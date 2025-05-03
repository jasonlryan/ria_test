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
 * Last Updated: Sat May 3 2025
 */

import { FileRepository, QueryProcessor, QueryContext, FileIdentificationResult } from '../interfaces';
import { FileSystemRepository, QueryProcessorImpl } from '../implementations';
import logger from '../../../shared/logger';
import { startTimer, endTimer, recordError } from '../monitoring';
import { QueryContext as QueryContextImpl } from '../implementations/QueryContext';

/**
 * Feature flags and rollout configuration
 */
const USE_REPOSITORY_PATTERN = process.env.USE_REPOSITORY_PATTERN === 'true';
const SHADOW_MODE = process.env.REPOSITORY_SHADOW_MODE === 'true';
const TRAFFIC_PERCENTAGE = parseInt(process.env.REPOSITORY_TRAFFIC_PERCENTAGE || '0', 10);
const ENABLE_RETRIEVAL_ADAPTER = process.env.ENABLE_RETRIEVAL_ADAPTER === 'true';

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
  if (!USE_REPOSITORY_PATTERN) return false;
  if (!ENABLE_RETRIEVAL_ADAPTER) return false;
  
  // Base decision on traffic percentage for non-shadow mode
  if (!SHADOW_MODE && TRAFFIC_PERCENTAGE < 100) {
    const random = Math.floor(Math.random() * 100);
    return random < TRAFFIC_PERCENTAGE;
  }
  
  return !SHADOW_MODE && USE_REPOSITORY_PATTERN && ENABLE_RETRIEVAL_ADAPTER;
}

/**
 * Create default repository instances if none provided
 * 
 * @returns Object with repository and processor
 */
function getDefaultImplementations() {
  const repository = new FileSystemRepository();
  const processor = new QueryProcessorImpl(repository);
  
  return { repository, processor };
}

/**
 * Identifies relevant files based on a query
 * @param {string} query - The user query
 * @param {object} options - Original options object
 * @returns {Promise<object>} Object with file_ids and metadata
 */
