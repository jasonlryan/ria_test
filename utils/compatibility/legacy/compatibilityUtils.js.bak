/**
 * @deprecated - This module is deprecated and will be removed in a future version.
 * Please use the unified TypeScript compatibility module at utils/compatibility.ts instead.
 *
 * Compatibility utilities for checking dataset comparability across years
 * and accessing compatibility mapping data.
 *
 * Last Updated: Sat May 25 2025
 */

// Log a warning when this module is imported
console.warn(
  "DEPRECATED: utils/shared/compatibilityUtils.js is deprecated. " +
    "Please use utils/compatibility.ts instead."
);

const fs = require("fs");
const path = require("path");
const logger = require("../logger");

// In-memory cache for compatibility mapping
let compatibilityMappingCache = null;

/**
 * Get the path to the compatibility mapping file
 * @returns {string} Path to compatibility mapping file
 */
function getCompatibilityMappingPath() {
  // NOTE: Routing changed from original "data/compatibility/compatibility_mapping.json" to unified file
  return path.join(
    process.cwd(),
    "data",
    "compatibility",
    "unified_compatibility.json"
  );
}

/**
 * Load compatibility mapping from disk
 * @returns {Object|null} Compatibility mapping or null if not found
 */
function loadCompatibilityMapping() {
  const mappingPath = getCompatibilityMappingPath();

  try {
    if (!fs.existsSync(mappingPath)) {
      logger.warn(`Compatibility mapping file not found at ${mappingPath}`);
      return null;
    }

    const data = fs.readFileSync(mappingPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error loading compatibility mapping: ${error.message}`);
    return null;
  }
}

/**
 * Get compatibility mapping, using cache if available
 * @param {boolean} forceRefresh - Force refresh from disk
 * @returns {Object} Compatibility mapping
 */
function getCompatibilityMapping(forceRefresh = false) {
  if (!compatibilityMappingCache || forceRefresh) {
    compatibilityMappingCache = loadCompatibilityMapping();
    if (!compatibilityMappingCache) {
      // Return an empty mapping structure if file cannot be loaded
      return {
        version: "1.0",
        lastUpdated: new Date().toISOString().split("T")[0],
        files: {},
        topics: {},
      };
    }
  }

  return compatibilityMappingCache;
}

/**
 * Check if a file is comparable based on compatibility mapping
 * @param {string} fileId - File ID to check
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {boolean} True if comparable, false if not
 */
function isFileComparable(fileId, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();

  // If file is not in mapping, default to true (assume comparable)
  if (!compatMapping.files || !compatMapping.files[fileId]) {
    return true;
  }

  // Updated to use 'comparable' property instead of 'isComparable'
  return compatMapping.files[fileId].comparable;
}

/**
 * Check if a topic is comparable based on compatibility mapping
 * @param {string} topicId - Topic ID to check
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {boolean} True if comparable, false if not
 */
function isTopicComparable(topicId, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();

  // If topic is not in mapping, default to true (assume comparable)
  if (!compatMapping.topics || !compatMapping.topics[topicId]) {
    return true;
  }

  // Updated to use 'comparable' property instead of 'isComparable'
  return compatMapping.topics[topicId].comparable;
}

/**
 * Get user message for incomparable topic if it exists
 * @param {string} topicId - Topic ID to check
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {string|null} User message or null if not found or comparable
 */
function getIncomparableTopicMessage(topicId, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();

  if (
    !compatMapping.topics ||
    !compatMapping.topics[topicId] ||
    compatMapping.topics[topicId].comparable
  ) {
    return null;
  }

  return compatMapping.topics[topicId].userMessage || null;
}

/**
 * Get all file IDs associated with a specific topic
 * @param {string} topicId - Topic ID to get files for
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {string[]} Array of file IDs
 */
function getFileIdsForTopic(topicId, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();
  const fileIds = [];

  if (!compatMapping.files) {
    return fileIds;
  }

  // Collect all file IDs that match the topic
  Object.entries(compatMapping.files).forEach(([fileId, file]) => {
    if (file.topicId === topicId) {
      fileIds.push(fileId);
    }
  });

  return fileIds;
}

/**
 * Get reason why files are not comparable
 * @param {string} fileId - File ID to check
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {string|null} Reason or null if comparable or not found
 */
function getFileIncomparabilityReason(fileId, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();

  if (
    !compatMapping.files ||
    !compatMapping.files[fileId] ||
    compatMapping.files[fileId].comparable
  ) {
    return null;
  }

  return compatMapping.files[fileId].reason || null;
}

/**
 * Check if two files can be compared to each other
 * @param {string} fileId1 - First file ID
 * @param {string} fileId2 - Second file ID
 * @param {Object} [mapping] - Optional pre-loaded compatibility mapping
 * @returns {boolean} True if files can be compared
 */
function areFilesComparable(fileId1, fileId2, mapping = null) {
  const compatMapping = mapping || getCompatibilityMapping();

  // If either file is not in mapping, assume they are comparable
  if (
    !compatMapping.files ||
    !compatMapping.files[fileId1] ||
    !compatMapping.files[fileId2]
  ) {
    return true;
  }

  const file1 = compatMapping.files[fileId1];
  const file2 = compatMapping.files[fileId2];

  // If they have different topics, they are not comparable
  if (file1.topicId !== file2.topicId) {
    return false;
  }

  // If either file is marked as not comparable, they can't be compared
  // Updated to use 'comparable' property instead of 'isComparable'
  if (!file1.comparable || !file2.comparable) {
    return false;
  }

  return true;
}

module.exports = {
  getCompatibilityMapping,
  isFileComparable,
  isTopicComparable,
  getIncomparableTopicMessage,
  getFileIdsForTopic,
  getFileIncomparabilityReason,
  areFilesComparable,
};

// Last updated: Sat May 25 2025
