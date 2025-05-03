/**
 * Repository Pattern Monitoring
 *
 * Provides monitoring and metrics tracking capabilities for comparing
 * the original implementation with the repository pattern implementation.
 * This helps validate the compatibility and performance of the refactor.
 *
 * Last Updated: Sat May 3 2025
 */

import logger from '../../../shared/logger';

// Performance metrics type
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  implementation: 'original' | 'repository';
  operation: string;
  success: boolean;
  threadId?: string;
  queryLength?: number;
  filesProcessed?: number;
}

// Store for metrics (in-memory for development, would use proper metrics in production)
class MetricsStore {
  private metrics: PerformanceMetrics[] = [];
  private errorCounts: Record<string, { original: number, repository: number }> = {};
  
  // Add a metric entry
  addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    logger.info(`[METRICS] Recorded ${metric.implementation} ${metric.operation} in ${metric.duration}ms`);
    
    // Periodically clean up old metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }
  
  // Record an error
  recordError(implementation: 'original' | 'repository', operation: string): void {
    if (!this.errorCounts[operation]) {
      this.errorCounts[operation] = { original: 0, repository: 0 };
    }
    
    this.errorCounts[operation][implementation]++;
    logger.error(`[METRICS] Error in ${implementation} ${operation}, count: ${this.errorCounts[operation][implementation]}`);
  }
  
  // Get metrics for comparison
  getComparison(): Record<string, { original: { avg: number, count: number }, repository: { avg: number, count: number } }> {
    const comparison: Record<string, { original: { avg: number, count: number }, repository: { avg: number, count: number } }> = {};
    
    // Group by operation
    for (const metric of this.metrics) {
      if (!metric.duration) continue;
      
      if (!comparison[metric.operation]) {
        comparison[metric.operation] = {
          original: { avg: 0, count: 0 },
          repository: { avg: 0, count: 0 }
        };
      }
      
      const entry = comparison[metric.operation][metric.implementation];
      entry.avg = (entry.avg * entry.count + metric.duration) / (entry.count + 1);
      entry.count++;
    }
    
    return comparison;
  }
  
  // Get error rates
  getErrorRates(): Record<string, { original: number, repository: number }> {
    return { ...this.errorCounts };
  }
}

// Create singleton metrics store
const metricsStore = new MetricsStore();

/**
 * Start timing an operation
 *
 * @param implementation Which implementation is being used
 * @param operation Operation name
 * @param context Additional context like threadId
 * @returns Performance metrics object
 */
export function startTimer(
  implementation: 'original' | 'repository',
  operation: string,
  context?: { threadId?: string, queryLength?: number }
): PerformanceMetrics {
  return {
    startTime: performance.now(),
    implementation,
    operation,
    success: false,
    threadId: context?.threadId,
    queryLength: context?.queryLength
  };
}

/**
 * Complete timing for an operation
 *
 * @param metrics Metrics object from startTimer
 * @param success Whether operation was successful
 * @param additionalData Additional data like filesProcessed
 */
export function endTimer(
  metrics: PerformanceMetrics,
  success: boolean,
  additionalData?: { filesProcessed?: number }
): void {
  metrics.endTime = performance.now();
  metrics.duration = metrics.endTime - metrics.startTime;
  metrics.success = success;
  metrics.filesProcessed = additionalData?.filesProcessed;
  
  metricsStore.addMetric(metrics);
}

/**
 * Record an error for monitoring
 *
 * @param implementation Which implementation had the error
 * @param operation Operation name
 */
export function recordError(
  implementation: 'original' | 'repository',
  operation: string
): void {
  metricsStore.recordError(implementation, operation);
}

/**
 * Get performance comparison between implementations
 * @returns Comparison data
 */
export function getPerformanceComparison(): Record<string, { original: { avg: number, count: number }, repository: { avg: number, count: number } }> {
  return metricsStore.getComparison();
}

/**
 * Get error rates comparison between implementations
 * @returns Error rate data
 */
export function getErrorRates(): Record<string, { original: number, repository: number }> {
  return metricsStore.getErrorRates();
}

export default {
  startTimer,
  endTimer,
  recordError,
  getPerformanceComparison,
  getErrorRates
}; 