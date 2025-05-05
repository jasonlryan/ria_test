/**
 * Cache Utilities
 * Manages thread-based caching of data files and their loaded segments.
 */

import kvClient from "./kvClient";
import logger from "../../utils/shared/logger";
import { performance } from "perf_hooks";
import { threadFileKey, threadMetaKey, TTL } from "./key-schema";

// Define type interfaces
export interface CachedFile {
  id: string;
  data: Record<string, any>;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
}

// Define compatibility metadata interface
export interface TopicCompatibility {
  comparable: boolean;
  availableYears: string[];
  availableMarkets: string[];
  userMessage: string;
}

export interface SegmentCompatibility {
  comparable: boolean;
  comparableValues: string[];
  userMessage: string;
}

export interface CompatibilityError {
  type: string;
  message: string;
  details?: string;
}

export interface CompatibilityMetadata {
  isFullyCompatible: boolean;
  topicCompatibility: Record<string, TopicCompatibility>;
  segmentCompatibility: Record<string, SegmentCompatibility>;
  mappingVersion: string;
  assessedAt: number;
  error?: CompatibilityError;
}

export interface ThreadCache {
  files: CachedFile[];
  compatibilityMetadata?: CompatibilityMetadata;
  lastUpdated: number;
  previousQueries?: string[];
  rawQueries?: string[];
  isFollowUp?: boolean;
  lastQueryTime?: number;
  metadata?: {
    cacheErrors?: Array<{
      timestamp: string;
      error: string;
    }>;
    [key: string]: any;
  };
}

/**
 * Validate thread data structure before caching
 * @param threadData Thread data to validate
 * @returns Validation result with error message if invalid
 */
function validateThreadData(threadData: any): { valid: boolean; error?: string } {
  if (!threadData) {
    return { valid: false, error: 'Thread data is null or undefined' };
  }

  if (typeof threadData !== 'object') {
    return { valid: false, error: `Thread data is not an object (got ${typeof threadData})` };
  }

  // Check for required fields
  const requiredFields = ['id', 'files', 'metadata'];
  const missingFields = requiredFields.filter(field => !threadData[field]);
  
  if (missingFields.length > 0) {
    return { 
      valid: false, 
      error: `Thread data missing required fields: ${missingFields.join(', ')}` 
    };
  }

  // Validate files array
  if (!Array.isArray(threadData.files)) {
    return { 
      valid: false, 
      error: `Thread files is not an array (got ${typeof threadData.files})` 
    };
  }

  // Validate metadata object
  if (typeof threadData.metadata !== 'object' || threadData.metadata === null) {
    return { 
      valid: false, 
      error: `Thread metadata is not an object (got ${typeof threadData.metadata})` 
    };
  }

  return { valid: true };
}

/**
 * Ensures that a files property is an array
 * @param files Files property that might not be an array
 * @returns An array (either the original if it was an array, or an empty array)
 */
function ensureFilesArray(files: any): any[] {
  if (!files) return [];
  return Array.isArray(files) ? files : [];
}

/**
 * Unified Cache Interface
 * Provides a standardized caching interface for the application.
 * All caching operations should go through this module.
 */
export class UnifiedCache {
  /**
   * Get cached value with performance tracking
   * @param key Cache key
   * @returns The cached value or null if not found
   */
  static async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      const result = await kvClient.get<T>(key);
      const duration = performance.now() - startTime;
      
