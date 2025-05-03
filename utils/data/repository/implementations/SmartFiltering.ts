/**
 * Smart Filtering Implementation
 *
 * TypeScript implementation of smart filtering functionality,
 * adapted from the original JavaScript module.
 *
 * References original: utils/data/smart_filtering.js
 * 
 * Last Updated: Sat May 25 2025
 */

import {
  QueryIntent,
  DataScope,
  FilterResult,
  FilteredDataItem,
} from "../interfaces/FilterProcessor";
import { CANONICAL_SEGMENTS } from "../../../cache/segment_keys";
import logger from "../../../shared/logger";

/**
 * Parse the user query and conversation history to extract intent.
 * @param query - The query text to analyze
 * @param conversationHistory - Optional conversation history
 * @returns Parsed query intent
 */
export function parseQueryIntent(
  query: string,
  conversationHistory: any[] = []
): QueryIntent {
  // Basic rule-based parsing for demonstration
  // Extract years from query
  const yearRegex = /\b(20\d{2})\b/g;
  const years: number[] = [];
  let match;
  while ((match = yearRegex.exec(query)) !== null) {
    years.push(Number(match[1]));
  }

  // Extract topics using simple pattern matching
  const topics: string[] = [];
  if (/remote|flexibility/i.test(query)) topics.push("remote_work");
  if (/ai|artificial intelligence/i.test(query)) topics.push("ai_impact");
  if (/leave|attrition/i.test(query)) topics.push("attrition");

  // Extract demographics
  const demographics: string[] = [];
  if (/us|united states/i.test(query)) demographics.push("us");
  if (/uk|united kingdom/i.test(query)) demographics.push("uk");
  if (/global/i.test(query)) demographics.push("global");
  
  // Add job level if mentioned
  if (/job level|position|seniority|management/i.test(query)) 
    demographics.push("job_level");
  
  // Add age if mentioned
  if (/age|ages|generation|older|younger/i.test(query))
    demographics.push("age");
  
  // Determine specificity
  const specificity =
    demographics.length > 0 || years.length > 0 ? "specific" : "general";

  // Follow-up detection
  const isFollowUp = conversationHistory.length > 0;

  return {
    topics,
    demographics,
    years,
    specificity,
    isFollowUp,
  };
}

/**
 * Map query intent to required data scope.
 * @param queryIntent - The parsed query intent
 * @returns Data scope for retrieval
 */
export function mapIntentToDataScope(queryIntent: QueryIntent): DataScope {
  return {
    topics: new Set(queryIntent.topics),
    demographics: new Set(queryIntent.demographics),
    years: new Set(queryIntent.years),
    fileIds: new Set(), // To be determined based on mapping logic
  };
}

/**
 * Filter data by specified segments
 * @param data - Data object with files property containing an array of data files
 * @param segments - Segments to filter by
 * @returns Filtered data result
 */
