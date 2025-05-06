/**
 * Create Logs Directory API Route Handler
 * Manages HTTP requests for the create-logs-dir endpoint, handles CORS,
 * delegates to createLogsDirController, and formats responses.
 * Used for creating log directories on demand.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../../utils/shared/cors";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import { postHandler } from "../controllers/createLogsDirController";

export async function OPTIONS(request: NextRequest) {
  const response = await handleOptions(request);
  if (response) return response;
  return new Response(null, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    return await postHandler(request);
  } catch (error) {
    return formatErrorResponse(error);
  }
} 