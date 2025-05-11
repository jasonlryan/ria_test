/**
 * Retrieval Adapter
 *
 * Provides adapters for retrieval.js to use the repository pattern.
 * Maintains backward compatibility with existing function signatures.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#retrieval-adapter
 * - Analysis: ../analysis/Consolidated-Analysis.md#3-adapter-implementation
 * - Related: ../implementations/FileSystemRepository.ts
 * - Related: ../implementations/QueryProcessorImpl.ts
 *
 * Last Updated: Mon May 06 2025
 */

import { FileRepository, QueryProcessor, QueryContext, FileIdentificationResult } from '../interfaces';
import { FileSystemRepository, QueryProcessorImpl, PromptRepository } from '../implementations';
import logger from '../../../shared/logger';
import { startTimer, endTimer, recordError } from '../monitoring';
import { QueryContext as QueryContextImpl } from '../implementations/QueryContext';
import path from 'path';
import { DEFAULT_SEGMENTS } from '../../../../utils/cache/segment_keys';
import { SmartFilteringProcessor } from '../implementations/SmartFiltering';

// Import utility functions from the TypeScript implementation
import {
  getPrecompiledStarterData,
  isStarterQuestion,
  detectComparisonQuery
} from '../../../../utils/openai/starterHelpers';

/**
 * Feature flags and rollout configuration - FORCED to true for repository pattern
 */
// Setting environment variables directly in code
const USE_REPOSITORY_PATTERN = true; // Forced to true
const SHADOW_MODE = false; // Disabled shadow mode
const TRAFFIC_PERCENTAGE = 100; // 100% traffic to repository
const ENABLE_RETRIEVAL_ADAPTER = true; // Forced to true

// Guard against recursive calls
const CALL_STACK = new Set<string>();

/**
 * Helper to determine if a request should use the repository implementation
 * based on feature flags and traffic percentage
 * 
 * @param threadId Thread ID for consistent user experience
 * @returns Boolean indicating whether to use repository implementation
 */
function shouldUseRepositoryImplementation(threadId?: string): boolean {
  // Always use repository implementation
  return true;
}

/**
 * Create default repository instances if none provided
 * 
 * @returns Object with repository and processor
 */
function getDefaultImplementations() {
  // Use PromptRepository so that identifyRelevantFiles still leverages 1_data_retrieval.md
  const repository = new PromptRepository();
  const processor = new QueryProcessorImpl(repository);
  
  return { repository, processor };
}

/**
 * Identifies relevant files based on a query
 * @param {string} query - The user query
 * @param {object} options - Original options object
 * @param {boolean} isFollowUp - Whether this is a follow-up query
 * @param {string} previousQuery - The previous query if any
 * @param {string} previousAssistantResponse - The previous assistant response if any
 * @returns {Promise<object>} Object with file_ids and metadata
 */
