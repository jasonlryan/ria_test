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
  FilterProcessor
} from "../interfaces/FilterProcessor";
import { CANONICAL_SEGMENTS } from "../../../cache/segment_keys";
import logger from "../../../shared/logger";
import { DataFile } from "../interfaces/FileRepository";
import { QueryContext } from "../interfaces/QueryContext";

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
 * Implementation of the FilterProcessor interface for smart filtering
 * of data files by segments and other criteria.
 */
export class SmartFilteringProcessor implements FilterProcessor {
  /**
   * Filter data by segments and extract statistics
   *
   * Direct processing of DataFile[] without intermediate object transformations.
   * 
   * @param files Array of data files to filter
   * @param context QueryContext containing segment information
   * @returns FilterResult containing filtered data and statistics
   */
  filterDataBySegments(files: DataFile[], context: QueryContext): FilterResult {
    logger.info("[FILTER] Called with files:", {
      count: files.length,
      segments: context.segments || []
    });

    // Use segments from context or fallback to defaults
    const segments = context.segments || ['region', 'age', 'gender'];
    
    // Validate input
    if (!files || !Array.isArray(files) || files.length === 0) {
      logger.error("[FILTER] ERROR: Invalid files array");
      return {
        filteredData: [],
        stats: [],
        foundSegments: [],
        missingSegments: segments,
        allAvailableSegmentsInFiles: {},
      };
    }

    // Count files with responses
    const filesWithResponses = files.filter(
      (file: DataFile) =>
        (Array.isArray(file.responses) && file.responses.length > 0) ||
        ((file as any).data && Array.isArray((file as any).data.responses) && (file as any).data.responses.length > 0)
    ).length;
    
    logger.info(`[FILTER] Files with valid responses: ${filesWithResponses}/${files.length}`);

    // Initialize objects to store segment information
    const allAvailableSegmentsOverall = new Set<string>(["overall"]);
    const allAvailableSegmentsPerFile: Record<string, Set<string>> = {}; 

    // Process each file to discover all segments present in the data
    for (const file of files) {
      if (!file || !file.id) continue; // Ensure file and file.id exist

      // Initialize segment set for the current file if it doesn't exist
      if (!allAvailableSegmentsPerFile[file.id]) {
        allAvailableSegmentsPerFile[file.id] = new Set<string>(["overall"]);
      }
      
      const responses = Array.isArray(file.responses)
        ? file.responses
        : Array.isArray((file as any).data?.responses)
        ? (file as any).data.responses
        : [];
      
      for (const responseObj of responses) {
        if (!responseObj || typeof responseObj !== "object") continue;
        
        const dataObj = responseObj.data || responseObj;
        if (!dataObj || typeof dataObj !== "object") continue;
        
        // Add any segment key found in the data
        for (const segmentKey of Object.keys(dataObj)) {
          if (CANONICAL_SEGMENTS.includes(segmentKey)) {
            allAvailableSegmentsOverall.add(segmentKey);
            allAvailableSegmentsPerFile[file.id].add(segmentKey);
          }
        }
      }
    }

    // Special handling for segments of high interest
    const HIGH_INTEREST_SEGMENTS = ['sector', 'industry', 'education'];
    const hasHighInterestSegments = [...allAvailableSegmentsOverall].some(segment => 
      HIGH_INTEREST_SEGMENTS.includes(segment));

    // Log available segments
    logger.info(`[FILTER] Available segments in data (overall): ${[...allAvailableSegmentsOverall].join(', ')}`);
    if (hasHighInterestSegments) {
      logger.info(`[FILTER] Found high-interest segments (sector/industry/education)`);
    }

    // Map any non-canonical segment names and ensure overall is included
    let segmentsToUse = segments.length > 0
      ? segments
          .map((d) => {
            if (d.toLowerCase() === "country") return "region";
            return d;
          })
          .filter((d) => CANONICAL_SEGMENTS.includes(d))
      : CANONICAL_SEGMENTS;

    // Always include "overall" in segmentsToUse
    if (!segmentsToUse.includes("overall")) {
      segmentsToUse = ["overall", ...segmentsToUse];
    }

    // IMPORTANT: Always include high-interest segments if they're available in the data
    // This ensures sector/industry/education data is never filtered out if present
    for (const segment of HIGH_INTEREST_SEGMENTS) {
      if (allAvailableSegmentsOverall.has(segment) && !segmentsToUse.includes(segment)) {
        segmentsToUse.push(segment);
        logger.info(`[FILTER] Adding high-interest segment to processing: ${segment}`);
      }
    }

    logger.info("[FILTER] segmentsToUse:", segmentsToUse);

    const filteredStats: FilteredDataItem[] = [];
    const foundSegments: string[] = [];

    // Process each file for stats generation
    for (const file of files) {
      if (!file || !file.id) { // Ensure file and file.id exist for stats generation too
        logger.warn("[FILTER] Invalid file object or missing file.id during stats generation");
        continue;
      }

      // Extract question from file (check all possible locations)
      const question =
        (file as any).question || 
        (file.metadata && file.metadata.canonicalQuestion) ||
        ((file as any).data && (file as any).data.question) ||
        ((file as any).data && (file as any).data.metadata && (file as any).data.metadata.canonicalQuestion) ||
        "";

      // Get responses array from the most direct source
      const responses = Array.isArray(file.responses)
        ? file.responses           // Direct responses array - this is what FileSystemRepository returns
        : Array.isArray((file as any).data?.responses)
        ? (file as any).data.responses      // Secondary location
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
          logger.warn(`[FILTER] Response has no valid data object in file ${file.id}`);
          continue;
        }

        // Process each segment in dataObj
        for (const segmentKey of Object.keys(dataObj)) {
          // Skip if this segment isn't in our target segments
          if (!segmentsToUse.includes(segmentKey)) {
            continue;
          }

          // Track found segments
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

    logger.info(`[FILTER] FINAL: Generated ${filteredStats.length} stats items across ${foundSegments.length} segments`);

    // Calculate missing segments
    const missingSegments = segmentsToUse.filter(
      (seg) => !foundSegments.includes(seg) && seg !== "overall"
    );

    // Convert Set<string> to string[] for each file in allAvailableSegmentsPerFile
    const allAvailableSegmentsInFilesResult: Record<string, string[]> = {};
    for (const fileId in allAvailableSegmentsPerFile) {
      allAvailableSegmentsInFilesResult[fileId] = Array.from(allAvailableSegmentsPerFile[fileId]);
    }

    // Return the filtered data result
    return {
      filteredData: filteredStats,
      stats: filteredStats,
      summary: `Extracted ${filteredStats.length} statistics from ${files.length} files across ${foundSegments.length} segments.`,
      foundSegments,
      missingSegments,
      allAvailableSegmentsInFiles: allAvailableSegmentsInFilesResult, 
    };
  }

  /**
   * Parse query intent from the query text and context
   * 
   * @param query Query text to parse
   * @param context Query context
   * @returns Updated context with parsed intent
   */
  parseQueryIntent(query: string, context: QueryContext): QueryContext {
    return {
      ...context,
      queryIntent: parseQueryIntent(query)
    };
  }
  
  /**
   * Return only essential data for general queries
   * 
   * @param files Array of data files
   * @param context Query context
   * @returns Filter result with base data
   */
  getBaseData(files: DataFile[], context: QueryContext): FilterResult {
    // Delegate to main implementation with default segments
    return this.filterDataBySegments(files, {
      ...context,
      segments: ['overall', 'region', 'age', 'gender']
    });
  }
}

/**
 * Legacy wrapper for backward compatibility
 * Directly forwards to the SmartFilteringProcessor implementation
 * 
 * @deprecated Use SmartFilteringProcessor.filterDataBySegments instead
 */
export function filterDataBySegments(data: any, segments: string[]): FilterResult {
  // Handle both function signatures: DataFile[] and {files: DataFile[]}
  const processor = new SmartFilteringProcessor();
  
  // If data is directly an array, assume it's DataFile[]
  if (Array.isArray(data)) {
    return processor.filterDataBySegments(data, { segments } as any);
  }
  
  // Otherwise, use the legacy {files: [...]} format
  if (data && Array.isArray(data.files)) {
    return processor.filterDataBySegments(data.files, { segments } as any);
  }
  
  // Invalid input
  logger.error("[FILTER] Invalid input to filterDataBySegments");
  return {
    filteredData: [],
    stats: [],
    foundSegments: [],
    missingSegments: segments || [],
    allAvailableSegmentsInFiles: {},
  };
}

export default SmartFilteringProcessor; 