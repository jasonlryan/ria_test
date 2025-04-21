// Route handlers for test-assistant API endpoints
// Delegates business logic to testAssistantController

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../../utils/shared/cors";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import { getHandler } from "../controllers/testAssistantController";

export async function OPTIONS(request) {
  const response = await handleOptions(request);
  if (response) return response;
  return new Response(null, { status: 405 });
}

export async function GET(request) {
  try {
    return await getHandler(request);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
