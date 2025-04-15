/**
 * Smart filtering module for query intent parsing and data filtering
 *
 * Segment keys are imported from utils/data/segment_keys.js
 */
const { CANONICAL_SEGMENTS } = require("./segment_keys");

/**
 * Parse the user query and conversation history to extract intent.
 * @param {string} query
 * @param {Array} conversationHistory
 * @returns {import("./types").QueryIntent}
 */
function parseQueryIntent(query, conversationHistory = []) {
  // Basic rule-based parsing for demonstration
  // In production, replace with NLP or more advanced logic

  // Example: extract years, topics, demographics from query string
  const yearRegex = /\b(20\d{2})\b/g;
  const years = [];
  let match;
  while ((match = yearRegex.exec(query))) {
    years.push(Number(match[1]));
  }

  // Example: simple topic/demographic extraction (expand as needed)
  const topics = [];
  if (/remote|flexibility/i.test(query)) topics.push("remote_work");
  if (/ai|artificial intelligence/i.test(query)) topics.push("ai_impact");
  if (/leave|attrition/i.test(query)) topics.push("attrition");

  const demographics = [];
  if (/us|united states/i.test(query)) demographics.push("us");
  if (/uk|united kingdom/i.test(query)) demographics.push("uk");
  if (/global/i.test(query)) demographics.push("global");

  // Specificity: if query mentions a demographic or year, treat as specific
  const specificity =
    demographics.length > 0 || years.length > 0 ? "specific" : "general";

  // Follow-up detection: if conversationHistory has previous queries, treat as follow-up
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
 * @param {import("./types").QueryIntent} queryIntent
 * @returns {import("./types").DataScope}
 */
function mapIntentToDataScope(queryIntent) {
  // TODO: Implement mapping logic from intent to data scope (fileIds, topics, demographics, years)
  return {
    topics: new Set(queryIntent.topics),
    demographics: new Set(queryIntent.demographics),
    years: new Set(queryIntent.years),
    fileIds: new Set(), // To be determined based on mapping logic
  };
}

/**
 * Return only essential data for general queries.
 * @param {any} retrievedData
 * @param {import("./types").QueryIntent} queryIntent
 * @returns {any}
 */
function getBaseData(retrievedData, queryIntent) {
  // Extract all available stats and percentages from the real file structure
  if (
    !retrievedData ||
    typeof retrievedData !== "object" ||
    !retrievedData.files
  ) {
    return { summary: "No data available", stats: [] };
  }

  const stats = [];
  for (const file of retrievedData.files) {
    const fileData = file.data;
    if (!fileData || !Array.isArray(fileData.responses)) continue;
    const question =
      fileData.question ||
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
            value: segmentValue,
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
                value: subValue,
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
    summary: `Extracted ${stats.length} statistics from ${retrievedData.files.length} files.`,
    stats,
  };
}

/**
 * Return detailed data filtered by demographics, years, etc.
 * @param {any} retrievedData
 * @param {import("./types").QueryIntent} queryIntent
 * @returns {any}
 */
function getSpecificData(retrievedData, { demographics = [] }) {
  // Only filter by canonical segment keys as provided by the LLM
  if (
    !retrievedData ||
    typeof retrievedData !== "object" ||
    !retrievedData.files
  ) {
    return { filteredData: [] };
  }

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

  // DIAGNOSTIC LOG: Print segmentsToUse
  console.log("[getSpecificData] segmentsToUse:", segmentsToUse);

  const filteredStats = [];

  for (const file of retrievedData.files) {
    if (!file.data || !Array.isArray(file.data.responses)) {
      continue;
    }
    const question =
      file.data.question ||
      (file.data.metadata && file.data.metadata.canonicalQuestion) ||
      "";
    for (const responseObj of file.data.responses) {
      const responseText = responseObj.response || "";
      const dataObj = responseObj.data || {};
      // For each segment in dataObj
      for (const segmentKey of Object.keys(dataObj)) {
        const segmentValue = dataObj[segmentKey];
        if (!segmentsToUse.includes(segmentKey)) {
          continue;
        }
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
        } else if (typeof segmentValue === "object" && segmentValue !== null) {
          // Nested segments (e.g., region, age, etc.)
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

  // DIAGNOSTIC LOG: Count sector stats
  const sectorStatsCount = filteredStats.filter(
    (stat) => stat.category === "sector" || stat.segment === "sector"
  ).length;
  console.log("[getSpecificData] sectorStatsCount:", sectorStatsCount);

  return { filteredData: filteredStats };
}

module.exports = {
  parseQueryIntent,
  mapIntentToDataScope,
  getBaseData,
  getSpecificData,
};
