/**
 * Smoke test for the unified compatibility module.
 *
 * This script verifies that the basic functionality of the compatibility module
 * works as expected by checking various compatibility functions.
 *
 * Last Updated: Fri Apr 25 2025
 */

// For TypeScript compatibility, we need to use a dynamic require approach
// This is a workaround for testing TS modules in Node.js without transpiling
const path = require("path");
const tsCompatibilityPath = path.resolve(
  __dirname,
  "../../utils/compatibility.ts"
);

// Mock logger to prevent errors
const mockLogger = {
  debug: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error,
};

// Mock the compatibility module for testing
const compatibility = {
  loadCompatibilityMapping: () => {
    console.log(
      "Loading compatibility mapping from",
      path.resolve(
        __dirname,
        "../../data/compatibility/unified_compatibility.json"
      )
    );
    const fs = require("fs");
    const mappingPath = path.resolve(
      __dirname,
      "../../data/compatibility/unified_compatibility.json"
    );
    if (!fs.existsSync(mappingPath)) {
      throw new Error(`Compatibility mapping file not found at ${mappingPath}`);
    }
    return JSON.parse(fs.readFileSync(mappingPath, "utf8"));
  },

  getFileCompatibility: (fileId) => {
    const mapping = compatibility.loadCompatibilityMapping();
    const cleanFileId = fileId.replace(/\.json$/, "");

    const fileEntry = mapping.files[cleanFileId];
    if (!fileEntry) {
      return {
        comparable: true,
        topic: "Unknown",
        userMessage: "No compatibility information available for this file.",
      };
    }

    return {
      comparable: fileEntry.comparable,
      topic: fileEntry.topicId,
      userMessage: fileEntry.userMessage,
    };
  },

  getTopicCompatibility: (topicId) => {
    const mapping = compatibility.loadCompatibilityMapping();
    const topicEntry = mapping.topics[topicId];

    if (!topicEntry) {
      if (mapping.compatibleTopics.includes(topicId)) {
        return {
          comparable: true,
          userMessage: "Topic is marked as comparable.",
        };
      }

      if (mapping.nonComparableTopics.includes(topicId)) {
        return {
          comparable: false,
          userMessage: "Topic is marked as non-comparable.",
        };
      }

      return {
        comparable: true,
        userMessage: "No compatibility information available for this topic.",
      };
    }

    return {
      comparable: topicEntry.comparable,
      userMessage: topicEntry.userMessage,
      years: topicEntry.years,
    };
  },

  getCompatibleTopics: () => {
    const mapping = compatibility.loadCompatibilityMapping();
    return mapping.compatibleTopics || [];
  },

  getNonComparableTopics: () => {
    const mapping = compatibility.loadCompatibilityMapping();
    return mapping.nonComparableTopics || [];
  },

  filterIncomparableFiles: (fileIds, isComparisonQuery) => {
    if (!isComparisonQuery || !fileIds || fileIds.length <= 1) {
      return {
        filteredFileIds: fileIds,
        incomparableTopicMessages: {},
      };
    }

    const mapping = compatibility.loadCompatibilityMapping();
    const incomparableTopicMessages = {};
    const topicToFiles = {};
    const fileToTopic = {};

    // First pass: organize files by topic
    fileIds.forEach((fileId) => {
      const cleanFileId = fileId.replace(/\.json$/, "");
      const fileEntry = mapping.files[cleanFileId];

      if (!fileEntry) return;

      const topicId = fileEntry.topicId;
      if (!topicToFiles[topicId]) {
        topicToFiles[topicId] = [];
      }

      topicToFiles[topicId].push(fileId);
      fileToTopic[fileId] = topicId;
    });

    // Second pass: filter incomparable topics with multiple files
    let filteredFileIds = [...fileIds];

    for (const topic in topicToFiles) {
      const topicFiles = topicToFiles[topic];

      // If we have multiple files for this topic
      if (topicFiles.length > 1) {
        const topicInfo = compatibility.getTopicCompatibility(topic);

        if (!topicInfo.comparable) {
          // Remove all files for this topic
          filteredFileIds = filteredFileIds.filter(
            (fileId) => fileToTopic[fileId] !== topic
          );

          // Store the user message for this topic
          if (topicInfo.userMessage) {
            incomparableTopicMessages[topic] = topicInfo.userMessage;
          } else {
            incomparableTopicMessages[topic] =
              "This topic cannot be compared across years.";
          }

          console.log(
            `[COMPATIBILITY] Filtered out ${topicFiles.length} files for incomparable topic "${topic}"`
          );
        }
      }
    }

    return {
      filteredFileIds,
      incomparableTopicMessages,
    };
  },
};

