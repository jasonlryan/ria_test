/**
 * Shared Error Handling and Response Formatting Utility
 */

export function formatErrorResponse(error, status = 500) {
  return new Response(
    JSON.stringify({
      error: error.message || "Internal server error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export function formatBadRequestResponse(message, missingFields = []) {
  return new Response(
    JSON.stringify({
      error: message,
      missingFields,
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
