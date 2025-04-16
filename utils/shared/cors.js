/**
 * CORS and Preflight Handling Utility
 * Provides a handler for OPTIONS requests with standard CORS headers.
 */

export async function handleOptions(request) {
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