      if (result) {
        logger.info(`Cache HIT for ${key} in ${duration.toFixed(2)}ms`);
        return result;
      } else {
        logger.info(`Cache MISS for ${key} in ${duration.toFixed(2)}ms`);
        return null;
      }
    } catch (error) {
      logger.error(`Cache ERROR for ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set cache value with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl TTL in seconds (defaults to 1 hour)
   * @returns Success status
   */
  static async set<T>(key: string, value: T, ttl = TTL.CACHE_DATA): Promise<boolean> {
    try {
      await kvClient.set(key, value, { ex: ttl });
      return true;
    } catch (error) {
      logger.error(`Failed to set cache for ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Delete a key from cache
   * @param key Cache key
   * @returns Success status
   */
  static async delete(key: string): Promise<boolean> {
    try {
      const result = await kvClient.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Get a hash field
   * @param key Hash key
   * @param field Field name
   * @returns Field value or null
   */
  static async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      return await kvClient.hget<T>(key, field);
    } catch (error) {
      logger.error(`Failed to get hash field ${key}.${field}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set hash fields
   * @param key Hash key
   * @param obj Fields to set
   * @returns Success status
   */
  static async hset(key: string, obj: Record<string, any>, ttl = TTL.CACHE_DATA): Promise<boolean> {
    try {
      await kvClient.hset(key, obj);
      // Always refresh TTL after hash operations
      await kvClient.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Failed to set hash fields for ${key}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Get all hash fields
   * @param key Hash key
   * @returns Hash fields or empty object
   */
  static async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      return await kvClient.hgetall<T>(key);
    } catch (error) {
      logger.error(`Failed to get all hash fields for ${key}: ${(error as Error).message}`);
      return {};
    }
  }

  /**
   * Get cached thread data
   * @param threadId Thread ID
   * @returns Thread metadata or null if not found
   */
  static async getThreadCache(threadId: string): Promise<ThreadCache | null> {
    const key = threadMetaKey(threadId);
    return this.get<ThreadCache>(key);
  }

  /**
   * Update thread cache data
   * @param threadId Thread ID
   * @param data Thread data to cache
   * @returns Success status
   */
  static async updateThreadCache(threadId: string, data: ThreadCache): Promise<boolean> {
    const key = threadMetaKey(threadId);
    return this.set<ThreadCache>(key, data, TTL.THREAD_DATA);
  }

  /**
   * Get cached files for thread
   * @param threadId Thread ID
   * @param fileId Optional file ID
   * @returns Cached files or empty array if not found
   */
  static async getCachedFilesForThread(threadId: string, fileId?: string): Promise<CachedFile[]> {
    try {
      if (fileId) {
        const key = threadFileKey(threadId, fileId);
        const fileData = await this.get<CachedFile>(key);
        return fileData ? [fileData] : [];
      }
      
      const threadData = await this.getThreadCache(threadId);
      if (!threadData) {
        return [];
      }
      
      // FIXED: Add safety check for files property
      const files = ensureFilesArray(threadData.files);
      
      // Convert loadedSegments and availableSegments to Set
      return files.map((file: any) => ({
        ...file,
        loadedSegments: new Set(file.loadedSegments),
        availableSegments: new Set(file.availableSegments),
      }));
    } catch (error) {
      logger.error(`Error reading cache for thread ${threadId}:`, error);
      return [];
    }
  }

  /**
   * Get thread compatibility metadata
   * @param threadId Thread ID
   * @returns Compatibility metadata or null if not found
   */
  static async getThreadCompatibilityMetadata(threadId: string): Promise<CompatibilityMetadata | null> {
    try {
      const key = threadMetaKey(threadId);
      const meta = await this.get<ThreadCache>(key);
      if (!meta || !meta.compatibilityMetadata) {
        return null;
      }
      return meta.compatibilityMetadata;
    } catch (error) {
      logger.error(`Error reading compatibility metadata for thread ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Update thread cache with new files and compatibility metadata
   * @param threadId Thread ID
   * @param newFiles New files to cache
   * @param compatibilityMetadata Optional compatibility metadata
   * @returns Success status
   */
  static async updateThreadWithFiles(
    threadId: string,
    newFiles: CachedFile[],
    compatibilityMetadata?: CompatibilityMetadata
  ): Promise<boolean> {
    try {
      const metaKey = threadMetaKey(threadId);
      const existingMeta = await this.get<ThreadCache>(metaKey) || {
        files: [],
        compatibilityMetadata: null,
        lastUpdated: Date.now()
      };

      // Validate existing meta structure before updating
      const validation = validateThreadData(existingMeta);
      if (!validation.valid) {
        logger.warn(`Invalid thread data for ${threadId}: ${validation.error}`);
        
        // Store validation error in thread metadata for debugging
        if (existingMeta && typeof existingMeta === 'object') {
          if (!existingMeta.metadata) {
            existingMeta.metadata = {};
          }
          if (!existingMeta.metadata.cacheErrors) {
            existingMeta.metadata.cacheErrors = [];
          }
          existingMeta.metadata.cacheErrors.push({
            timestamp: new Date().toISOString(),
            error: validation.error
          });
        }
        
        // FIXED: Initialize files as empty array if it's not an array
        if (!Array.isArray(existingMeta.files)) {
          existingMeta.files = [];
          logger.info(`Initialized empty files array for thread ${threadId}`);
        }
      }

      // CACHE / SHADOW SAFETY: Prevent mixing incompatible years
      // Check if we're trying to add files from incompatible years
      if (existingMeta.files.length > 0 && newFiles.length > 0) {
        const existingYears = new Set<string>();
        const newYears = new Set<string>();
        
        // Extract years from file IDs
        existingMeta.files.forEach((file: any) => {
          if (typeof file.id === 'string' && file.id.match(/^(202[45])_/)) {
            existingYears.add(file.id.substring(0, 4));
          }
        });
        
        newFiles.forEach(file => {
          if (typeof file.id === 'string' && file.id.match(/^(202[45])_/)) {
            newYears.add(file.id.substring(0, 4));
          }
        });
        
        // Check for mixed years and compatibility
        if (existingYears.size > 0 && newYears.size > 0) {
          const allYears = new Set([...existingYears, ...newYears]);
          
          // If multiple years and compatible flag is false/missing, prevent mixing
          if (allYears.size > 1 && 
              (!compatibilityMetadata?.isFullyCompatible || 
               (existingMeta.compatibilityMetadata && !existingMeta.compatibilityMetadata.isFullyCompatible))) {
            logger.warn(`[COMPATIBILITY] Prevented mixing incompatible years in thread ${threadId}: ${Array.from(allYears).join(', ')}`);
            logger.info(`[COMPATIBILITY] Only adding files from years: ${Array.from(newYears).join(', ')}`);
            
            // Filter existing files to keep only those with the same years as new files
            existingMeta.files = existingMeta.files.filter((file: any) => {
              if (typeof file.id === 'string' && file.id.match(/^(202[45])_/)) {
                const fileYear = file.id.substring(0, 4);
                return newYears.has(fileYear);
              }
              return true; // Keep files without clear year indicators
            });
            
            // Update compatibility metadata to show we've enforced compatibility
            if (compatibilityMetadata) {
              compatibilityMetadata.isFullyCompatible = true;
            }
          }
        }
      }

      // FIXED: Ensure files is an array before mapping
      const files = ensureFilesArray(existingMeta.files);
      
      // Convert loadedSegments and availableSegments to Set for merging
      existingMeta.files = files.map((file: any) => ({
        ...file,
        loadedSegments: new Set(file.loadedSegments),
        availableSegments: new Set(file.availableSegments),
      }));

      // Merge newFiles into existingMeta.files
      for (const newFile of newFiles) {
        const existingIndex = existingMeta.files.findIndex((f: any) => f.id === newFile.id);
        if (existingIndex === -1) {
          existingMeta.files.push(newFile);
        } else {
          const existingFile = existingMeta.files[existingIndex];
          Array.from(newFile.loadedSegments).forEach((seg: string) => existingFile.loadedSegments.add(seg));
          Array.from(newFile.availableSegments).forEach((seg: string) => existingFile.availableSegments.add(seg));
          Array.from(newFile.loadedSegments).forEach((seg: string) => {
            existingFile.data[seg] = newFile.data[seg];
          });
          existingMeta.files[existingIndex] = existingFile;
        }
      }

      // Update compatibility metadata if provided
      if (compatibilityMetadata) {
        existingMeta.compatibilityMetadata = compatibilityMetadata;
      }
      
      // Update timestamp
      existingMeta.lastUpdated = Date.now();

      // Convert Sets back to arrays for serialization
      existingMeta.files = existingMeta.files.map((file: any) => ({
        ...file,
        loadedSegments: Array.from(file.loadedSegments),
        availableSegments: Array.from(file.availableSegments),
      }));

      // Write updated meta back to KV with TTL
      await this.set(metaKey, existingMeta, TTL.THREAD_DATA);

      // Write segment slices with hset and TTL
      for (const file of newFiles) {
        const fileKey = threadFileKey(threadId, file.id);
        const segmentData: Record<string, string> = {};
        for (const segment of Array.from(file.loadedSegments)) {
          segmentData[segment] = JSON.stringify(file.data[segment]);
        }
        await this.hset(fileKey, segmentData, TTL.THREAD_DATA);
      }

      return true;
    } catch (error) {
      logger.error(`Error updating cache for thread ${threadId}:`, error);
      return false;
    }
  }

  /**
   * Checks if the cached compatibility metadata is still valid
   * @param threadId Thread identifier
   * @param currentMappingVersion Current version of the canonical mapping
   * @returns Whether the cached compatibility metadata is still valid
   */
  static async isCompatibilityMetadataValid(
    threadId: string,
    currentMappingVersion: string
  ): Promise<boolean> {
    try {
      const metadata = await this.getThreadCompatibilityMetadata(threadId);
      
      if (!metadata) {
        return false;
      }
      
      // Check if mapping version matches and assessment is recent enough
      const isValid = metadata.mappingVersion === currentMappingVersion &&
        (Date.now() - metadata.assessedAt) < (7 * 24 * 60 * 60 * 1000); // 7 days max age
      
      return isValid;
    } catch (error) {
      logger.error(`Error validating compatibility metadata: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Update thread with files in cache
   * @param threadId Thread ID
   * @param data Thread data
   * @param ttl TTL in seconds
   */
  async updateThreadWithFiles(threadId: string, data: any, ttl = TTL.THREAD_DATA): Promise<void> {
    try {
      const key = threadMetaKey(threadId);
      
      // Validate thread data before caching
      const validation = validateThreadData(data);
      if (!validation.valid) {
        logger.warn(`Invalid thread data for ${threadId}: ${validation.error}`);
        
        // Store validation error in thread metadata for debugging
        if (data && typeof data === 'object' && data.metadata) {
          if (!data.metadata.cacheErrors) {
            data.metadata.cacheErrors = [];
          }
          data.metadata.cacheErrors.push({
            timestamp: new Date().toISOString(),
            error: validation.error
          });
        }
        
        // FIXED: Initialize files as empty array if it's not valid
        if (!Array.isArray(data.files)) {
          data.files = [];
          logger.info(`Initialized empty files array for thread ${threadId} in instance method`);
        }
      }
      
      await kvClient.set(key, data, { ex: ttl });
      logger.info(`Updated thread ${threadId} in cache with TTL ${ttl}s`);
    } catch (error) {
      logger.error(`Failed to update thread ${threadId} in cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update thread with query context
   * @param threadId Thread ID
   * @param contextData Context data to update
   * @returns Success status
   */
  static async updateThreadWithContext(
    threadId: string,
    contextData: {
      previousQueries?: string[];
      rawQueries?: string[];
      isFollowUp?: boolean;
      lastQueryTime?: number;
    }
  ): Promise<boolean> {
    try {
      const key = threadMetaKey(threadId);
      const existing = await this.get<ThreadCache>(key) || {
        files: [],
        lastUpdated: Date.now()
      };

      // Merge with existing data
      const updated: ThreadCache = {
        ...existing,
        previousQueries: contextData.previousQueries || existing.previousQueries || [],
        rawQueries: contextData.rawQueries || existing.rawQueries || [],
        isFollowUp: contextData.isFollowUp ?? existing.isFollowUp,
        lastQueryTime: contextData.lastQueryTime || Date.now(),
        lastUpdated: Date.now()
      };

      return this.set(key, updated, TTL.THREAD_DATA);
    } catch (error) {
      logger.error(`Error updating thread context for ${threadId}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Get thread context data
   * @param threadId Thread ID
   * @returns Thread context or default values if not found
   */
  static async getThreadContext(
    threadId: string
  ): Promise<{
    previousQueries: string[];
    rawQueries: string[];
    isFollowUp: boolean;
    lastQueryTime?: number;
  }> {
    try {
      const key = threadMetaKey(threadId);
      const data = await this.get<ThreadCache>(key);
      
      return {
        previousQueries: data?.previousQueries || [],
        rawQueries: data?.rawQueries || [],
        isFollowUp: Array.isArray(data?.previousQueries) && data.previousQueries.length > 0,
        lastQueryTime: data?.lastQueryTime
      };
    } catch (error) {
      logger.error(`Error getting thread context for ${threadId}: ${(error as Error).message}`);
      return { previousQueries: [], rawQueries: [], isFollowUp: false };
    }
  }
}

// Export both class and convenience methods
export const getThreadCache = UnifiedCache.getThreadCache.bind(UnifiedCache);
export const updateThreadCache = UnifiedCache.updateThreadCache.bind(UnifiedCache);
export const getCachedFilesForThread = UnifiedCache.getCachedFilesForThread.bind(UnifiedCache);
export const getThreadCompatibilityMetadata = UnifiedCache.getThreadCompatibilityMetadata.bind(UnifiedCache);
export const isCompatibilityMetadataValid = UnifiedCache.isCompatibilityMetadataValid.bind(UnifiedCache);
export const updateThreadWithFiles = UnifiedCache.updateThreadWithFiles.bind(UnifiedCache);
export const updateThreadWithContext = UnifiedCache.updateThreadWithContext.bind(UnifiedCache);
export const getThreadContext = UnifiedCache.getThreadContext.bind(UnifiedCache); 