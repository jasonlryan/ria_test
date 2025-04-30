/**
 * QueryProcessor Interface
 *
 * Defines the contract for processing queries against data files.
 * Handles the core logic of query analysis, data retrieval, and response formatting.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#queryprocessor-interface
 * - Analysis: ../analysis/QueryProcessor-Analysis.md#1-processquerywithdata
 * - Related Interface: ./QueryContext.ts
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: Wed May 1 2024
 */

import { QueryContext } from './QueryContext';
import { DataFile } from './FileRepository';

/**
 * Processing options for queries
 */
export interface QueryProcessingOptions {
  /** Enable detailed pattern detection for specialized queries */
  enablePatternDetection?: boolean;
  /** Strategy for handling starter questions */
  starterQuestionStrategy?: 'auto' | 'always' | 'never';
  /** Strategy for handling comparison questions */
  comparisonStrategy?: 'enhanced' | 'basic' | 'disabled';
  /** Maximum number of files to process */
  maxFiles?: number;
  /** Maximum segments to include in context */
  maxSegments?: number;
  /** List of segments to prioritize in processing */
  prioritySegments?: string[];
}

/**
 * Result of a processed query
 */
export interface ProcessedQueryResult {
  /** Processed data ready for response generation */
  processedData: any;
  /** Files that contributed to the final result */
  relevantFiles: DataFile[];
  /** Original query context with processing metadata */
  enhancedContext: QueryContext;
  /** Whether the processing involved a comparison */
  isComparison?: boolean;
  /** Whether the processing involved a starter question */
  isStarterQuestion?: boolean;
  /** Data version of the processing result */
  dataVersion: string;
  /** Performance metrics from processing */
  metrics?: {
    processingTimeMs: number;
    fileCount: number;
    segmentCount: number;
    dataSize?: number;
  };
}

/**
 * Query Processor Interface
 * 
 * Defines the contract for components that process queries against data
 */
export interface QueryProcessor {
  /**
   * Process a query against available data
   *
   * @param context - The query context containing the query and related information
   * @param options - Processing options to customize behavior
   * @returns Promise resolving to the processed query result
   */
  processQueryWithData(
    context: QueryContext,
    options?: QueryProcessingOptions
  ): Promise<ProcessedQueryResult>;

  /**
   * Determine if a query is asking for a comparison between data
   * 
   * @param query - The query text to analyze
   * @returns Whether the query is a comparison query
   */
  isComparisonQuery(query: string): boolean;

  /**
   * Determine if a query is a starter question
   * 
   * @param query - The query text to analyze
   * @returns Whether the query is a starter question
   */
  isStarterQuestion(query: string): boolean;

  /**
   * Extract segments mentioned in a query
   * 
   * @param query - The query text to analyze
   * @returns Array of segment identifiers mentioned in the query
   */
  extractSegmentsFromQuery(query: string): string[];
}

export default QueryProcessor; 