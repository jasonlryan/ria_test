/**
 * Controller for create-logs-dir API endpoint.
 * Handles request validation, directory creation logic,
 * response formatting, and error handling.
 */

import { NextResponse } from "next/server";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";
import fs from "fs";
import path from "path";

export async function postHandler(request) {
  try {
    // For this endpoint, no specific body parameters are required
    const logsDir = path.join(process.cwd(), "logs");

    await fs.promises.mkdir(logsDir, { recursive: true });

    return NextResponse.json({ message: "Logs directory created or already exists." });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
