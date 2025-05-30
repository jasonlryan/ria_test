/**
 * Polling Manager
 * Provides a centralized, type-safe polling mechanism with configurable
 * retry logic, timeouts, and backoff strategies.
 */

import logger from './logger';
import { isFeatureEnabled } from '../feature-flags';

/**
 * Configuration for a polling operation
 */
export interface PollingConfig {
  /** Maximum time to poll in milliseconds */
  maxPollingTime?: number;
  /** Interval between polls in milliseconds */
  pollingInterval?: number;
  /** Number of retries for failed poll attempts */
  maxRetries?: number;
  /** Whether to use exponential backoff for retries */
  useExponentialBackoff?: boolean;
  /** Custom condition to stop polling */
  stopCondition?: (result: any) => boolean;
  /** Context for logging */
  context?: string;
}

/**
 * Default polling configuration
 */
const DEFAULT_CONFIG: Required<PollingConfig> = {
  maxPollingTime: 90000, // 90 seconds
  pollingInterval: 1000, // 1 second
  maxRetries: 2,
  useExponentialBackoff: true,
  stopCondition: () => false,
  context: 'POLLING',
};

/**
 * Error thrown when polling times out
 */
export class PollingTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PollingTimeoutError';
  }
}

/**
 * Error thrown when polling fails due to too many retries
 */
export class PollingRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PollingRetryError';
  }
}

/**
 * Manages polling operations with configurable behavior
 */
export class PollingManager {
  private static instance: PollingManager;

  private constructor() {}

  /**
   * Get the singleton instance of PollingManager
   */
  public static getInstance(): PollingManager {
    if (!PollingManager.instance) {
      PollingManager.instance = new PollingManager();
    }
    return PollingManager.instance;
  }

  /**
   * Execute a polling operation with the given configuration
   * @param pollingFn - The async function to poll
   * @param config - Polling configuration
   * @returns The final result of the polling operation
   */
  public async poll<T>(
    pollingFn: () => Promise<T>,
    config: PollingConfig = {}
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const {
      maxPollingTime,
      pollingInterval,
      maxRetries,
      useExponentialBackoff,
      stopCondition,
      context,
    } = finalConfig;

    const startTime = Date.now();
    let retryCount = 0;
    let lastError: Error | null = null;

    while (true) {
      try {
        // Check if we've exceeded max polling time
        if (Date.now() - startTime > maxPollingTime) {
          throw new PollingTimeoutError(
            `Polling timed out after ${maxPollingTime}ms [${context}]`
          );
        }

        // Execute polling function
        const result = await pollingFn();

        // Check if we should stop polling
        if (stopCondition(result)) {
          logger.info(`[${context}] Polling completed successfully`);
          return result;
        }

        // Calculate next polling interval
        const interval = useExponentialBackoff
          ? pollingInterval * Math.pow(2, retryCount)
          : pollingInterval;

        logger.debug(
          `[${context}] Polling attempt ${retryCount + 1}, waiting ${interval}ms`
        );

        // Wait for next interval
        await new Promise((resolve) => setTimeout(resolve, interval));
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount > maxRetries) {
          throw new PollingRetryError(
            `Polling failed after ${maxRetries} retries [${context}]: ${lastError.message}`
          );
        }

        logger.warn(
          `[${context}] Polling attempt ${retryCount} failed: ${lastError.message}`
        );
      }
    }
  }

  /**
   * Execute multiple polling operations in parallel
   * @param pollingOperations - Array of polling operations
   * @param config - Shared polling configuration
   * @returns Array of polling results
   */
  public async pollAll<T>(
    pollingOperations: Array<() => Promise<T>>,
    config: PollingConfig = {}
  ): Promise<T[]> {
    return Promise.all(
      pollingOperations.map((operation) => this.poll(operation, config))
    );
  }
}

// Export singleton instance
export const pollingManager = PollingManager.getInstance();

// Export convenience function for polling
export async function pollOperation<T>(
  operation: () => Promise<T>,
  config?: PollingConfig
): Promise<T> {
  return pollingManager.poll(operation, config);
} 