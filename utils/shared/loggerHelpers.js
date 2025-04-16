import logger from "../logger";

/**
 * Logs performance metrics in a consistent format for testing
 * @param {string} stage - The stage name
 * @param {object} metrics - Key-value pairs of metrics
 */
export function logPerformanceMetrics(stage, metrics) {
  logger.info(`----- ${stage} -----`);
  Object.entries(metrics).forEach(([key, value]) => {
    logger.info(`${key}: ${value}`);
  });
  logger.info("---------------------");
}

/**
 * Logs performance metrics to the performance_metrics.log file asynchronously
 * @param {string} query - The query string
 * @param {string[]} cachedFileIds - Array of cached file IDs
 * @param {string[]} fileIds - Array of file IDs used
 * @param {number} pollCount - Number of polls
 * @param {number} totalTimeMs - Total time in milliseconds
 * @param {number} status - Status code
 * @param {string} message - Optional message
 */
export function logPerformanceToFile(
  query,
  cachedFileIds,
  fileIds,
  pollCount,
  totalTimeMs,
  status,
  message = ""
) {
  if (process.env.VERCEL) return; // Skip file logging on Vercel
  const fs = require("fs");
  const path = require("path");
  const logDir = path.join(process.cwd(), "logs");
  const logFile = path.join(logDir, "performance_metrics.log");

  const cachedFileIdsStr = Array.isArray(cachedFileIds)
    ? cachedFileIds.join(",")
    : "";
  const fileIdsStr = Array.isArray(fileIds) ? fileIds.join(",") : "";
  const timestamp = new Date().toISOString();

  const logEntry = `${query.substring(
    0,
    100
  )} | ${cachedFileIdsStr} | ${fileIdsStr} | ${pollCount} | ${totalTimeMs} | ${status} | ${timestamp}\n`;

  fs.promises
    .mkdir(logDir, { recursive: true })
    .then(() => fs.promises.appendFile(logFile, logEntry))
    .then(() => {
      if (process.env.NODE_ENV === "development") {
        logger.debug(`Performance metrics saved to ${logFile}`);
      }
    })
    .catch((error) => {
      logger.error("Error writing to performance log:", error);
    });
}