export async function identifyRelevantFiles(
  query: string, 
  options: any = {},
  isFollowUp: boolean = false,
  previousQuery: string = "",
  previousAssistantResponse: string = ""
) {
  try {
    // Always use repository implementation
    logger.info(`[ADAPTER] identifyRelevantFiles called - always using repository implementation`);
    
    // Start timer for repository implementation
    const repoTimer = startTimer('repository', 'identifyRelevantFiles', {
      threadId: options.threadId,
      queryLength: query?.length || 0
    });
    
    try {
      // Map options to QueryContext
      const context = mapToQueryContext(query, options);
      
      // Add follow-up context
      context.isFollowUp = isFollowUp;
      context.previousQuery = previousQuery;
      context.previousResponse = previousAssistantResponse;
      
      // Use repository implementation
      logger.info(`[ADAPTER] Using repository implementation for identifyRelevantFiles`);
      const { repository: fileRepository } = getDefaultImplementations();
      const result = await fileRepository.getFilesByQuery(context);
      
      // Format result to match original API format
      const formattedResult = formatResult(result);
      logger.info(`[ADAPTER] Formatted result from repository: ${JSON.stringify(formattedResult.file_ids)}`);
      
      // ===== COMPATIBILITY GATE =====
      try {
        // Import compatibility utilities
        const { lookupFiles, getComparablePairs } = await import('../../../compatibility/compatibility');
        
        // Decide if the user intent or resulting file set implies a year-comparison
        const distinctYearsInSet = new Set<number>();
        const rawYearsInSet: (number | undefined)[] = [];

        // Temporary array to capture potential NaN issues
        const numericYears: number[] = [];

        // Enrich with compatibility metadata ONCE
        const fileMeta = lookupFiles(formattedResult.file_ids);
        fileMeta.forEach(f => {
          rawYearsInSet.push(f.year);
          if (!isNaN(f.year)) distinctYearsInSet.add(f.year);
          if (!isNaN(f.year)) numericYears.push(f.year);
        });

        const hasMultipleYears = distinctYearsInSet.size > 1;

        const isComparison = formattedResult.isComparisonQuery === true
                          || detectComparisonQuery(query) // explicit wording
                          || hasMultipleYears; // implicit because 2+ years selected
        
        if (formattedResult.file_ids && formattedResult.file_ids.length > 0) {
          // ====================================
          // CASE A – NOT a comparison query
          // ====================================
          if (!isComparison) {
            // Always use the latest *numeric* year present in the set
            const latestYear = numericYears.includes(2025) ? 2025 : Math.max(...numericYears);

            if (isNaN(latestYear)) {
              logger.warn('[COMPATIBILITY GATE] Could not determine latest year – abandoning default-year filter');
            }

            const originalIds = [...formattedResult.file_ids];
            formattedResult.file_ids = fileMeta
                .filter(f => f.year === latestYear)
                .map(f => f.fileId);
                
            logger.info(`[COMPATIBILITY GATE] Non-comparison query → default to ${latestYear}. Years present: ${Array.from(distinctYearsInSet).join(',')}. Kept ${formattedResult.file_ids.length}/${originalIds.length} files.`);
          }
          // ====================================
          // CASE B – Comparison query
          // ====================================
          else {
            const compatResult = getComparablePairs(fileMeta);
            
            if (compatResult.invalid.length > 0) {
              // incompatible → let controller return 409 / user-message
              formattedResult.incompatible = true;
              formattedResult.incompatibleMessage = compatResult.message || 'Files/topics not comparable';
              logger.warn(`[COMPATIBILITY GATE] Comparison blocked. Non-comparable files: ${compatResult.invalid.join(', ')}`);
              
              // Keep only valid files if any
              if (compatResult.valid.length > 0) {
                formattedResult.file_ids = compatResult.valid;
              }
            } else {
              logger.info('[COMPATIBILITY GATE] Comparison allowed – files are compatible');
            }
          }
          
          // Store metadata for downstream use
          formattedResult.fileMetadata = fileMeta;
        }
      } catch (compatError) {
        logger.error(`[COMPATIBILITY GATE] Error applying compatibility gate: ${compatError instanceof Error ? compatError.message : String(compatError)}`);
      }
      
      // End timer with success status
      endTimer(repoTimer, true, { 
        fileCount: formattedResult?.file_ids?.length || 0,
        relevantFilesCount: result?.relevantFiles?.length || 0
      });
      logger.info(`[METRICS] Recorded repository identifyRelevantFiles: ${result?.relevantFiles?.length || 0} files in ${performance.now() - repoTimer.startTime}ms`);
      
      return formattedResult;
    } catch (error) {
      // Record error and end timer
      recordError('repository', 'identifyRelevantFiles');
      endTimer(repoTimer, false, { error: error.message });
      logger.error(`[METRICS] Recorded repository identifyRelevantFiles error: ${error.message}`);
      logger.error(`[ADAPTER] Error in identifyRelevantFiles: ${error.message}`);
      
      // Re-throw error since we're not using fallback
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in identifyRelevantFiles adapter: ${error.message}`);
    recordError('adapter', 'identifyRelevantFiles');
    throw error;
  }
}

// Helper to determine if we should use the repository based on traffic percentage
function determineIfShouldUseRepository() {
  // Always use repository implementation
  return true;
}

// Map options from old format to QueryContext
function mapToQueryContext(query: string, options: any): QueryContext {
  // Create a new context with the query
  return new QueryContextImpl({
    query,
    threadId: options.threadId || 'default',
    isFollowUp: options.isFollowUp || false,
    previousQuery: options.previousQuery || '',
    previousResponse: options.previousResponse || '',
    // Add other context properties as needed
  });
}

// Function to format the result from repository format to the original format expected by clients
function formatResult(result: any): any {
  if (!result) {
    return { file_ids: [], matched_topics: [], explanation: "No results from repository" };
  }

  return {
    file_ids: result.relevantFiles || [],
    matched_topics: result.matchedTopics || [],
    explanation: result.explanation || "Files identified by repository",
    segments: result.segments || DEFAULT_SEGMENTS,
    fileMetadata: result.fileMetadata || [],
    isComparisonQuery: result.isComparisonQuery || false,
    detectedYears: result.detectedYears || []
  };
}

// Use repository pattern for data files retrieval
export async function retrieveDataFiles(fileIds: string[]) {
  try {
    logger.info(`[ADAPTER] retrieveDataFiles called - always using repository implementation`);
    
    // Start timer
    const timer = startTimer('repository', 'retrieveDataFiles', { fileCount: fileIds.length });
    
    try {
      const { repository } = getDefaultImplementations();
      // Use correct method name from FileRepository interface
      const result = await repository.getFilesByIds(fileIds);
      
      // End timer with success
      endTimer(timer, true, { filesRetrieved: result.length });
      
      // Debug log the file structure to identify where responses are
      result.forEach((file: any, idx: number) => {
        // Avoid logging massive response content
        const hasResponses = Array.isArray(file.responses);
        const responseCount = hasResponses ? file.responses.length : 0;
        logger.info(`[ADAPTER] File ${file.id}: responses=${hasResponses}, count=${responseCount}`);
      });
      
      logger.info(`[ADAPTER] Successfully retrieved ${result.length} files from repository`);
      return result;
    } catch (error) {
      // End timer with failure
      endTimer(timer, false, { error: error.message });
      logger.error(`[ADAPTER] Error retrieving files: ${error.message}`);
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in retrieveDataFiles: ${error.message}`);
    recordError('adapter', 'retrieveDataFiles');
    throw error;
  }
}

