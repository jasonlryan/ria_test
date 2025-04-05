import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const body = await request.json();
    const { filename, data } = body;

    if (!filename || !data) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing filename or data",
        },
        { status: 400 }
      );
    }

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Save the file to the logs directory
    const filePath = path.join(logsDir, filename);
    fs.writeFileSync(filePath, data, "utf8");

    console.log(`Saved file to ${filePath}`);

    return NextResponse.json({
      success: true,
      message: `File saved to ${filePath}`,
    });
  } catch (error) {
    console.error("Error saving file to logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
