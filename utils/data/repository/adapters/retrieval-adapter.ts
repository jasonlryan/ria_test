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

/**
 * Feature flags and rollout configuration
 */
const USE_REPOSITORY_PATTERN = process.env.USE_REPOSITORY_PATTERN === 'true';
const SHADOW_MODE = process.env.REPOSITORY_SHADOW_MODE === 'true';
const TRAFFIC_PERCENTAGE = parseInt(process.env.REPOSITORY_TRAFFIC_PERCENTAGE || '0', 10);
const ENABLE_RETRIEVAL_ADAPTER = process.env.ENABLE_RETRIEVAL_ADAPTER === 'true';

/**
 * Helper to determine if a request should use the repository implementation
 * based on feature flags and traffic percentage
 * 
 * @param threadId Thread ID for consistent user experience
 * @returns Boolean indicating whether to use repository implementation
 */
function shouldUseRepositoryImplementation(threadId?: string): boolean {
  // Adapter-specific flag has priority (can enable/disable just this adapter)
  if (ENABLE_RETRIEVAL_ADAPTER === false) {
    return false;
  }
  
  // If feature flag is explicitly off, don't use repository
  if (!USE_REPOSITORY_PATTERN) {
    return false;
  }
  
  // If no traffic percentage is set, rely only on the main feature flag
  if (TRAFFIC_PERCENTAGE <= 0) {
    return USE_REPOSITORY_PATTERN;
  }
  
  // For consistent user experience, use threadId hash to determine
  // if this user/thread should get repository implementation
  if (threadId) {
    // Simple hash function to get a number between 0-99
    const hash = threadId.split('').reduce((acc, char) => {
      return (acc + char.charCodeAt(0)) % 100;
    }, 0);
    
    // Use repository for the specified percentage of traffic
    return hash < TRAFFIC_PERCENTAGE;
  }
  
  // If no threadId, use random assignment
  return Math.random() * 100 < TRAFFIC_PERCENTAGE;
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
 * Adapter for identifyRelevantFiles in retrieval.js
 * 
 * @param query User query
 * @param options Additional options
 * @param customRepository Optional custom repository instance
 * @returns Array of relevant file IDs
 */
export async function identifyRelevantFiles(
  query: string,
  options: any = {},
  customRepository?: FileRepository
) {
  // Determine if this request should use repository implementation
  const useRepository = shouldUseRepositoryImplementation(options.threadId);
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] identifyRelevantFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'identifyRelevantFiles', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  let originalResult;
  try {
    const { identifyRelevantFiles } = await import('../../../openai/retrieval');
    originalResult = await identifyRelevantFiles(query, options);
    endTimer(originalTimer, true, { filesProcessed: originalResult?.length || 0 });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'identifyRelevantFiles');
    logger.error(`[ADAPTER] Error in original identifyRelevantFiles: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'identifyRelevantFiles', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  try {
    // Create or use repository
    const { repository } = customRepository 
      ? { repository: customRepository } 
      : getDefaultImplementations();
    
    // Create context from options
    const context: QueryContext = {
      query,
      isFollowUp: options.isFollowUp || false,
      threadId: options.threadId,
      previousQuery: options.previousQuery,
      previousResponse: options.previousResponse
    };
    
    // Call repository method
    const repoResult = await repository.getFilesByQuery(context);
    endTimer(repoTimer, true, { filesProcessed: repoResult.relevantFiles.length || 0 });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] identifyRelevantFiles comparison - original: ${originalResult.length} files, repository: ${repoResult.relevantFiles.length} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return repoResult.relevantFiles;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'identifyRelevantFiles');
    logger.error(`[ADAPTER] Error in repository identifyRelevantFiles: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

/**
 * Adapter for retrieveDataFiles in retrieval.js
 * 
 * @param fileIds Array of file IDs
 * @param customRepository Optional custom repository instance
 * @returns Array of file data
 */
export async function retrieveDataFiles(
  fileIds: string[],
  customRepository?: FileRepository
) {
  const useRepository = shouldUseRepositoryImplementation();
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] retrieveDataFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'retrieveDataFiles', { 
    queryLength: fileIds.length
  });
  
  let originalResult;
  try {
    const { retrieveDataFiles } = await import('../../../openai/retrieval');
    originalResult = await retrieveDataFiles(fileIds);
    endTimer(originalTimer, true, { filesProcessed: fileIds.length });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'retrieveDataFiles');
    logger.error(`[ADAPTER] Error in original retrieveDataFiles: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'retrieveDataFiles', { 
    queryLength: fileIds.length
  });
  
  try {
    // Create or use repository
    const { repository } = customRepository 
      ? { repository: customRepository } 
      : getDefaultImplementations();
    
    // Call repository method
    const repoResult = await repository.getFilesByIds(fileIds);
    endTimer(repoTimer, true, { filesProcessed: fileIds.length });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] retrieveDataFiles comparison - original: ${originalResult.length} files, repository: ${repoResult.length} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return repoResult;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'retrieveDataFiles');
    logger.error(`[ADAPTER] Error in repository retrieveDataFiles: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
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