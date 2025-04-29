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

import { FileData } from './FileRepository';
import { QueryContext } from './QueryContext';

/**
 * Options for segment filtering
 */
export interface SegmentFilterOptions {
  includeAll?: boolean;
  preserveStructure?: boolean;
  defaultSegments?: string[];
}

/**
 * Result of segment calculation
 */
export interface SegmentCalculationResult {
  availableSegments: string[];
  missingSegments: Record<string, string[]>;
  segmentsToLoad: Record<string, string[]>;
}

/**
 * Manager for handling data segmentation
 */
export interface SegmentManager {
  /**
   * Extract segment identifiers from a query
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Array of segment identifiers
   */
  extractSegmentsFromQuery(
    query: string,
    context?: QueryContext
  ): string[];

  /**
   * Calculate which segments are missing for the given files
   *
   * @param fileData Array of file data objects
   * @param requestedSegments Array of requested segment identifiers
   * @param context QueryContext with processing context
   * @returns Calculation result with missing segments
   */
  calculateMissingSegments(
    fileData: FileData[],
    requestedSegments: string[],
    context?: QueryContext
  ): SegmentCalculationResult;

  /**
   * Load additional segments for files
   *
   * @param fileData Array of file data objects
   * @param segmentsToLoad Record mapping file IDs to segments
   * @param context QueryContext with processing context
   * @returns Updated file data with new segments
   */
  loadAdditionalSegments(
    fileData: FileData[],
    segmentsToLoad: Record<string, string[]>,
    context?: QueryContext
  ): Promise<FileData[]>;

  /**
   * Merge new segments into existing file data
   *
   * @param existingData Existing file data
   * @param newSegments New segment data to merge
   * @returns Merged file data
   */
  mergeFileSegments(
    existingData: FileData,
    newSegments: any
  ): FileData;

  /**
   * Filter data by segment identifiers
   *
   * @param fileData Array of file data objects
   * @param segments Array of segment identifiers to include
   * @param options Filter options
   * @returns Filtered file data
   */
  filterDataBySegments(
    fileData: FileData[],
    segments: string[],
    options?: SegmentFilterOptions
  ): FileData[];

  /**
   * Identify segments relevant to a query
   *
   * @param query User query text
   * @param availableSegments Array of available segment identifiers
   * @param context QueryContext with processing context
   * @returns Array of relevant segment identifiers
   */
  filterRelevantSegments(
    query: string,
    availableSegments: string[],
    context?: QueryContext
  ): string[];
}

export default SegmentManager; 