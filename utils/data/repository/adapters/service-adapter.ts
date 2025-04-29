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
 * Last Updated: Wed May 1 2024
 */

import { FileRepository, QueryProcessor, QueryContext, SegmentTrackingData } from '../interfaces';
import { FileSystemRepository, QueryProcessorImpl } from '../implementations';

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
  return repository.identifyRelevantFiles(query, context);
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
  // Create or use repository
  const { repository } = customRepository 
    ? { repository: customRepository } 
    : getDefaultImplementations();
  
  // Call repository method
  return repository.loadFileData(fileIds, segments);
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
  // Create or use processor
  const { processor } = customProcessor 
    ? { processor: customProcessor } 
    : getDefaultImplementations();
  
  // Create enhanced context with service-specific fields
  const segmentTracking: SegmentTrackingData = {
    requestedSegments: options.segments || [],
    currentSegments: options.currentSegments || [],
    loadedSegments: options.loadedSegments || {},
    missingSegments: {}
  };
  
  const context: QueryContext = {
    query,
    isFollowUp: options.isFollowUp || false,
    threadId: options.threadId,
    previousQuery: options.previousQuery,
    previousResponse: options.previousResponse,
    cachedFileIds: options.cachedFileIds || [],
    compatibility: options.compatibility || {},
    segmentTracking
  };
  
  // Call processor method
  return processor.processQueryWithData(
    query,
    context,
    options.cachedFileIds || [],
    options.threadId || '',
    options.isFollowUp || false,
    options.previousQuery || '',
    options.previousResponse || ''
  );
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
  // Create or use repository
  const { repository } = customRepository 
    ? { repository: customRepository } 
    : getDefaultImplementations();
  
  // Call repository method
  return repository.cacheFilesForThread(threadId, fileIds);
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
  // Create or use repository
  const { repository } = customRepository 
    ? { repository: customRepository } 
    : getDefaultImplementations();
  
  // Call repository method
  return repository.getCachedFilesForThread(threadId);
}

export default {
  identifyRelevantFiles,
  loadDataFiles,
  processQueryWithData,
  cacheFilesForThread,
  getCachedFilesForThread
}; 