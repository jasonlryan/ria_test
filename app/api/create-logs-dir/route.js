// Route handlers for create-logs-dir API endpoints
// Delegates business logic to createLogsDirController (to be implemented)

import { NextRequest, NextResponse } from "next/server";
import { handleOptions } from "../../utils/shared/cors";
import { formatErrorResponse } from "../../utils/shared/errorHandler";

import { postHandler } from "../controllers/createLogsDirController";

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
