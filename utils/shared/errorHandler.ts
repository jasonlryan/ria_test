/**
 * Shared Error Handling and Response Formatting Utility
 * Provides standardized error response formatting for API endpoints.
 */

/**
 * Creates a formatted error response with appropriate status code and headers
 * @param error - The error object to format
 * @param status - HTTP status code for the response (defaults to 500)
 * @returns Formatted Response object with error details
 */
export function formatErrorResponse(error: Error | unknown, status = 500): Response {
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  return new Response(
    JSON.stringify({
      error: errorMessage,
      stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
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

/**
 * Creates a formatted 400 Bad Request response
 * @param message - The error message
 * @param missingFields - Optional array of missing field names
 * @returns Formatted Response object with bad request details
 */
export function formatBadRequestResponse(message: string, missingFields: string[] = []): Response {
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