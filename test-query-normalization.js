/**
 * Test script for query normalization
 *
 * Run with: node test-query-normalization.js
 */

// Import the function from our utility file
const { normalizeQueryText } = require("./utils/shared/queryUtils");

// Examples from logs with different query formats
const testQueries = [
  "how does this compare with 2024?",
  "Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected",
  "Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification",
  "what is the level of trust employees have in their direct managers?",
  "\nQuery: What are the primary reasons employees may be resistant to returning to the office full-time?\n\nAnalysis Summary: LLM-driven file identification",
  "\n\nQuery: How does this compare to 2024?\n\nAnalysis Summary: Incomparable data detected for year-on-year comparison",
];

console.log("=== QUERY NORMALIZATION TEST ===");
console.log("Testing with examples from logs...\n");

// Test each query and show results
testQueries.forEach((query, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Original: "${query.substring(0, 60)}..."`);
  const normalized = normalizeQueryText(query);
  console.log(`Normalized: "${normalized}"`);

  // Check if the normalization worked as expected
  const startsWith = query.trim().toLowerCase().startsWith("query:");
  const hasAnalysis = query.toLowerCase().includes("\n\nanalysis");
  const success =
    (!startsWith || !normalized.toLowerCase().includes("query:")) &&
    (!hasAnalysis || !normalized.toLowerCase().includes("analysis"));

  console.log(`Result: ${success ? "✅ PASS" : "❌ FAIL"}`);
  console.log("-------------------------------------------\n");
});

console.log("Test completed.");
