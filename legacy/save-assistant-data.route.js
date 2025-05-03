import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request) {
  try {
    const { data, timestamp } = await request.json();

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create a filename with timestamp
    const filename = `assistant-data-${timestamp
      .replace(/:/g, "-")
      .replace(/\./g, "-")}.txt`;
    const filePath = path.join(logsDir, filename);

    // Write the data to the file
    fs.writeFileSync(filePath, data);

    console.log(`Assistant data saved to: ${filePath}`);

    return NextResponse.json({
      success: true,
      filePath,
      message: `Data saved to ${filePath}. Check this file to see the exact data sent to the assistant.`,
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
