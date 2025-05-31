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
import { getComparablePairs, FileMetadata, summarizeTopicFiles } from "../../../utils/compatibility/compatibility";
// Import detectComparisonQuery from the adapter where it's re-exported
import { detectComparisonQuery } from "../../../utils/data/repository/adapters/retrieval-adapter";
import fs from "fs/promises"; // Use promises version of fs
import path from "path";

const dataRetrievalService = new DataRetrievalService();

// Thread metadata interface
interface ThreadMetadata {
  previousQueries: string[];
  fileMetadata: FileMetadata[];
  lastUpdated: number;
  previousResponse?: string;
  [key: string]: any;
}

// Helper function to load and render the assistant prompt template
async function renderAssistantPrompt(userQuestion: string, dataResult: any): Promise<string> {
  try {
    const promptPath = path.join(process.cwd(), "utils", "openai", "assistant_prompt.md");
    let template = await fs.readFile(promptPath, "utf-8");
    logger.info("[PROMPT_RENDER] Successfully loaded assistant_prompt.md template.");

    const segmentLabel = dataResult?.segments?.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") || "Overall";
    
    let statsPreviewString = "NO STATISTICAL DATA WAS PROCESSED OR INCLUDED.";
    const actualStatsArray = dataResult?.stats;
    if (actualStatsArray && Array.isArray(actualStatsArray) && actualStatsArray.length > 0) {
      const statsToInclude = actualStatsArray.slice(0, 150);
      statsPreviewString = JSON.stringify(statsToInclude, null, 2);
      logger.info(`[PROMPT_RENDER] Included ${statsToInclude.length} (out of ${actualStatsArray.length}) stats in prompt from dataResult.stats.`);
    } else {
      logger.warn("[PROMPT_RENDER] No 'dataResult.stats' array found or it was empty. Check dataResult structure.", dataResult);
    }

    let rawDataJsonString = "NO RAW DATA AVAILABLE";
    if (dataResult?.raw_data) {
      rawDataJsonString = `\`\`\`json\n${typeof dataResult.raw_data === 'string' ? dataResult.raw_data : JSON.stringify(dataResult.raw_data, null, 2)}\n\`\`\``;
      logger.info("[PROMPT_RENDER] Included raw_data in prompt.");
    }

    template = template.replace(/{{{USER_QUESTION}}}/g, userQuestion || "Not specified.");
    template = template.replace(/{{{ANALYSIS_SUMMARY}}}/g, dataResult?.analysis || "No analysis summary available.");
    template = template.replace(/{{{FILES_USED}}}/g, dataResult?.files_used?.join(", ") || "None listed.");
    template = template.replace(/{{{DATA_POINTS_SOURCE}}}/g, String(dataResult?.data_points) || "N/A");
    template = template.replace(/{{{QUERY_STATUS}}}/g, dataResult?.status || "N/A");
    template = template.replace(/{{{SEGMENT_LABEL}}}/g, segmentLabel);
    template = template.replace(/{{{STATS_PREVIEW_STRING}}}/g, statsPreviewString);
    template = template.replace(/{{{RAW_DATA_JSON}}}/g, rawDataJsonString);

    logger.info(`[PROMPT_RENDER] Final rendered assistant prompt length: ${template.length}. Preview (first 200): ${template.substring(0,200)}`);
    return template;

  } catch (error) {
    logger.error("[PROMPT_RENDER_ERROR] Failed to load or render assistant_prompt.md:", error);
    return `User Question: ${userQuestion}\nData: ${JSON.stringify(dataResult?.stats?.slice(0,10) || dataResult?.raw_data || "Error: Prompt template rendering failed. No data available.")}`;
  }
}

