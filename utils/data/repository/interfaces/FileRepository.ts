/**
 * FileRepository Interface
 *
 * Defines the contract for components that provide access to data files.
 * Consolidates the file identification and data loading operations from
 * multiple implementations into a unified interface.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#filerepository-interface
 * - Analysis: ../analysis/FileRepository-Analysis.md#1-identifyrelevantfiles
 * - Related Interface: ./QueryContext.ts
 *
 * Last Updated: Wed May 1 2024
 */

import { QueryContext } from './QueryContext';

/**
 * Represents a data file with metadata and segments
 */
export interface DataFile {
  id: string;
  filepath: string;
  metadata: Record<string, any>;
  segments: Record<string, any>;
  contentType?: string;
  lastModified?: Date;
  isLoaded?: boolean;
  error?: string;
}

/**
 * File identification result structure
 */
export interface FileIdentificationResult {
  relevantFiles: string[];
  relevanceScores?: Record<string, number>;
  matchedPatterns?: Record<string, string[]>;
  detectedYears?: string[];
  detectedSegments?: string[];
  /** Matched canonical topic IDs */
  matchedTopics?: string[];
  /** Human-readable rationale from upstream services */
  explanation?: string;
}

/**
 * Segment data structure
 */
export interface SegmentData {
  id: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Options for file retrieval operations
 */
export interface FileRetrievalOptions {
  includeMetadataOnly?: boolean;
  requiredSegments?: string[];
  cacheStrategy?: 'use-cache' | 'refresh' | 'no-cache';
  compatibility?: {
    years?: string[];
    segments?: string[];
  };
}

/**
 * File Repository Interface
 * 
 * Provides access to data files and file identification operations
 */
export interface FileRepository {
  /**
   * Get a single file by ID
   *
   * @param fileId - Unique identifier for the file
   * @param options - Retrieval options
   * @returns Promise resolving to the requested data file or null if not found
   */
  getFileById(fileId: string, options?: FileRetrievalOptions): Promise<DataFile | null>;

  /**
   * Get multiple files by their IDs
   *
   * @param fileIds - Array of file identifiers
   * @param options - Retrieval options
   * @returns Promise resolving to an array of data files
   */
  getFilesByIds(fileIds: string[], options?: FileRetrievalOptions): Promise<DataFile[]>;

  /**
   * Identify and retrieve files based on a query context
   *
   * @param context - Query context containing query information
   * @param options - Retrieval options
   * @returns Promise resolving to file identification results
   */
  getFilesByQuery(context: QueryContext, options?: FileRetrievalOptions): Promise<FileIdentificationResult>;

  /**
   * Load specific segments for a file
   *
   * @param fileId - Unique identifier for the file
   * @param segments - Array of segment identifiers to load
   * @param options - Retrieval options
   * @returns Promise resolving to an updated data file with requested segments
   */
  loadSegments(fileId: string, segments: string[], options?: FileRetrievalOptions): Promise<DataFile>;
}

export default FileRepository; 