export async function identifyRelevantFiles(query: string, options: any = {}) {
  try {
    // Calculate if this request should use the repository implementation
    const useRepository = shouldUseRepositoryImplementation(options.threadId);
    const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
    
    logger.info(`[ADAPTER] identifyRelevantFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
    
    if (!useRepository) {
      // Call original implementation with the flag to prevent recursive calls
      logger.info(`[ADAPTER] Using original implementation for identifyRelevantFiles`);
      
      // Start timer for original implementation
      const timer = startTimer('original', 'identifyRelevantFiles', { 
        threadId: options.threadId,
        queryLength: query?.length || 0
      });
      
      try {
        const { identifyRelevantFiles } = await import('../../../openai/retrieval');
        const result = await identifyRelevantFiles(query, options, false, "", "", true); // true = _isAdapterCall
        
        // End timer with success status
        endTimer(timer, true, { fileCount: result?.file_ids?.length || 0 });
        logger.info(`[METRICS] Recorded original identifyRelevantFiles: ${result?.file_ids?.length || 0} files in ${performance.now() - timer.startTime}ms`);
        
        return result;
      } catch (error) {
        // Record error and end timer
        recordError('original', 'identifyRelevantFiles');
        endTimer(timer, false, { error: error.message });
        logger.error(`[METRICS] Recorded original identifyRelevantFiles error: ${error.message}`);
        throw error;
      }
    }
    
    // Start timer for repository implementation
    const repoTimer = startTimer('repository', 'identifyRelevantFiles', {
      threadId: options.threadId,
      queryLength: query?.length || 0
    });
    
    try {
      // Map options to QueryContext
      const context = mapToQueryContext(query, options);
      
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
      // Fallback to original implementation
      logger.warn(`[FALLBACK] Using original identifyRelevantFiles implementation`);
      
      // Start timer for fallback operation
      const fallbackTimer = startTimer('original', 'identifyRelevantFiles_fallback');
      
      try {
        // Import here to prevent circular dependencies
        const originalImplementation = await import('../../../openai/retrieval');
        const result = await originalImplementation.identifyRelevantFiles(query, options);
        
        // End fallback timer with success
        endTimer(fallbackTimer, true);
        logger.info(`[METRICS] Recorded fallback identifyRelevantFiles success`);
        
        return result;
      } catch (fallbackError) {
        // Record fallback error
        recordError('original', 'identifyRelevantFiles_fallback');
        endTimer(fallbackTimer, false, { error: fallbackError.message });
        logger.error(`[METRICS] Recorded fallback identifyRelevantFiles error: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
  } catch (error) {
    logger.error(`[ADAPTER] Unhandled error in identifyRelevantFiles adapter: ${error.message}`);
    recordError('adapter', 'identifyRelevantFiles');
    
    // Last resort fallback
    const { identifyRelevantFiles } = await import('../../../openai/retrieval');
    return identifyRelevantFiles(query, options);
  }
}

// Helper to determine if we should use the repository based on traffic percentage
function determineIfShouldUseRepository() {
  if (!USE_REPOSITORY_PATTERN) return false;
  if (SHADOW_MODE) return false;
  
  // Random percentage-based routing
  if (TRAFFIC_PERCENTAGE < 100) {
    const random = Math.floor(Math.random() * 100);
    return random < TRAFFIC_PERCENTAGE;
  }
  
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

// Format repository result back to original API format
function formatResult(result: any): any {
  // The original API expects an object with file_ids, not just an array of IDs
  if (!result || !result.relevantFiles) return { file_ids: [] };
  
  // Create a result that matches the format expected by the original implementation
  return {
    file_ids: result.relevantFiles,
    matched_topics: result.matchedTopics || [],
    explanation: result.explanation || "Files identified by repository implementation",
    segments: result.detectedSegments || ["region", "age", "gender"],
    out_of_scope: false
  };
}

/**
 * Retrieve data files based on file IDs
 * @param {string[]} fileIds - Array of file IDs
 * @returns {Promise<object>} Retrieved data
 */
export async function retrieveDataFiles(fileIds: string[]) {
  try {
    // Calculate if this request should use the repository implementation
    const useRepository = shouldUseRepositoryImplementation();
    const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
    
    logger.info(`[ADAPTER] retrieveDataFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
    
    if (!useRepository) {
      // Call original implementation with the flag to prevent recursive calls
      logger.info(`[ADAPTER] Using original implementation for retrieveDataFiles`);
      const { retrieveDataFiles } = await import('../../../openai/retrieval');
      return retrieveDataFiles(fileIds, true); // true = _isAdapterCall
    }
    
    // Use repository implementation
    logger.info(`[ADAPTER] Using repository implementation for retrieveDataFiles`);
    const { repository: fileRepository } = getDefaultImplementations();
    const result = await fileRepository.getFilesByIds(fileIds);
    
    // Format result back to original format expected by consumers
    return {
      files: result,
      topics: extractTopics(result),
      totalDataPoints: countDataPoints(result),
    };
  } catch (error) {
    logger.error(`[ADAPTER] Error in retrieveDataFiles: ${error.message}`);
    // Fallback to original implementation
    logger.warn(`[FALLBACK] Using original retrieveDataFiles implementation`);
    
    // Import here to prevent circular dependencies
    const originalImplementation = await import('../../../openai/retrieval');
    return originalImplementation.retrieveDataFiles(fileIds);
  }
}

// Helper to extract topics from files
function extractTopics(files: any[]): string[] {
  const topics = new Set<string>();
  
  files.forEach(file => {
    if (file.topic) {
      topics.add(file.topic);
    }
  });
  
  return Array.from(topics);
}

// Helper to count data points
function countDataPoints(files: any[]): number {
  let count = 0;
  
  files.forEach(file => {
    if (file.data) {
      if (Array.isArray(file.data)) {
        count += file.data.length;
      } else if (typeof file.data === 'object') {
        count += 1;
      }
    }
  });
  
  return count;
}

/**
 * Adapter for processQueryWithData in retrieval.js
 * 
 * @param query User query
 * @param options Additional options
 * @param customProcessor Optional custom processor instance
 * @returns Processed query result
 */
export async function processQueryWithData(
  query: string,
  options: any = {},
  customProcessor?: QueryProcessor
) {
  const useRepository = shouldUseRepositoryImplementation(options.threadId);
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] processQueryWithData called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'processQueryWithData', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  let originalResult;
  try {
    const { processQueryWithData } = await import('../../../openai/retrieval');
    originalResult = await processQueryWithData(query, options);
    endTimer(originalTimer, true, { 
      filesProcessed: originalResult?.relevantFiles?.length || 0 
    });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'processQueryWithData');
    logger.error(`[ADAPTER] Error in original processQueryWithData: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'processQueryWithData', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  try {
    // Create or use processor
    const { processor } = customProcessor 
      ? { processor: customProcessor } 
      : getDefaultImplementations();
    
    // Create context from options
    const context: QueryContext = {
      query,
      isFollowUp: options.isFollowUp || false,
      threadId: options.threadId,
      previousQuery: options.previousQuery,
      previousResponse: options.previousResponse,
      cachedFileIds: options.cachedFileIds || []
    };
    
    // Call processor method
    const repoResult = await processor.processQueryWithData(context);
    endTimer(repoTimer, true, { 
      filesProcessed: repoResult?.relevantFiles?.length || 0 
    });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] processQueryWithData comparison - original: ${originalResult?.relevantFiles?.length || 0} files, repository: ${repoResult?.relevantFiles?.length || 0} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return repoResult;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'processQueryWithData');
    logger.error(`[ADAPTER] Error in repository processQueryWithData: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

export default {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData
}; 