/**
 * Test script for the end-to-end compatibility integration pipeline
 *
 * This script simulates a query processing flow with compatibility metadata,
 * showing how compatibility information flows through the system.
 */

const fs = require("fs");
const path = require("path");
const {
  DataRetrievalService,
} = require("../app/api/services/dataRetrievalService");
const { buildPromptWithFilteredData } = require("../utils/openai/promptUtils");

// Mock data for testing
const mockFilteredData = {
  stats: [
    {
      fileId: "2025_11",
      question:
        "How fair do you consider your compensation relative to your contribution?",
      response: "Underpaid",
      segment: "overall",
      percentage: 39,
    },
    {
      fileId: "2025_11",
      question:
        "How fair do you consider your compensation relative to your contribution?",
      response: "Underpaid",
      segment: "region:United Kingdom",
      percentage: 38,
    },
    {
      fileId: "2025_11",
      question:
        "How fair do you consider your compensation relative to your contribution?",
      response: "Underpaid",
      segment: "region:United States",
      percentage: 39,
    },
  ],
};

async function testCompatibilityPipeline() {
  console.log("Starting compatibility pipeline test...");

  // Step 1: Initialize the DataRetrievalService
  const dataRetrievalService = new DataRetrievalService();

  // Step 2: Simulate a query that requests year-on-year comparison
  const queryWithComparison =
    "How has compensation fairness changed from 2024 to 2025?";
  console.log(`\nProcessing query: "${queryWithComparison}"`);

  // Step 3: Identify relevant files and assess compatibility
  const fileIdentificationResult =
    await dataRetrievalService.identifyRelevantFiles(
      queryWithComparison,
      "context",
      false, // not a follow-up
      "",
      ""
    );

  console.log("\nFile identification results:");
  console.log(
    `- Matched topics: ${fileIdentificationResult.matched_topics.join(", ")}`
  );
  console.log(`- File IDs: ${fileIdentificationResult.file_ids.join(", ")}`);
  console.log(`- Segments: ${fileIdentificationResult.segments.join(", ")}`);

  // Step 4: Extract and display compatibility metadata
  const compatibilityMetadata = fileIdentificationResult.compatibilityMetadata;
  console.log("\nCompatibility metadata:");
  console.log(
    `- Is fully compatible: ${compatibilityMetadata.isFullyCompatible}`
  );
  console.log("- Topic compatibility:");
  Object.entries(compatibilityMetadata.topicCompatibility).forEach(
    ([topic, info]) => {
      console.log(
        `  * ${topic}: ${info.comparable ? "Comparable" : "Not comparable"} - ${
          info.userMessage
        }`
      );
    }
  );

  // Step 5: Build a prompt with compatibility information
  console.log("\nBuilding prompt with compatibility information:");

  // Test different verbosity levels
  const verbosityLevels = ["minimal", "standard", "detailed"];

  for (const verbosity of verbosityLevels) {
    console.log(`\n=== ${verbosity.toUpperCase()} VERBOSITY ===`);
    const prompt = buildPromptWithFilteredData(
      queryWithComparison,
      mockFilteredData,
      {
        compatibilityMetadata: compatibilityMetadata,
        compatibilityVerbosity: verbosity,
      }
    );

    console.log(prompt);
  }

  console.log("\nCompatibility pipeline test completed.");
}

testCompatibilityPipeline().catch((error) => {
  console.error("Error running compatibility pipeline test:", error);
});
