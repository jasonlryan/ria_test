/**
 * CacheManager Interface
 *
 * Defines the contract for components that handle caching operations.
 * Provides a unified approach to file caching across implementations.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#cachemanager-interface
 * - Analysis: ../analysis/Consolidated-Analysis.md#dependencies-analysis
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: Wed May 1 2024
 */

import { FileData } from './FileRepository';

/**
 * Cache metadata information
 */
export interface CacheMetadata {
  lastUpdated: string;
  expiresAt?: string;
  size?: number;
  hits?: number;
  misses?: number;
  [key: string]: any;
}

/**
 * Manager for cache operations
 */
export interface CacheManager {
  /**
   * Retrieve files from cache
   *
   * @param threadId Thread identifier
   * @returns Array of cached file data objects
   */
  getCachedFiles(threadId: string): Promise<FileData[]>;

  /**
   * Update cache with new files
   *
   * @param threadId Thread identifier
   * @param fileData Array of file data objects to cache
   * @param ttl Optional time-to-live in seconds
   * @returns Success indicator
   */
  updateCache(
    threadId: string,
    fileData: FileData[],
    ttl?: number
  ): Promise<boolean>;

  /**
   * Get metadata about cached content
   *
   * @param threadId Thread identifier
   * @returns Cache metadata
   */
  getCacheMetadata(threadId: string): Promise<CacheMetadata>;

  /**
   * Clear specific cache entries
   *
   * @param threadId Thread identifier
   * @param fileIds Optional array of file identifiers to invalidate
   * @returns Success indicator
   */
  invalidateCache(
    threadId: string,
    fileIds?: string[]
  ): Promise<boolean>;
  
  /**
   * Check if files are cached for a thread
   *
   * @param threadId Thread identifier
   * @returns Boolean indicating if cache exists
   */
  hasCachedFiles(threadId: string): Promise<boolean>;
  
  /**
   * Cache file IDs for a thread
   *
   * @param threadId Thread identifier
   * @param fileIds Array of file identifiers to cache
   * @param ttl Optional time-to-live in seconds
   * @returns Success indicator
   */
  cacheFileIds(
    threadId: string,
    fileIds: string[],
    ttl?: number
  ): Promise<boolean>;
  
  /**
   * Get cached file IDs for a thread
   *
   * @param threadId Thread identifier
   * @returns Array of cached file identifiers
   */
  getCachedFileIds(threadId: string): Promise<string[]>;
}

export default CacheManager; 