/**
 * Cache Utilities
 * Manages thread-based caching of data files and their loaded segments.
 */

import * as fs from "fs";
import * as path from "path";
import logger from "./logger";

const CACHE_DIR = path.join(process.cwd(), "cache");

/**
 * Represents a cached file with segment metadata.
 */
export interface CachedFile {
  id: string;
  data: any;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
}

/**
 * Loads the cache for a given thread.
 * @param threadId - The thread identifier.
 * @returns The cache entry containing cached files and metadata.
 */
export async function getCachedFilesForThread(threadId: string): Promise<CachedFile[]> {
  const cacheFilePath = path.join(CACHE_DIR, `${threadId}.json`);
  try {
    if (!fs.existsSync(cacheFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(cacheFilePath, "utf8");
    const cacheEntry = JSON.parse(content);
    // Convert loadedSegments and availableSegments to Set
    const files = cacheEntry.files.map((file: any) => ({
      ...file,
      loadedSegments: new Set(file.loadedSegments),
      availableSegments: new Set(file.availableSegments),
    }));
    return files;
  } catch (error) {
    logger.error(`Error reading cache for thread ${threadId}:`, error);
    return [];
  }
}

/**
 * Updates the cache for a given thread.
 * Merges new files or updates existing files with new segment data.
 * @param threadId - The thread identifier.
 * @param newFiles - Array of new or updated cached files.
 * @returns void
 */
export async function updateThreadCache(threadId: string, newFiles: CachedFile[]): Promise<void> {
  const cacheFilePath = path.join(CACHE_DIR, `${threadId}.json`);
  let cacheEntry = { files: [], scope: {} };
  try {
    if (fs.existsSync(cacheFilePath)) {
      const content = await fs.promises.readFile(cacheFilePath, "utf8");
      cacheEntry = JSON.parse(content);
      // Convert loadedSegments and availableSegments to Set
      cacheEntry.files = cacheEntry.files.map((file: any) => ({
        ...file,
        loadedSegments: new Set(file.loadedSegments),
        availableSegments: new Set(file.availableSegments),
      }));
    }
  } catch (error) {
    logger.error(`Error reading cache for thread ${threadId}:`, error);
  }

  // Merge newFiles into cacheEntry.files
  for (const newFile of newFiles) {
    const existingIndex = cacheEntry.files.findIndex((f: any) => f.id === newFile.id);
    if (existingIndex === -1) {
      // Add new file
      cacheEntry.files.push(newFile);
    } else {
      // Merge segments and data
      const existingFile = cacheEntry.files[existingIndex];
      // Merge loadedSegments
      newFile.loadedSegments.forEach((seg: string) => existingFile.loadedSegments.add(seg));
      // Merge availableSegments
      newFile.availableSegments.forEach((seg: string) => existingFile.availableSegments.add(seg));
      // Merge data (assuming data is an object with segment keys)
      Array.from(newFile.loadedSegments).forEach((seg: string) => {
        existingFile.data[seg] = newFile.data[seg];
      });
      cacheEntry.files[existingIndex] = existingFile;
    }
  }

  // Convert Sets back to arrays for JSON serialization
  cacheEntry.files = cacheEntry.files.map((file: any) => ({
    ...file,
    loadedSegments: Array.from(file.loadedSegments),
    availableSegments: Array.from(file.availableSegments),
  }));

  try {
    await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(cacheFilePath, JSON.stringify(cacheEntry, null, 2), "utf8");
  } catch (error) {
    logger.error(`Error writing cache for thread ${threadId}:`, error);
  }
}
