/**
 * Starter Question Helper Functions
 * 
 * Utility functions for handling starter questions (SQ1, SQ2, etc.) and comparison queries.
 * Extracted from the original retrieval system to avoid circular dependencies.
 * 
 * Last Updated: Mon May 5 2025
 */

import fs from 'fs';
import path from 'path';
import logger from '../shared/logger';
import { isStarterQuestion } from '../shared/queryUtils';

// Directory for precompiled starter data
const PRECOMPILED_STARTERS_DIR = path.join(
  process.cwd(),
  "utils",
  "openai",
  "precompiled_starters"
);

/**
 * Loads and returns the precompiled data for a given starter question code.
 * @param {string} code - The starter question code (e.g., "SQ1")
 * @returns {object|null} The precompiled data object, or null if not found
 */
export function getPrecompiledStarterData(code: string): any | null {
  if (!code || typeof code !== "string") {
    return null;
  }

  const normalizedCode = code.trim().toUpperCase();

  const filename = `${normalizedCode}.json`;
  const filePath = path.join(PRECOMPILED_STARTERS_DIR, filename);
  // Also try absolute path for comparison
  const absolutePath = path.resolve(PRECOMPILED_STARTERS_DIR, filename);

  let fileExists = false;
  try {
    // --- Step 1: Check Existence ---
    fileExists = fs.existsSync(filePath);

    // Try the absolute path as fallback
    if (!fileExists) {
      fileExists = fs.existsSync(absolutePath);
    }

    if (!fileExists) {
      return null;
    }
  } catch (existsError) {
    return null;
  }

  const pathToUse = fileExists ? filePath : absolutePath;
  let fileContent = null;
  try {
    // --- Step 2: Read File ---
    fileContent = fs.readFileSync(pathToUse, "utf8");
  } catch (readError) {
    return null; // Return null if read fails
  }

  if (fileContent === null || fileContent.trim() === "") {
    return null;
  }

  try {
    // --- Step 3: Parse JSON ---
    const parsedData = JSON.parse(fileContent);
    return parsedData; // Success! Return the parsed data
  } catch (parseError) {
    return null; // Return null if parse fails
  }
}

/**
 * Detects if the prompt is a starter question code (e.g., "SQ1", "SQ2", case-insensitive).
 * @param {string} prompt - The prompt or code to check
 * @returns {boolean} True if the prompt matches the starter question code pattern
 */
export { isStarterQuestion };

/**
 * Checks if a query is asking for a comparison between years
 * @param {string} query - The user query
 * @returns {boolean} - Whether the query is asking for a comparison
 */
export function detectComparisonQuery(query: string): boolean {
  if (!query) return false;

  try {
    // Normalize the query
    const normalizedQuery = query.toLowerCase();

    // Multi-year safety net: When we see explicit year references, especially for direct comparison queries
    const directYearMention =
      /\b(2024|2025|last year|previous year|year[- ]on[- ]year|year over year|yoy)\b/i.test(
        normalizedQuery
      );
    const comparisonTerms =
      /\b(compar(e|ed|ing|ison)|vs\.?|versus|differ(ence|ent)|change[sd]?|trend|over time)\b/i.test(
        normalizedQuery
      );

    // Early return for very explicit cases
    if (directYearMention && comparisonTerms) {
      logger.info(
        "[COMPATIBILITY] Detected explicit year comparison: direct year mention + comparison terms"
      );
      return true;
    }

    // Patterns that indicate a comparison query
    const comparisonPatterns = [
      // Year-specific patterns
      /compare.*2024.*2025/i,
      /compare.*2025.*2024/i,
      /comparison.*2024.*2025/i,
      /comparison.*2025.*2024/i,
      /2024.*compared to.*2025/i,
      /2025.*compared to.*2024/i,
      /2024.*vs\.?.*2025/i,
      /2025.*vs\.?.*2024/i,
      /2024.*versus.*2025/i,
      /2025.*versus.*2024/i,

      // Direct comparison requests
      /\bcompare with 2024\b/i,
      /\bcompare to 2024\b/i,
      /\bcompare with previous year\b/i,
      /\bcompare to previous year\b/i,
      /\bcompare with last year\b/i,
      /\bcompare to last year\b/i,

      // Evolution/between patterns
      /\bbetween 2024 and 2025\b/i,
      /\bbetween 2025 and 2024\b/i,
      /\bfrom 2024 to 2025\b/i,
      /\bfrom 2025 to 2024\b/i,
      /\b2024 to 2025\b/i,
      /\b2025 to 2024\b/i,
      /\bevolution.*between/i,

      // Generic time comparison patterns
      /change(d|s)? (from|since|over|between)/i,
      /difference(s)? (from|since|over|between)/i,
      /trend(s)? (from|since|over|between)/i,
      /evolution (from|since|over|between)/i,
      /compare (\w+ )?(year|time)/i,
      /comparison (\w+ )?(year|time)/i,
      /previous (year|time)/i,
      /year[\s-]on[\s-]year/i,
      /year[\s-]over[\s-]year/i,
      /over time/i,
      /across years/i,
      /across time/i,

      // Follow-up comparison queries
      /^can you compare/i,
      /^compare with/i,
      /^compare to/i,
      /^how does this compare/i,
      /^what about (in )?2024/i,
      /^what about (the )?(previous|last) year/i,

      // Additional patterns from logs
      /\bcompare this with\b/i,
      /\bcompare these with\b/i,
      /\bcompare the data with\b/i,
      /\bhow has this changed\b/i,
      /\bshow me the comparison\b/i,
      /\byear by year\b/i,
      /\btrend analysis\b/i,
      /\bhistorical comparison\b/i,
      /\bhistorical data\b/i,
      /\bshow me 2024\b/i,
      /\bshow the 2024\b/i,
      /\bdata from 2024\b/i,
      /\bhas this improved\b/i,
      /\bchanged compared to\b/i,
      /\bcompare these results\b/i,
      /\bcompare these findings\b/i,
      /\bcompare these numbers\b/i,
      /\bare these better\b/i,
      /\bare these worse\b/i,
      /\bcompare with previous survey\b/i,
      /\bworse or better than\b/i,
      /\bbetter or worse than\b/i,
      /\bhow do the numbers compare\b/i,
      /\byearly trend\b/i,
      /\bannual trend\b/i,
      /\bannual comparison\b/i,
      /\bhow did the\b.*\bchange\b/i,
      /\bhow did this\b.*\bchange\b/i,
    ];

    // Check if any comparison pattern matches
    const patternMatch = comparisonPatterns.some((pattern) =>
      pattern.test(normalizedQuery)
    );

    if (patternMatch) {
      logger.info("[COMPATIBILITY] Detected comparison query via pattern match");
      return true;
    }

    // Super explicit single-term direct comparison terms like "2024" or "compare" at the start
    // with no context - typically follow-up queries asking for comparison
    if (/^(compare|2024|previous|last year)/i.test(normalizedQuery.trim())) {
      logger.info("[COMPATIBILITY] Detected likely comparison follow-up query");
      return true;
    }

    return false;
  } catch (error) {
    logger.error(`[COMPATIBILITY] Error detecting comparison query: ${error.message}`);
    return false;
  }
} 