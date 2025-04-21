/**
 * Query API Route Handler
 * Manages HTTP requests for the query endpoint, handles CORS,
 * delegates business logic to queryController, and formats responses.
 * Entry point for standalone query processing in the application.
 */

// Route handlers for query API endpoints
// Delegates business logic to queryController (to be implemented)

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../../utils/shared/cors";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";

import { postHandler } from "../controllers/queryController";

export async function OPTIONS(request) {
  const response = await handleOptions(request);
  if (response) return response;
  return new Response(null, { status: 405 });
}

export async function POST(request) {
  try {
    return await postHandler(request);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
