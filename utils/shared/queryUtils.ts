/**
 * Query Utilities
 * 
 * Shared utilities for query processing, extracted from duplicate implementations
 * in retrieval.js and dataRetrievalService.js. These utilities handle common 
 * operations like detecting query types and normalizing input.
 * 
 * References:
 * - Implementation Plan: utils/data/IMPLEMENTATION_PLAN.md
 * - Duplication Analysis: utils/data/analysis/Function-Duplication-Analysis.md
 * 
 * Last Updated: Wed Jul 3 2024
 */

/**
 * Detects if a query is a comparison query based on patterns
 * 
 * @param query The query text to analyze
 * @returns Boolean indicating if the query is a comparison query
 */
export function isComparisonQuery(query: string): boolean {
  if (!query) return false;
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Comparison patterns
  const comparisonPatterns = [
    /\bcompare\b.*\band\b/i,
    /\bcomparison\b.*\bbetween\b/i,
    /\bdifference\b.*\bbetween\b/i,
    /\bhow\b.*\bdiffer\b/i,
    /\bsimilarities\b.*\band\b.*\bdifferences\b/i,
    /\bvs\b|\bversus\b/i,
    /\b(which|what)('s| is) (better|worse|preferred|different)\b/i
  ];
  
  return comparisonPatterns.some(pattern => pattern.test(normalizedQuery));
}

/**
 * Normalizes a query by removing unnecessary whitespace and 
 * standardizing formatting
 * 
 * @param query The query to normalize
 * @returns Normalized query string
 */
export function normalizeQuery(query: string): string {
  if (!query) return '';
  
  // Trim whitespace and ensure consistent spacing
  let normalized = query.trim().replace(/\s+/g, ' ');
  
  // Remove common prefixes that don't add meaning
  const prefixesToRemove = [
    'hey',
    'hi',
    'hello',
    'could you',
    'can you',
    'please',
    'tell me',
    'i want to know',
    'i\'d like to know',
  ];
  
  for (const prefix of prefixesToRemove) {
    const pattern = new RegExp(`^${prefix}\\s+`, 'i');
    normalized = normalized.replace(pattern, '');
  }
  
  // Standardize question marks
  if (!normalized.endsWith('?') && normalized.includes('?')) {
    const lastQuestionMark = normalized.lastIndexOf('?');
    normalized = normalized.substring(0, lastQuestionMark + 1);
  }
  
  return normalized.trim();
}

/**
 * Detects if a query is a starter question based on content and length
 * 
 * @param query The query to analyze
 * @returns Boolean indicating if the query is a starter question
 */
export function isStarterQuestion(query: string): boolean {
  if (!query) return false;

  const normalizedQuery = query.toLowerCase().trim();

  // Check for starter question codes like "SQ1"
  if (/^sq\d+$/i.test(normalizedQuery)) {
    return true;
  }

  // Short queries are generally introductory
  if (normalizedQuery.length < 15) {
    return true;
  }

  const starterPatterns = [
    /^(hi|hello|hey)/i,
    /^what can you/i,
    /^tell me about/i,
    /^help me/i,
    /^what do you know/i,
    /^what can i ask/i,
    /\bwhat are\b.*\bkey\b|\bimportant\b|\bmain\b.*\b(points|topics|facts|insights|findings)\b/i,
    /\bwhat is\b.*\boverview\b/i,
    /\bgive me an overview\b/i,
    /\bsummarize\b/i,
    /\bsummary\b/i,
    /\bhighlights\b/i,
    /\bwhat should i know\b/i,
    /\bwhat do i need to know\b/i,
    /\btell me more\b/i,
    /\bintroduction\b/i,
    /\bintroduce me\b/i,
    /\bexplain\b/i,
    /\bwhat are\b/i,
    /\bhow would you describe\b/i,
    /\bprovide context\b/i
  ];

  if (starterPatterns.some((pattern) => pattern.test(normalizedQuery))) {
    return true;
  }

  const wordCount = normalizedQuery.split(/\s+/).filter(Boolean).length;
  return wordCount < 5;
}

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