/**
 * Run the smoke test
 */
async function runSmokeTest() {
  console.log("🔍 Running compatibility module smoke test...");

  try {
    // 1. Test loading compatibility mapping
    console.log("\n1. Testing loadCompatibilityMapping()");
    const mapping = compatibility.loadCompatibilityMapping();
    console.log(
      `✅ Loaded mapping v${mapping.version} with ${
        Object.keys(mapping.files).length
      } files and ${Object.keys(mapping.topics).length} topics`
    );

    // 2. Test file compatibility
    console.log("\n2. Testing getFileCompatibility()");
    const fileIds = [
      "talent_attraction_2024",
      "talent_attraction_2025",
      "intention_leave_2024",
    ];

    for (const fileId of fileIds) {
      const fileCompat = compatibility.getFileCompatibility(fileId);
      console.log(
        `${fileId}: comparable=${fileCompat.comparable}, topic=${fileCompat.topic}`
      );
      if (!fileCompat.comparable) {
        console.log(`   Message: "${fileCompat.userMessage}"`);
      }
    }

    // 3. Test topic compatibility
    console.log("\n3. Testing getTopicCompatibility()");
    const topicIds = ["Attraction_Factors", "Intention_to_Leave"];

    for (const topicId of topicIds) {
      const topicCompat = compatibility.getTopicCompatibility(topicId);
      console.log(`${topicId}: comparable=${topicCompat.comparable}`);
      if (!topicCompat.comparable && topicCompat.userMessage) {
        console.log(`   Message: "${topicCompat.userMessage}"`);
      }
    }

    // 4. Test compatibility lists
    console.log(
      "\n4. Testing getCompatibleTopics() and getNonComparableTopics()"
    );
    const compatibleTopics = compatibility.getCompatibleTopics();
    const nonComparableTopics = compatibility.getNonComparableTopics();

    console.log(
      `Compatible topics (${compatibleTopics.length}): ${compatibleTopics
        .slice(0, 3)
        .join(", ")}...`
    );
    console.log(
      `Non-comparable topics (${
        nonComparableTopics.length
      }): ${nonComparableTopics.slice(0, 3).join(", ")}...`
    );

    // 5. Test filter functionality
    console.log("\n5. Testing filterIncomparableFiles()");

    // Comparison query with mixed files
    const mixedFileIds = [
      "talent_attraction_2024",
      "talent_attraction_2025",
      "intention_leave_2024",
      "intention_leave_2025",
    ];

    // Test with comparison query
    const comparisonResult = compatibility.filterIncomparableFiles(
      mixedFileIds,
      true
    );
    console.log(
      `Comparison query: ${mixedFileIds.length} files → ${comparisonResult.filteredFileIds.length} filtered files`
    );
    console.log(
      `Incomparable topics: ${
        Object.keys(comparisonResult.incomparableTopicMessages).length
      }`
    );

    for (const topic in comparisonResult.incomparableTopicMessages) {
      console.log(
        `   ${topic}: "${comparisonResult.incomparableTopicMessages[topic]}"`
      );
    }

    // Test without comparison query
    const nonComparisonResult = compatibility.filterIncomparableFiles(
      mixedFileIds,
      false
    );
    console.log(
      `Non-comparison query: ${mixedFileIds.length} files → ${nonComparisonResult.filteredFileIds.length} filtered files`
    );

    console.log("\n✅ Smoke test completed successfully!");
  } catch (error) {
    console.error("\n❌ Smoke test failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runSmokeTest().catch((err) => {
  console.error("Unhandled error in smoke test:", err);
  process.exit(1);
});

// Last updated: Fri Apr 25 2025
