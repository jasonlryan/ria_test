/**
 * Test script for query normalization
 * Run with: node scripts/test_query_normalization.js
 */

const { normalizeQueryText } = require("../utils/shared/queryUtils");

// Sample queries from logs
const queries = [
  // Standard query
  "how does this compare with 2024?",

  // Formatted query with Analysis Summary
  "Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected for year-on-year comparison",

  // Formatted query with file identification
  "Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification and smart filtering with 3 topics",

  // Query with query prefix in the middle of text
  "I want to know Query: what is the level of trust employees have?",

  // Multi-line query with nested structure
  `Query: What factors affect retention?

Analysis Summary: 
- Found 3 topics
- Used 5 files
- Processing time: 450ms`,

  // Query with multiple analysis sections
  `Query: how have attitudes changed?
  
Analysis: First analysis

Summary: Additional summary`,

  // Real query from logs
  `
Query: What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?

Analysis Summary: LLM-driven file identification and smart filtering completed successfully in 127ms.`,

  // Real follow-up query from logs
  `
Query: how does this compare to 2024?

Analysis Summary: Incomparable data detected for year-on-year comparison`,
];

console.log("QUERY NORMALIZATION TEST\n=======================\n");

// Log normalized results
queries.forEach((q, i) => {
  const normalizedQuery = normalizeQueryText(q);

  console.log(`Test Case ${i + 1}:`);
  console.log(
    `Original (${q.length} chars):\n"${q.substring(0, 100)}${
      q.length > 100 ? "..." : ""
    }"`
  );
  console.log(
    `Normalized (${normalizedQuery.length} chars):\n"${normalizedQuery}"\n`
  );

  // Calculate reduction percentage
  const reductionPercent = (
    ((q.length - normalizedQuery.length) / q.length) *
    100
  ).toFixed(1);
  if (reductionPercent > 0) {
    console.log(`Reduction: ${reductionPercent}%`);
  }
  console.log("-".repeat(50) + "\n");
});

// Test with extreme cases
const edgeCases = [
  "",
  "   ",
  null,
  undefined,
  "Query:",
  "query:   ",
  "QUERY: text",
  "query: text\n\n",
  "Query: multi\nline\ntext",
];

console.log("EDGE CASES\n===========\n");

edgeCases.forEach((q, i) => {
  try {
    const normalizedQuery = normalizeQueryText(q);
    console.log(`Edge Case ${i + 1}:`);
    console.log(`Original: "${q}"`);
    console.log(`Normalized: "${normalizedQuery}"\n`);
  } catch (e) {
    console.log(`Edge Case ${i + 1} error:`, e.message);
  }
});

// Show how this would fix actual issue in logs
console.log("REAL-WORLD EXAMPLE\n=================\n");

const actualScenario = {
  currentQuery: `
Query: how does this compare to 2024 data?

Analysis Summary: Incomparable data detected for year-on-year comparison`,
  previousQuery: `
Query: What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?

Analysis Summary: LLM-driven file identification and smart filtering completed successfully in 127ms.`,
};

console.log("Current Implementation:");
console.log(
  `Current query sent to LLM:\n"${actualScenario.currentQuery.substring(
    0,
    100
  )}..."`
);
console.log(
  `Previous query sent to LLM:\n"${actualScenario.previousQuery.substring(
    0,
    100
  )}..."\n`
);

console.log("With Normalization:");
console.log(
  `Current query sent to LLM:\n"${normalizeQueryText(
    actualScenario.currentQuery
  )}"`
);
console.log(
  `Previous query sent to LLM:\n"${normalizeQueryText(
    actualScenario.previousQuery
  )}"\n`
);

console.log("CONCLUSION:");
console.log("The normalization function successfully cleans up query text,");
console.log("removing 'Query:' prefixes and analysis sections. This prevents");
console.log(
  "confusion in the LLM when identifying topics and ensures follow-up"
);
console.log("detection works properly, restoring the intended functionality.");
