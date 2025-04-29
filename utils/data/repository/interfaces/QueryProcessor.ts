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
import { FileData, FileIdentificationResult } from './FileRepository';

/**
 * Classification of query type
 */
export interface QueryClassification {
  isStarterQuestion: boolean;
  isComparisonQuery: boolean;
  isSegmentSpecific: boolean;
  targetSegments?: string[];
  targetYears?: string[];
  queryIntent?: string;
}

/**
 * Result of data processing
 */
export interface ProcessedResult {
  data: any;
  insights?: any[];
  metrics?: Record<string, any>;
}

/**
 * Final response format
 */
export interface QueryResponse {
  data: any;
  insights?: any[];
  metadata: {
    query: string;
    timestamp: string;
    processingTime?: number;
    compatibility?: Record<string, any>;
    [key: string]: any;
  };
}

/**
 * Result of query processing operation
 */
export interface ProcessedQueryResult {
  /**
   * Enhanced context with additional information
   */
  enhancedContext: QueryContext;
  
  /**
   * List of files used in the processing
   */
  files: FileData[];
  
  /**
   * Whether the query is a starter question
   */
  isStarterQuestion?: boolean;
  
  /**
   * Whether the query is a comparison query
   */
  isComparisonQuery?: boolean;
  
  /**
   * Additional metadata about the processing
   */
  metadata?: any;
}

/**
 * Processor for handling user queries and generating responses
 */
export interface QueryProcessor {
  /**
   * Process a query and generate a response
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Processed response
   */
  processQuery(query: string, context: QueryContext): Promise<QueryResponse>;

  /**
   * Process a query with retrieved data
   * 
   * @param query User query text
   * @param context QueryContext with processing context
   * @param cachedFileIds Optional array of cached file IDs
   * @param threadId Thread ID for the conversation
   * @param isFollowUp Whether this is a follow-up query
   * @param previousQuery Previous query in the conversation
   * @param previousAssistantResponse Previous assistant response
   * @returns Enhanced context with processed data
   */
  processQueryWithData(
    query: string,
    context: QueryContext,
    cachedFileIds?: string[],
    threadId?: string,
    isFollowUp?: boolean,
    previousQuery?: string,
    previousAssistantResponse?: string
  ): Promise<ProcessedQueryResult>;

  /**
   * Classify the type of query
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Classification result
   */
  classifyQuery(query: string, context?: QueryContext): QueryClassification;

  /**
   * Process data based on the query and context
   *
   * @param data File data to process
   * @param query User query
   * @param context QueryContext with processing context
   * @returns Processed data result
   */
  processData(
    data: FileData[],
    query: string,
    context: QueryContext
  ): Promise<ProcessedResult>;

  /**
   * Format the final response
   *
   * @param result Processed result
   * @param context QueryContext with processing context
   * @returns Formatted query response
   */
  formatResponse(result: ProcessedResult, context: QueryContext): QueryResponse;
  
  /**
   * Determine if a query is asking for a comparison between years
   * 
   * @param query User query text
   * @returns Boolean indicating if this is a comparison query
   */
  isComparisonQuery(query: string): boolean;
  
  /**
   * Check if a query is a starter question
   * 
   * @param query User query text
   * @returns Boolean indicating if this is a starter question
   */
  isStarterQuestion(query: string): boolean;
  
  /**
   * Extract segments from a query
   * 
   * @param query User query text
   * @returns Array of segments mentioned in the query
   */
  extractSegmentsFromQuery(query: string): string[];
}

export default QueryProcessor; 