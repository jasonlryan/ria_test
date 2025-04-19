/**
 * Cache Utilities
 * Manages thread-based caching of data files and their loaded segments.
 */

import kvClient from "./shared/kvClient";
import logger from "./logger";

const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days TTL

export interface CachedFile {
  id: string;
  data: Record<string, any>;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
}

export async function getCachedFilesForThread(threadId: string): Promise<CachedFile[]> {
  try {
    const key = `thread:${threadId}:meta`;
    const meta = await kvClient.get(key);
    if (!meta || !meta.files) {
      return [];
    }
    // Convert loadedSegments and availableSegments to Set
    const files = meta.files.map((file: any) => ({
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

export async function updateThreadCache(threadId: string, newFiles: CachedFile[]): Promise<void> {
  try {
    const metaKey = `thread:${threadId}:meta`;
    const existingMeta = await kvClient.get(metaKey) || { files: [], scope: {} };

    // Convert loadedSegments and availableSegments to Set for merging
    existingMeta.files = existingMeta.files.map((file: any) => ({
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

    // Convert Sets back to arrays for serialization
    existingMeta.files = existingMeta.files.map((file: any) => ({
      ...file,
      loadedSegments: Array.from(file.loadedSegments),
      availableSegments: Array.from(file.availableSegments),
    }));

    // Write updated meta back to KV with TTL
    await kvClient.set(metaKey, existingMeta, { ex: TTL_SECONDS });

    // Write segment slices with hset and TTL
    for (const file of newFiles) {
      const fileKey = `thread:${threadId}:file:${file.id}`;
      const segmentData: Record<string, string> = {};
      for (const segment of Array.from(file.loadedSegments)) {
        segmentData[segment] = JSON.stringify(file.data[segment]);
      }
      await kvClient.hset(fileKey, segmentData);
      await kvClient.expire(fileKey, TTL_SECONDS);
    }
  } catch (error) {
    logger.error(`Error updating cache for thread ${threadId}:`, error);
  }
}
