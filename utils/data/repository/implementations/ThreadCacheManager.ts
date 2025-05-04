/**
 * Thread Cache Manager Implementation
 *
 * Provides implementation of CacheManager interface for thread cache operations.
 * 
 * Adapts the existing cache-utils.ts functionality to work with the repository pattern.
 */

import { CacheManager, CacheOptions, CacheMetadata, FileRepository, DataFile } from '../interfaces';
import { getCachedFilesForThread, updateThreadWithFiles } from '../../../cache/cache-utils';
import logger from '../../../shared/logger';

/**
 * Cache manager implementation for thread-based caching
 * Adapts the unified cache implementation in cache-utils.ts
 */
export class ThreadCacheManager implements CacheManager {
  private repository: FileRepository;

  constructor(repository: FileRepository) {
    this.repository = repository;
  }

  /**
   * Get cache metadata for a thread
   * 
   * @param threadId Thread identifier
   * @returns Cache metadata
   */
  async getCacheMetadata(threadId: string): Promise<CacheMetadata> {
    try {
      const cachedFiles = await this.getCachedFiles(threadId);
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
      
      return {
        threadId,
        lastUpdated: now.toISOString(),
        fileCount: cachedFiles.length,
        status: 'active',
        createdAt: now,
        expiresAt: expiresAt,
        accessCount: 0
      };
    } catch (error) {
      logger.error(`[CACHE] Error getting cache metadata for thread ${threadId}: ${error.message}`);
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      return {
        threadId,
        lastUpdated: now.toISOString(),
        fileCount: 0,
        status: 'error',
        createdAt: now,
        expiresAt: expiresAt,
        accessCount: 0
      };
    }
  }

  /**
   * Get cached files for a thread
   * 
   * @param threadId Thread identifier
   * @param options Cache options
   * @returns Array of file identifiers
   */
  async getCachedFiles(threadId: string, options?: CacheOptions): Promise<string[]> {
    try {
      // Use the existing cache-utils implementation
      const cachedFiles = await getCachedFilesForThread(threadId);
      return cachedFiles.map(file => file.fileId);
    } catch (error) {
      logger.error(`[CACHE] Error getting cached files for thread ${threadId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get thread files - alias for getCachedFiles for backward compatibility
   * 
   * @param threadId Thread identifier
   * @returns Array of file identifiers
   */
  async getThreadFiles(threadId: string): Promise<string[]> {
    return this.getCachedFiles(threadId);
  }

  /**
   * Set cached files for a thread - internal implementation
   * 
   * @param threadId Thread identifier
   * @param fileIds File identifiers to cache
   * @returns Success indicator
   */
  async setThreadFiles(threadId: string, fileIds: string[]): Promise<boolean> {
    try {
      // Format files for cache
      const files = await this.prepareFilesForCache(fileIds);
      
      // Use the existing cache-utils implementation
      await updateThreadWithFiles(threadId, files);
      return true;
    } catch (error) {
      logger.error(`[CACHE] Error setting cached files for thread ${threadId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Update cache with new files
   * 
   * @param threadId Thread identifier
   * @param fileIds File identifiers to cache
   * @param files Optional file data to cache
   * @param options Cache options
   * @returns Success indicator
   */
  async updateCache(
    threadId: string,
    fileIds: string[],
    files?: DataFile[],
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      // If full file data is provided, use it directly
      if (files && files.length > 0) {
        const cacheFiles = files.map(file => ({
          fileId: file.id,
          fileName: file.id,
          fileType: 'document',
          lastAccessed: new Date().toISOString()
        }));
        
        await updateThreadWithFiles(threadId, cacheFiles);
        return true;
      }
      
      // Otherwise use the file IDs to prepare cache entries
      return this.setThreadFiles(threadId, fileIds);
    } catch (error) {
      logger.error(`[CACHE] Error updating cache for thread ${threadId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Invalidate specific cache entries
   * 
   * @param threadId Thread identifier to invalidate
   * @param fileIds Optional specific file IDs to invalidate
   * @returns Success indicator
   */
  async invalidateCache(threadId: string, fileIds?: string[]): Promise<boolean> {
    try {
      if (!fileIds || fileIds.length === 0) {
        // Empty the thread cache completely
        return this.setThreadFiles(threadId, []);
      }
      
      // Remove specific files from cache
      const existingFiles = await this.getCachedFiles(threadId);
      const remainingFiles = existingFiles.filter(id => !fileIds.includes(id));
      
      return this.setThreadFiles(threadId, remainingFiles);
    } catch (error) {
      logger.error(`[CACHE] Error invalidating cache for thread ${threadId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if files are cached
   * 
   * @param threadId Thread identifier
   * @param fileIds File identifiers to check
   * @returns Object mapping file IDs to boolean cached status
   */
  async areFilesCached(threadId: string, fileIds: string[]): Promise<Record<string, boolean>> {
    try {
      const cachedFiles = await this.getCachedFiles(threadId);
      const cachedSet = new Set(cachedFiles);
      
      return fileIds.reduce((result, fileId) => {
        result[fileId] = cachedSet.has(fileId);
        return result;
      }, {} as Record<string, boolean>);
    } catch (error) {
      logger.error(`[CACHE] Error checking cached status for thread ${threadId}: ${error.message}`);
      return fileIds.reduce((result, fileId) => {
        result[fileId] = false;
        return result;
      }, {} as Record<string, boolean>);
    }
  }

  /**
   * Prepare files for caching by retrieving their metadata
   * 
   * @param fileIds File identifiers to prepare
   * @returns Formatted cache entries
   */
  private async prepareFilesForCache(fileIds: string[]) {
    try {
      // Get file metadata using repository
      const files = await this.repository.getFilesByIds(fileIds);
      
      // Format for cache
      return files.map(file => ({
        fileId: file.id,
        fileName: file.id, // Use ID as name if not available
        fileType: 'document',
        lastAccessed: new Date().toISOString()
      }));
    } catch (error) {
      logger.error(`[CACHE] Error preparing files for cache: ${error.message}`);
      
      // Return minimal structure if we can't get full metadata
      return fileIds.map(fileId => ({
        fileId,
        fileName: fileId,
        fileType: 'unknown',
        lastAccessed: new Date().toISOString()
      }));
    }
  }
} 