/**
 * Unified compatibility module for checking dataset comparability across years.
 * Provides functions to load compatibility data, check if files and topics are comparable,
 * and filter incomparable files from retrieval.
 * 
 * Last Updated: Sat May 25 2025
 */

import fs from 'fs';
import path from 'path';
import logger from "../shared/logger";

// In-memory cache with TTL
let compatibilityCache: CompatibilityMapping | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
let lastCacheTime = 0;

// Path to unified compatibility mapping file
// NOTE: This TypeScript version was already using the unified compatibility file
const MAPPING_PATH = path.join(
  process.cwd(),
  'data',
  'compatibility',
  'unified_compatibility.json'
);

// Type definitions
export interface CompatibilityFile {
  fileId: string;
  topicId: string;
  year: number;
  comparable: boolean;
  reason?: string;
  userMessage?: string;
}

export interface CompatibilityTopic {
  topicId: string;
  parentTheme: string;
  comparable: boolean;
  userMessage?: string;
  canonicalQuestion?: string;
  years: number[];
}

export interface GlobalFile {
  comparable: boolean;
  description: string;
}

export interface CompatibilityMapping {
  version: string;
  lastUpdated: string;
  metadata?: {
    description?: string;
    generatedFrom?: string[];
  };
  files: Record<string, CompatibilityFile>;
  topics: Record<string, CompatibilityTopic>;
  globalFiles?: Record<string, GlobalFile>;
  compatibleTopics: string[];
  nonComparableTopics: string[];
}

/**
 * Load the compatibility mapping from disk
 * @returns The compatibility mapping
 * @throws Error if the compatibility file cannot be loaded
 */
export function loadCompatibilityMapping(): CompatibilityMapping {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (compatibilityCache && now - lastCacheTime < CACHE_TTL) {
      logger.debug('Using cached compatibility mapping');
      return compatibilityCache;
    }

    // Read and parse the compatibility file
    if (!fs.existsSync(MAPPING_PATH)) {
      throw new Error(`Compatibility mapping file not found at ${MAPPING_PATH}`);
    }

    const fileContent = fs.readFileSync(MAPPING_PATH, 'utf8');
    const compatibilityData = JSON.parse(fileContent) as CompatibilityMapping;

    // Update cache
    compatibilityCache = compatibilityData;
    lastCacheTime = now;

    logger.info(
      `Loaded compatibility mapping v${compatibilityData.version} with ${
        Object.keys(compatibilityData.files).length
      } file entries and ${Object.keys(compatibilityData.topics).length} topic entries`
    );
    
    return compatibilityData;
  } catch (error) {
    logger.error(`Error loading compatibility mapping: ${(error as Error).message}`);
    
    // Return empty mapping on error
    return {
      version: '0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      files: {},
      topics: {},
      compatibleTopics: [],
      nonComparableTopics: []
    };
  }
}

/**
 * Force refresh the compatibility mapping cache
 * @returns The refreshed compatibility mapping
 */
export function refreshCompatibilityMapping(): CompatibilityMapping {
  compatibilityCache = null;
  lastCacheTime = 0;
  return loadCompatibilityMapping();
}

/**
 * Check if a file is comparable based on the compatibility mapping
 * @param fileId The file ID to check (without .json extension)
 * @returns Compatibility information with status and message
 */
export function getFileCompatibility(fileId: string): {
  comparable: boolean;
  topic: string;
  userMessage?: string;
} {
  try {
    const mapping = loadCompatibilityMapping();

    // Clean the fileId by removing .json extension if present
    const cleanFileId = fileId.replace(/\.json$/, '');

    // Get file entry or return a default
    const fileEntry = mapping.files[cleanFileId];
    
    if (!fileEntry) {
      // Check if it's a global file
      if (mapping.globalFiles && mapping.globalFiles[cleanFileId]) {
        return {
          comparable: mapping.globalFiles[cleanFileId].comparable,
          topic: 'Global',
          userMessage: mapping.globalFiles[cleanFileId].description
        };
      }
      
      // Default for unknown files
      return {
        comparable: true, // Assume comparable if not found (conservative approach)
        topic: 'Unknown',
        userMessage: 'No compatibility information available for this file.'
      };
    }

    // Return file compatibility info
    return {
      comparable: fileEntry.comparable,
      topic: fileEntry.topicId,
      userMessage: fileEntry.userMessage
    };
  } catch (error) {
    logger.error(`Error checking file compatibility for ${fileId}: ${(error as Error).message}`);
    // Default on error
    return {
      comparable: false, // Conservative approach on error
      topic: 'Unknown',
      userMessage: 'Unable to determine compatibility due to a technical issue.'
    };
  }
}

