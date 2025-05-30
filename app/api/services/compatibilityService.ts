/**
 * Service for compatibility checking between datasets.
 * Provides methods for determining if datasets are comparable across years
 * and retrieving compatibility information.
 *
 * Last Updated: Mon May 27 2024
 */

import logger from "../../../utils/shared/logger";
import * as compatibility from "../../../utils/compatibility/compatibility";
import { CompatibilityMapping, CompatibilityTopic, FileMetadata } from "../../../utils/compatibility/compatibility";

export interface FileCompatibilityResult {
  fileId: string;
  isComparable: boolean;
  topicId?: string;
  topicMessage?: string;
}

export interface TopicCompatibilityResult {
  topicId: string;
  isComparable: boolean;
  message?: string;
}

export interface CompatibilityMetadata {
  hasIncomparableTopics: boolean;
  incomparableTopicMessages: Record<string, string>;
  fileCompatibility?: Record<string, {
    isComparable: boolean;
    topicId?: string;
    message?: string;
  }>;
}

export interface FileIdentificationResult {
  matched_topics?: Array<{ id: string; confidence: number }>;
  fileIds?: string[];
  [key: string]: any;
}

export class CompatibilityService {
  constructor() {}

  /**
   * Get the complete compatibility mapping
   * @param {boolean} forceRefresh - Force reload from disk even if cached
   * @returns {Promise<CompatibilityMapping>} The compatibility mapping
   */
  async getCompatibilityMapping(forceRefresh = false): Promise<CompatibilityMapping> {
    return forceRefresh
      ? compatibility.refreshCompatibilityMapping()
      : compatibility.loadCompatibilityMapping();
  }

  /**
   * Check if a file is comparable across years
   * @param {string} fileId - The file ID to check
   * @returns {Promise<boolean>} Whether the file is comparable
   */
  async isFileComparable(fileId: string): Promise<boolean> {
    const fileInfo = compatibility.getFileCompatibility(fileId);
    return fileInfo.comparable;
  }

  /**
   * Check if a topic is comparable across years
   * @param {string} topicId - The topic ID to check
   * @returns {Promise<boolean>} Whether the topic is comparable
   */
  async isTopicComparable(topicId: string): Promise<boolean> {
    const topicInfo = compatibility.getTopicCompatibility(topicId);
    return topicInfo.comparable;
  }

  /**
   * Get the incomparability message for a topic if it exists
   * @param {string} topicId - The topic ID to check
   * @returns {Promise<string|null>} The message or null if topic is comparable
   */
  async getIncomparableTopicMessage(topicId: string): Promise<string | null> {
    return compatibility.getIncomparableTopicMessage(topicId);
  }

  /**
   * Check compatibility for a list of files
   * @param {string[]} fileIds - Array of file IDs to check
   * @returns {Promise<Record<string, FileCompatibilityResult>>} Object with compatibility status for each file
   */
  async checkFilesCompatibility(fileIds: string[]): Promise<Record<string, FileCompatibilityResult>> {
    logger.info(
      `[COMPATIBILITY] Checking compatibility for ${fileIds.length} files`
    );

    const results: Record<string, FileCompatibilityResult> = {};

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
   * @returns {Promise<Record<string, TopicCompatibilityResult>>} Object with compatibility status for each topic
   */
  async checkTopicsCompatibility(topicIds: string[]): Promise<Record<string, TopicCompatibilityResult>> {
    logger.info(
      `[COMPATIBILITY] Checking compatibility for ${topicIds.length} topics`
    );

    const results: Record<string, TopicCompatibilityResult> = {};

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
   * @returns {Promise<{filteredFileIds: string[], incomparableTopicMessages: Record<string, string>}>} Object with filtered file IDs and messages for incomparable topics
   */
  async filterIncomparableFiles(
    fileIds: string[], 
    isComparisonQuery: boolean
  ): Promise<{
    filteredFileIds: string[];
    incomparableTopicMessages: Record<string, string>;
  }> {
    logger.info(
      `[COMPATIBILITY] Filtering incomparable files for ${fileIds.length} files (comparison: ${isComparisonQuery})`
    );

    return compatibility.filterIncomparableFiles(fileIds, isComparisonQuery);
  }

  /**
   * Get list of all compatible topics
   * @returns {Promise<string[]>} Array of compatible topic IDs
   */
  async getCompatibleTopics(): Promise<string[]> {
    return compatibility.getCompatibleTopics();
  }

  /**
   * Get list of all non-comparable topics
   * @returns {Promise<string[]>} Array of non-comparable topic IDs
   */
  async getNonComparableTopics(): Promise<string[]> {
    return compatibility.getNonComparableTopics();
  }

  /**
   * Build compatibility metadata for thread context
   * @param {FileIdentificationResult} fileIdentificationResult - Result from file identification
   * @returns {Promise<CompatibilityMetadata>} Compatibility metadata
   */
  async buildCompatibilityMetadata(fileIdentificationResult?: FileIdentificationResult): Promise<CompatibilityMetadata> {
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
    const incomparableTopicMessages: Record<string, string> = {};
    let hasIncomparableTopics = false;

    for (const topicId in topicsCompatibility) {
      const topicInfo = topicsCompatibility[topicId];
      if (!topicInfo.isComparable && topicInfo.message) {
        incomparableTopicMessages[topicId] = topicInfo.message;
        hasIncomparableTopics = true;
      }
    }

    // Build file compatibility information
    const fileCompatibility: Record<string, {
      isComparable: boolean;
      topicId?: string;
      message?: string;
    }> = {};
    
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

// Last updated: Mon May 27 2024 