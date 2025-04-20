/**
 * Chat Assistant API Route Handler
 * Manages HTTP requests for the chat assistant endpoint, handles CORS,
 * delegates to chatAssistantController, and formats responses.
 * Primary entry point for all assistant interactions.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../../utils/shared/cors";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import { postHandler, putHandler } from "../controllers/chatAssistantController";

const controller = {
  postHandler,
  putHandler,
};

export async function OPTIONS(request: NextRequest) {
  const response = await handleOptions(request);
  if (response) return response;
  return new Response(null, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    return await controller.postHandler(request);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    return await controller.putHandler(request);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
