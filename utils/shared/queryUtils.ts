/**
 * Query utilities for text normalization and context handling
 */

/**
 * Normalizes query text by removing prefixes and analysis sections
 * @param text Raw query text that may contain formatting
 * @returns Clean query text
 */
export function normalizeQueryText(text: string): string {
  if (!text) return "";

  // First trim the text (including any leading newlines)
  let cleanText = text.trim();
  
  // Handle various formatting patterns
  
  // Pattern 1: "Query: actual query\n\nAnalysis Summary: ..."
  if (cleanText.toLowerCase().startsWith("query:")) {
    // Split at the first occurrence of Analysis or Summary after a double newline
    const analysisMatch = cleanText.match(/\n\n(?:Analysis|Summary)/i);
    if (analysisMatch) {
      cleanText = cleanText.substring(0, analysisMatch.index);
    }
    // Remove the "Query:" prefix - ensure case insensitivity
    cleanText = cleanText.replace(/^query:\s*/i, "").trim();
    return cleanText;
  }
  
  // Pattern 2: Text that contains "Analysis Summary:" without a Query prefix
  const analysisSummaryIndex = cleanText.indexOf("\n\nAnalysis Summary:");
  if (analysisSummaryIndex > 0) {
    cleanText = cleanText.substring(0, analysisSummaryIndex).trim();
  }
  
  // Pattern 3: Text that contains "Analysis:" without a Query prefix
  const analysisIndex = cleanText.indexOf("\n\nAnalysis:");
  if (analysisIndex > 0) {
    cleanText = cleanText.substring(0, analysisIndex).trim();
  }
  
  return cleanText;
}

/**
 * Extracts a clean query from an assistant tool call
 * @param toolCallArgs Arguments from a tool call
 * @returns Normalized query text
 */
export function extractCleanQueryFromToolCall(toolCallArgs: any): string {
  try {
    if (!toolCallArgs || !toolCallArgs.query) return "";
    return normalizeQueryText(toolCallArgs.query);
  } catch (e) {
    return "";
  }
}

/**
 * Creates a thread context object with normalized queries
 * @param currentQuery Current user query
 * @param previousQuery Previous user query
 * @param previousResponse Previous assistant response
 * @param isFollowUp Whether this is a follow-up query
 * @returns Context object with normalized queries
 */
export function createThreadContext(
  currentQuery: string,
  previousQuery: string,
  previousResponse: string,
  isFollowUp: boolean
) {
  return {
    normalizedCurrentQuery: normalizeQueryText(currentQuery),
    normalizedPreviousQuery: normalizeQueryText(previousQuery),
    previousResponse,
    isFollowUp,
  };
}

// For testing purposes - can be removed in production
if (require.main === module) {
  // Test with sample queries from logs
  const queries = [
    "how does this compare with 2024?",
    "Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected",
    "Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification",
    "what is the level of trust employees have in their direct managers?",
    "\nQuery: What are the primary reasons employees may be resistant to returning to the office full-time?\n\nAnalysis Summary: LLM-driven file identification",
    "\n\nQuery: How does this compare to 2024?\n\nAnalysis Summary: Incomparable data detected for year-on-year comparison"
  ];
  
  // Log normalized results
  queries.forEach(q => {
    console.log(`Original: "${q.substring(0, 40)}..."`);
    console.log(`Normalized: "${normalizeQueryText(q)}"\n`);
  });
  
  // Run the test function if invoked directly with Node
  console.log("Running tests for normalizeQueryText...");
  console.log("All tests completed.");
} 