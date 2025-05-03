/**
 * Test script for compatibility assessment implementation
 *
 * This script directly tests the compatibility assessment logic without
 * depending on the DataRetrievalService class to avoid module import issues.
 */

const fs = require("fs");
const path = require("path");

// Let's implement a simplified version of the assessCompatibility function for testing
function assessCompatibility(topics, segments) {
  try {
    const mappingPath = path.join(
      process.cwd(),
      "scripts",
      "reference files",
      "2025",
      "canonical_topic_mapping.json"
    );

    const mappingData = fs.readFileSync(mappingPath, "utf8");
    const mapping = JSON.parse(mappingData);
    const mappingVersion = mapping.metadata?.version || "1.0";

    // Initialize compatibility metadata
    const compatibilityMetadata = {
      isFullyCompatible: true,
      topicCompatibility: {},
      segmentCompatibility: {},
      mappingVersion,
      assessedAt: Date.now(),
    };

    // Check topic compatibility
    for (const topicId of topics) {
      let foundTopic = null;

      // Find the topic in the mapping
      for (const theme of mapping.themes || []) {
        for (const topic of theme.topics || []) {
          if (topic.id === topicId) {
            foundTopic = topic;
            break;
          }
        }
        if (foundTopic) break;
      }

      if (!foundTopic) {
        // Topic not found in mapping
        compatibilityMetadata.topicCompatibility[topicId] = {
          comparable: false,
          availableYears: [],
          availableMarkets: [],
          userMessage: "This topic is not available in the canonical mapping.",
        };
        compatibilityMetadata.isFullyCompatible = false;
        continue;
      }

      // Get topic compatibility information
      const isComparable = foundTopic.comparable || false;
      const availableYears = [];
      if (foundTopic.mapping?.["2024"]) availableYears.push("2024");
      if (foundTopic.mapping?.["2025"]) availableYears.push("2025");

      const availableMarkets = foundTopic.availableMarkets || [];
      const userMessage =
        foundTopic.userMessage ||
        (isComparable
          ? "Data can be compared across years."
          : "Year‑on‑year comparisons not available for this topic.");

      compatibilityMetadata.topicCompatibility[topicId] = {
        comparable: isComparable,
        availableYears,
        availableMarkets,
        userMessage,
      };

      // Update overall compatibility flag
      if (!isComparable && availableYears.length > 1) {
        compatibilityMetadata.isFullyCompatible = false;
      }
    }

    // Check segment compatibility
    for (const segmentType of segments) {
      let isSegmentCompatible = true;
      let comparableValues = [];
      let userMessage = "";

      // Check segment compatibility based on mapping rules
      switch (segmentType) {
        case "country":
          // Only comparable markets can be compared across years
          comparableValues = mapping.dataAccess?.comparableMarkets || [];
          isSegmentCompatible = comparableValues.length > 0;
          userMessage = isSegmentCompatible
            ? "Country data can be compared across years for these markets: " +
              comparableValues.join(", ")
            : "No comparable country data available across years.";
          break;

        case "age":
        case "gender":
          // These are generally comparable
          isSegmentCompatible = true;
          userMessage = `${segmentType} data can be compared across years.`;
          break;

        default:
          // Other segments may not be comparable
          isSegmentCompatible = false;
          userMessage = `${segmentType} data cannot be reliably compared across years due to methodology changes.`;
      }

      compatibilityMetadata.segmentCompatibility[segmentType] = {
        comparable: isSegmentCompatible,
        comparableValues,
        userMessage,
      };

      // Update overall compatibility flag
      if (!isSegmentCompatible) {
        compatibilityMetadata.isFullyCompatible = false;
      }
    }

    return compatibilityMetadata;
  } catch (error) {
    console.error(`Compatibility assessment error: ${error.message}`);
    return {
      isFullyCompatible: false,
      error: {
        type: "TECHNICAL",
        message: "Unable to assess compatibility due to a technical issue",
        details: error.message,
      },
      topicCompatibility: {},
      segmentCompatibility: {},
      mappingVersion: "unknown",
      assessedAt: Date.now(),
    };
  }
}

async function testCompatibilityAssessment() {
  console.log("Starting compatibility assessment test...");

  // Test Case 1: Known comparable topic
  console.log("\n=== Test Case 1: Known comparable topic ===");
  const result1 = assessCompatibility(
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
  const result2 = assessCompatibility(
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
  const result3 = assessCompatibility(
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
  const result4 = assessCompatibility(
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
  const result5 = assessCompatibility(
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
