// Route handlers for chat-assistant API endpoints
// Delegates business logic to chatAssistantController

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
