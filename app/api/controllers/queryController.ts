/**
 * Controller for query API endpoints.
 * Handles request validation, delegates to data retrieval service,
 * manages response formatting and error handling.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import DataRetrievalService from "../services/dataRetrievalService";
import logger from "../../../utils/logger";

const dataRetrievalService = new DataRetrievalService();

export async function postHandler(request) {
  try {
    const body = await request.json();
    const { query, threadId, previousQuery, previousAssistantResponse } = body;

    if (!query || typeof query !== "string") {
      return formatBadRequestResponse("Missing or invalid 'query' field");
    }

    // Determine if this is a follow-up query based on threadId presence
    const isFollowUp = !!threadId;
    
    logger.info(`[QUERY] Processing query: "${query.substring(0, 50)}..." | ThreadId: ${threadId || 'none'} | IsFollowUp: ${isFollowUp}`);

    // Pass all context to the data retrieval service
    const result = await dataRetrievalService.processQueryWithData(
      query,
      "all-sector",
      [], // We don't have cached file IDs here, this should be fixed
      threadId || "default",
      isFollowUp,
      previousQuery || "",
      previousAssistantResponse || ""
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[ERROR] Query controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