/**
 * Check if a topic is comparable based on the compatibility mapping
 * @param topicId The topic ID to check
 * @returns Compatibility information with status and message
 */
export function getTopicCompatibility(topicId: string): {
  comparable: boolean;
  userMessage?: string;
  years?: number[];
} {
  try {
    const mapping = loadCompatibilityMapping();

    // Get topic entry or return a default
    const topicEntry = mapping.topics[topicId];
    
    if (!topicEntry) {
      // Check if topic is explicitly listed in compatibleTopics or nonComparableTopics
      if (mapping.compatibleTopics.includes(topicId)) {
        return {
          comparable: true,
          userMessage: 'Topic is marked as comparable.'
        };
      }
      
      if (mapping.nonComparableTopics.includes(topicId)) {
        return {
          comparable: false,
          userMessage: 'Topic is marked as non-comparable.'
        };
      }
      
      // Default for unknown topics
      return {
        comparable: true, // Assume comparable if not found
        userMessage: 'No compatibility information available for this topic.'
      };
    }

    // Return topic compatibility info
    return {
      comparable: topicEntry.comparable,
      userMessage: topicEntry.userMessage,
      years: topicEntry.years
    };
  } catch (error) {
    logger.error(`Error checking topic compatibility for ${topicId}: ${(error as Error).message}`);
    // Default on error
    return {
      comparable: false, // Conservative approach on error
      userMessage: 'Unable to determine topic compatibility due to a technical issue.'
    };
  }
}

/**
 * Check if multiple files are all comparable with each other
 * @param fileIds Array of file IDs to check
 * @returns Whether all files are comparable with each other
 */
