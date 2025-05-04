/**
 * Service Adapter
 *
 * Provides adapters for dataRetrievalService.js to use the repository pattern.
 * Maintains backward compatibility with existing service methods.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#service-adapter
 * - Analysis: ../analysis/Consolidated-Analysis.md#3-adapter-implementation
 * - Related: ../implementations/FileSystemRepository.ts
 * - Related: ../implementations/QueryProcessorImpl.ts
 *
 * Last Updated: Sat May 3 2025
 */

import { FileRepository, QueryProcessor, QueryContext, SegmentTrackingData } from '../interfaces';
import { FileSystemRepository, QueryProcessorImpl, PromptRepository } from '../implementations';
import { ThreadCacheManager } from '../implementations/ThreadCacheManager';
import logger from '../../../shared/logger';
import { startTimer, endTimer, recordError } from '../monitoring';

/**
 * Feature flags and rollout configuration
 */
const USE_REPOSITORY_PATTERN = process.env.USE_REPOSITORY_PATTERN === 'true';
const SHADOW_MODE = process.env.REPOSITORY_SHADOW_MODE === 'true';
const TRAFFIC_PERCENTAGE = parseInt(process.env.REPOSITORY_TRAFFIC_PERCENTAGE || '0', 10);
const ENABLE_SERVICE_ADAPTER = process.env.ENABLE_SERVICE_ADAPTER === 'true';

// Instance of the original service
let originalServiceInstance: any = null;

/**
 * Get original service instance (lazy initialization)
 */
async function getOriginalService() {
  if (!originalServiceInstance) {
    const DataRetrievalService = (await import('../../../../app/api/services/dataRetrievalService')).default;
    originalServiceInstance = new DataRetrievalService();
  }
  return originalServiceInstance;
}

/**
 * Helper to determine if a request should use the repository implementation
 * based on feature flags and traffic percentage
 * 
 * @param threadId Thread ID for consistent user experience
 * @returns Boolean indicating whether to use repository implementation
 */
