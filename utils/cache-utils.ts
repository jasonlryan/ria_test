/**
 * Server-side implementation of thread cache utilities
 * This provides a way to access thread data cache on the server
 */

// Define the cache structure type
interface ThreadCache {
  [threadId: string]: {
    fileIds: string[];
  };
}

// In-memory cache store for server-side operations
// In a production environment, this would be replaced with a database
const serverThreadCache: ThreadCache = {};

/**
 * Get cached file IDs for a thread
 * @param {string} threadId - The thread ID to retrieve cache for
 * @returns {string[]} Array of cached file IDs
 */
export async function getCachedFilesForThread(threadId: string): Promise<string[]> {
  if (!threadId) {
    console.log(`No threadId provided, returning empty cache`);
    return [];
  }
  
  if (!serverThreadCache[threadId]) {
    console.log(`No cache found for thread ${threadId}, initializing empty cache`);
    serverThreadCache[threadId] = { fileIds: [] };
  }
  
  const fileIds = serverThreadCache[threadId].fileIds || [];
  console.log(`Retrieved ${fileIds.length} cached files for thread ${threadId}`);
  if (fileIds.length > 0) {
    console.log(`Cached files: ${fileIds.join(', ')}`);
  }
  
  return fileIds;
}

/**
 * Update thread cache with new file IDs
 * @param {string} threadId - The thread ID to update
 * @param {string[]} newFileIds - Array of new file IDs to add to the cache
 * @returns {string[]} Updated array of cached file IDs
 */
export async function updateThreadCache(threadId: string, newFileIds: string[]): Promise<string[]> {
  if (!threadId || !newFileIds || !newFileIds.length) return [];
  
  if (!serverThreadCache[threadId]) {
    serverThreadCache[threadId] = { fileIds: [] };
  }
  
  // Add new file IDs without duplicates
  const existingIds = serverThreadCache[threadId].fileIds || [];
  const allFileIds = [...existingIds];
  
  newFileIds.forEach(id => {
    if (!allFileIds.includes(id)) {
      allFileIds.push(id);
    }
  });
  
  serverThreadCache[threadId].fileIds = allFileIds;
  
  console.log(`Server cache updated for thread ${threadId}: ${allFileIds.length} files`);
  
  return allFileIds;
}

/**
 * Clear thread cache
 * @param {string} threadId - The thread ID to clear cache for
 */
export async function clearThreadCache(threadId: string): Promise<void> {
  if (!threadId) return;
  
  delete serverThreadCache[threadId];
  console.log(`Server cache cleared for thread ${threadId}`);
} 