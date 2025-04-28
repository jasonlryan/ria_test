/**
 * Logger Utility
 * Provides a simple logging interface for the application.
 *
 * @module logger
 */

/**
 * Logger object with standardized logging methods
 * @typedef {Object} Logger
 * @property {Function} info - Log informational messages
 * @property {Function} warn - Log warning messages
 * @property {Function} error - Log error messages
 * @property {Function} debug - Log debug messages (only in development)
 */

const logger = {
  /**
   * Log informational messages
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.log("[INFO]", ...args);
  },

  /**
   * Log warning messages
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn("[WARN]", ...args);
  },

  /**
   * Log error messages
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error("[ERROR]", ...args);
  },

  /**
   * Log debug messages (only in development)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[DEBUG]", ...args);
    }
  },
};

export default logger;
