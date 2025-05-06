/**
 * CORS and Preflight Handling Utility
 * Provides a handler for OPTIONS requests with standard CORS headers.
 */

import { NextRequest } from 'next/server';

/**
 * Handles OPTIONS requests by returning appropriate CORS headers
 * @param request - The incoming request object
 * @returns Response with CORS headers or null if not an OPTIONS request
 */
export async function handleOptions(request: NextRequest): Promise<Response | null> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
  return null;
} 