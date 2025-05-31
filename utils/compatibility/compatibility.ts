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

// Debug helper - track fileIds that have been logged to avoid duplicate trace logs
const COMPAT_TRACE_SEEN = new Set<string>();

// Path to unified compatibility mapping file
// NOTE: This TypeScript version was already using the unified compatibility file
const MAPPING_PATH = path.join(
  process.cwd(),
  'scripts',
  'reference files',
  'file_compatibility.json'
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
 * Extended file metadata with compatibility information
 */
export interface FileMetadata {
  fileId: string;
  topicId: string;
  year: number;
  comparable: boolean;
  userMessage?: string;
}

/**
 * Result of comparable pairs check
 */
export interface ComparablePairsResult {
  valid: string[];
  invalid: string[];
  message: string;
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

    const rawData = fs.readFileSync(MAPPING_PATH, 'utf8');
    const rawData_parsed = JSON.parse(rawData);
    
    // Adapt structure - the file_compatibility.json uses "fileCompatibility" instead of "files"
    const compatibilityData: CompatibilityMapping = {
      version: rawData_parsed.metadata?.version || "1.0",
      lastUpdated: rawData_parsed.metadata?.lastUpdated || new Date().toISOString(),
      metadata: rawData_parsed.metadata,
      // Use fileCompatibility instead of files if present
      files: rawData_parsed.files || rawData_parsed.fileCompatibility || {},
      // Use other fields as-is or empty objects
      topics: rawData_parsed.topics || {},
      globalFiles: rawData_parsed.globalFiles || {},
      compatibleTopics: rawData_parsed.compatibleTopics || [],
      nonComparableTopics: rawData_parsed.nonComparableTopics || []
    };

    // Validate basic structure
    logger.info(`[COMPATIBILITY_LOAD] Data structure confirmed: Keys found - metadata: ${!!compatibilityData.metadata}, files: ${!!compatibilityData.files}, topics: ${!!compatibilityData.topics}`);
    
    // Check if files object is empty
    if (!compatibilityData.files || Object.keys(compatibilityData.files).length === 0) {
      logger.error(`[COMPATIBILITY_LOAD] CRITICAL: Compatibility mapping loaded but 'files' object is empty or missing!`);
      throw new Error('Compatibility mapping has no file entries. This will prevent proper compatibility checks.');
    }

    // Basic validation passed - log file count
    const fileCount = Object.keys(compatibilityData.files).length;
    logger.info(`[COMPATIBILITY_LOAD] Successfully loaded file_compatibility.json. Found ${fileCount} file entries.`);

    // Update cache and return
    compatibilityCache = compatibilityData;
    lastCacheTime = now;
    
    return compatibilityData;
  } catch (error) {
    logger.error(`[COMPATIBILITY_LOAD] Failed to load compatibility mapping: ${error.message}`);
    throw error;
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
      
      // Default for unknown files - changed to false for safety
      logger.warn(`[COMPATIBILITY] Unknown file ID: ${cleanFileId} - No entry found in compatibility mapping.`);
      return {
        comparable: false, // Changed from true to false to be cautious with unknown files
        topic: 'Unknown',
        userMessage: 'File not found in compatibility mapping. Treating as non-comparable for safety.'
      };
    }

    // Return file compatibility info
    return {
      comparable: fileEntry.comparable,
      topic: fileEntry.topicId || (fileEntry as any).topic || 'Unknown', // Handle both structures
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
      
      // Default for unknown topics - changed to false for safety
      logger.warn(`[COMPATIBILITY] Unknown topic ID: ${topicId} - No entry found in compatibility mapping.`);
      return {
        comparable: false, // Changed from true to false to be cautious with unknown topics
        userMessage: 'Topic not found in compatibility mapping. Treating as non-comparable for safety.'
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

/**
 * Look up file metadata with compatibility information
 * @param fileIds Array of file IDs to enrich with metadata
 * @returns Array of file metadata with compatibility information
 */
export function lookupFiles(fileIds: string[]): FileMetadata[] {
  try {
    const mapping = loadCompatibilityMapping();
    return fileIds.map(fileId => {
      // Clean the fileId by removing .json extension if present
      const cleanFileId = fileId.replace(/\.json$/, '');
      
      // Get file entry from mapping
      const fileEntry = mapping.files[cleanFileId];
      
      if (!fileEntry) {
        // Default for unknown files - conservative approach
        return {
          fileId: cleanFileId,
          topicId: 'Unknown',
          year: extractYearFromFileId(cleanFileId),
          comparable: false,
          userMessage: 'No compatibility information available for this file.'
        };
      }
      
      // Build enriched metadata
      const meta: FileMetadata = {
        fileId: cleanFileId,
        topicId: fileEntry.topicId,
        year: (typeof fileEntry.year === 'number' && !isNaN(fileEntry.year))
              ? fileEntry.year
              : extractYearFromFileId(cleanFileId),
        comparable: fileEntry.comparable,
        userMessage: fileEntry.userMessage
      };

      // DEBUG TRACE — deduplicated to avoid repetitive logs
      if (!COMPAT_TRACE_SEEN.has(meta.fileId)) {
        logger.debug(`[COMPAT_TRACE] ${meta.fileId} | topic=${meta.topicId} | year=${meta.year} | comparable=${meta.comparable}`);
        COMPAT_TRACE_SEEN.add(meta.fileId);
      }

      return meta;
    });
  } catch (error) {
    logger.error(`Error looking up file metadata: ${(error as Error).message}`);
    // Return minimal metadata with default values
    return fileIds.map(fileId => ({
      fileId: fileId.replace(/\.json$/, ''),
      topicId: 'Unknown',
      year: extractYearFromFileId(fileId),
      comparable: false,
      userMessage: 'Unable to determine compatibility due to a technical issue.'
    }));
  }
}

/**
 * Check for comparable pairs of files across years
 * @param files Array of file metadata to check for comparable pairs
 * @returns Result with valid and invalid file pairs and user message
 */
export function getComparablePairs(files: FileMetadata[]): ComparablePairsResult {
  try {
    // Group files by topicId
    const topicGroups: Record<string, FileMetadata[]> = {};
    
    // Initialize result
    const result: ComparablePairsResult = {
      valid: [],
      invalid: [],
      message: ''
    };
    
    // Group files by topic
    files.forEach(file => {
      if (!topicGroups[file.topicId]) {
        topicGroups[file.topicId] = [];
      }
      topicGroups[file.topicId].push(file);
    });
    
    // Collect unique user messages
    const userMessages: Set<string> = new Set();
    
    // Process each topic group
    Object.entries(topicGroups).forEach(([topicId, topicFiles]) => {
      // Get all distinct years for this topic
      const years = new Set(topicFiles.map(file => file.year));

      if (years.has(2024) && years.has(2025)) {
        // Mixed year topic – evaluate each file individually
        topicFiles.forEach(file => {
          if (file.comparable) {
            result.valid.push(file.fileId);
          } else {
            result.invalid.push(file.fileId);
            if (file.userMessage) {
              userMessages.add(file.userMessage);
            }
          }
        });
      } else {
        // Topic doesn't have files from both years, so add them all to valid
        topicFiles.forEach(file => {
          result.valid.push(file.fileId);
        });
      }
    });
    
    // Combine all user messages
    result.message = Array.from(userMessages).join(' ');
    
    return result;
  } catch (error) {
    logger.error(`Error checking comparable pairs: ${(error as Error).message}`);
    return {
      valid: [],
      invalid: files.map(f => f.fileId),
      message: 'Unable to determine file compatibility due to a technical issue.'
    };
  }
}

/**
 * Summarize file compatibility by topic
 * @param files Array of file metadata
 * @returns Record of topicId to summary info
 */
export function summarizeTopicFiles(files: FileMetadata[]): Record<string, { years: number[]; comparable: boolean; userMessage?: string; }> {
  const summary: Record<string, { years: number[]; comparable: boolean; userMessage?: string; }> = {};

  files.forEach(file => {
    if (!summary[file.topicId]) {
      summary[file.topicId] = { years: [], comparable: true, userMessage: file.userMessage };
    }

    const topicInfo = summary[file.topicId];

    if (!topicInfo.years.includes(file.year)) {
      topicInfo.years.push(file.year);
    }

    if (!file.comparable) {
      topicInfo.comparable = false;
    }

    if (file.userMessage && !topicInfo.userMessage) {
      topicInfo.userMessage = file.userMessage;
    }
  });

  return summary;
}

/**
 * Extract year from file ID
 * @param fileId File ID to extract year from
 * @returns Extracted year or default (2025)
 */
function extractYearFromFileId(fileId: string): number {
  if (fileId.startsWith('2024')) return 2024;
  if (fileId.startsWith('2025')) return 2025;
  
  // Try to extract from more complex patterns
  const yearMatch = fileId.match(/^(\d{4})_/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year === 2024 || year === 2025) {
      return year;
    }
  }
  
  // Default to current year as fallback
  return 2025;
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
  getFileIncomparabilityReason,
  lookupFiles,
  getComparablePairs,
  summarizeTopicFiles
};

// Last updated: Sat May 31 12:26:45 UTC 2025
