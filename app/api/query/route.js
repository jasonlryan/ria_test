// API Endpoint for Query Processing
// This file implements the serverless function for handling user queries

import { NextResponse } from "next/server";
import { processQueryWithData } from "../../../utils/openai/retrieval";

export async function POST(request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Invalid query parameter" },
        { status: 400 }
      );
    }

    // Check query length to prevent excessive token usage
    if (query.length > 500) {
      return NextResponse.json(
        { error: "Query exceeds maximum length of 500 characters" },
        { status: 400 }
      );
    }

    console.log(`Processing query: ${query}`);

    // Process query using the two-step retrieval approach
    const result = await processQueryWithData(query);

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      validation: result.validation,
      metadata: {
        files_used: result.files_used,
        data_points: result.data_points,
      },
    });
  } catch (error) {
    console.error("Error processing query:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// For older Next.js versions that might use the API Routes format
export const config = {
  api: {
    bodyParser: true,
  },
};
