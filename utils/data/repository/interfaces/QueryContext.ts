/**
 * QueryContext Interface
 *
 * Defines the standard context object passed between query processing components.
 * Standardizes context information needed for query processing across implementations.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#querycontext-interface
 * - Analysis: ../analysis/QueryContext-Analysis.md#context-object-analysis
 *
 * Last Updated: Sat May 25 2025
 */

import { QueryIntent } from './FilterProcessor';

/**
 * Compatibility metadata structure
 */
export interface CompatibilityData {
  compatibleYears: string[];
  compatibleSegments: string[];
  compatibilityScore: number;
  incompatibleReasons: string[];
  metadataCompatibility: Record<string, boolean>;
}

/**
 * Segment tracking data structure
 */
export interface SegmentTrackingData {
  /**
   * Segments already loaded by fileId
   */
  loadedSegments: Record<string, string[]>;
  
  /**
   * Segments currently in use
   */
  currentSegments: string[];
  
  /**
   * Segments requested in the current query
   */
  requestedSegments: string[];
  
  /**
   * Segments that need to be loaded by fileId
   */
  missingSegments: Record<string, string[]>;
}

/**
 * Standard context object for query processing
 */
export interface QueryContext {
  // Basic properties
  threadId?: string;
  query: string;
  isFollowUp: boolean;
  previousQuery?: string;
  previousResponse?: string;

  // File tracking
  cachedFileIds?: string[];
  relevantFiles?: string[];

  // Data processing
  processedData?: any;
  dataVersion?: string;

  // Enhanced capabilities
  compatibility?: CompatibilityData;
  segmentTracking: SegmentTrackingData;
  
  /**
   * Parsed intent from the query
   */
  queryIntent?: QueryIntent;

  // Response enhancement
  responseProperties?: Record<string, any>;

  // Additional properties
  [key: string]: any;
}

/**
 * Utility functions for creating context objects
 */
export const createBasicContext = (query: string): QueryContext => ({
  query,
  isFollowUp: false,
  segmentTracking: {
    loadedSegments: {},
    currentSegments: [],
    requestedSegments: [],
    missingSegments: {}
  }
});

export const createThreadContext = (query: string, threadId: string): QueryContext => ({
  ...createBasicContext(query),
  threadId
});

export const createCompatibilityContext = (query: string, threadId: string, compatibilityData: Partial<CompatibilityData>): QueryContext => ({
  ...createThreadContext(query, threadId),
  compatibility: {
    compatibleYears: [],
    compatibleSegments: [],
    compatibilityScore: 0,
    incompatibleReasons: [],
    metadataCompatibility: {},
    ...compatibilityData
  }
});

export default QueryContext; 