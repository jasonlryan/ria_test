/**
 * Compatibility Logger Utility
 *
 * Provides specialized logging functions for compatibility assessment to track
 * compatibility information, file IDs, and segments for monitoring and debugging.
 */

import logger from "../logger";

/**
 * Logs the result of a compatibility assessment
 * @param {string} query - The user query
 * @param {object} compatibilityMetadata - The compatibility metadata
 * @param {string[]} topicIds - Array of topic IDs
 * @param {string[]} segments - Array of segments
 */
export function logCompatibilityAssessment(
  query,
  compatibilityMetadata,
  topicIds,
  segments
) {
  logger.info(
    `[COMPATIBILITY] Assessment for query: "${query.substring(0, 100)}..."`
  );
  logger.info(`[COMPATIBILITY] Topics: ${topicIds.join(", ")}`);
  logger.info(`[COMPATIBILITY] Segments: ${segments.join(", ")}`);
  logger.info(
    `[COMPATIBILITY] Is Fully Compatible: ${compatibilityMetadata.isFullyCompatible}`
  );

  // Log incompatible topics if any
  const incompatibleTopics = Object.entries(
    compatibilityMetadata.topicCompatibility || {}
  )
    .filter(([_, info]) => !info.comparable)
    .map(([topic]) => topic);

  if (incompatibleTopics.length > 0) {
    logger.info(
      `[COMPATIBILITY] Incompatible Topics: ${incompatibleTopics.join(", ")}`
    );
  }

  // Log incompatible segments if any
  const incompatibleSegments = Object.entries(
    compatibilityMetadata.segmentCompatibility || {}
  )
    .filter(([_, info]) => !info.comparable)
    .map(([segment]) => segment);

  if (incompatibleSegments.length > 0) {
    logger.info(
      `[COMPATIBILITY] Incompatible Segments: ${incompatibleSegments.join(
        ", "
      )}`
    );
  }
}

/**
 * Logs compatibility metadata cache operations
 * @param {string} operation - The operation (e.g., 'write', 'read', 'validate')
 * @param {string} threadId - The thread ID
 * @param {boolean} success - Whether the operation was successful
 * @param {string} [message] - Optional message
 */
export function logCompatibilityCache(
  operation,
  threadId,
  success,
  message = ""
) {
  logger.info(
    `[COMPATIBILITY_CACHE] ${operation} for thread ${threadId}: ${
      success ? "SUCCESS" : "FAILED"
    } ${message}`
  );
}

/**
 * Logs detailed compatibility information to a file for analysis
 * @param {string} query - The user query
 * @param {string} threadId - The thread ID
 * @param {object} compatibilityMetadata - The compatibility metadata
 */
export function logCompatibilityToFile(query, threadId, compatibilityMetadata) {
  if (process.env.VERCEL) return; // Skip file logging on Vercel

  const fs = require("fs");
  const path = require("path");
  const logDir = path.join(process.cwd(), "logs");
  const logFile = path.join(logDir, "compatibility_assessment.log");

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    threadId,
    query: query.substring(0, 100),
    isFullyCompatible: compatibilityMetadata.isFullyCompatible,
    mappingVersion: compatibilityMetadata.mappingVersion,
    assessedAt: compatibilityMetadata.assessedAt,
    incompatibleTopics: Object.entries(
      compatibilityMetadata.topicCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([topic]) => topic),
    incompatibleSegments: Object.entries(
      compatibilityMetadata.segmentCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([segment]) => segment),
  };

  fs.promises
    .mkdir(logDir, { recursive: true })
    .then(() =>
      fs.promises.appendFile(logFile, JSON.stringify(logEntry) + "\n")
    )
    .then(() => {
      if (process.env.NODE_ENV === "development") {
        logger.debug(`Compatibility assessment saved to ${logFile}`);
      }
    })
    .catch((error) => {
      logger.error("Error writing to compatibility log:", error);
    });
}

/**
 * Logs when compatibility information is included in prompts
 * @param {string} verbosityLevel - The verbosity level used
 * @param {string} query - The user query
 * @param {boolean} isFullyCompatible - Whether data is fully compatible
 */
export function logCompatibilityInPrompt(
  verbosityLevel,
  query,
  isFullyCompatible
) {
  logger.info(
    `[COMPATIBILITY_PROMPT] Including ${verbosityLevel} compatibility info for query: "${query.substring(
      0,
      60
    )}..."`
  );
  logger.info(
    `[COMPATIBILITY_PROMPT] Compatibility status: ${
      isFullyCompatible ? "FULLY COMPATIBLE" : "COMPATIBILITY LIMITATIONS"
    }`
  );
}
