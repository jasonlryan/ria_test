/**
 * Smart filtering module for query intent parsing and data filtering
 *
 * Functions:
 * - parseQueryIntent
 * - mapIntentToDataScope
 * - getBaseData
 * - getSpecificData
 */

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
function getSpecificData(retrievedData, queryIntent) {
  // Robust implementation: filter by year, demographics, and topics if possible
  if (
    !retrievedData ||
    typeof retrievedData !== "object" ||
    !retrievedData.files
  ) {
    return { filteredData: [] };
  }

  const { years = [], demographics = [], topics = [] } = queryIntent;
  const filteredStats = [];

  for (const file of retrievedData.files) {
    if (!file.data || !Array.isArray(file.data.responses)) continue;
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
        if (typeof segmentValue === "number") {
          // Filter by year, demographics, topics if needed
          let yearMatch = true;
          if (years.length > 0) {
            yearMatch = years.some(
              (y) =>
                (question && String(question).includes(String(y))) ||
                (responseText && String(responseText).includes(String(y)))
            );
          }
          if (!yearMatch) continue;

          let demoMatch = true;
          if (demographics.length > 0) {
            demoMatch = demographics.some(
              (demo) =>
                segmentKey &&
                segmentKey.toLowerCase().includes(demo.toLowerCase())
            );
          }
          if (demographics.length > 0 && !demoMatch) continue;

          let topicMatch = true;
          if (topics.length > 0) {
            topicMatch = topics.some(
              (t) =>
                question && question.toLowerCase().includes(t.toLowerCase())
            );
          }
          if (topics.length > 0 && !topicMatch) continue;

          filteredStats.push({
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
              // Filter by year, demographics, topics if needed
              let yearMatch = true;
              if (years.length > 0) {
                yearMatch = years.some(
                  (y) =>
                    (question && String(question).includes(String(y))) ||
                    (responseText && String(responseText).includes(String(y)))
                );
              }
              if (!yearMatch) continue;

              let demoMatch = true;
              if (demographics.length > 0) {
                demoMatch = demographics.some(
                  (demo) =>
                    subKey && subKey.toLowerCase().includes(demo.toLowerCase())
                );
              }
              if (demographics.length > 0 && !demoMatch) continue;

              let topicMatch = true;
              if (topics.length > 0) {
                topicMatch = topics.some(
                  (t) =>
                    question && question.toLowerCase().includes(t.toLowerCase())
                );
              }
              if (topics.length > 0 && !topicMatch) continue;

              filteredStats.push({
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

  return { filteredData: filteredStats };
}

module.exports = {
  parseQueryIntent,
  mapIntentToDataScope,
  getBaseData,
  getSpecificData,
};