export function filterDataBySegments(
  data: any,
  segments: string[]
): FilterResult {
  logger.info("[FILTER] Called with data structure:", {
    type: typeof data,
    hasFiles: data?.files ? true : false,
    filesCount: data?.files?.length || 0,
    segments: JSON.stringify(segments),
  });

  // Validate input data structure
  if (!data || typeof data !== "object" || !data.files || !Array.isArray(data.files)) {
    logger.error("[FILTER] ERROR: Invalid data format for filtering");
    return {
      filteredData: [],
      stats: [],
      foundSegments: [],
      missingSegments: segments,
    };
  }

  const filesWithResponses = data.files.filter(
    (file: any) =>
      file.data &&
      Array.isArray(file.data.responses) &&
      file.data.responses.length > 0
  ).length;
  
  logger.info(
    `[FILTER] Files with valid responses: ${filesWithResponses}/${data.files.length}`
  );

  // If no segments provided, use all canonical segments
  let segmentsToUse = segments && segments.length > 0
    ? segments
        .map((d) => {
          // Map to canonical if possible (e.g., "country" → "region")
          if (d.toLowerCase() === "country") return "region";
          return d;
        })
        .filter((d) => CANONICAL_SEGMENTS.includes(d))
    : CANONICAL_SEGMENTS;

  // Always include "overall" in segmentsToUse
  if (!segmentsToUse.includes("overall")) {
    segmentsToUse = ["overall", ...segmentsToUse];
  }

  logger.info("[FILTER] segmentsToUse:", segmentsToUse);

  const filteredStats: FilteredDataItem[] = [];
  const foundSegments: string[] = [];

  for (const file of data.files) {
    // Verify we have a valid file to process
    if (!file.data) {
      logger.warn(`[FILTER] File ${file.id} has no data property`);
      continue;
    }

    // Extract question from file
    const question =
      file.data.question ||
      (file.data.metadata && file.data.metadata.canonicalQuestion) ||
      "";

    // Handle different file structures
    const responses = Array.isArray(file.data.responses)
      ? file.data.responses
      : Array.isArray(file.data)
      ? file.data
      : [];

    if (responses.length === 0) {
      logger.warn(`[FILTER] File ${file.id} has no responses`);
      continue;
    }

    // Process each response
    for (const responseObj of responses) {
      if (!responseObj || typeof responseObj !== "object") {
        continue;
      }

      const responseText = responseObj.response || "";
      const dataObj = responseObj.data || responseObj;

      if (!dataObj || typeof dataObj !== "object") {
        logger.warn(
          `[FILTER] Response has no valid data object in file ${file.id}`
        );
        continue;
      }

      // Process each segment in dataObj
      for (const segmentKey of Object.keys(dataObj)) {
        // Skip if this segment isn't in our target segments
        if (!segmentsToUse.includes(segmentKey)) {
          continue;
        }

        // Keep track of found segments
        if (!foundSegments.includes(segmentKey)) {
          foundSegments.push(segmentKey);
        }

        const segmentValue = dataObj[segmentKey];

        // Handle direct value (e.g., "overall": 0.67)
        if (typeof segmentValue === "number") {
          filteredStats.push({
            fileId: file.id,
            question,
            response: responseText,
            segment: segmentKey,
            category: segmentKey,
            value: "overall",
            stat: segmentValue,
            percentage: Math.round(segmentValue * 100),
            formatted: `${Math.round(segmentValue * 100)}%`,
          });
        }
        // Handle nested segment objects (e.g., "region": {"united_states": 0.72, ...})
        else if (typeof segmentValue === "object" && segmentValue !== null) {
          for (const subKey of Object.keys(segmentValue)) {
            const subValue = segmentValue[subKey];
            if (typeof subValue === "number") {
              filteredStats.push({
                fileId: file.id,
                question,
                response: responseText,
                segment: `${segmentKey}:${subKey}`,
                category: segmentKey,
                value: subKey,
                stat: subValue,
                percentage: Math.round(subValue * 100),
                formatted: `${Math.round(subValue * 100)}%`,
              });
            }
          }
        }
      }
    }
  }

  // Log count of stats for each segment for debugging
  segmentsToUse.forEach((seg) => {
    const count = filteredStats.filter((stat) => stat.category === seg).length;
    logger.info(`[FILTER] ${seg} stats count:`, count);
  });

  logger.info(
    `[FILTER] FINAL: Generated ${filteredStats.length} stats items across ${foundSegments.length} segments`
  );

  // Calculate missing segments
  const missingSegments = segmentsToUse.filter(
    (seg) => !foundSegments.includes(seg) && seg !== "overall"
  );

  // Return the filtered data result
  return {
    filteredData: filteredStats,
    stats: filteredStats,
    summary: `Extracted ${filteredStats.length} statistics from ${data.files.length} files across ${foundSegments.length} segments.`,
    foundSegments,
    missingSegments,
  };
}

/**
 * Legacy wrapper for getSpecificData to maintain backward compatibility
 * @deprecated Use filterDataBySegments instead
 */
export function getSpecificData(
  retrievedData: any,
  options: { demographics?: string[] }
): FilterResult {
  logger.info("[LEGACY] Using getSpecificData adapter - forwarding to filterDataBySegments");
  return filterDataBySegments(retrievedData, options.demographics || []);
} 