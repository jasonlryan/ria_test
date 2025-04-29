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
 * Last Updated: Wed May 1 2024
 */

import { FileRepository, QueryProcessor, QueryContext } from '../interfaces';
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
  return repository.identifyRelevantFiles(query, context);
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
  // Create or use repository
  const { repository } = customRepository 
    ? { repository: customRepository } 
    : getDefaultImplementations();
  
  // Call repository method
  return repository.loadFileData(fileIds);
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

export default {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData
}; 