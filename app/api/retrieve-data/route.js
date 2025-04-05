// API Endpoint for Data Retrieval
// This file implements the serverless function for retrieving complete data files
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const body = await request.json();
    const { file_ids } = body;

    if (!file_ids || !Array.isArray(file_ids)) {
      return NextResponse.json(
        { error: "Invalid file_ids parameter" },
        { status: 400 }
      );
    }

    // Use local files (in production this would typically use GitHub)
    const files = await Promise.all(
      file_ids.map(async (id) => {
        try {
          // Sanitize file ID to prevent any path traversal
          const safeId = id.replace(/[^a-zA-Z0-9_\.-]/g, "");

          // Use the correct local path to the split data files
          const dataDir = path.join(
            process.cwd(),
            "scripts",
            "output",
            "split_data"
          );
          const filePath = path.join(dataDir, `${safeId}.json`);

          console.log(`Retrieving file: ${filePath}`);

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
          }

          // Read the file
          const fileData = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(fileData);

          return { id, data, error: null };
        } catch (err) {
          console.error(`Error retrieving ${id}:`, err);
          return { id, data: null, error: err.message };
        }
      })
    );

    // Count total data points for validation
    let totalDataPoints = 0;
    for (const file of files) {
      if (file.data) {
        totalDataPoints += countDataPoints(file.data);
      }
    }

    return NextResponse.json({
      success: true,
      files,
      metadata: {
        requested: file_ids.length,
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
