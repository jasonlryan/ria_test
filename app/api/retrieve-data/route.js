/**
 * Data Retrieval API Route Handler
 * Manages HTTP requests for direct data file retrieval,
 * delegates to retrieveDataController, and formats responses.
 * Used for accessing specific data files by ID.
 */

// Route handlers for retrieve-data API endpoints
// Delegates business logic to retrieveDataController

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../utils/shared/cors";
import { formatErrorResponse } from "../../utils/shared/errorHandler";
import { postHandler } from "../controllers/retrieveDataController";

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
