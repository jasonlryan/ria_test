/**
 * Helper function to build a natural language prompt with filtered data stats.
 * Groups stats by fileId, question, and response, then formats them into readable text.
 * @param {string} originalUserContent - The original user query.
 * @param {object} filteredData - The filtered data object containing stats array.
 * @returns {string} - The constructed prompt string.
 */
export function buildPromptWithFilteredData(originalUserContent, filteredData) {
  // Defensive check for filteredData and stats
  if (!filteredData || !Array.isArray(filteredData.stats)) {
    return originalUserContent;
  }

  // Group filteredStats by fileId, question, response
  const groupStats = (stats) => {
    const grouped = [];
    const keyMap = new Map();
    for (const stat of stats) {
      const key = `${stat.fileId}||${stat.question}||${stat.response}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          fileId: stat.fileId,
          question: stat.question,
          response: stat.response,
          overall: null,
          region: {},
          age: {},
          gender: {},
        });
      }
      const entry = keyMap.get(key);
      if (stat.segment === "overall") {
        entry.overall = stat.percentage;
      } else if (stat.segment.startsWith("region:")) {
        const region = stat.segment.split(":")[1];
        entry.region[region] = stat.percentage;
      } else if (stat.segment.startsWith("age:")) {
        const age = stat.segment.split(":")[1];
        entry.age[age] = stat.percentage;
      } else if (stat.segment.startsWith("gender:")) {
        const gender = stat.segment.split(":")[1];
        entry.gender[gender] = stat.percentage;
      }
    }
    return Array.from(keyMap.values());
  };

  const formatGroupedStats = (grouped) => {
    return grouped
      .map((entry) => {
        let lines = [];
        lines.push("Question: " + entry.question);
        lines.push("Response: " + entry.response);
        if (entry.overall !== null) {
          lines.push("- overall: " + entry.overall + "%");
        }
        if (Object.keys(entry.region).length > 0) {
          lines.push(
            "- region { " +
              Object.entries(entry.region)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        if (Object.keys(entry.age).length > 0) {
          lines.push(
            "- age { " +
              Object.entries(entry.age)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        if (Object.keys(entry.gender).length > 0) {
          lines.push(
            "- gender { " +
              Object.entries(entry.gender)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        return lines.join("\n");
      })
      .join("\n\n");
  };

  const groupedStats = groupStats(filteredData.stats);
  const statsPreview =
    groupedStats.length > 0
      ? formatGroupedStats(groupedStats)
      : "No data matched for the selected segments.";

  return originalUserContent + "\n\n" + statsPreview;
}
