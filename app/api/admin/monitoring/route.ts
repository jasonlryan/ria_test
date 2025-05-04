/**
 * Unified Monitoring API
 * 
 * Provides metrics on:
 * 1. OpenAI Responses API migration
 * 2. Repository pattern implementation
 * 
 * Uses a single consolidated endpoint to reduce duplication
 */

import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';
import { migrationMonitor } from "../../../../utils/shared/monitoring";
import { isFeatureEnabled } from "../../../../utils/shared/feature-flags";
import logger from "../../../../utils/shared/logger";
import { getMetrics } from "../../../../utils/data/repository/monitoring";
import { formatErrorResponse } from "../../../../utils/shared/errorHandler";

// File path to repository metrics
const METRICS_FILE = path.join(process.cwd(), '.next', 'repository-metrics.json');

/**
 * GET handler for monitoring metrics
 * 
 * Query parameters:
 * - type: 'openai' (default) or 'repository' to specify which metrics to return
 * - combined: 'true' to return both types of metrics (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'openai';
    const combined = url.searchParams.get('combined') === 'true';
    
    // If combined is true, return both types of metrics
    if (combined) {
      return NextResponse.json({
        openai: getOpenAIMetrics(),
        repository: getRepositoryMetrics(),
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Otherwise return the requested type
    if (type === 'repository') {
      return NextResponse.json(getRepositoryMetrics());
    } else {
      return NextResponse.json(getOpenAIMetrics());
    }
  } catch (error) {
    logger.error('[ADMIN] Error generating monitoring dashboard:', error);
    
    return formatErrorResponse(error);
  }
}

/**
 * Get OpenAI migration metrics
 */
function getOpenAIMetrics() {
  // Get migration monitoring metrics
  const migrationMetrics = migrationMonitor.getMetrics();
  
  // Calculate rates and averages
  const totalUnifiedCalls = migrationMetrics.unifiedServiceCalls || 0;
  const totalLegacyCalls = migrationMetrics.legacyServiceCalls || 0;
  const totalCalls = totalUnifiedCalls + totalLegacyCalls;
  
  // Calculate error rates
  const unifiedErrorRate = totalUnifiedCalls 
    ? migrationMetrics.errors.unified / totalUnifiedCalls 
    : 0;
  const legacyErrorRate = totalLegacyCalls 
    ? migrationMetrics.errors.legacy / totalLegacyCalls 
    : 0;
  
  // Calculate average performance times
  const avgUnifiedPerformance = migrationMetrics.performance.unified.length 
    ? migrationMetrics.performance.unified.reduce((a, b) => a + b, 0) / migrationMetrics.performance.unified.length 
    : 0;
  const avgLegacyPerformance = migrationMetrics.performance.legacy.length 
    ? migrationMetrics.performance.legacy.reduce((a, b) => a + b, 0) / migrationMetrics.performance.legacy.length 
    : 0;
  
  // Prepare dashboard data
  return {
    migrationStatus: {
      useResponsesApiEnabled: isFeatureEnabled('USE_RESPONSES_API'),
      unifiedOpenAIServiceEnabled: isFeatureEnabled('UNIFIED_OPENAI_SERVICE'),
      monitorMigrationEnabled: isFeatureEnabled('MONITOR_MIGRATION'),
      fallbackToLegacyEnabled: isFeatureEnabled('FALLBACK_TO_LEGACY'),
    },
    callDistribution: {
      unified: totalUnifiedCalls,
      legacy: totalLegacyCalls,
      total: totalCalls,
      percentage: totalCalls ? (totalUnifiedCalls / totalCalls * 100).toFixed(2) + '%' : '0%'
    },
    errorMetrics: {
      unified: {
        count: migrationMetrics.errors.unified,
        rate: unifiedErrorRate.toFixed(4)
      },
      legacy: {
        count: migrationMetrics.errors.legacy,
        rate: legacyErrorRate.toFixed(4)
      },
      hasSignificantIssues: migrationMonitor.hasIssues()
    },
    performanceMetrics: {
      unified: {
        averageMs: avgUnifiedPerformance.toFixed(2),
        samples: migrationMetrics.performance.unified.length
      },
      legacy: {
        averageMs: avgLegacyPerformance.toFixed(2),
        samples: migrationMetrics.performance.legacy.length
      },
      comparison: avgLegacyPerformance && avgUnifiedPerformance
        ? ((avgUnifiedPerformance / avgLegacyPerformance) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get repository metrics
 */
function getRepositoryMetrics() {
  try {
    logger.info(`[MONITORING] Retrieving repository implementation metrics from ${METRICS_FILE}`);
    
    // First try to get metrics from the repository monitoring utility
    try {
      return {
        ...getMetrics(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn(`[MONITORING] Error using getMetrics(), falling back to file read: ${error.message}`);
      
      // Fall back to reading the file directly
      if (!fs.existsSync(METRICS_FILE)) {
        logger.warn(`[MONITORING] Metrics file not found at ${METRICS_FILE}`);
        return {
          overall: {
            totalOperations: 0,
            averageSpeeds: { original: 0, repository: 0 },
            callCounts: { original: 0, repository: 0 },
            totalErrors: { original: 0, repository: 0 }
          },
          performance: {},
          errors: {},
          timestamp: new Date().toISOString(),
          message: 'No metrics data available. Run tests or generate test data.'
        };
      }
      
      // Read metrics directly from file
      const metricsData = fs.readFileSync(METRICS_FILE, 'utf8');
      const metrics = JSON.parse(metricsData);
      
      logger.info(`[MONITORING] Successfully retrieved metrics with ${Object.keys(metrics.performance || {}).length} operations`);
      
      return {
        ...metrics,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.error(`[MONITORING] Error retrieving repository metrics: ${error.message}`);
    return {
      overall: {
        totalOperations: 0,
        averageSpeeds: { original: 0, repository: 0 },
        callCounts: { original: 0, repository: 0 },
        totalErrors: { original: 0, repository: 0 }
      },
      performance: {},
      errors: {},
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
} 