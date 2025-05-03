/**
 * Repository Monitoring API
 *
 * Provides monitoring data for repository pattern implementation.
 * Endpoints for performance comparisons and error tracking.
 *
 * Last Updated: Sat May 3 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { formatErrorResponse } from '../../../../utils/shared/errorHandler';
import logger from '../../../../utils/shared/logger';

// File path to metrics
const METRICS_FILE = path.join(process.cwd(), '.next', 'repository-metrics.json');

/**
 * GET handler for repository monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    logger.info(`[MONITORING] Retrieving repository implementation metrics from ${METRICS_FILE}`);
    
    // Check if file exists
    if (!fs.existsSync(METRICS_FILE)) {
      logger.warn(`[MONITORING] Metrics file not found at ${METRICS_FILE}`);
      return NextResponse.json({
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
      });
    }
    
    // Read metrics directly from file
    const metricsData = fs.readFileSync(METRICS_FILE, 'utf8');
    const metrics = JSON.parse(metricsData);
    
    logger.info(`[MONITORING] Successfully retrieved metrics with ${Object.keys(metrics.performance || {}).length} operations`);
    
    // Return comprehensive monitoring data
    return NextResponse.json({
      ...metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`[MONITORING] Error retrieving repository metrics: ${error.message}`);
    return formatErrorResponse(error);
  }
} 