import { QueryContext as IQueryContext, CompatibilityData, SegmentTrackingData } from '../interfaces/QueryContext';

/**
 * Implementation of the QueryContext interface
 * 
 * Provides a concrete implementation of the standard context object
 * that's passed between query processing components.
 * 
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#querycontext-interface
 * - Analysis: ../analysis/QueryContext-Analysis.md#context-model-analysis
 * 
 * Last Updated: Wed May 1 2024
 */
export class QueryContext implements IQueryContext {
  // Basic properties
  threadId?: string;
  query: string;
  isFollowUp: boolean;
  previousQuery?: string;
  previousResponse?: string;

  // File tracking
  cachedFileIds: string[] = [];
  relevantFiles: string[] = [];

  // Data processing
  processedData: any = null;
  dataVersion: string = "v2";

  // Enhanced capabilities
  compatibility?: CompatibilityData;
  segmentTracking?: SegmentTrackingData;

  // Response enhancement
  responseProperties: Record<string, any> = {};

  constructor(queryOrObj: string | Partial<IQueryContext>, threadId?: string) {
    if (typeof queryOrObj === 'string') {
      // Constructor with query string
      this.query = queryOrObj;
      this.threadId = threadId;
      this.isFollowUp = false;
    } else {
      // Constructor with partial object
      const obj = queryOrObj;
      this.query = obj.query || '';
      this.isFollowUp = obj.isFollowUp ?? false;
      this.threadId = obj.threadId;
      this.previousQuery = obj.previousQuery;
      this.previousResponse = obj.previousResponse;
      this.cachedFileIds = obj.cachedFileIds || [];
      this.relevantFiles = obj.relevantFiles || [];
      this.processedData = obj.processedData || null;
      this.dataVersion = obj.dataVersion || "v2";
      this.compatibility = obj.compatibility;
      this.segmentTracking = obj.segmentTracking;
      this.responseProperties = obj.responseProperties || {};
    }
  }

  /**
   * Create a deep clone of this context
   */
  clone(): QueryContext {
    // Use JSON serialization for deep cloning
    return QueryContext.fromJSON(this.toJSON());
  }

  /**
   * Convert to a plain object for storage
   */
  toJSON(): Record<string, any> {
    // Convert to plain object
    return {
      threadId: this.threadId,
      query: this.query,
      isFollowUp: this.isFollowUp,
      previousQuery: this.previousQuery,
      previousResponse: this.previousResponse,
      cachedFileIds: this.cachedFileIds,
      relevantFiles: this.relevantFiles,
      processedData: this.processedData,
      dataVersion: this.dataVersion,
      compatibility: this.compatibility,
      segmentTracking: this.segmentTracking,
      responseProperties: this.responseProperties
    };
  }

  /**
   * Create a QueryContext from a plain object
   */
  static fromJSON(json: Record<string, any>): QueryContext {
    return new QueryContext(json);
  }

  /**
   * Merge updates into this context
   */
  merge(updates: Partial<IQueryContext>): QueryContext {
    // Create a new context with merged properties
    return new QueryContext({
      ...this.toJSON(),
      ...updates,
      // Special handling for nested objects
      compatibility: updates.compatibility && this.compatibility
        ? { ...this.compatibility, ...updates.compatibility }
        : (updates.compatibility || this.compatibility),
      segmentTracking: updates.segmentTracking && this.segmentTracking
        ? { ...this.segmentTracking, ...updates.segmentTracking }
        : (updates.segmentTracking || this.segmentTracking),
      responseProperties: updates.responseProperties
        ? { ...this.responseProperties, ...updates.responseProperties }
        : this.responseProperties
    });
  }
} 