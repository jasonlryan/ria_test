/**
 * Standardized key schema for Vercel KV cache
 * All cache keys should be generated using these functions
 */

// TTL Constants (in seconds)
export const TTL = {
  THREAD_DATA: 60 * 60 * 24 * 90, // 90 days
  USER_SESSION: 60 * 60 * 24,     // 24 hours
  CACHE_DATA: 60 * 60,            // 1 hour
  ANALYTICS: 60 * 60 * 24 * 30,   // 30 days
};

/**
 * Generate key for thread file data
 * @param threadId Thread identifier
 * @param fileId File identifier
 * @returns Formatted cache key
 */
export const threadFileKey = (threadId: string, fileId: string): string => 
  `thread:${threadId}:file:${fileId}`;

/**
 * Generate key for thread metadata
 * @param threadId Thread identifier
 * @returns Formatted cache key
 */
export const threadMetaKey = (threadId: string): string => 
  `thread:${threadId}:meta`;

/**
 * Generate key for analytics data
 * @param metric Analytics metric name
 * @param date Date string (YYYY-MM-DD format)
 * @returns Formatted cache key
 */
export const analyticsKey = (metric: string, date: string): string => 
  `analytics:${metric}:${date}`;

/**
 * Generate key for general cache data
 * @param category Cache category
 * @param id Identifier within category
 * @returns Formatted cache key
 */
export const cacheKey = (category: string, id: string): string => 
  `cache:${category}:${id}`;

/**
 * Generate key for user session data
 * @param userId User identifier
 * @returns Formatted cache key
 */
export const userSessionKey = (userId: string): string =>
  `user:${userId}:session`;

/**
 * Generate key for temporary data
 * @param type Type of temporary data
 * @param id Identifier for the data
 * @returns Formatted cache key
 */
export const tempDataKey = (type: string, id: string): string =>
  `temp:${type}:${id}`; 