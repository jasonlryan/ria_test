/**
 * Repository Pattern Monitoring System
 * 
 * Provides unified performance tracking for repository pattern implementation.
 * Records metrics for both original and repository implementations to support
 * the incremental rollout process.
 */

import fs from 'fs';
import path from 'path';
import logger from '../../../shared/logger';

// Define types for metrics
interface ImplementationMetrics {
  original: number;
  repository: number;
}

interface OperationPerformance {
  callCount: number;
  totalDuration: ImplementationMetrics;
  averageDuration: ImplementationMetrics;
  callCounts: ImplementationMetrics;
}

interface OperationErrors {
  original: number;
  repository: number;
}

interface MetricsStore {
  overall: {
    totalOperations: number;
    averageSpeeds: ImplementationMetrics;
    callCounts: ImplementationMetrics;
    totalErrors: ImplementationMetrics;
  };
  performance: Record<string, OperationPerformance>;
  errors: Record<string, OperationErrors>;
  timestamp: string;
}

// Store metrics in a file that can be accessed by both main and monitoring servers
const METRICS_FILE = path.join(process.cwd(), '.next', 'repository-metrics.json');

// In-memory metrics store as fallback
let metricsStore: MetricsStore = {
  overall: {
    totalOperations: 0,
    averageSpeeds: {
      original: 0,
      repository: 0
    },
    callCounts: {
      original: 0,
      repository: 0
    },
    totalErrors: {
      original: 0,
      repository: 0
    }
  },
  performance: {},
  errors: {},
  timestamp: new Date().toISOString()
};

// Initialize metrics file if it doesn't exist
try {
  if (!fs.existsSync(path.dirname(METRICS_FILE))) {
    fs.mkdirSync(path.dirname(METRICS_FILE), { recursive: true });
  }
  if (!fs.existsSync(METRICS_FILE)) {
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metricsStore), 'utf8');
    logger.info(`[MONITORING] Created metrics file at ${METRICS_FILE}`);
  } else {
    // Load existing metrics
    const data = fs.readFileSync(METRICS_FILE, 'utf8');
    metricsStore = JSON.parse(data);
    logger.info(`[MONITORING] Loaded existing metrics from ${METRICS_FILE}`);
  }
} catch (error) {
  logger.error(`[MONITORING] Error initializing metrics file: ${error.message}`);
}

/**
 * Start a timer for an operation
 * @param {string} implementation - 'original' or 'repository'
 * @param {string} operation - The operation name
 * @param {object} metadata - Optional metadata for the operation
 * @returns {object} Timer object
 */
export function startTimer(implementation: string, operation: string, metadata: Record<string, any> = {}) {
  return {
    implementation,
    operation,
    startTime: performance.now(),
    metadata
  };
}

/**
 * End a timer and record the result
 * @param {object} timer - Timer object from startTimer
 * @param {boolean} success - Whether the operation succeeded
 * @param {object} results - Optional results metadata
 */
export function endTimer(timer: any, success: boolean, results: Record<string, any> = {}) {
  const { implementation, operation, startTime, metadata } = timer;
  const duration = performance.now() - startTime;
  
  try {
    // Load latest metrics first to avoid overwriting other processes' data
    loadMetrics();
    
    // Update operation-specific metrics
    if (!metricsStore.performance[operation]) {
      metricsStore.performance[operation] = {
        callCount: 0,
        totalDuration: {
          original: 0,
          repository: 0
        },
        averageDuration: {
          original: 0,
          repository: 0
        },
        callCounts: {
          original: 0,
          repository: 0
        }
      };
    }
    
    // Update performance metrics
    const perfMetrics = metricsStore.performance[operation];
    perfMetrics.callCount++;
    perfMetrics.totalDuration[implementation] += duration;
    perfMetrics.callCounts[implementation]++;
    perfMetrics.averageDuration[implementation] = 
      perfMetrics.totalDuration[implementation] / perfMetrics.callCounts[implementation];
    
    // Update overall metrics
    metricsStore.overall.totalOperations++;
    metricsStore.overall.callCounts[implementation]++;
    
    // Recalculate average speeds
    const totalDuration = Object.values(metricsStore.performance).reduce(
      (sum: number, op: OperationPerformance) => {
        // Safely access the implementation property with type checking
        return sum + (op.totalDuration[implementation as keyof ImplementationMetrics] || 0);
      }, 0
    );
    
    metricsStore.overall.averageSpeeds[implementation] = 
      totalDuration / metricsStore.overall.callCounts[implementation];
    
    // Update timestamp
    metricsStore.timestamp = new Date().toISOString();
    
    // Save metrics to file for inter-process access
    saveMetrics();
    
    logger.debug(
      `[MONITORING] ${implementation} ${operation} completed in ${duration.toFixed(2)}ms`
    );
  } catch (error) {
    logger.error(`[MONITORING] Error recording metrics: ${error.message}`);
  }
}

/**
 * Record an error for an operation
 * @param {string} implementation - 'original' or 'repository'
 * @param {string} operation - The operation name
 */
export function recordError(implementation: string, operation: string) {
  try {
    // Load latest metrics first
    loadMetrics();
    
    // Update error tracking
    if (!metricsStore.errors[operation]) {
      metricsStore.errors[operation] = {
        original: 0,
        repository: 0
      };
    }
    
    metricsStore.errors[operation][implementation]++;
    metricsStore.overall.totalErrors[implementation]++;
    
    // Update timestamp
    metricsStore.timestamp = new Date().toISOString();
    
    // Save metrics to file
    saveMetrics();
    
    logger.error(
      `[MONITORING] Error recorded for ${implementation} ${operation}`
    );
  } catch (error) {
    logger.error(`[MONITORING] Error recording error metrics: ${error.message}`);
  }
}

/**
 * Get current metrics
 * @returns {object} Current metrics
 */
export function getMetrics() {
  try {
    // Load the latest metrics from file
    loadMetrics();
    return metricsStore;
  } catch (error) {
    logger.error(`[MONITORING] Error retrieving metrics: ${error.message}`);
    return metricsStore; // Return in-memory metrics as fallback
  }
}

/**
 * Load metrics from the shared file
 */
function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf8');
      metricsStore = JSON.parse(data);
    }
  } catch (error) {
    logger.error(`[MONITORING] Error loading metrics from file: ${error.message}`);
  }
}

/**
 * Save metrics to the shared file
 */
function saveMetrics() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(path.dirname(METRICS_FILE))) {
      fs.mkdirSync(path.dirname(METRICS_FILE), { recursive: true });
    }
    
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metricsStore), 'utf8');
  } catch (error) {
    logger.error(`[MONITORING] Error saving metrics to file: ${error.message}`);
  }
}

export default {
  startTimer,
  endTimer,
  recordError,
  getMetrics
}; 