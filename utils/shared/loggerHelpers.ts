/**
 * Logger Helper Utilities
 * Provides functions for performance metrics logging,
 * structured logging formats, and file-based logging.
 * Helps with debugging application performance.
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from "./logger";

/**
 * Metrics object type for performance logging
 */
export interface PerformanceMetrics {
  [key: string]: string | number | boolean;
}

/**
 * Logs performance metrics in a consistent format for testing
 * @param stage - The stage name
 * @param metrics - Key-value pairs of metrics
 */
export function logPerformanceMetrics(stage: string, metrics: PerformanceMetrics): void {
  logger.info(`----- ${stage} -----`);
  Object.entries(metrics).forEach(([key, value]) => {
    logger.info(`${key}: ${value}`);
  });
  logger.info("---------------------");
}

/**
 * Logs performance metrics to the performance_metrics.log file asynchronously
 * @param query - The query string
 * @param cachedFileIds - Array of cached file IDs
 * @param fileIds - Array of file IDs used
 * @param pollCount - Number of polls
 * @param totalTimeMs - Total time in milliseconds
 * @param status - Status code
 * @param message - Optional message
 */
export function logPerformanceToFile(
  query: string,
  cachedFileIds: string[],
  fileIds: string[],
  pollCount: number,
  totalTimeMs: number,
  status: number,
  message: string = ""
): void {
  if (process.env.VERCEL) return; // Skip file logging on Vercel
  
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