// API Endpoint for Query Processing
// This file implements the serverless function for handling user queries

import { NextResponse } from "next/server";
import { processQueryWithData } from "../../../utils/openai/retrieval";

export async function POST(req) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400 }
      );
    }

    console.log(`Processing query: ${query}`);

    // Process the query using the retrieval.js file
    const dataResult = await processQueryWithData(query);

    // Log the raw data status
    console.log(`DATA RESULT STATUS: ${dataResult ? "exists" : "null"}`);
    if (dataResult) {
      console.log(`HAS RAW DATA: ${!!dataResult.raw_data}`);
      console.log(`RAW DATA TYPE: ${typeof dataResult.raw_data}`);
      if (dataResult.raw_data) {
        console.log(
          `RAW DATA LENGTH: ${
            Array.isArray(dataResult.raw_data)
              ? dataResult.raw_data.length
              : "not array"
          }`
        );
        if (
          Array.isArray(dataResult.raw_data) &&
          dataResult.raw_data.length > 0
        ) {
          console.log(
            `FIRST ITEM: ${JSON.stringify(dataResult.raw_data[0]).substring(
              0,
              100
            )}...`
          );
        }
      }
    }

    // Return the result to the client for use in assistant prompting
    return NextResponse.json(dataResult);
  } catch (error) {
    console.error(`Error processing query:`, error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

// For older Next.js versions that might use the API Routes format
export const config = {
  api: {
    bodyParser: true,
  },
};
