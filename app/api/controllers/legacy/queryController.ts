/**
 * Controller for query API endpoints.
 * Handles request validation, delegates to data retrieval service,
 * manages response formatting and error handling.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import { DataRetrievalService } from "../services/dataRetrievalService";
import logger from "../../../utils/shared/logger";
import { normalizeQueryText } from "../../../utils/shared/queryUtils";
import { UnifiedCache } from "../../../utils/cache/cache-utils";
import { threadMetaKey, TTL } from "../../../utils/cache/key-schema";
import { getComparablePairs, FileMetadata } from "../../../utils/compatibility/compatibility";
// Import detectComparisonQuery from the adapter where it's re-exported
import { detectComparisonQuery } from "../../../utils/data/repository/adapters/retrieval-adapter";

const dataRetrievalService = new DataRetrievalService();

// Thread metadata interface
interface ThreadMetadata {
  previousQueries: string[];
  fileMetadata: FileMetadata[];
  lastUpdated: number;
  previousResponse?: string;
  [key: string]: any;
}

export async function postHandler(request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { query, threadId, previousQuery, previousAssistantResponse } = body;

    if (!query || typeof query !== "string") {
      return formatBadRequestResponse("Missing or invalid 'query' field");
    }

    // Normalize queries
    const normalizedQuery = normalizeQueryText(query);
    const normalizedPreviousQuery = previousQuery 
      ? normalizeQueryText(previousQuery) 
      : "";

    // Get thread metadata from KV
    let threadMetadata: ThreadMetadata | null = null;
    if (threadId) {
      threadMetadata = await UnifiedCache.get<ThreadMetadata>(threadMetaKey(threadId));
    }

    // Determine if this is a follow-up query based on previous queries in the thread
    const isFollowUp = !!(threadMetadata?.previousQueries?.length > 0);
    
    logger.info(`[QUERY] Raw query: "${query.substring(0, 50)}..."`);
    logger.info(`[QUERY] Normalized query: "${normalizedQuery.substring(0, 50)}..."`);
    logger.info(`[QUERY] Processing normalized query: "${normalizedQuery.substring(0, 50)}..." | ThreadId: ${threadId || 'none'} | IsFollowUp: ${isFollowUp}`);

    // Check if this is a comparison query
    // Note: In the current implementation, detectComparisonQuery just returns a boolean
    const isComparisonQuery = detectComparisonQuery(normalizedQuery);
    
    // Compatibility check for follow-up comparison queries
    if (isFollowUp && isComparisonQuery) {
      const comparisonResult = await handleComparisonCompatibility(
        normalizedQuery,
        threadId,
        threadMetadata
      );
      
      if (comparisonResult.error) {
        // Fix the parameter type error - pass error message as string
        return formatBadRequestResponse(comparisonResult.message || "Incompatible comparison");
      }
      
      // If we have a valid comparison, use the filtered file IDs
      if (comparisonResult.fileIds && comparisonResult.fileIds.length > 0) {
        logger.info(`[COMPATIBILITY] Using filtered file IDs for compatible comparison: ${comparisonResult.fileIds.join(', ')}`);
        
        // Pass normalized context to the data retrieval service with overridden file IDs
        const result = await dataRetrievalService.processQueryWithData(
          normalizedQuery,
          "all-sector",
          comparisonResult.fileIds, // Use validated compatible file IDs
          threadId || "default",
          isFollowUp,
          normalizedPreviousQuery,
          previousAssistantResponse || ""
        );
        
        // Log processing time
        const processingTime = Date.now() - startTime;
        logger.info(`[QUERY] Comparison query processed in ${processingTime}ms`);
        
        // Update thread metadata with the new query
        await updateThreadMetadata(threadId, normalizedQuery, result?.fileMetadata);
        
        return NextResponse.json(result);
      }
    }

    // Regular query processing (non-comparison or first query)
    // Pass normalized context to the data retrieval service
    const result = await dataRetrievalService.processQueryWithData(
      normalizedQuery,
      "all-sector",
      [], // No cached file IDs for regular processing
      threadId || "default",
      isFollowUp,
      normalizedPreviousQuery,
      previousAssistantResponse || ""
    );
    
    // Check if result is valid before returning
    if (!result) {
      logger.error(`[ERROR] Data retrieval service returned null or undefined result`);
      return formatErrorResponse(new Error("Failed to process query"));
    }

    // For first query, store file metadata in KV
    if (!isFollowUp && result?.fileMetadata) {
      await updateThreadMetadata(threadId, normalizedQuery, result.fileMetadata);
    }

    // Log processing time
    const processingTime = Date.now() - startTime;
    logger.info(`[QUERY] Query processed in ${processingTime}ms`);

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[ERROR] Query controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}

/**
 * Handle compatibility check for comparison queries
 * @param query Normalized query text
 * @param threadId Thread ID
 * @param threadMetadata Thread metadata from KV
 * @returns Compatibility check result
 */
