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
 * File metadata structure
 */
export interface FileMetadata {
  title?: string;
  description?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  segments?: string[];
  years?: string[];
  properties?: Record<string, any>;
}

/**
 * File data structure returned by repository
 */
export interface FileData {
  fileId: string;
  metadata: FileMetadata;
  content: any;
}

/**
 * Result of a file identification operation
 */
export interface FileIdentificationResult {
  file_ids: string[];
  matched_topics?: string[];
  segments?: string[];
  explanation?: string;
}

/**
 * Repository for managing data files and their contents
 */
export interface FileRepository {
  /**
   * Find files relevant to the given query
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Array of file identifiers
   */
  identifyRelevantFiles(
    query: string,
    context: QueryContext
  ): Promise<string[]>;

  /**
   * Load data from the specified files
   *
   * @param fileIds Array of file identifiers to load
   * @param segments Optional segments to filter by
   * @param context QueryContext with processing context
   * @returns Array of file data objects
   */
  loadFileData(
    fileIds: string[],
    segments?: string[],
    context?: QueryContext
  ): Promise<FileData[]>;

  /**
   * Get all available segments across the given files
   *
   * @param fileIds Array of file identifiers to check
   * @returns Array of segment identifiers
   */
  getAvailableSegments(fileIds: string[]): Promise<string[]>;

  /**
   * Cache file associations for a thread
   *
   * @param threadId Thread identifier
   * @param fileIds File identifiers to cache
   * @returns Success indicator
   */
  cacheFilesForThread(threadId: string, fileIds: string[]): Promise<boolean>;

  /**
   * Get cached file associations for a thread
   *
   * @param threadId Thread identifier
   * @returns Array of cached file identifiers
   */
  getCachedFilesForThread(threadId: string): Promise<string[]>;
  
  /**
   * Get a single file by its ID
   *
   * @param fileId File identifier
   * @returns File data object
   */
  getFileById(fileId: string): Promise<FileData>;
  
  /**
   * Get multiple files by their IDs
   *
   * @param fileIds Array of file identifiers
   * @returns Array of file data objects
   */
  getFilesByIds(fileIds: string[]): Promise<FileData[]>;
  
  /**
   * Get files based on a query
   *
   * @param query User query
   * @param context Query context
   * @returns File identification result with loaded data
   */
  getFilesByQuery(
    query: string,
    context: QueryContext
  ): Promise<FileIdentificationResult>;
}

export default FileRepository; 