// Helper functions
function extractTopics(files: any[]): string[] {
  const topics = new Set<string>();
  
  files.forEach(file => {
    if (file.metadata && file.metadata.topic) {
      topics.add(file.metadata.topic);
    }
    if (file.topic) {
      topics.add(file.topic);
    }
  });
  
  return Array.from(topics);
}

function countDataPoints(files: any[]): number {
  let count = 0;
  
  files.forEach(file => {
    if (file.data && file.data.stats) {
      count += file.data.stats.length;
    } else if (file.stats) {
      count += file.stats.length;
    }
  });
  
  return count;
}

/**
 * Process a query with data
 * @param {string} query - The user query
 * @param {string} context - The context (e.g., 'all-sector')
 * @param {string[]} cachedFileIds - Previously identified file IDs
 * @param {string} threadId - The thread ID
 * @param {boolean} isFollowUp - Whether this is a follow-up query
 * @param {string} previousQuery - The previous query
 * @param {string} previousAssistantResponse - The previous assistant response
 * @returns {Promise<object>} The processed data result
 */
export async function processQueryWithData(
  query: string,
  context: string = "all-sector",
  cachedFileIds: string[] = [],
  threadId: string = "default",
  isFollowUp: boolean = false,
  previousQuery: string = "",
  previousAssistantResponse: string = "",
  customProcessor?: QueryProcessor
) {
  try {
    logger.info(`[ADAPTER] processQueryWithData called - always using repository implementation`);
    
    // Start timer
    const timer = startTimer('repository', 'processQueryWithData');
    
    try {
      // Map options to QueryContext
      const queryContext = new QueryContextImpl({
        query,
        threadId: threadId,
        isFollowUp: isFollowUp,
        previousQuery: previousQuery,
        previousResponse: previousAssistantResponse,
        cachedFileIds: cachedFileIds,
      });
      
      // Use provided processor or get default
      const processor = customProcessor || getDefaultImplementations().processor;
      // Use correct method name from QueryProcessor interface
      const result = await processor.processQueryWithData(queryContext);
      
      // End timer with success
      endTimer(timer, true);
      
      logger.info(`[ADAPTER] Successfully processed query with repository`);
      
      // Add legacy v2 contract fields for backward compatibility
      const processedData = result.processedData || [];
      const relevantFiles = result.relevantFiles || [];
      
      /**
       * STEP 1 – Load full file data (segments & responses) if not already available
       * -------------------------------------------------------------------------
       * SmartFiltering requires each file to expose either `segments` or
       * `data.responses` structure.  `relevantFiles` coming from the
       * QueryProcessorImpl may only contain file‐level metadata (ids). We need
       * to ensure the complete file objects are in memory before filtering.
       */
      let dataFiles: any[] = [];
      if (relevantFiles.length > 0) {
        const idsToLoad = relevantFiles.map((f: any) => (typeof f === 'string' ? f : f.id));
        dataFiles = await retrieveDataFiles(idsToLoad);
        logger.info(`[ADAPTER] Loaded ${dataFiles.length} files for SmartFiltering`);
      }

      /**
       * STEP 2 – Work out which segments to include
       * -------------------------------------------
       * If the query explicitly asked for certain segments (tracked inside
       * QueryContext.segmentTracking.requestedSegments) we keep those; otherwise we
       * fall back to the DEFAULT_SEGMENTS constant (overall, region, age, gender, ...)
       */
      const requestedSegments: string[] = (queryContext.segmentTracking?.requestedSegments &&
        queryContext.segmentTracking.requestedSegments.length > 0)
        ? queryContext.segmentTracking.requestedSegments
        : DEFAULT_SEGMENTS;

      /**
       * STEP 3 – Run SmartFilteringProcessor to obtain filtered stats
       */
      let stats: any[] = [];
      if (dataFiles.length > 0) {
        const sfProcessor = new SmartFilteringProcessor();
        try {
          // Create a consistent context object for the processor
          const filterContext = {
            ...queryContext,
            segments: requestedSegments
          };
          
          // Direct call to SmartFilteringProcessor with DataFile[] array
          const filterRes = sfProcessor.filterDataBySegments(dataFiles, filterContext);
          stats = filterRes.stats || filterRes.filteredData || [];
          logger.info(`[ADAPTER] SmartFiltering produced ${stats.length} stats (segments used: ${requestedSegments.join(', ')})`);
        } catch (sfErr) {
          logger.error(`[ADAPTER] SmartFiltering error: ${sfErr instanceof Error ? sfErr.message : String(sfErr)}`);
        }
      } else {
        logger.warn(`[ADAPTER] No file data available for SmartFiltering – stats array will be empty`);
      }
      
      const filesActuallyUsedIds = dataFiles.map(df => df.id);

      const enhancedResult = {
        processedData: Array.isArray(processedData) ? processedData : [],
        stats,
        enhancedContext: [],
        relevantFiles: dataFiles.length > 0 ? dataFiles : relevantFiles,
        files_used: filesActuallyUsedIds,
        isComparison: result.isComparison || false,
        dataVersion: 2,
        metrics: {}
      };
      
      return enhancedResult;
    } catch (error) {
      // End timer with failure
      endTimer(timer, false, { error: error.message });
      logger.error(`[ADAPTER] Error processing query: ${error.message}`);
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in processQueryWithData: ${error.message}`);
    recordError('adapter', 'processQueryWithData');
    throw error;
  }
}

// Export these functions directly (no need to reassign)
export { getPrecompiledStarterData, isStarterQuestion, detectComparisonQuery };

export default {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery
}; 