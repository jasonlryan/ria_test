/**
 * Migration Monitoring System
 * Tracks usage patterns, performance, and issues during the OpenAI service migration.
 */

import logger from './logger';
import { isFeatureEnabled } from './feature-flags';

interface MigrationMetrics {
  unifiedServiceCalls: number;
  legacyServiceCalls: number;
  errors: {
    unified: number;
    legacy: number;
  };
  performance: {
    unified: number[];
    legacy: number[];
  };
}

export class MigrationMonitor {
  private static instance: MigrationMonitor;
  private metrics: MigrationMetrics = {
    unifiedServiceCalls: 0,
    legacyServiceCalls: 0,
    errors: {
      unified: 0,
      legacy: 0,
    },
    performance: {
      unified: [],
      legacy: [],
    },
  };

  private constructor() {}

  public static getInstance(): MigrationMonitor {
    if (!MigrationMonitor.instance) {
      MigrationMonitor.instance = new MigrationMonitor();
    }
    return MigrationMonitor.instance;
  }

  /**
   * Track a service call
   * @param service - Which service was called
   * @param method - Which method was called
   * @param startTime - When the call started
   */
  public trackCall(service: 'unified' | 'legacy', method: string, startTime: number): void {
    if (!isFeatureEnabled('MONITOR_MIGRATION')) return;

    const duration = Date.now() - startTime;
    
    if (service === 'unified') {
      this.metrics.unifiedServiceCalls++;
      this.metrics.performance.unified.push(duration);
    } else {
      this.metrics.legacyServiceCalls++;
      this.metrics.performance.legacy.push(duration);
    }

    logger.debug(`[MIGRATION] ${service} service call to ${method} took ${duration}ms`);
  }

  /**
   * Track an error
   * @param service - Which service had the error
   * @param method - Which method had the error
   * @param error - The error that occurred
   */
  public trackError(service: 'unified' | 'legacy', method: string, error: Error): void {
    if (!isFeatureEnabled('MONITOR_MIGRATION')) return;

    if (service === 'unified') {
      this.metrics.errors.unified++;
    } else {
      this.metrics.errors.legacy++;
    }

    logger.warn(`[MIGRATION] Error in ${service} service ${method}: ${error.message}`);
  }

  /**
   * Check if there are any issues that warrant rollback
   */
  public hasIssues(): boolean {
    if (!isFeatureEnabled('MONITOR_MIGRATION')) return false;

    const { errors, performance } = this.metrics;
    
    // Check error rates
    const unifiedErrorRate = errors.unified / (this.metrics.unifiedServiceCalls || 1);
    const legacyErrorRate = errors.legacy / (this.metrics.legacyServiceCalls || 1);
    
    if (unifiedErrorRate > legacyErrorRate * 2) {
      logger.warn('[MIGRATION] Unified service error rate significantly higher than legacy');
      return true;
    }

    // Check performance
    const avgUnifiedPerformance = this.calculateAverage(performance.unified);
    const avgLegacyPerformance = this.calculateAverage(performance.legacy);
    
    if (avgUnifiedPerformance > avgLegacyPerformance * 1.5) {
      logger.warn('[MIGRATION] Unified service performance significantly worse than legacy');
      return true;
    }

    return false;
  }

  /**
   * Get current migration metrics
   */
  public getMetrics(): MigrationMetrics {
    return { ...this.metrics };
  }

  /**
   * Log current migration status
   */
  public logStatus(): void {
    if (!isFeatureEnabled('MONITOR_MIGRATION')) return;

    const { unifiedServiceCalls, legacyServiceCalls, errors, performance } = this.metrics;
    
    logger.info('[MIGRATION] Current Status:', {
      unifiedServiceCalls,
      legacyServiceCalls,
      errorRates: {
        unified: errors.unified / (unifiedServiceCalls || 1),
        legacy: errors.legacy / (legacyServiceCalls || 1),
      },
      avgPerformance: {
        unified: this.calculateAverage(performance.unified),
        legacy: this.calculateAverage(performance.legacy),
      },
    });
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

// Export singleton instance
export const migrationMonitor = MigrationMonitor.getInstance(); 