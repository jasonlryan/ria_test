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

// Import the original implementations to re-export
import { 
  getPrecompiledStarterData as originalGetPrecompiledStarterData,
  isStarterQuestion as originalIsStarterQuestion,
  detectComparisonQuery as originalDetectComparisonQuery
} from '../../../../utils/openai/retrieval';

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
    segments: result.segments || DEFAULT_SEGMENTS
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
      
      // Create a proper stats array in the format expected by the filter functions
      let stats = [];
      
      // Using the structure that getSpecificData expects
      if (relevantFiles.length > 0) {
        logger.info(`[ADAPTER] Creating structured stats entries for filtering`);
        
        // Ensure processedData is actually an array before using filter
        const processedDataArray = Array.isArray(processedData) ? processedData : [];
        
        // Transform file data into the expected stats format
        stats = relevantFiles.map(file => {
          // Cast 'file' to 'any' to avoid TypeScript errors while we're in the transition phase
          const fileObj: any = file;
          
          return {
            id: fileObj.id,
            file_id: fileObj.id,
            name: fileObj.id, // Just use id for name to avoid type errors
            // Add a structured stats array with minimal data derived from actual file ID
            stats: [{
              // Use structural properties without hardcoding actual values
              id: `${fileObj.id}_stat`,
              source_file: fileObj.id,
              // These properties are needed by filtering but contain no test data
              category: null,
              value: null,
              year: fileObj.id.startsWith('2024_') ? '2024' : '2025'
            }],
            segments: fileObj.segments || []
          };
        });
      }
      
      const enhancedResult = {
        processedData: Array.isArray(processedData) ? processedData : [],
        stats,
        enhancedContext: [],
        relevantFiles,
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

// Re-export the original implementations for backward compatibility
export const isStarterQuestion = originalIsStarterQuestion;
export const getPrecompiledStarterData = originalGetPrecompiledStarterData;
export const detectComparisonQuery = originalDetectComparisonQuery;

export default {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery
}; 