function shouldUseRepositoryImplementation(threadId?: string): boolean {
  // Adapter-specific flag has priority (can enable/disable just this adapter)
  if (ENABLE_SERVICE_ADAPTER === false) {
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
 * @returns Object with repository, processor, and cacheManager
 */
function getDefaultImplementations() {
  // Use PromptRepository so file identification relies on the canonical prompt
  const repository = new PromptRepository();
  const processor = new QueryProcessorImpl(repository);
  const cacheManager = new ThreadCacheManager(repository);
  
  return { repository, processor, cacheManager };
}

/**
 * Adapter for identifyRelevantFiles in dataRetrievalService.js
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
  
  logger.info(`[ADAPTER] Service identifyRelevantFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'service.identifyRelevantFiles', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  let originalResult;
  try {
    const service = await getOriginalService();
    originalResult = await service.identifyRelevantFiles(
      query, 
      options,
      options.isFollowUp,
      options.previousQuery,
      options.previousResponse
    );
    endTimer(originalTimer, true, { filesProcessed: originalResult?.length || 0 });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'service.identifyRelevantFiles');
    logger.error(`[ADAPTER] Error in original service.identifyRelevantFiles: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'service.identifyRelevantFiles', { 
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
      compatibility: options.compatibility,
      segmentTracking: {
        requestedSegments: options.segments || [],
        loadedSegments: {},
        currentSegments: [],
        missingSegments: {}
      }
    };
    
    // Call repository method
    const repoResult = await repository.getFilesByQuery(context);
    endTimer(repoTimer, true, { filesProcessed: repoResult.relevantFiles.length || 0 });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] service.identifyRelevantFiles comparison - original: ${originalResult.length} files, repository: ${repoResult.relevantFiles.length} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return repoResult.relevantFiles;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'service.identifyRelevantFiles');
    logger.error(`[ADAPTER] Error in repository service.identifyRelevantFiles: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

/**
 * Adapter for loadDataFiles in dataRetrievalService.js
 * 
 * @param fileIds Array of file IDs
 * @param segments Optional segments to filter by
 * @param customRepository Optional custom repository instance
 * @returns Array of file data
 */
export async function loadDataFiles(
  fileIds: string[],
  segments: string[] = [],
  customRepository?: FileRepository
) {
  // Determine if this request should use repository implementation
  const useRepository = shouldUseRepositoryImplementation();
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] Service loadDataFiles called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'service.loadDataFiles', { 
    queryLength: fileIds.length
  });
  
  let originalResult;
  try {
    const service = await getOriginalService();
    originalResult = await service.loadDataFiles(fileIds);
    endTimer(originalTimer, true, { filesProcessed: fileIds.length });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'service.loadDataFiles');
    logger.error(`[ADAPTER] Error in original service.loadDataFiles: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'service.loadDataFiles', { 
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
      logger.info(`[SHADOW] service.loadDataFiles comparison - original: ${originalResult.length} files, repository: ${repoResult.length} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return repoResult;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'service.loadDataFiles');
    logger.error(`[ADAPTER] Error in repository service.loadDataFiles: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

/**
 * Adapter for processQueryWithData in dataRetrievalService.js
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
  // Determine if this request should use repository implementation
  const useRepository = shouldUseRepositoryImplementation(options.threadId);
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] Service processQueryWithData called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'service.processQueryWithData', { 
    threadId: options.threadId,
    queryLength: query.length
  });
  
  let originalResult;
  try {
    const service = await getOriginalService();
    originalResult = await service.processQueryWithData(
      query, 
      options.context || {},
      options.cachedFileIds || [],
      options.threadId,
      options.isFollowUp,
      options.previousQuery,
      options.previousResponse
    );
    endTimer(originalTimer, true);
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'service.processQueryWithData');
    logger.error(`[ADAPTER] Error in original service.processQueryWithData: ${error.message}`);
    throw error; // Re-throw if we're not using the repository as fallback
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'service.processQueryWithData', { 
    threadId: options.threadId,
    queryLength: query.length,
    hasSegments: options.segments ? true : false
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
      cachedFileIds: options.cachedFileIds || [],
      compatibility: options.compatibility,
      segmentTracking: {
        requestedSegments: options.segments || [],
        loadedSegments: {},
        currentSegments: [],
        missingSegments: {}
      }
    };
    
    // Call repository method
    const processingOptions = {
      enablePatternDetection: options.enablePatternDetection,
      maxFiles: options.maxFiles,
      prioritySegments: options.segments
    };
    
    const result = await processor.processQueryWithData(context, processingOptions);
    endTimer(repoTimer, true, { 
      filesProcessed: result.relevantFiles.length,
      segmentsProcessed: context.segmentTracking.requestedSegments.length
    });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] service.processQueryWithData comparison - original: ${Object.keys(originalResult).length} properties, repository: ${Object.keys(result).length} properties`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return {
      ...result,
      // Add information about missing/available segments
      segmentInfo: {
        requested: context.segmentTracking.requestedSegments,
        found: result.processedData?.foundSegments || context.segmentTracking.currentSegments,
        missing: result.processedData?.missingSegments || []
      }
    };
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'service.processQueryWithData');
    logger.error(`[ADAPTER] Error in repository service.processQueryWithData: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

/**
 * Adapter for cacheFilesForThread in dataRetrievalService.js
 * 
 * @param threadId Thread identifier
 * @param fileIds File identifiers to cache
 * @param customRepository Optional custom repository instance
 * @returns Success indicator
 */
export async function cacheFilesForThread(
  threadId: string,
  fileIds: string[],
  customRepository?: FileRepository
) {
  // Determine if this request should use repository implementation
  const useRepository = shouldUseRepositoryImplementation(threadId);
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] Service cacheFilesForThread called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'service.cacheFilesForThread', { 
    threadId,
    fileCount: fileIds.length
  });
  
  let originalResult = false;
  try {
    const service = await getOriginalService();
    originalResult = await service.cacheFilesForThread(threadId, fileIds);
    endTimer(originalTimer, true);
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'service.cacheFilesForThread');
    logger.error(`[ADAPTER] Error in original service.cacheFilesForThread: ${error.message}`);
    // Original implementation failed, don't rethrow as we'll try repository if enabled
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'service.cacheFilesForThread', { 
    threadId,
    fileCount: fileIds.length
  });
  
  try {
    // Create or use repository
    const { repository, cacheManager } = customRepository 
      ? { repository: customRepository, cacheManager: null } 
      : getDefaultImplementations();
    
    // Call repository method using cacheManager for thread-related caching
    if (!cacheManager) {
      throw new Error('CacheManager not available in repository implementation');
    }
    
    const result = await cacheManager.setThreadFiles(threadId, fileIds);
    endTimer(repoTimer, true, { filesProcessed: fileIds.length });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] service.cacheFilesForThread comparison - original: ${originalResult}, repository: ${result}`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return result;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'service.cacheFilesForThread');
    logger.error(`[ADAPTER] Error in repository service.cacheFilesForThread: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

/**
 * Adapter for getCachedFilesForThread in dataRetrievalService.js
 * 
 * @param threadId Thread identifier
 * @param customRepository Optional custom repository instance
 * @returns Array of cached file identifiers
 */
export async function getCachedFilesForThread(
  threadId: string,
  customRepository?: FileRepository
) {
  // Determine if this request should use repository implementation
  const useRepository = shouldUseRepositoryImplementation(threadId);
  const isShadowMode = SHADOW_MODE && USE_REPOSITORY_PATTERN;
  
  logger.info(`[ADAPTER] Service getCachedFilesForThread called with feature flag: ${USE_REPOSITORY_PATTERN}, traffic: ${TRAFFIC_PERCENTAGE}%, shadow: ${isShadowMode}`);
  
  // Always run original implementation in shadow mode or when feature flag is off
  const originalTimer = startTimer('original', 'service.getCachedFilesForThread', { 
    threadId
  });
  
  let originalResult = [];
  try {
    const service = await getOriginalService();
    originalResult = await service.getCachedFilesForThread(threadId);
    endTimer(originalTimer, true, { filesReturned: originalResult.length });
  } catch (error) {
    endTimer(originalTimer, false);
    recordError('original', 'service.getCachedFilesForThread');
    logger.error(`[ADAPTER] Error in original service.getCachedFilesForThread: ${error.message}`);
    // Original implementation failed, don't rethrow as we'll try repository if enabled
  }
  
  // If not using repository implementation and not in shadow mode, return original result
  if (!useRepository && !isShadowMode) {
    return originalResult;
  }
  
  // Start timer for repository implementation
  const repoTimer = startTimer('repository', 'service.getCachedFilesForThread', { 
    threadId
  });
  
  try {
    // Create or use repository
    const { repository, cacheManager } = customRepository 
      ? { repository: customRepository, cacheManager: null } 
      : getDefaultImplementations();
    
    // Call repository method using cacheManager for thread-related caching
    if (!cacheManager) {
      throw new Error('CacheManager not available in repository implementation');
    }
    
    const cachedFiles = await cacheManager.getThreadFiles(threadId);
    endTimer(repoTimer, true, { filesReturned: cachedFiles.length });
    
    // In shadow mode, log comparison but return original result
    if (isShadowMode) {
      logger.info(`[SHADOW] service.getCachedFilesForThread comparison - original: ${originalResult.length} files, repository: ${cachedFiles.length} files`);
      return originalResult;
    }
    
    // Otherwise return repository result
    return cachedFiles;
  } catch (error) {
    endTimer(repoTimer, false);
    recordError('repository', 'service.getCachedFilesForThread');
    logger.error(`[ADAPTER] Error in repository service.getCachedFilesForThread: ${error.message}`);
    
    // Return original result on error
    return originalResult;
  }
}

export default {
  identifyRelevantFiles,
  loadDataFiles,
  processQueryWithData,
  cacheFilesForThread,
  getCachedFilesForThread
}; 