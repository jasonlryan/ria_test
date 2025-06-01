/**
 * Controller for openai API endpoints.
 * Handles OpenAI assistant interactions via the unifiedOpenAIService.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import logger from "../../../utils/shared/logger";
import { unifiedOpenAIService } from "../services/unifiedOpenAIService";

/**
 * Handle POST requests for the openai endpoint.
 * Expects a JSON body with at least an `input` field and optionally
 * `previous_response_id` and `options` for the service.
 */
export async function postHandler(request: Request) {
  try {
    const body = await request.json();
    const { input, previous_response_id, options = {} } = body || {};

    if (!input || typeof input !== "string") {
      return formatBadRequestResponse("Missing 'input' field");
    }

    let result;
    if (previous_response_id) {
      logger.info(`[OPENAI_CTRL] Continuing conversation ${previous_response_id}`);
      result = await unifiedOpenAIService.continueConversation(previous_response_id, input, options);
    } else {
      logger.info("[OPENAI_CTRL] Creating response");
      result = await unifiedOpenAIService.createResponse(input, options);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error(`[OPENAI_CTRL] ${error instanceof Error ? error.message : error}`);
    return formatErrorResponse(error);
  }
}
