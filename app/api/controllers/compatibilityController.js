/**
 * Controller for compatibility API endpoints.
 * Handles request validation, delegates to compatibility service,
 * manages response formatting and error handling.
 */

import { NextResponse } from "next/server";
import {
  formatBadRequestResponse,
  formatErrorResponse,
} from "../../../utils/shared/errorHandler";
import CompatibilityService from "../services/compatibilityService";
import logger from "../../../utils/shared/logger";

const compatibilityService = new CompatibilityService();

/**
 * Handle GET requests for compatibility information
 */
export async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const action = searchParams.get("action");

    logger.info(`[COMPATIBILITY] Processing ${action} request`);

    if (action === "mapping") {
      // Return the full compatibility mapping
      const mapping = await compatibilityService.getCompatibilityMapping();
      return NextResponse.json({ mapping });
    }

    if (action === "compatibleTopics") {
      // Return list of compatible topics
      const topics = await compatibilityService.getCompatibleTopics();
      return NextResponse.json({ topics });
    }

    if (action === "nonComparableTopics") {
      // Return list of non-comparable topics
      const topics = await compatibilityService.getNonComparableTopics();
      return NextResponse.json({ topics });
    }

    if (fileId) {
      // Check compatibility for a specific file
      const compatibility = await compatibilityService.getFileCompatibility(
        fileId
      );
      return NextResponse.json({ compatibility });
    }

    return formatBadRequestResponse(
      "Missing required parameters. Please specify fileId or action"
    );
  } catch (error) {
    logger.error(`[ERROR] Compatibility controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}

/**
 * Handle POST requests for bulk compatibility checks
 */
export async function postHandler(request) {
  try {
    const body = await request.json();
    const { fileIds, isComparisonQuery } = body;

    if (!fileIds || !Array.isArray(fileIds)) {
      return formatBadRequestResponse(
        "Missing or invalid fileIds parameter. Expected array of file IDs."
      );
    }

    logger.info(
      `[COMPATIBILITY] Processing bulk compatibility check for ${fileIds.length} files`
    );

    if (isComparisonQuery) {
      // Filter incomparable files for comparison query
      const result = await compatibilityService.filterIncomparableFiles(
        fileIds,
        true
      );
      return NextResponse.json(result);
    } else {
      // Check if all files are comparable with each other
      const areComparable = await compatibilityService.areFilesComparable(
        fileIds
      );
      return NextResponse.json({ areComparable });
    }
  } catch (error) {
    logger.error(`[ERROR] Compatibility controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
