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

const dataRetrievalService = new DataRetrievalService();

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

    // Determine if this is a follow-up query based on threadId presence
    const isFollowUp = !!threadId;
    
    logger.info(`[QUERY] Raw query: "${query.substring(0, 50)}..."`);
    logger.info(`[QUERY] Normalized query: "${normalizedQuery.substring(0, 50)}..."`);
    logger.info(`[QUERY] Processing normalized query: "${normalizedQuery.substring(0, 50)}..." | ThreadId: ${threadId || 'none'} | IsFollowUp: ${isFollowUp}`);

    // Pass normalized context to the data retrieval service
    const result = await dataRetrievalService.processQueryWithData(
      normalizedQuery,
      "all-sector",
      [], // We don't have cached file IDs here, this should be fixed
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

    // Log processing time
    const processingTime = Date.now() - startTime;
    logger.info(`[QUERY] Query processed in ${processingTime}ms`);

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[ERROR] Query controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