export async function postHandler(request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    let { query, threadId, previousQuery, previousAssistantResponse, previous_response_id } = body;
    const originalUserQuery = query;

    logger.info(`[QUERY_CTRL_INIT] Received request. Original threadId: ${threadId}, previous_response_id: ${previous_response_id}`);

    // If threadId is not provided OR if previous_response_id is provided (indicating a follow-up in Responses API flow),
    // prioritize previous_response_id as the source of truth for the current operation's context.
    if (previous_response_id && typeof previous_response_id === "string" && previous_response_id.startsWith("resp_")) {
      threadId = previous_response_id;
      logger.info(`[QUERY_CTRL_INIT] Using previous_response_id as threadId: ${threadId}`);
    } else if (threadId) {
      logger.info(`[QUERY_CTRL_INIT] Using provided threadId: ${threadId}`);
    } else {
      logger.info(`[QUERY_CTRL_INIT] No threadId or previous_response_id provided. Treating as new conversation.`);
    }

    if (!query || typeof query !== "string") {
      return formatBadRequestResponse("Missing or invalid 'query' field");
    }

    // Get thread metadata from KV. This should use the potentially updated threadId.
    let threadMetadata: ThreadMetadata | null = null;
    if (threadId) {
      const kvKeyForThreadMeta = threadMetaKey(threadId);
      logger.debug(`[QUERY_CTRL_KV_KEY] Attempting to fetch thread metadata with key: ${kvKeyForThreadMeta}`);
      threadMetadata = await UnifiedCache.get<ThreadMetadata>(kvKeyForThreadMeta);
      if (threadMetadata) {
        logger.info(`[QUERY_CTRL_KV] Fetched threadMetadata for ${threadId}`);
        logger.debug(`[QUERY_CTRL_KV_CONTENT] Full fetched threadMetadata content:`, threadMetadata);
        logger.debug(`[QUERY_CTRL_KV_CONTENT_FILEMETADATA] threadMetadata.fileMetadata:`, threadMetadata.fileMetadata);
        logger.debug(`[QUERY_CTRL_KV_CONTENT_FILES] threadMetadata.files:`, (threadMetadata as any).files); // Log 'files' field if it exists
      } else {
        logger.info(`[QUERY_CTRL_KV] No threadMetadata for ${threadId}`);
      }
    }

    // Determine if this is a follow-up query
    // A query is a follow-up if a valid previous_response_id was passed,
    // or if we have a threadId and that thread has previous queries in its metadata.
    const isFollowUp = !!(previous_response_id && typeof previous_response_id === 'string' && previous_response_id.startsWith('resp_')) ||
                       !!(threadId && threadMetadata?.previousQueries?.length > 0);
    
    // Initialize with potentially client-sent values
    let currentPreviousQuery = previousQuery || "";
    let currentPreviousAssistantResponse = previousAssistantResponse || "";

    if (isFollowUp) {
      logger.info(`[FOLLOW-UP_DETECT] Detected as FOLLOW-UP. Reason: ${
        (previous_response_id && typeof previous_response_id === 'string' && previous_response_id.startsWith('resp_')) ? 'prev_resp_id' :
        (threadId && threadMetadata?.previousQueries?.length > 0) ? 'metadata' : 'Unknown'
      }. Context ID: ${threadId}`);
      // If it's a follow-up and we have threadMetadata, use that as the source of truth for previous Q&A
      if (threadMetadata) {
        currentPreviousQuery = threadMetadata.previousQueries?.[0] || "";
        currentPreviousAssistantResponse = threadMetadata.assistantResponseContent || "";
        logger.debug("[QUERY_CTRL_FOLLOWUP_CONTEXT] Using context from fetched threadMetadata:", { 
            previousQuery: currentPreviousQuery.substring(0,50) + "...", 
            previousAssistantResponse: currentPreviousAssistantResponse.substring(0,50) + "..." 
        });
      }
    } else {
      logger.info(`[FOLLOW-UP_DETECT] Detected as NEW query. Context ID: ${threadId || 'none'}`);
    }

    // Normalize queries using the potentially updated previous query
    const normalizedQuery = normalizeQueryText(query);
    const normalizedPreviousQuery = currentPreviousQuery 
      ? normalizeQueryText(currentPreviousQuery) 
      : "";
    // Use currentPreviousAssistantResponse directly as it should be the raw content
    const finalPreviousAssistantResponse = currentPreviousAssistantResponse;

    logger.info(`[QUERY_CTRL_MAIN] Processing: "${normalizedQuery.substring(0, 50)}..." | Thread: ${threadId || 'none'} | FollowUp: ${isFollowUp}`);

    let dataProcessingResult;
    const isComparisonQuery = detectComparisonQuery(normalizedQuery);
    
    if (isFollowUp && isComparisonQuery) {
      const comparisonResult = await handleComparisonCompatibility(
        normalizedQuery,
        threadId!, // threadId will be set if isFollowUp is true from prev_resp_id
        threadMetadata
      );
      
      if (comparisonResult.error) {
        return formatBadRequestResponse(comparisonResult.message || "Incompatible comparison");
      }
      
      if (comparisonResult.fileIds && comparisonResult.fileIds.length > 0) {
        logger.info(`[COMPATIBILITY] Using filtered file IDs for compatible comparison: ${comparisonResult.fileIds.join(', ')}`);
        dataProcessingResult = await dataRetrievalService.processQueryWithData(
          normalizedQuery,
          "all-sector",
          comparisonResult.fileIds, // Use validated compatible file IDs
          threadId || "default",
          isFollowUp,
          normalizedPreviousQuery,
          finalPreviousAssistantResponse
        );
      } else {
        // If comparison check passed but no specific files (e.g. non-explicit year comparison), proceed with normal follow-up discovery
        const fileIdsForDiscovery = (threadMetadata?.fileMetadata?.length > 0) ? threadMetadata.fileMetadata.map(fm => fm.fileId) : [];
        logger.info(`[QUERY_CTRL_FILES] Comparison follow-up, using ${fileIdsForDiscovery.length} cached file IDs.`);
        dataProcessingResult = await dataRetrievalService.processQueryWithData(
          normalizedQuery,
          "all-sector",
          fileIdsForDiscovery, // IMPORTANT: Use these for follow-ups
          threadId || "default", // session/thread identifier for the service
          isFollowUp,
          normalizedPreviousQuery,
          finalPreviousAssistantResponse
        );
      }
    } else {
      const fileIdsForDiscovery = (isFollowUp && threadMetadata?.fileMetadata && Array.isArray(threadMetadata.fileMetadata) && threadMetadata.fileMetadata.length > 0)
        ? threadMetadata.fileMetadata.map(fm => fm.fileId)
        : [];
      logger.info(`[QUERY_CTRL_FILES] Using ${fileIdsForDiscovery.length} cached file IDs for discovery (if follow-up).`);
      logger.debug('[QUERY_CTRL_CACHED_FILES_TO_SERVICE] fileIdsForDiscovery:', fileIdsForDiscovery);
      dataProcessingResult = await dataRetrievalService.processQueryWithData(
        normalizedQuery,
        "all-sector", 
        fileIdsForDiscovery, 
        threadId || "default", 
        isFollowUp,
        normalizedPreviousQuery, // Use the one derived from threadMetadata if follow-up
        finalPreviousAssistantResponse // Use the one derived from threadMetadata if follow-up
      );
    }
    
    if (!dataProcessingResult) {
      logger.error(`[ERROR] Data retrieval service returned null/undefined for processQueryWithData`);
      return formatErrorResponse(new Error("Failed to process query data."));
    }

    const finalAssistantPrompt = await renderAssistantPrompt(originalUserQuery, dataProcessingResult);

    const responseToFrontend = {
      ...dataProcessingResult,
      finalAssistantPrompt: finalAssistantPrompt,
      isFollowUp: isFollowUp,
      query: originalUserQuery,
      currentContextId: threadId,
    };

    logger.info(`[QUERY_CTRL_NO_KV_UPDATE] Deferring KV update to chatController.`);

    const processingTime = Date.now() - startTime;
    logger.info(`[QUERY_CTRL_END] Query processed in ${processingTime}ms. Returning data with rendered prompt.`);

    return NextResponse.json(responseToFrontend);
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
  compatibilitySummary?: Record<string, { years: number[]; comparable: boolean; userMessage?: string }>;
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
    const compatibilitySummary = summarizeTopicFiles(mergedFileMetadata);

    if (invalid.length > 0 && valid.length === 0) {
      // All requested files are incompatible
      logger.warn(`[COMPATIBILITY] Incompatible comparison files: ${invalid.join(', ')}`);
      logger.warn(`[COMPATIBILITY] User message: ${message}`);

      return {
        error: true,
        message: message || "Year-on-year comparisons are not available for the requested topics due to methodology changes."
      };
    }

    if (invalid.length > 0) {
      logger.warn(`[COMPATIBILITY] Partial comparison. Invalid files: ${invalid.join(', ')}`);
      if (message) logger.warn(`[COMPATIBILITY] User message: ${message}`);
    }

    logger.info(`[COMPATIBILITY] Compatible comparison files: ${valid.join(', ')}`);
    return {
      error: false,
      fileIds: valid,
      message: invalid.length > 0 ? message : undefined,
      compatibilitySummary
    };
  } catch (error) {
    logger.error(`[COMPATIBILITY] Error handling comparison compatibility: ${error.message}`);
    return { error: false }; // Continue with normal processing on error
  }
}
