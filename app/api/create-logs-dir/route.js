import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    // Create logs directory if it doesn't exist (async, idempotent)
    const logsDir = path.join(process.cwd(), "logs");
    await fs.promises.mkdir(logsDir, { recursive: true });

    return NextResponse.json({
      success: true,
      message: "Logs directory created or verified",
    });
  } catch (error) {
    console.error("Error creating logs directory:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
