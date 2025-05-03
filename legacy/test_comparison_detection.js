/**
 * Test script for comparison detection and compatibility warnings
 *
 * This script tests the updated compatibility warning system:
 * 1. Detects comparison queries
 * 2. Provides prominent warnings for incompatible topics
 * 3. Uses different verbosity levels based on the query type
 */

// Use dynamic imports to handle ESM modules
async function importModules() {
  const fs = await import("fs");
  const path = await import("path");

  // Create a simpler test that doesn't require importing the actual service

  // Comparison detection patterns - copied from the service
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
  ];

  // Test queries for comparison detection
  const TEST_QUERIES = [
    // Explicit comparison queries
    "Compare job attraction factors between 2024 and 2025",
    "How have retention factors changed from 2024 to 2025?",
    "Attrition factors 2024 vs 2025",
    "Job satisfaction trends over time",
    "Year-on-year changes in employee preferences",
    "Evolution of work-life balance preferences between 2024 and 2025",
    "Show me the difference in compensation satisfaction from previous year",
    "What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?",
    "Can you compare with 2024?",

    // Non-comparison queries
    "What are the top factors for job attraction in 2025?",
    "Employee retention factors in 2024",
    "Show me data about attrition factors",
    "How satisfied are employees with compensation in 2025?",
    "What's the current state of work-life balance preferences?",
  ];

  // Simulate the isComparisonQuery function
  function isComparisonQuery(query) {
    if (!query) return false;

    // Normalize the query
    const normalizedQuery = query.toLowerCase();

    // Check if any comparison pattern matches
    return comparisonPatterns.some((pattern) => pattern.test(normalizedQuery));
  }

  /**
   * Tests the comparison detection logic
   */
  function testComparisonDetection() {
    console.log("=== TESTING COMPARISON QUERY DETECTION ===");

    TEST_QUERIES.forEach((query) => {
      const isComparison = isComparisonQuery(query);
      console.log(`Query: "${query}"`);
      console.log(`Detected as comparison: ${isComparison ? "YES" : "NO"}`);
      console.log("---");
    });
  }

  /**
   * Formats a mock compatibility message
   */
  function formatMockCompatibilityMessage(verbosity) {
    // Example compatibility metadata for Attraction_Factors
    const mockCompatibilityMetadata = {
      isFullyCompatible: false,
      topicCompatibility: {
        Attraction_Factors: {
          comparable: false,
          availableYears: ["2024", "2025"],
          availableMarkets: [],
          userMessage:
            "Year‑on‑year comparisons not available due to methodology changes.",
        },
        Retention_Factors: {
          comparable: false,
          availableYears: ["2024", "2025"],
          availableMarkets: [],
          userMessage:
            "Year‑on‑year comparisons not available due to methodology changes.",
        },
      },
      segmentCompatibility: {
        country: {
          comparable: true,
          comparableValues: ["United Kingdom", "United States", "Australia"],
          userMessage: "Country data can be compared across years.",
        },
      },
      mappingVersion: "1.0",
      assessedAt: Date.now(),
    };

    // Simplified versions of the formatting functions
    let message = "";

    switch (verbosity) {
      case "minimal":
        message =
          "⚠️ IMPORTANT: The following topics CANNOT be compared across years due to methodology changes: Attraction_Factors, Retention_Factors. You must not make direct year-on-year comparisons for these topics.";
        break;

      case "standard":
        message =
          "IMPORTANT: Some data limitations apply for year-on-year comparisons.\n\n" +
          "⚠️ CRITICAL - DIRECT YEAR COMPARISON PROHIBITED FOR THESE TOPICS ⚠️\n" +
          "- Attraction_Factors: Year‑on‑year comparisons not available due to methodology changes.\n" +
          "- Retention_Factors: Year‑on‑year comparisons not available due to methodology changes.\n\n" +
          "When analyzing the above topics, you MUST NOT make direct comparisons between years. Present data for each year separately if requested, but explicitly state the comparison limitation.";
        break;

      case "detailed":
        message =
          "Data Compatibility Assessment (Version: 1.0)\n\n" +
          "IMPORTANT: Year-on-year comparison limitations exist for the following data:\n\n" +
          "⚠️ CRITICAL RESTRICTION: YOU MUST NOT DIRECTLY COMPARE YEARS FOR THESE TOPICS: Attraction_Factors, Retention_Factors ⚠️\n" +
          "For these topics, you must present data for each year separately and explicitly note the comparison limitations. Do not draw conclusions about trends, changes, or patterns between years.\n\n" +
          "Topic Compatibility:\n" +
          "- Attraction_Factors:\n" +
          "  - Comparable: No\n" +
          "  - IMPORTANT: DO NOT COMPARE years for this topic!\n" +
          "  - Available Years: 2024, 2025\n" +
          "  - Available Markets: All\n" +
          "  - Notice: Year‑on‑year comparisons not available due to methodology changes.\n" +
          "- Retention_Factors:\n" +
          "  - Comparable: No\n" +
          "  - IMPORTANT: DO NOT COMPARE years for this topic!\n" +
          "  - Available Years: 2024, 2025\n" +
          "  - Available Markets: All\n" +
          "  - Notice: Year‑on‑year comparisons not available due to methodology changes.";
        break;

      default:
        message = "Unknown verbosity level";
    }

    return message;
  }

  /**
   * Tests the compatibility warning for a specific comparison query
   */
  function testCompatibilityWarning() {
    console.log("\n=== TESTING COMPATIBILITY WARNING FORMATS ===");

    // Test with queries about attraction factors (which should be non-comparable)
    const testQueries = [
      "Compare attraction factors between 2024 and 2025",
      "What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?",
      "Can you compare with 2024?",
    ];

    testQueries.forEach((query) => {
      console.log(`\nTesting query: "${query}"`);

      // Determine if this is a comparison query
      const isComparison = isComparisonQuery(query);
      console.log(
        `Detected as comparison query: ${isComparison ? "YES" : "NO"}`
      );

      // Select verbosity based on query type
      const verbosity = isComparison ? "detailed" : "standard";
      console.log(`Selected verbosity: ${verbosity}`);

      // Format mock compatibility message
      console.log("\nFormatted Compatibility Message:");
      const message = formatMockCompatibilityMessage(verbosity);
      console.log(message);

      console.log("\n----------------------------------------");
    });
  }

  // Run the tests
  testComparisonDetection();
  testCompatibilityWarning();
}

// Run the main function
importModules().catch(console.error);
