// API Endpoint for Query Processing
// This file implements the serverless function for handling user queries

import { NextResponse } from "next/server";
import { processQueryWithData } from "../../../utils/openai/retrieval";

// New route segment config format for Next.js 14+
export const runtime = "nodejs";

// This handles requests to analyze datasets
export async function POST(request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { query, context, cachedFileIds = [] } = body;

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

    console.log(
      `[QUERY API] 🔍 Query: "${query.substring(0, 50)}${
        query.length > 50 ? "..." : ""
      }"`
    );
    console.log(`[QUERY API] 💾 Cached files: ${validCachedFileIds.length}`);

    // Process the query using our retrieval system
    const result = await processQueryWithData(
      query,
      context || "all-sector",
      validCachedFileIds
    );

    // Mark if this is a follow-up and using cached files
    if (result.status === "follow_up") {
      console.log(
        `[QUERY API] ✅ Follow-up detected, using ${validCachedFileIds.length} cached files`
      );
    } else if (result.file_ids) {
      // Calculate which files are new vs cached
      const newFiles = result.file_ids.filter(
        (id) => !validCachedFileIds.includes(id)
      );
      result.new_file_ids = newFiles;

      console.log(
        `[QUERY API] 📊 Files: ${result.file_ids.length} total, ${newFiles.length} new`
      );
    }

    // Check for special error status
    if (result.status === "error_no_context") {
      console.log(
        "[QUERY API] ⚠️ Content transformation without context error"
      );

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
    console.error(`[QUERY API] ❌ Error processing query:`, error);
    return NextResponse.json(
      { error: "Error processing query", details: error.message },
      { status: 500 }
    );
  }
}
