/**
 * Service for compatibility checking between datasets.
 * Provides methods for determining if datasets are comparable across years
 * and retrieving compatibility information.
 *
 * Last Updated: Mon May 6 2025
 */

import logger from "../../../utils/shared/logger";
import * as compatibility from "../../../utils/compatibility/compatibility";

export class CompatibilityService {
  constructor() {}

  /**
   * Get the complete compatibility mapping
   * @param {boolean} forceRefresh - Force reload from disk even if cached
   * @returns {Promise<object>} The compatibility mapping
   */
  async getCompatibilityMapping(forceRefresh = false) {
    return forceRefresh
      ? compatibility.refreshCompatibilityMapping()
      : compatibility.loadCompatibilityMapping();
  }

  /**
   * Check if a file is comparable across years
   * @param {string} fileId - The file ID to check
   * @returns {Promise<boolean>} Whether the file is comparable
   */
  async isFileComparable(fileId) {
    const fileInfo = compatibility.getFileCompatibility(fileId);
    return fileInfo.comparable;
  }

  /**
   * Check if a topic is comparable across years
   * @param {string} topicId - The topic ID to check
   * @returns {Promise<boolean>} Whether the topic is comparable
   */
  async isTopicComparable(topicId) {
    const topicInfo = compatibility.getTopicCompatibility(topicId);
    return topicInfo.comparable;
  }

  /**
   * Get the incomparability message for a topic if it exists
   * @param {string} topicId - The topic ID to check
   * @returns {Promise<string|null>} The message or null if topic is comparable
   */
  async getIncomparableTopicMessage(topicId) {
    return compatibility.getIncomparableTopicMessage(topicId);
  }

  /**
   * Check compatibility for a list of files
   * @param {string[]} fileIds - Array of file IDs to check
   * @returns {Promise<object>} Object with compatibility status for each file
   */
  async checkFilesCompatibility(fileIds) {
    logger.info(
      `[COMPATIBILITY] Checking compatibility for ${fileIds.length} files`
    );

    const results = {};

    for (const fileId of fileIds) {
      const fileInfo = compatibility.getFileCompatibility(fileId);

      results[fileId] = {
        fileId,
        isComparable: fileInfo.comparable,
        topicId: fileInfo.topic !== "Unknown" ? fileInfo.topic : undefined,
        topicMessage: fileInfo.userMessage,
      };
    }

    return results;
  }

  /**
   * Check compatibility for a list of topics
   * @param {string[]} topicIds - Array of topic IDs to check
   * @returns {Promise<object>} Object with compatibility status for each topic
   */
  async checkTopicsCompatibility(topicIds) {
    logger.info(
      `[COMPATIBILITY] Checking compatibility for ${topicIds.length} topics`
    );

    const results = {};

    for (const topicId of topicIds) {
      const topicInfo = compatibility.getTopicCompatibility(topicId);

      results[topicId] = {
        topicId,
        isComparable: topicInfo.comparable,
        message: topicInfo.userMessage,
      };
    }

    return results;
  }

  /**
   * Filter out incomparable files when a comparison is requested
   * @param {string[]} fileIds - Array of file IDs to filter
   * @param {boolean} isComparisonQuery - Whether this is a comparison query
   * @returns {Promise<object>} Object with filtered file IDs and messages for incomparable topics
   */
  async filterIncomparableFiles(fileIds, isComparisonQuery) {
    logger.info(
      `[COMPATIBILITY] Filtering incomparable files for ${fileIds.length} files (comparison: ${isComparisonQuery})`
    );

    return compatibility.filterIncomparableFiles(fileIds, isComparisonQuery);
  }

  /**
   * Get list of all compatible topics
   * @returns {Promise<string[]>} Array of compatible topic IDs
   */
  async getCompatibleTopics() {
    return compatibility.getCompatibleTopics();
  }

  /**
   * Get list of all non-comparable topics
   * @returns {Promise<string[]>} Array of non-comparable topic IDs
   */
  async getNonComparableTopics() {
    return compatibility.getNonComparableTopics();
  }

  /**
   * Build compatibility metadata for thread context
   * @param {object} fileIdentificationResult - Result from file identification
   * @returns {Promise<object>} Compatibility metadata
   */
  async buildCompatibilityMetadata(fileIdentificationResult) {
    logger.info(
      "[COMPATIBILITY] Building compatibility metadata for thread context"
    );

    if (!fileIdentificationResult || !fileIdentificationResult.matched_topics) {
      logger.warn("[COMPATIBILITY] No file identification result provided");
      return { hasIncomparableTopics: false, incomparableTopicMessages: {} };
    }

    const matchedTopics = fileIdentificationResult.matched_topics || [];
    const topicIds = matchedTopics.map((topic) => topic.id);

    const topicsCompatibility = await this.checkTopicsCompatibility(topicIds);

    // Collect incomparable topics
    const incomparableTopicMessages = {};
    let hasIncomparableTopics = false;

    for (const topicId in topicsCompatibility) {
      const topicInfo = topicsCompatibility[topicId];
      if (!topicInfo.isComparable && topicInfo.message) {
        incomparableTopicMessages[topicId] = topicInfo.message;
        hasIncomparableTopics = true;
      }
    }

    // Build file compatibility information
    const fileCompatibility = {};
    const fileIds = fileIdentificationResult.fileIds || [];

    if (fileIds.length > 0) {
      const fileResults = await this.checkFilesCompatibility(fileIds);
      for (const fileId in fileResults) {
        fileCompatibility[fileId] = {
          isComparable: fileResults[fileId].isComparable,
          topicId: fileResults[fileId].topicId,
          message: fileResults[fileId].topicMessage,
        };
      }
    }

    return {
      hasIncomparableTopics,
      incomparableTopicMessages,
      fileCompatibility,
    };
  }
}

export default CompatibilityService;

// Last updated: Mon May 6 2025
