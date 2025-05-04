/**
 * Controller for OpenAI API endpoints.
 * Handles request validation, delegates to unified OpenAI service,
 * manages response formatting and error handling.
 * 
 * This controller currently provides a placeholder POST handler.
 * Future implementations should add full OpenAI API request handling.
 */

import { NextRequest, NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import { unifiedOpenAIService } from "../services/unifiedOpenAIService";
import { isFeatureEnabled } from "../../../utils/shared/feature-flags";
import { migrationMonitor } from "../../../utils/shared/monitoring";
import logger from "../../../utils/shared/logger";

/**
 * Handle POST requests to the OpenAI API endpoint
 * Processes chat completions and other OpenAI API operations
 */
export async function postHandler(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { operation, ...params } = body;

    // Validate required fields
    if (!operation) {
      return formatBadRequestResponse("Missing required field: operation");
    }

    // Track request for monitoring
    logger.info(`[OPENAI] Processing ${operation} request`);

    // Handle different operation types
    switch (operation) {
      case "chat.completions":
        return await handleChatCompletion(params);
      
      case "embeddings":
        return await handleEmbeddings(params);
      
      case "image.generation":
        return await handleImageGeneration(params);
      
      default:
        return formatBadRequestResponse(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    // Enhanced error logging
    logger.error(`[OPENAI] Controller error: ${error.message}`, {
      path: "/api/openai",
      duration: Date.now() - startTime,
      error
    });
    return formatErrorResponse(error);
  } finally {
    // Log performance metrics for all requests
    const duration = Date.now() - startTime;
    if (duration > 5000) {
      logger.warn(`[OPENAI] Slow request processing time: ${duration}ms`);
    }
  }
}

/**
 * Handle chat completion requests
 */
async function handleChatCompletion(params: any) {
  try {
    // Validate required parameters
    if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
      return formatBadRequestResponse("Missing or invalid field: messages");
    }

    // Normalize parameters
    const { messages, model = "gpt-3.5-turbo", ...options } = params;
    
    // Process with unified service
    const result = await unifiedOpenAIService.createChatCompletion(messages, {
      model,
      ...options
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[OPENAI] Chat completion error: ${error.message}`);
    return formatErrorResponse(error);
  }
}

/**
 * Handle embeddings requests
 */
async function handleEmbeddings(params: any) {
  try {
    // Validate required parameters
    if (!params.input) {
      return formatBadRequestResponse("Missing required field: input");
    }

    // Normalize parameters
    const { input, model = "text-embedding-ada-002", ...options } = params;
    
    // Process with unified service
    const result = await unifiedOpenAIService.createEmbeddings(input, {
      model,
      ...options
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[OPENAI] Embeddings error: ${error.message}`);
    return formatErrorResponse(error);
  }
}

/**
 * Handle image generation requests
 */
async function handleImageGeneration(params: any) {
  try {
    // Validate required parameters
    if (!params.prompt) {
      return formatBadRequestResponse("Missing required field: prompt");
    }

    // Normalize parameters
    const { prompt, ...options } = params;
    
    // Process with unified service
    const result = await unifiedOpenAIService.createImage(prompt, options);

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[OPENAI] Image generation error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
