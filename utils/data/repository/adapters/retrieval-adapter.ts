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

import { FileRepository, QueryProcessor, QueryContext, FileIdentificationResult, DataFile } from '../interfaces';
import { FileSystemRepository, QueryProcessorImpl, PromptRepository } from '../implementations';
import logger from '../../../shared/logger';
import { QueryContext as QueryContextImpl } from '../implementations/QueryContext';
import path from 'path';
import { DEFAULT_SEGMENTS } from '../../../../utils/cache/segment_keys';
import { SmartFilteringProcessor } from '../implementations/SmartFiltering';
import kvClient from '../../../cache/kvClient'; // CORRECTED Import

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
    
    // Start processing for repository implementation
    
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
      
      // Processing succeeded
      
      return formattedResult;
    } catch (error) {
      // Log error during processing
      logger.error(`[ADAPTER] identifyRelevantFiles error: ${error.message}`);
      logger.error(`[ADAPTER] Error in identifyRelevantFiles: ${error.message}`);
      
      // Re-throw error since we're not using fallback
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in identifyRelevantFiles adapter: ${error.message}`);
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
    
    // Begin retrieving files
    
    try {
      const { repository } = getDefaultImplementations();
      // Use correct method name from FileRepository interface
      const result = await repository.getFilesByIds(fileIds);
      
      // Retrieval successful
      
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
      logger.error(`[ADAPTER] Error retrieving files: ${error.message}`);
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in retrieveDataFiles: ${error.message}`);
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
    // Start repository query processing
    
    try {
      const queryContext = new QueryContextImpl({
        query,
        threadId,
        isFollowUp,
        previousQuery,
        previousResponse: previousAssistantResponse,
        cachedFileIds: cachedFileIds,
      });
      
      logger.debug('[ADAPTER_PROCESS_QUERY_DATA_INPUT] queryContext.cachedFileIds:', queryContext.cachedFileIds);
      const processor = customProcessor || getDefaultImplementations().processor;
      const result = await processor.processQueryWithData(queryContext);
      
      logger.info(`[ADAPTER] Successfully processed query with repository`);
      
      const processedData = result.processedData || [];
      const relevantFiles = result.relevantFiles || [];
      
      let dataFiles: DataFile[] = [];
      if (relevantFiles.length > 0) {
        const idsToLoad = relevantFiles.map((f: any) => (typeof f === 'string' ? f : f.id));
        dataFiles = await retrieveDataFiles(idsToLoad) as DataFile[];
        logger.info(`[ADAPTER] Loaded ${dataFiles.length} files for SmartFiltering`);
      }

      const baseRequestedSegments: string[] = (queryContext.segmentTracking?.requestedSegments &&
        queryContext.segmentTracking.requestedSegments.length > 0)
        ? queryContext.segmentTracking.requestedSegments
        : DEFAULT_SEGMENTS;

      let combinedStats: any[] = [];
      const RAW_SEGMENTS_CACHE_TTL = 60 * 60 * 24 * 7;
      const STATS_CACHE_TTL = 60 * 60 * 24;

      const statsServedFromCache: any[] = [];
      const filesAndSegmentsForProcessing: { file: DataFile; segments: string[] }[] = [];

      if (dataFiles.length > 0) {
        for (const dataFile of dataFiles) {
          const segmentsToPotentiallyProcessForFile: string[] = [];
          for (const segmentId of baseRequestedSegments) {
            const cacheKey = `stats:${dataFile.id}:${segmentId}`;
            try {
              const cachedSegmentStatsJson = await kvClient.get<string>(cacheKey);
              if (cachedSegmentStatsJson) {
                const cachedSegmentStats = JSON.parse(cachedSegmentStatsJson);
                if (Array.isArray(cachedSegmentStats) && cachedSegmentStats.length > 0) {
                  statsServedFromCache.push(...cachedSegmentStats);
                  logger.info(`[ADAPTER_CACHE_HIT] Served stats for file ${dataFile.id}, segment ${segmentId} from cache.`);
                } else {
                  segmentsToPotentiallyProcessForFile.push(segmentId);
                }
              } else {
                segmentsToPotentiallyProcessForFile.push(segmentId);
              }
            } catch (cacheError) {
              logger.error(`[ADAPTER_CACHE_READ_ERROR] Error reading stats cache for file ${dataFile.id}, segment ${segmentId}: ${cacheError.message}`);
              segmentsToPotentiallyProcessForFile.push(segmentId);
            }
          }
          if (segmentsToPotentiallyProcessForFile.length > 0) {
            filesAndSegmentsForProcessing.push({ file: dataFile, segments: segmentsToPotentiallyProcessForFile });
          }
        }
      }
      
      let statsFromProcessing: any[] = [];
      if (filesAndSegmentsForProcessing.length > 0) {
        const filesToFilter = filesAndSegmentsForProcessing.map(item => item.file);
        const segmentsForSfProcessor = new Set<string>();
        filesAndSegmentsForProcessing.forEach(item => item.segments.forEach(seg => segmentsForSfProcessor.add(seg)));

        if (filesToFilter.length > 0 && segmentsForSfProcessor.size > 0) {
            const sfProcessor = new SmartFilteringProcessor();
            try {
            const filterContextForProcessing = {
                ...queryContext,
                segments: Array.from(segmentsForSfProcessor)
            };
            
            const filterRes = sfProcessor.filterDataBySegments(filesToFilter, filterContextForProcessing);
            statsFromProcessing = filterRes.stats || filterRes.filteredData || [];
            logger.info(`[ADAPTER] SmartFiltering (post-cache check) produced ${statsFromProcessing.length} new stats.`);

            if (filterRes.allAvailableSegmentsInFiles) {
                for (const fileId in filterRes.allAvailableSegmentsInFiles) {
                    const rawSegments = filterRes.allAvailableSegmentsInFiles[fileId];
                    const cacheKeyMeta = `filemeta:${fileId}:available_raw_segments`;
                    try {
                      await kvClient.set(cacheKeyMeta, JSON.stringify(rawSegments), { ex: RAW_SEGMENTS_CACHE_TTL });
                      logger.info(`[ADAPTER_CACHE] Cached available raw segments for file ${fileId}`);
                    } catch (cacheError) {
                      logger.error(`[ADAPTER_CACHE] Error caching available raw segments for file ${fileId}: ${cacheError.message}`);
                    }
                }
            }

            if (statsFromProcessing && statsFromProcessing.length > 0) {
                const groupedStats: Record<string, Record<string, any[]>> = {};
                statsFromProcessing.forEach((statItem: any) => { 
                if (statItem && statItem.fileId && statItem.category) {
                    if (!groupedStats[statItem.fileId]) groupedStats[statItem.fileId] = {};
                    if (!groupedStats[statItem.fileId][statItem.category]) groupedStats[statItem.fileId][statItem.category] = [];
                    groupedStats[statItem.fileId][statItem.category].push(statItem);
                }
                });
                for (const fileId in groupedStats) {
                for (const segmentId in groupedStats[fileId]) {
                    const segmentStatsToCache = groupedStats[fileId][segmentId];
                    const cacheKeyStats = `stats:${fileId}:${segmentId}`;
                    try {
                      // logger.debug(`[ADAPTER_CACHE_WRITE] Caching stats for ${cacheKeyStats}:`, segmentStatsToCache); // Keep original log for comparison
                      const jsonStringToCache = JSON.stringify(segmentStatsToCache);
                      logger.debug(`[ADAPTER_CACHE_WRITE_PRE_SET] Stringified stats for ${cacheKeyStats} (length: ${jsonStringToCache.length}, first 100 chars):`, jsonStringToCache.substring(0, 100));
                      if (jsonStringToCache === "\"[object Object]\"" || (jsonStringToCache.startsWith("\"") && !jsonStringToCache.startsWith("[{"))) { // More robust check for bad stringify
                          logger.error(`[ADAPTER_CACHE_WRITE_ERROR] Bad JSON stringify for ${cacheKeyStats}! Value: ${jsonStringToCache}. Original object:`, segmentStatsToCache);
                          // Potentially do not cache if stringification is bad, or try alternative stringifier
                      }
                      await kvClient.set(cacheKeyStats, jsonStringToCache, { ex: STATS_CACHE_TTL });
                      logger.info(`[ADAPTER_CACHE] Cached newly processed stats for file ${fileId}, segment ${segmentId}`);
                    } catch (cacheError) {
                      logger.error(`[ADAPTER_CACHE] Error caching newly processed stats for file ${fileId}, segment ${segmentId}: ${cacheError.message}`);
                    }
                }
                }
            }
            } catch (sfErr) {
            logger.error(`[ADAPTER] SmartFiltering error (post-cache check): ${sfErr instanceof Error ? sfErr.message : String(sfErr)}`);
            }
        } else {
          logger.info(`[ADAPTER] No further processing needed by SmartFiltering after cache check.`);
        }
      } else if (dataFiles.length > 0 && statsServedFromCache.length > 0) {
        logger.info(`[ADAPTER] All requested stats served from cache. No SmartFiltering needed.`);
      } else {
        logger.warn(`[ADAPTER] No data files to process and nothing served from cache.`);
      }
      
      combinedStats = [...statsServedFromCache, ...statsFromProcessing];
      logger.info(`[ADAPTER] Total combined stats (cache + processed): ${combinedStats.length}`);

      const filesActuallyUsedIds = dataFiles.map(df => df.id);
      const enhancedResult = {
        processedData: Array.isArray(processedData) ? processedData : [],
        stats: combinedStats,
        enhancedContext: [],
        relevantFiles: dataFiles.length > 0 ? dataFiles : relevantFiles,
        files_used: filesActuallyUsedIds,
        isComparison: result.isComparison || false,
        dataVersion: 2,
        metrics: {}
      };
      
      return enhancedResult;
    } catch (error) {
      logger.error(`[ADAPTER] Error processing query with repository: ${error.message}`);
      throw error;
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in processQueryWithData: ${error.message}`);
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