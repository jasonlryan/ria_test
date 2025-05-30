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

import { DataFile } from './FileRepository';

/**
 * Cache control options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Whether to force refresh the cache */
  forceRefresh?: boolean;
  /** Cache key prefix for namespace separation */
  keyPrefix?: string;
  /** Strategy for cache misses */
  missStrategy?: 'load' | 'return-null' | 'throw';
}

/**
 * Cache metadata information
 */
export interface CacheMetadata {
  /** When the cache entry was created */
  createdAt: Date;
  /** When the cache entry expires */
  expiresAt: Date;
  /** Number of times the cache entry has been accessed */
  accessCount: number;
  /** Size in bytes of the cached data */
  sizeBytes?: number;
  /** Additional metadata specific to the cache entry */
  [key: string]: any;
}

/**
 * Cache Manager Interface
 * 
 * Provides operations for caching file data
 */
export interface CacheManager {
  /**
   * Get cached files for a thread
   * 
   * @param threadId - Thread identifier
   * @param options - Cache options
   * @returns Promise resolving to cached file IDs, or empty array if not found
   */
  getCachedFiles(threadId: string, options?: CacheOptions): Promise<string[]>;

  /**
   * Update cache with new files
   * 
   * @param threadId - Thread identifier
   * @param fileIds - File identifiers to cache
   * @param files - Optional file data to cache
   * @param options - Cache options
   * @returns Promise resolving to success indicator
   */
  updateCache(
    threadId: string,
    fileIds: string[],
    files?: DataFile[],
    options?: CacheOptions
  ): Promise<boolean>;

  /**
   * Get metadata about cached content
   * 
   * @param threadId - Thread identifier
   * @returns Promise resolving to cache metadata
   */
  getCacheMetadata(threadId: string): Promise<CacheMetadata>;

  /**
   * Invalidate specific cache entries
   * 
   * @param threadId - Thread identifier to invalidate
   * @param fileIds - Optional specific file IDs to invalidate
   * @returns Promise resolving to success indicator
   */
  invalidateCache(threadId: string, fileIds?: string[]): Promise<boolean>;
}

export default CacheManager; 