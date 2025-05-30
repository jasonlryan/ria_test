/**
 * Data Retrieval API Route Handler
 * Manages HTTP requests for direct data file retrieval,
 * delegates to retrieveDataController, and formats responses.
 * Used for accessing specific data files by ID.
 */

import { NextRequest } from "next/server";
import { handleOptions } from "../../../utils/shared/cors";
import { formatErrorResponse } from "../../../utils/shared/errorHandler";
import { postHandler } from "../controllers/retrieveDataController";

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