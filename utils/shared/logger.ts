/**
 * Logger Utility
 * Provides a simple logging interface for the application.
 */

/**
 * Logger interface defining the standard logging methods
 */
export interface Logger {
  /**
   * Log informational messages
   * @param args - Arguments to log
   */
  info(...args: any[]): void;
  
  /**
   * Log warning messages
   * @param args - Arguments to log
   */
  warn(...args: any[]): void;
  
  /**
   * Log error messages
   * @param args - Arguments to log
   */
  error(...args: any[]): void;
  
  /**
   * Log debug messages (only in development)
   * @param args - Arguments to log
   */
  debug(...args: any[]): void;
}

const logger: Logger = {
  /**
   * Log informational messages
   * @param args - Arguments to log
   */
  info: (...args: any[]): void => {
    console.log("[INFO]", ...args);
  },

  /**
   * Log warning messages
   * @param args - Arguments to log
   */
  warn: (...args: any[]): void => {
    console.warn("[WARN]", ...args);
  },

  /**
   * Log error messages
   * @param args - Arguments to log
   */
  error: (...args: any[]): void => {
    console.error("[ERROR]", ...args);
  },

  /**
   * Log debug messages (only in development)
   * @param args - Arguments to log
   */
  debug: (...args: any[]): void => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[DEBUG]", ...args);
    }
  },
};

export default logger; 