async function handleComparisonCompatibility(
  query: string, 
  threadId: string,
  threadMetadata: ThreadMetadata | null
): Promise<{ 
  error: boolean; 
  message?: string; 
  fileIds?: string[];
}> {
  try {
    // Since detectComparisonQuery just returns a boolean in the current implementation,
    // we need to manually extract the years from the query
    const isComparison = detectComparisonQuery(query);
    const years = [2024, 2025]; // Hard-code the years as we're specifically handling 2024 vs 2025 comparison
    
    if (!isComparison) {
      // Not a comparison query, so no compatibility check needed
      return { error: false };
    }

    // Check if years mention both 2024 and 2025
    if (!query.includes("2024") || !query.includes("2025")) {
      // Non-explicit year comparison, continue with normal processing
      logger.info(`[COMPATIBILITY] Detected non-explicit year comparison`);
      return { error: false };
    }

    logger.info(`[COMPATIBILITY] Detected comparison query: "${query.substring(0, 50)}..."`);
    
    // Get cached files from thread metadata
    const cachedFileMetadata = threadMetadata?.fileMetadata || [];
    
    if (cachedFileMetadata.length === 0) {
      logger.warn(`[COMPATIBILITY] No cached file metadata found for thread ${threadId}`);
      return { error: false }; // Continue with normal processing
    }
    
    // Get new files from the data retrieval service (this will leverage PromptRepository)
    const fileIdentificationResult = await dataRetrievalService.identifyRelevantFiles(
      query,
      "all-sector",
      true, // isFollowUp
      threadMetadata?.previousQueries?.[threadMetadata.previousQueries.length - 1] || "",
      threadMetadata?.previousResponse || ""
    );
    
    // Merge cached files with newly identified files
    const mergedFileMetadata = [...cachedFileMetadata];
    
    // Add new files that aren't already in the cache
    const newFileMetadata = fileIdentificationResult?.fileMetadata || [];
    const existingFileIds = new Set(cachedFileMetadata.map(file => file.fileId));
    
    for (const file of newFileMetadata) {
      if (!existingFileIds.has(file.fileId)) {
        mergedFileMetadata.push(file);
      }
    }
    
    // Check if we have comparable pairs
    const { valid, invalid, message } = getComparablePairs(mergedFileMetadata);
    
    if (invalid.length > 0) {
      // We have incompatible files, return error
      logger.warn(`[COMPATIBILITY] Incompatible comparison files: ${invalid.join(', ')}`);
      logger.warn(`[COMPATIBILITY] User message: ${message}`);
      
      return {
        error: true,
        message: message || "Year-on-year comparisons are not available for the requested topics due to methodology changes."
      };
    }
    
    // We have compatible files, return them
    logger.info(`[COMPATIBILITY] Compatible comparison files: ${valid.join(', ')}`);
    return {
      error: false,
      fileIds: valid
    };
  } catch (error) {
    logger.error(`[COMPATIBILITY] Error handling comparison compatibility: ${error.message}`);
    return { error: false }; // Continue with normal processing on error
  }
}

/**
 * Update thread metadata in KV
 * @param threadId Thread ID
 * @param query Current query
 * @param fileMetadata File metadata to store
 */
async function updateThreadMetadata(
  threadId: string, 
  query: string, 
  fileMetadata?: FileMetadata[]
): Promise<void> {
  try {
    if (!threadId) return;
    
    const key = threadMetaKey(threadId);
    
    // Get existing metadata or create new with proper type casting
    const existingMeta = await UnifiedCache.get<ThreadMetadata>(key) || {
      previousQueries: [],
      fileMetadata: [],
      lastUpdated: Date.now()
    } as ThreadMetadata;
    
    // Update previous queries
    if (!existingMeta.previousQueries) {
      existingMeta.previousQueries = [];
    }
    
    // Add current query to previous queries
    existingMeta.previousQueries.push(query);
    
    // Update file metadata if provided
    if (fileMetadata && Array.isArray(fileMetadata)) {
      existingMeta.fileMetadata = fileMetadata;
      logger.info(`[CACHE] Updated file metadata for thread ${threadId} with ${fileMetadata.length} files`);
    }
    
    // Update timestamp
    existingMeta.lastUpdated = Date.now();
    
    // Write updated meta back to KV with TTL
    await UnifiedCache.set(key, existingMeta, TTL.THREAD_DATA);
    
    logger.info(`[CACHE] Updated thread metadata for ${threadId}`);
  } catch (error) {
    logger.error(`[CACHE] Error updating thread metadata: ${error.message}`);
  }
}
