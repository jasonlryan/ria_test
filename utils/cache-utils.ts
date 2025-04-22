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

export async function getThreadCompatibilityMetadata(threadId: string): Promise<CompatibilityMetadata | null> {
  try {
    const key = `thread:${threadId}:meta`;
    const meta = await kvClient.get(key);
    if (!meta || !meta.compatibilityMetadata) {
      return null;
    }
    return meta.compatibilityMetadata as CompatibilityMetadata;
  } catch (error) {
    logger.error(`Error reading compatibility metadata for thread ${threadId}:`, error);
    return null;
  }
}

export async function updateThreadCache(
  threadId: string, 
  newFiles: CachedFile[],
  compatibilityMetadata?: CompatibilityMetadata
): Promise<void> {
  try {
    const metaKey = `thread:${threadId}:meta`;
    const existingMeta = await kvClient.get(metaKey) || { 
      files: [], 
      compatibilityMetadata: null,
      lastUpdated: Date.now()
    };

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
    await kvClient.set(metaKey, existingMeta);
    await kvClient.expire(metaKey, TTL_SECONDS);

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

/**
 * Checks if the cached compatibility metadata is still valid
 * @param threadId Thread identifier
 * @param currentMappingVersion Current version of the canonical mapping
 * @returns Whether the cached compatibility metadata is still valid
 */
export async function isCompatibilityMetadataValid(
  threadId: string, 
  currentMappingVersion: string
): Promise<boolean> {
  try {
    const metadata = await getThreadCompatibilityMetadata(threadId);
    
    if (!metadata) {
      return false;
    }
    
    // Check if mapping version matches and assessment is recent enough
    const isValid = metadata.mappingVersion === currentMappingVersion &&
      (Date.now() - metadata.assessedAt) < (7 * 24 * 60 * 60 * 1000); // 7 days max age
    
    return isValid;
  } catch (error) {
    logger.error(`Error validating compatibility metadata: ${error.message}`);
    return false;
  }
}