export function areFilesComparable(fileIds: string[]): boolean {
  if (!fileIds || fileIds.length <= 1) {
    return true; // Single file or empty array is always "comparable"
  }

  try {
    // Group files by topic
    const topicGroups: Record<string, Array<{ fileId: string, comparable: boolean }>> = {};

    fileIds.forEach((fileId) => {
      const compatibility = getFileCompatibility(fileId);
      if (!topicGroups[compatibility.topic]) {
        topicGroups[compatibility.topic] = [];
      }
      
      topicGroups[compatibility.topic].push({
        fileId,
        comparable: compatibility.comparable
      });
    });

    // Check each topic group for incomparable files
    for (const topic in topicGroups) {
      const group = topicGroups[topic];

      // If group has multiple files and any are marked as not comparable
      if (group.length > 1 && group.some((file) => !file.comparable)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error(`Error checking multiple file compatibility: ${(error as Error).message}`);
    return false; // Be conservative on errors
  }
}

/**
 * Filter out incomparable files when a comparison is requested
 * @param fileIds Array of file IDs to filter
 * @param isComparisonQuery Whether this is a comparison query
 * @returns Filtered file IDs and messages for incomparable topics
 */
export function filterIncomparableFiles(
  fileIds: string[],
  isComparisonQuery: boolean
): {
  filteredFileIds: string[];
  incomparableTopicMessages: Record<string, string>;
} {
  if (!isComparisonQuery || !fileIds || fileIds.length <= 1) {
    return {
      filteredFileIds: fileIds,
      incomparableTopicMessages: {},
    };
  }

  try {
    const mapping = loadCompatibilityMapping();
    const incomparableTopicMessages: Record<string, string> = {};
    const topicToFiles: Record<string, string[]> = {};
    const fileToTopic: Record<string, string> = {};

    // First pass: organize files by topic
    fileIds.forEach((fileId) => {
      const cleanFileId = fileId.replace(/\.json$/, '');
      const fileEntry = mapping.files[cleanFileId];

      if (!fileEntry) return;

      const { topicId } = fileEntry;
      if (!topicToFiles[topicId]) {
        topicToFiles[topicId] = [];
      }

      topicToFiles[topicId].push(fileId);
      fileToTopic[fileId] = topicId;
    });

    // Second pass: filter incomparable topics with multiple files
    let filteredFileIds = [...fileIds];

    for (const topic in topicToFiles) {
      const topicFiles = topicToFiles[topic];

      // If we have multiple files for this topic
      if (topicFiles.length > 1) {
        // Get topic compatibility info
        const topicInfo = getTopicCompatibility(topic);

        if (!topicInfo.comparable) {
          // Remove all files for this topic
          filteredFileIds = filteredFileIds.filter(
            (fileId) => fileToTopic[fileId] !== topic
          );

          // Store the user message for this topic
          if (topicInfo.userMessage) {
            incomparableTopicMessages[topic] = topicInfo.userMessage;
          } else {
            incomparableTopicMessages[topic] = 'This topic cannot be compared across years.';
          }

          logger.info(
            `[COMPATIBILITY] Filtered out ${topicFiles.length} files for incomparable topic "${topic}"`
          );
        }
      }
    }

    return {
      filteredFileIds,
      incomparableTopicMessages,
    };
  } catch (error) {
    logger.error(`Error filtering incomparable files: ${(error as Error).message}`);
    return {
      filteredFileIds: fileIds,
      incomparableTopicMessages: {},
    };
  }
}

/**
 * Get list of all compatible topics from the mapping
 * @returns Array of compatible topic IDs
 */
export function getCompatibleTopics(): string[] {
  try {
    const mapping = loadCompatibilityMapping();
    return mapping.compatibleTopics || [];
  } catch (error) {
    logger.error(`Error getting compatible topics: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Get list of all non-comparable topics from the mapping
 * @returns Array of non-comparable topic IDs
 */
export function getNonComparableTopics(): string[] {
  try {
    const mapping = loadCompatibilityMapping();
    return mapping.nonComparableTopics || [];
  } catch (error) {
    logger.error(`Error getting non-comparable topics: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Get user message for incomparable topic if it exists
 * @param topicId The topic ID to check
 * @returns User message or null if not found or comparable
 */
export function getIncomparableTopicMessage(topicId: string): string | null {
  const topicInfo = getTopicCompatibility(topicId);
  
  if (topicInfo.comparable) {
    return null;
  }
  
  return topicInfo.userMessage || null;
}

/**
 * Get all file IDs associated with a specific topic
 * @param topicId The topic ID to get files for
 * @returns Array of file IDs
 */
export function getFileIdsForTopic(topicId: string): string[] {
  try {
    const mapping = loadCompatibilityMapping();
    const fileIds: string[] = [];
    
    // Collect all file IDs that match the topic
    Object.entries(mapping.files).forEach(([fileId, file]) => {
      if (file.topicId === topicId) {
        fileIds.push(fileId);
      }
    });
    
    return fileIds;
  } catch (error) {
    logger.error(`Error getting file IDs for topic ${topicId}: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Get reason why files are not comparable
 * @param fileId The file ID to check
 * @returns Reason or null if comparable or not found
 */
export function getFileIncomparabilityReason(fileId: string): string | null {
  try {
    const mapping = loadCompatibilityMapping();
    const cleanFileId = fileId.replace(/\.json$/, '');
    const fileEntry = mapping.files[cleanFileId];
    
    if (!fileEntry || fileEntry.comparable) {
      return null;
    }
    
    return fileEntry.reason || null;
  } catch (error) {
    logger.error(`Error getting incomparability reason for ${fileId}: ${(error as Error).message}`);
    return null;
  }
}

export default {
  loadCompatibilityMapping,
  refreshCompatibilityMapping,
  getFileCompatibility,
  getTopicCompatibility,
  areFilesComparable,
  filterIncomparableFiles,
  getCompatibleTopics,
  getNonComparableTopics,
  getIncomparableTopicMessage,
  getFileIdsForTopic,
  getFileIncomparabilityReason
};

// Last updated: Sat May 25 2025 