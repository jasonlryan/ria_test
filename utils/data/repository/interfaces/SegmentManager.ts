/**
 * SegmentManager Interface
 *
 * Defines the contract for components that manage data segmentation.
 * Handles identification, loading, and filtering of segments within data files.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#segmentmanager-interface
 * - Analysis: ../analysis/Consolidated-Analysis.md#dependencies-analysis
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: Wed May 1 2024
 */

import { DataFile } from './FileRepository';
import { QueryContext } from './QueryContext';

/**
 * Options for segment filtering operations
 */
export interface SegmentFilterOptions {
  /** Include only these segments in the filter */
  includeSegments?: string[];
  /** Exclude these segments from the filter */
  excludeSegments?: string[];
  /** Full segments that should be loaded regardless of content */
  requiredFullSegments?: string[];
  /** Filter criteria for segment content */
  filterCriteria?: {
    /** Terms that must be present in segment content */
    requiredTerms?: string[];
    /** Terms that must not be present in segment content */
    excludedTerms?: string[];
    /** Minimum relevance score for the segment to be included */
    minRelevanceScore?: number;
  };
}

/**
 * Result of a segment extraction operation
 */
export interface SegmentExtractionResult {
  /** Segments that were identified in the query */
  detectedSegments: string[];
  /** Pattern that matched segments (if any) */
  matchPattern?: string;
  /** Confidence score for the extraction (0-1) */
  confidence: number;
}

/**
 * Segment Manager Interface
 * 
 * Provides functionality for managing data segmentation
 */
export interface SegmentManager {
  /**
   * Extract segments mentioned in a query
   * 
   * @param query - The query text to analyze
   * @param context - Optional query context with additional information
   * @returns The extracted segments and extraction metadata
   */
  extractSegmentsFromQuery(query: string, context?: QueryContext): SegmentExtractionResult;

  /**
   * Calculate which segments are missing from a set of files
   * 
   * @param files - The files to check for segments
   * @param requiredSegments - The segments that are needed
   * @returns Record of file IDs to arrays of missing segments
   */
  calculateMissingSegments(
    files: DataFile[],
    requiredSegments: string[]
  ): Record<string, string[]>;

  /**
   * Load additional segments for files that are missing segments
   * 
   * @param files - The files that need additional segments
   * @param missingSegments - Record of file IDs to arrays of missing segments
   * @returns The updated files with new segments loaded
   */
  loadAdditionalSegments(
    files: DataFile[],
    missingSegments: Record<string, string[]>
  ): Promise<DataFile[]>;

  /**
   * Merge new segments into existing files
   * 
   * @param existingFiles - The files to update
   * @param newSegments - New segment data to merge
   * @returns The merged files with all segments
   */
  mergeFileSegments(
    existingFiles: DataFile[],
    newSegments: Record<string, Record<string, any>>
  ): DataFile[];

  /**
   * Filter data based on segments and filtering options
   * 
   * @param files - The files to filter
   * @param options - Filtering options
   * @returns The filtered files
   */
  filterDataBySegments(
    files: DataFile[],
    options: SegmentFilterOptions
  ): DataFile[];

  /**
   * Identify segments relevant to a query
   * 
   * @param query - The query to analyze
   * @param context - Query context with additional information
   * @returns Array of relevant segment identifiers
   */
  filterRelevantSegments(
    query: string,
    context: QueryContext
  ): string[];
}

export default SegmentManager; 