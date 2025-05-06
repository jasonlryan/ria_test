/**
 * Controller for save-to-logs API endpoint.
 * Handles request validation, log saving logic,
 * response formatting, and error handling.
 */

import { NextResponse } from "next/server";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";
import fs from "fs";
import path from "path";

export async function postHandler(request) {
  try {
    const body = await request.json();
    const { logEntry } = body;

    if (!logEntry || typeof logEntry !== "string") {
      return formatBadRequestResponse("Missing or invalid 'logEntry' field");
    }

    const logsDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logsDir, "application.log");

    await fs.promises.mkdir(logsDir, { recursive: true });
    await fs.promises.appendFile(logFile, logEntry + "\n", "utf8");

    return NextResponse.json({ message: "Log entry saved successfully." });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
