// API Endpoint for Data Retrieval
// This file implements the serverless function for retrieving complete data files
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req) {
  console.log("RETRIEVE-DATA API CALLED");
  const startTime = performance.now();

  try {
    const body = await req.json();
    const { file_ids } = body;

    console.log(`Retrieving ${file_ids.length} files:`, file_ids);

    if (!file_ids || !Array.isArray(file_ids)) {
      return NextResponse.json({
        error: "Invalid file_ids parameter - must be an array",
        status: 400,
      });
    }

    // Debug check for the split_data directory
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    console.log(`Checking data directory: ${dataDir}`);
    console.log(`Directory exists: ${fs.existsSync(dataDir)}`);
    if (fs.existsSync(dataDir)) {
      console.log(`Files in directory: ${fs.readdirSync(dataDir).length}`);
    }

    // Array to collect the topics associated with files
    const topics = new Set();

    // Process each file ID and retrieve the corresponding data file
    const files = await Promise.all(
      file_ids.map(async (file_id) => {
        try {
          // Normalize file ID to include .json extension if missing
          const normalizedId = file_id.endsWith(".json")
            ? file_id
            : `${file_id}.json`;

          // Construct absolute path to the data file
          const filePath = path.join(
            process.cwd(),
            "scripts",
            "output",
            "split_data",
            normalizedId
          );

          // Log file retrieval for debugging
          console.log(`Attempting to retrieve file: ${filePath}`);
          console.log(`File exists: ${fs.existsSync(filePath)}`);

          // Ensure file exists
          if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return {
              id: file_id,
              error: `File not found: ${filePath}`,
            };
          }

          // Read the file content
          const fileContent = fs.readFileSync(filePath, "utf8");
          console.log(
            `File read successfully, size: ${fileContent.length} bytes`
          );

          // Parse the file content as JSON
          const jsonData = JSON.parse(fileContent);
          console.log(
            `Parsed JSON data, length: ${
              Array.isArray(jsonData) ? jsonData.length : "not an array"
            }`
          );

          // Extract topic from file_id (simple extraction logic)
          let topic = "Unknown";
          if (file_id.includes("_1")) topic = "Attraction_Factors";
          else if (file_id.includes("_2")) topic = "Retention_Factors";
          else if (file_id.includes("_3")) topic = "Attrition_Factors";
          else if (file_id.includes("_7")) topic = "Intention_to_Leave";
          else if (file_id.includes("_12")) topic = "Work_Preferences";

          // Add topic to set
          topics.add(topic);

          // Return file data
          return {
            id: file_id,
            topic: topic,
            data: jsonData, // This is the full raw data from the file
          };
        } catch (error) {
          console.error(`Error retrieving file ${file_id}:`, error);
          return {
            id: file_id,
            error: error.message,
          };
        }
      })
    );

    // Calculate total data points
    let totalDataPoints = 0;
    files.forEach((file) => {
      if (file.data && Array.isArray(file.data)) {
        totalDataPoints += file.data.length;
        console.log(`File ${file.id} contains ${file.data.length} data points`);
      } else if (file.data && typeof file.data === "object") {
        // Handle case where data might not be an array
        totalDataPoints += 1;
        console.log(`File ${file.id} contains 1 data object (not an array)`);
      }
    });

    console.log(`Total data points: ${totalDataPoints}`);
    console.log(`Successful files: ${files.filter((f) => !f.error).length}`);
    console.log(`Failed files: ${files.filter((f) => f.error).length}`);

    // Return the combined result
    const endTime = performance.now();
    const result = {
      files,
      topics: Array.from(topics),
      totalDataPoints,
      metadata: {
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
        processing_time_ms: endTime - startTime,
        retrieved_at: new Date().toISOString(),
      },
    };

    // Log a sample of the response
    if (files.length > 0 && files[0].data) {
      console.log(
        "Sample of first file data:",
        JSON.stringify(
          Array.isArray(files[0].data)
            ? files[0].data.slice(0, 1)
            : files[0].data
        ).slice(0, 500)
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in retrieve-data API:", error);
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

// Helper to count data points in file
function countDataPoints(data) {
  let count = 0;
  function traverse(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === "number") {
          count++;
        } else {
          traverse(obj[key]);
        }
      }
    }
  }
  traverse(data);
  return count;
}

// For older Next.js versions that might use the API Routes format
export const config = {
  api: {
    bodyParser: true,
  },
};
