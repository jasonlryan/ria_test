import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const { data, filename } = await request.json();

    // Save directly to project root for maximum visibility
    const filePath = path.join(process.cwd(), "raw-data.txt");

    // Make sure we write EXACTLY what we get
    fs.writeFileSync(filePath, data, "utf8");

    // Also save a summary version that shows if raw_data is present
    const hasRawData =
      data.includes("Raw Survey Data:") && data.includes("```json");
    const summaryPath = path.join(process.cwd(), "data-summary.txt");
    const summary = `
DATA SENT TO ASSISTANT - SUMMARY
===============================
Length: ${data.length} characters
Has Raw Survey Data: ${hasRawData}
Date: ${new Date().toISOString()}

First 500 chars:
${data.substring(0, 500)}
...

DATA INCLUDES RAW_DATA: ${data.includes("raw_data")}
RAW_DATA POSITION: ${data.indexOf("raw_data")}
JSON POSITION: ${data.indexOf("```json")}
CLOSING JSON POSITION: ${data.indexOf("```", data.indexOf("```json") + 6)}

FULL DATA IS AVAILABLE IN: ${filePath}
    `;
    fs.writeFileSync(summaryPath, summary, "utf8");

    console.log(`SAVED COMPLETE ASSISTANT DATA TO: ${filePath}`);
    console.log(`SAVED SUMMARY TO: ${summaryPath}`);

    return NextResponse.json({
      success: true,
      filePath,
      message: `Data saved to ${filePath}`,
    });
  } catch (error) {
    console.error("Error saving assistant data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
