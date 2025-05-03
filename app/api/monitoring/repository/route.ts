/**
 * Repository Monitoring API
 *
 * Provides monitoring data for repository pattern implementation.
 * Endpoints for performance comparisons and error tracking.
 *
 * Last Updated: Sat May 3 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceComparison, getErrorRates } from '../../../../utils/data/repository/monitoring';
import { formatErrorResponse } from '../../../../utils/shared/errorHandler';
import logger from '../../../../utils/shared/logger';

/**
 * GET handler for repository monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    logger.info(`[MONITORING] Retrieving repository implementation metrics`);
    
    // Get performance comparison data
    const performanceData = getPerformanceComparison();
    
    // Get error rates
    const errorRates = getErrorRates();
    
    // Calculate overall metrics
    const operations = Object.keys(performanceData);
    const overallMetrics = {
      totalOperations: operations.length,
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
    };
    
    // Aggregate overall metrics
    let totalOriginalTime = 0;
    let totalRepoTime = 0;
    
    operations.forEach(op => {
      overallMetrics.callCounts.original += performanceData[op].original.count;
      overallMetrics.callCounts.repository += performanceData[op].repository.count;
      
      totalOriginalTime += performanceData[op].original.avg * performanceData[op].original.count;
      totalRepoTime += performanceData[op].repository.avg * performanceData[op].repository.count;
    });
    
    if (overallMetrics.callCounts.original > 0) {
      overallMetrics.averageSpeeds.original = totalOriginalTime / overallMetrics.callCounts.original;
    }
    
    if (overallMetrics.callCounts.repository > 0) {
      overallMetrics.averageSpeeds.repository = totalRepoTime / overallMetrics.callCounts.repository;
    }
    
    // Aggregate error counts
    Object.values(errorRates).forEach(rates => {
      overallMetrics.totalErrors.original += rates.original;
      overallMetrics.totalErrors.repository += rates.repository;
    });
    
    // Return comprehensive monitoring data
    return NextResponse.json({
      overall: overallMetrics,
      performance: performanceData,
      errors: errorRates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`[MONITORING] Error retrieving repository metrics: ${error.message}`);
    return formatErrorResponse(error);
  }
} 