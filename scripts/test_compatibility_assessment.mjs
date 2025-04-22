/**
 * Test script for compatibility assessment implementation
 *
 * This script tests the compatibility assessment function in the DataRetrievalService
 * by passing different combinations of topics and segments and logging the results.
 */

import pkg from "../app/api/services/dataRetrievalService.js";
const { DataRetrievalService } = pkg;

import { fileURLToPath } from "url";
import { dirname } from "path";

// Set __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testCompatibilityAssessment() {
  console.log("Starting compatibility assessment test...");

  const dataRetrievalService = new DataRetrievalService();

  // Test Case 1: Known comparable topic
  console.log("\n=== Test Case 1: Known comparable topic ===");
  const result1 = dataRetrievalService.assessCompatibility(
    ["Intention_to_Leave"], // A topic we know is comparable based on mapping
    ["country", "age", "gender"]
  );
  console.log("Topic compatibility result:");
  console.log(JSON.stringify(result1.topicCompatibility, null, 2));
  console.log("Segment compatibility result:");
  console.log(JSON.stringify(result1.segmentCompatibility, null, 2));
  console.log(`Is fully compatible: ${result1.isFullyCompatible}`);

  // Test Case 2: Known non-comparable topic
  console.log("\n=== Test Case 2: Known non-comparable topic ===");
  const result2 = dataRetrievalService.assessCompatibility(
    ["Attraction_Factors"], // A topic we know is not comparable based on mapping
    ["country", "age", "gender"]
  );
  console.log("Topic compatibility result:");
  console.log(JSON.stringify(result2.topicCompatibility, null, 2));
  console.log("Segment compatibility result:");
  console.log(JSON.stringify(result2.segmentCompatibility, null, 2));
  console.log(`Is fully compatible: ${result2.isFullyCompatible}`);

  // Test Case 3: Mix of comparable and non-comparable topics
  console.log(
    "\n=== Test Case 3: Mix of comparable and non-comparable topics ==="
  );
  const result3 = dataRetrievalService.assessCompatibility(
    ["Intention_to_Leave", "Attraction_Factors"],
    ["country", "age", "gender"]
  );
  console.log("Topic compatibility result:");
  console.log(JSON.stringify(result3.topicCompatibility, null, 2));
  console.log("Segment compatibility result:");
  console.log(JSON.stringify(result3.segmentCompatibility, null, 2));
  console.log(`Is fully compatible: ${result3.isFullyCompatible}`);

  // Test Case 4: Non-standard segments
  console.log("\n=== Test Case 4: Non-standard segments ===");
  const result4 = dataRetrievalService.assessCompatibility(
    ["Intention_to_Leave"],
    ["country", "org_size", "job_level"] // Job level and org size are non-standard
  );
  console.log("Topic compatibility result:");
  console.log(JSON.stringify(result4.topicCompatibility, null, 2));
  console.log("Segment compatibility result:");
  console.log(JSON.stringify(result4.segmentCompatibility, null, 2));
  console.log(`Is fully compatible: ${result4.isFullyCompatible}`);

  // Test Case 5: Error handling
  console.log("\n=== Test Case 5: Error handling (non-existent topic) ===");
  const result5 = dataRetrievalService.assessCompatibility(
    ["NonExistentTopic"],
    ["country", "age", "gender"]
  );
  console.log("Topic compatibility result:");
  console.log(JSON.stringify(result5.topicCompatibility, null, 2));
  console.log("Segment compatibility result:");
  console.log(JSON.stringify(result5.segmentCompatibility, null, 2));
  console.log(`Is fully compatible: ${result5.isFullyCompatible}`);

  console.log("\nCompatibility assessment test completed.");
}

testCompatibilityAssessment().catch((error) => {
  console.error("Error running compatibility assessment test:", error);
});
