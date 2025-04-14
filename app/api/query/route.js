// API Endpoint for Query Processing
// This file implements the serverless function for handling user queries

import { NextResponse } from "next/server";
import { processQueryWithData } from "../../../utils/openai/retrieval";
import logger from "../../../utils/logger";

// New route segment config format for Next.js 14+
export const runtime = "nodejs";

// This handles requests to analyze datasets
export async function POST(request) {
  let query, context, cachedFileIds; // Ensure all are defined for error logging
  try {
    // Parse the request body
    const body = await request.json();
    query = body.query;
    context = body.context;
    cachedFileIds = body.cachedFileIds || [];

    if (!query) {
      return NextResponse.json(
        { error: "Missing required field: query" },
        { status: 400 }
      );
    }

    // Make sure cachedFileIds is always an array
    const validCachedFileIds = Array.isArray(cachedFileIds)
      ? cachedFileIds
      : [];

    logger.info(`[QUERY API] Query received`, {
      query: query.substring(0, 100),
      cachedFileIdsCount: validCachedFileIds.length,
    });

    // Process the query using our retrieval system
    const result = await processQueryWithData(
      query,
      context || "all-sector",
      validCachedFileIds
    );

    // Mark if this is a follow-up and using cached files
    if (result.status === "follow_up") {
      logger.info(`[QUERY API] Follow-up detected, using cached files`, {
        cachedFileIdsCount: validCachedFileIds.length,
      });
    } else if (result.file_ids) {
      // Calculate which files are new vs cached
      const newFiles = result.file_ids.filter(
        (id) => !validCachedFileIds.includes(id)
      );
      result.new_file_ids = newFiles;

      logger.info(`[QUERY API] Files processed`, {
        totalFiles: result.file_ids.length,
        newFiles: newFiles.length,
      });
    }

    // Check for special error status
    if (result.status === "error_no_context") {
      logger.warn("[QUERY API] Content transformation without context error", {
        query,
      });

      // Pass the error along to the client
      return NextResponse.json({
        ...result,
        query_info: {
          error_type: "content_transformation_no_context",
          message:
            result.error || "Cannot process this request without prior context",
        },
      });
    }

    // Add query type information to help with debugging
    result.query_info = {
      is_follow_up: result.status === "follow_up",
      cached_files_count: validCachedFileIds.length,
      new_files_count: result.new_file_ids ? result.new_file_ids.length : 0,
      total_files_count: result.file_ids ? result.file_ids.length : 0,
    };

    return NextResponse.json(result);
  } catch (error) {
    // Enhanced error logging for better diagnosis
    let errorInfo = {};
    if (error instanceof Error) {
      errorInfo = {
        message: error.message,
        stack: error.stack,
      };
    } else {
      errorInfo = {
        raw: JSON.stringify(error),
      };
    }
    logger.error(`[QUERY API] Error processing query`, {
      error: errorInfo,
      query,
    });
    return NextResponse.json(
      {
        error: "Error processing query",
        details: errorInfo.message || errorInfo.raw || "Unknown error",
      },
      { status: 500 }
    );
  }
}
