/**
 * Controller for retrieve-data API endpoint.
 * Handles request validation, file retrieval from filesystem,
 * response formatting, and error handling.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import fs from "fs";
import path from "path";

export async function postHandler(request) {
  try {
    const body = await request.json();
    const { file_ids } = body;

    if (!file_ids || !Array.isArray(file_ids)) {
      return formatBadRequestResponse("Invalid or missing 'file_ids' array");
    }

    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    const topics = new Set();

    const files = await Promise.all(
      file_ids.map(async (file_id) => {
        try {
          const normalizedId = file_id.endsWith(".json") ? file_id : `${file_id}.json`;
          const filePath = path.join(dataDir, normalizedId);

          if (!fs.existsSync(filePath)) {
            return { id: file_id, error: `File not found: ${filePath}` };
          }

          const fileContent = fs.readFileSync(filePath, "utf8");
          const jsonData = JSON.parse(fileContent);

          let topic = "Unknown";
          if (file_id.includes("_1")) topic = "Attraction_Factors";
          else if (file_id.includes("_2")) topic = "Retention_Factors";
          else if (file_id.includes("_3")) topic = "Attrition_Factors";
          else if (file_id.includes("_7")) topic = "Intention_to_Leave";
          else if (file_id.includes("_12")) topic = "Work_Preferences";

          topics.add(topic);

          return { id: file_id, topic, data: jsonData };
        } catch (error) {
          return { id: file_id, error: error.message };
        }
      })
    );

    const totalDataPoints = files.reduce((acc, file) => {
      if (file.data && Array.isArray(file.data)) return acc + file.data.length;
      if (file.data && typeof file.data === "object") return acc + 1;
      return acc;
    }, 0);

    const result = {
      files,
      topics: Array.from(topics),
      totalDataPoints,
      metadata: {
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
        processing_time_ms: 0, // Can be updated with timing if needed
        retrieved_at: new Date().toISOString(),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
