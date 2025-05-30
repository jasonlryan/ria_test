/**
 * FilterProcessor Interface
 * 
 * Defines the contract for filter processors that filter data by segments
 * and other criteria. This is used to implement smart filtering within
 * the repository pattern.
 * 
 * Last Updated: Sat May 25 2025
 */

import { DataFile } from "./FileRepository";
import { QueryContext } from "./QueryContext";

/**
 * Interface for query intent information extracted from queries
 */
export interface QueryIntent {
  topics: string[];
  demographics: string[];
  years: number[];
  specificity: "general" | "specific";
  isFollowUp: boolean;
}

/**
 * Interface for data scope used in filtering
 */
export interface DataScope {
  topics: Set<string>;
  demographics: Set<string>;
  years: Set<number>;
  fileIds: Set<string>;
}

/**
 * Interface for filtered data items
 */
export interface FilteredDataItem {
  fileId: string;
  question: string;
  response: string;
  segment: string;
  category: string;
  value: string | number;
  stat: number;
  percentage: number;
  formatted: string;
}

/**
 * Result of filtering data by segments and other criteria
 */
export interface FilterResult {
  /**
   * Filtered data items organized by segment
   */
  filteredData: FilteredDataItem[];
  
  /**
   * Statistics extracted from the data
   */
  stats: FilteredDataItem[];
  
  /**
   * Summary of the filtering operation
   */
  summary?: string;
  
  /**
   * Segments that were found in the data
   */
  foundSegments: string[];
  
  /**
   * Segments that were requested but not found in the data
   */
  missingSegments: string[];

  /**
   * All unique canonical segment keys found within each processed input file.
   * Maps file_id to an array of segment strings.
   * Optional, as older implementations might not provide this.
   */
  allAvailableSegmentsInFiles?: Record<string, string[]>;
}

/**
 * Interface for processors that filter data by segments and other criteria
 */
export interface FilterProcessor {
  /**
   * Filter data by segments and extract statistics
   * 
   * @param files Array of data files to filter
   * @param context Query context containing segment information
   * @returns FilterResult containing filtered data and statistics
   */
  filterDataBySegments(
    files: DataFile[],
    context: QueryContext
  ): FilterResult;
  
  /**
   * Parse query intent from the query text and context
   * 
   * @param query Query text to parse
   * @param context Query context
   * @returns Updated context with parsed intent
   */
  parseQueryIntent(
    query: string,
    context: QueryContext
  ): QueryContext;
  
  /**
   * Return only essential data for general queries
   * 
   * @param files Array of data files
   * @param context Query context
   * @returns Filter result with base data
   */
  getBaseData(
    files: DataFile[],
    context: QueryContext
  ): FilterResult;
} 