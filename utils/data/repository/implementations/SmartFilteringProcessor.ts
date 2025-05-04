/**
 * SmartFilteringProcessor Implementation
 *
 * Implements the FilterProcessor interface to provide smart filtering
 * capabilities for data files. Converts the existing smart_filtering.js
 * functionality to TypeScript and integrates with the repository pattern.
 *
 * Last Updated: Sun May 4 13:40:21 BST 2025
 */

import { 
  FilterProcessor, 
  FilterResult, 
  QueryIntent, 
  DataScope, 
  FilteredDataItem 
} from '../interfaces/FilterProcessor';
import { DataFile } from '../interfaces/FileRepository';
import { QueryContext } from '../interfaces/QueryContext';
import { CANONICAL_SEGMENTS } from '../../../cache/segment_keys';

/**
 * Implementation of the FilterProcessor interface
 */
export class SmartFilteringProcessor implements FilterProcessor {
  /**
   * Filter data by segments and extract statistics
   * 
   * @param files Array of data files to filter
   * @param context Query context containing segment information
   * @returns FilterResult containing filtered data and statistics
   */
  filterDataBySegments(files: DataFile[], context: QueryContext): FilterResult {
    console.log("[filterDataBySegments] Called with files:", {
      count: files.length,
      segments: context.segments || []
    });

    // Use the demographics from context as segments
    const segments = context.segments || ['country', 'age', 'gender'];
    
    // Convert files to the expected format for getSpecificData
    const retrievedData = {
      files: files.map(file => ({
        id: file.id,
        data: file.segments
      }))
    };

    const result = this.getSpecificData(retrievedData, { demographics: segments });

    // Track found and missing segments
    const foundSegments: string[] = [];
    const missingSegments: string[] = [];

    // Map segments to canonical names
    const canonicalSegmentMap: Record<string, string> = {
      'country': 'region',
      'generation': 'age'
    };

    // Track which segments were found in the data
    const segmentsInData = new Set<string>();
    result.filteredData.forEach(item => {
      segmentsInData.add(item.category);
    });

    // Add found segments to the result
    segments.forEach(segment => {
      const canonicalName = canonicalSegmentMap[segment] || segment;
      if (segmentsInData.has(canonicalName) || segmentsInData.has(segment)) {
        foundSegments.push(segment);
      } else {
        missingSegments.push(segment);
      }
    });

    // Add missing canonical segments
    CANONICAL_SEGMENTS.forEach(segment => {
      if (!foundSegments.includes(segment) && !missingSegments.includes(segment)) {
        missingSegments.push(segment);
      }
    });

    console.log(`[SEGMENTS] Found in data: ${foundSegments.join(', ')}`);
    console.log(`[SEGMENTS] Missing canonical segments: ${missingSegments.join(', ')}`);

    return {
      ...result,
      foundSegments,
      missingSegments
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
    // Extract years
    const yearRegex = /\b(20\d{2})\b/g;
    const years: number[] = [];
    let match;
    while ((match = yearRegex.exec(query))) {
      years.push(Number(match[1]));
    }

    // Extract topics based on keywords
    const topics: string[] = [];
    if (/remote|flexibility/i.test(query)) topics.push("remote_work");
    if (/ai|artificial intelligence/i.test(query)) topics.push("ai_impact");
    if (/leave|attrition/i.test(query)) topics.push("attrition");
    if (/leadership|managers/i.test(query)) topics.push("leadership");
    if (/trust|confidence/i.test(query)) topics.push("trust");

    // Extract demographics
    const demographics: string[] = [];
    if (/us|united states/i.test(query)) demographics.push("us");
    if (/uk|united kingdom/i.test(query)) demographics.push("uk");
    if (/global/i.test(query)) demographics.push("global");
    if (/age|generation/i.test(query)) demographics.push("age");
    if (/gender/i.test(query)) demographics.push("gender");
    
    // Determine specificity
    const specificity = demographics.length > 0 || years.length > 0 ? "specific" : "general";

    // Create intent object
    const intent: QueryIntent = {
      topics,
      demographics,
      years,
      specificity,
      isFollowUp: context.isFollowUp || false
    };

    // Return updated context with intent
    return {
      ...context,
      intent
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
    // Convert files to the expected format
    const retrievedData = {
      files: files.map(file => ({
        id: file.id,
        data: file.segments
      }))
    };

    // Extract all available stats and percentages
    const stats: FilteredDataItem[] = [];
    
    for (const file of retrievedData.files) {
      const fileData = file.data;
      if (!fileData || !Array.isArray(fileData.responses)) continue;
      
      const question = fileData.question || 
                     (fileData.metadata && fileData.metadata.canonicalQuestion) || 
                     "";
                     
      for (const responseObj of fileData.responses) {
        const responseText = responseObj.response || "";
        const dataObj = responseObj.data || {};
        
        for (const segmentKey of Object.keys(dataObj)) {
          const segmentValue = dataObj[segmentKey];
          
          if (typeof segmentValue === "number") {
            stats.push({
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
          } else if (typeof segmentValue === "object" && segmentValue !== null) {
            // Nested segments (e.g., region, age, etc.)
            for (const subKey of Object.keys(segmentValue)) {
              const subValue = segmentValue[subKey];
              if (typeof subValue === "number") {
                stats.push({
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

    return {
      filteredData: stats,
      stats,
      summary: `Extracted ${stats.length} statistics from ${retrievedData.files.length} files.`,
      foundSegments: ['overall'],
      missingSegments: CANONICAL_SEGMENTS.filter(seg => seg !== 'overall')
    };
  }

  /**
   * Get specific data filtered by demographics, years, etc.
   * Private method used by filterDataBySegments.
   * 
   * @param retrievedData Data to filter
   * @param options Filtering options
   * @returns Filtered data results
   */
  private getSpecificData(retrievedData: any, { demographics = [] }: { demographics?: string[] }): { filteredData: FilteredDataItem[], stats: FilteredDataItem[] } {
    console.log("[getSpecificData] Called with retrievedData:", {
      type: typeof retrievedData,
      hasFiles: retrievedData?.files ? true : false,
      filesCount: retrievedData?.files?.length || 0,
      demographics: JSON.stringify(demographics),
    });

    // Only filter by canonical segment keys as provided by the LLM
    if (
      !retrievedData ||
      typeof retrievedData !== "object" ||
      !retrievedData.files
    ) {
      console.error("[getSpecificData] ERROR: Invalid retrievedData format");
      return { filteredData: [], stats: [] };
    }

    const filesWithResponses = retrievedData.files.filter(
      (file: any) =>
        file.data &&
        Array.isArray(file.data.responses) &&
        file.data.responses.length > 0
    ).length;
    
    console.log(
      `[getSpecificData] Files with valid responses: ${filesWithResponses}/${retrievedData.files.length}`
    );

    // If no demographics provided, use all canonical segments
    let segmentsToUse =
      demographics && demographics.length > 0
        ? demographics
            .map((d) => {
              // Map LLM-provided segment to canonical if possible (e.g., "country" → "region")
              if (d.toLowerCase() === "country") return "region";
              return d;
            })
            .filter((d) => CANONICAL_SEGMENTS.includes(d))
        : CANONICAL_SEGMENTS;

    // Always include "overall" in segmentsToUse
    if (!segmentsToUse.includes("overall")) {
      segmentsToUse = ["overall", ...segmentsToUse];
    }

    console.log("[getSpecificData] segmentsToUse:", segmentsToUse);

    const filteredStats: FilteredDataItem[] = [];

    for (const file of retrievedData.files) {
      // First, verify we have a valid file to process
      if (!file.data) {
        console.warn(`[getSpecificData] File ${file.id} has no data property`);
        continue;
      }

      // Extract question from file
      const question =
        file.data.question ||
        (file.data.metadata && file.data.metadata.canonicalQuestion) ||
        "";

      // Some files might have different structures - handle both standard and nested formats
      const responses = Array.isArray(file.data.responses)
        ? file.data.responses
        : Array.isArray(file.data)
        ? file.data
        : [];

      if (responses.length === 0) {
        console.warn(`[getSpecificData] File ${file.id} has no responses`);
        continue;
      }

      // Process each response
      for (const responseObj of responses) {
        // Skip invalid responses
        if (!responseObj || typeof responseObj !== "object") {
          continue;
        }

        const responseText = responseObj.response || "";
        // Allow for different data locations
        const dataObj = responseObj.data || responseObj;

        if (!dataObj || typeof dataObj !== "object") {
          console.warn(
            `[getSpecificData] Response has no valid data object in file ${file.id}`
          );
          continue;
        }

        // Process each segment in dataObj
        for (const segmentKey of Object.keys(dataObj)) {
          // Skip if this segment isn't in our target segments
          if (!segmentsToUse.includes(segmentKey)) {
            continue;
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
      console.log(`[getSpecificData] ${seg} stats count:`, count);
    });

    console.log(
      `[getSpecificData] FINAL: Generated ${filteredStats.length} stats items`
    );

    // Return a consistent data structure that works with the pipeline
    return {
      filteredData: filteredStats,
      stats: filteredStats, // Also include at top level for direct access
    };
  }
}

export default SmartFilteringProcessor; 