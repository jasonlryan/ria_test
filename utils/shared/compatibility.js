/**
 * @deprecated - This module is deprecated and will be removed in a future version.
 * Please use the unified TypeScript compatibility module at utils/compatibility.ts instead.
 *
 * File compatibility utilities for detecting and managing file compatibility.
 * Provides functions to load compatibility data, check if files are comparable,
 * and filter incomparable files from retrieval.
 *
 * Last Updated: Fri Apr 25 2025
 */

// Log a warning when this module is imported
console.warn(
  "DEPRECATED: utils/shared/compatibility.js is deprecated. " +
    "Please use utils/compatibility.ts instead."
);

import fs from "fs";
import path from "path";
import logger from "../../utils/logger";

// Path to compatibility mapping file
const COMPATIBILITY_FILE_PATH = path.join(
  process.cwd(),
  "scripts/reference files/file_compatibility.json"
);

// In-memory cache of the compatibility data
let compatibilityCache = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
let lastCacheTime = 0;

/**
 * Loads the file compatibility mapping from disk
 * @returns {object} The file compatibility mapping
 * @throws {Error} If the compatibility file cannot be loaded
 */
export function loadCompatibilityMapping() {
  try {
    // Check if cache is valid
    const now = Date.now();
    if (compatibilityCache && now - lastCacheTime < CACHE_TTL) {
      logger.debug("Using cached compatibility mapping");
      return compatibilityCache;
    }

    // Read and parse the compatibility file
    const fileContent = fs.readFileSync(COMPATIBILITY_FILE_PATH, "utf8");
    const compatibilityData = JSON.parse(fileContent);

    // Update cache
    compatibilityCache = compatibilityData;
    lastCacheTime = now;

    logger.info(
      `Loaded compatibility mapping with ${
        Object.keys(compatibilityData.fileCompatibility).length
      } file entries`
    );
    return compatibilityData;
  } catch (error) {
    logger.error(`Error loading compatibility mapping: ${error.message}`);
    throw new Error(`Failed to load compatibility data: ${error.message}`);
  }
}

/**
 * Check if a file is comparable based on the compatibility mapping
 * @param {string} fileId - The file ID to check (without .json extension)
 * @returns {object} Compatibility information { comparable, topic, userMessage }
 */
export function getFileCompatibility(fileId) {
  try {
    const mapping = loadCompatibilityMapping();

    // Clean the fileId by removing .json extension if present
    const cleanFileId = fileId.replace(/\.json$/, "");

    // Get compatibility info or return a default
    const compatibility = mapping.fileCompatibility[cleanFileId] || {
      comparable: false,
      topic: "Unknown",
      userMessage: "Compatibility information not available for this file.",
    };

    return compatibility;
  } catch (error) {
    logger.error(
      `Error checking file compatibility for ${fileId}: ${error.message}`
    );
    return {
      comparable: false,
      topic: "Unknown",
      userMessage:
        "Unable to determine compatibility due to a technical issue.",
    };
  }
}

/**
 * Check if multiple files are all comparable with each other
 * @param {string[]} fileIds - Array of file IDs to check
 * @returns {boolean} True if all files are comparable, false otherwise
 */
export function areFilesComparable(fileIds) {
  if (!fileIds || fileIds.length <= 1) {
    return true; // Single file or empty array is always "comparable"
  }

  try {
    // Group files by topic
    const topicGroups = {};

    fileIds.forEach((fileId) => {
      const compatibility = getFileCompatibility(fileId);
      if (!topicGroups[compatibility.topic]) {
        topicGroups[compatibility.topic] = [];
      }
      topicGroups[compatibility.topic].push({
        fileId,
        comparable: compatibility.comparable,
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
    logger.error(
      `Error checking multiple file compatibility: ${error.message}`
    );
    return false; // Be conservative on errors
  }
}

/**
 * Filter out incomparable files when a comparison is requested
 * @param {string[]} fileIds - Array of file IDs to filter
 * @param {boolean} isComparisonQuery - Whether this is a comparison query
 * @returns {object} Filtered file IDs and messages for incomparable topics
 */
export function filterIncomparableFiles(fileIds, isComparisonQuery) {
  if (!isComparisonQuery || !fileIds || fileIds.length <= 1) {
    return {
      filteredFileIds: fileIds,
      incomparableTopicMessages: {},
    };
  }

  try {
    const mapping = loadCompatibilityMapping();
    const incomparableTopicMessages = {};
    const topicToFiles = {};
    const fileToTopic = {};

    // First pass: organize files by topic
    fileIds.forEach((fileId) => {
      const cleanFileId = fileId.replace(/\.json$/, "");
      const compatibility = mapping.fileCompatibility[cleanFileId];

      if (!compatibility) return;

      const { topic } = compatibility;
      if (!topicToFiles[topic]) {
        topicToFiles[topic] = [];
      }

      topicToFiles[topic].push(fileId);
      fileToTopic[fileId] = topic;
    });

    // Second pass: filter incomparable topics with multiple files
    let filteredFileIds = [...fileIds];

    for (const topic in topicToFiles) {
      const topicFiles = topicToFiles[topic];

      // If we have multiple files for this topic
      if (topicFiles.length > 1) {
        // Check the first file (they should all have same comparable status for same topic)
        const firstFileId = topicFiles[0].replace(/\.json$/, "");
        const compatibility = mapping.fileCompatibility[firstFileId];

        if (compatibility && !compatibility.comparable) {
          // Remove all files for this topic
          filteredFileIds = filteredFileIds.filter(
            (fileId) => fileToTopic[fileId] !== topic
          );

          // Store the user message for this topic
          incomparableTopicMessages[topic] = compatibility.userMessage;

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
    logger.error(`Error filtering incomparable files: ${error.message}`);
    return {
      filteredFileIds: fileIds,
      incomparableTopicMessages: {},
    };
  }
}

/**
 * Get list of all compatible topics from the mapping
 * @returns {string[]} Array of compatible topic IDs
 */
export function getCompatibleTopics() {
  try {
    const mapping = loadCompatibilityMapping();
    return mapping.compatibleTopics || [];
  } catch (error) {
    logger.error(`Error getting compatible topics: ${error.message}`);
    return [];
  }
}

/**
 * Get list of all non-comparable topics from the mapping
 * @returns {string[]} Array of non-comparable topic IDs
 */
export function getNonComparableTopics() {
  try {
    const mapping = loadCompatibilityMapping();
    return mapping.nonComparableTopics || [];
  } catch (error) {
    logger.error(`Error getting non-comparable topics: ${error.message}`);
    return [];
  }
}

export default {
  loadCompatibilityMapping,
  getFileCompatibility,
  areFilesComparable,
  filterIncomparableFiles,
  getCompatibleTopics,
  getNonComparableTopics,
};

// Last updated: Fri Apr 25 2025
