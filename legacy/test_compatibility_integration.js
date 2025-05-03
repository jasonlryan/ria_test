/**
 * Simplified integration test for compatibility metadata formatting
 * with comprehensive logging
 *
 * This script tests the compatibility metadata formatting functionality
 * without depending on ES module imports.
 */

const fs = require("fs");
const path = require("path");

// Import logger
let logger;
try {
  // Try to import the real logger
  logger = require("../utils/logger").default;
} catch (error) {
  // Fallback to a simple console logger if imports fail
  logger = {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    debug: (...args) => console.debug("[DEBUG]", ...args),
  };
}

// Compatibility logger mock implementation
const compatibilityLogger = {
  logCompatibilityAssessment: (query, metadata, topics, segments) => {
    logger.info(
      `[COMPATIBILITY] Assessment for query: "${query.substring(0, 100)}..."`
    );
    logger.info(`[COMPATIBILITY] Topics: ${topics.join(", ")}`);
    logger.info(`[COMPATIBILITY] Segments: ${segments.join(", ")}`);
    logger.info(
      `[COMPATIBILITY] Is Fully Compatible: ${metadata.isFullyCompatible}`
    );
  },
  logCompatibilityInPrompt: (verbosity, query, isFullyCompatible) => {
    logger.info(
      `[COMPATIBILITY_PROMPT] Including ${verbosity} compatibility info for query: "${query}"`
    );
    logger.info(
      `[COMPATIBILITY_PROMPT] Compatibility status: ${
        isFullyCompatible ? "FULLY COMPATIBLE" : "COMPATIBILITY LIMITATIONS"
      }`
    );
  },
  logCompatibilityToFile: (query, threadId, metadata) => {
    logger.info(
      `[COMPATIBILITY_FILE] Would log metadata to file for query: "${query.substring(
        0,
        60
      )}..."`
    );
  },
};

// Mock compatibility metadata for testing
const mockCompatibilityMetadata = {
  isFullyCompatible: false,
  topicCompatibility: {
    Pay_and_Reward: {
      comparable: true,
      availableYears: ["2024", "2025"],
      availableMarkets: [
        "United Kingdom",
        "United States",
        "Australia",
        "India",
        "Brazil",
      ],
      userMessage: "Data can be compared across years.",
    },
    Attraction_Factors: {
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
      comparableValues: [
        "United Kingdom",
        "United States",
        "Australia",
        "India",
        "Brazil",
      ],
      userMessage:
        "Country data can be compared across years for these markets: United Kingdom, United States, Australia, India, Brazil",
    },
    age: {
      comparable: true,
      comparableValues: [],
      userMessage: "age data can be compared across years.",
    },
    gender: {
      comparable: true,
      comparableValues: [],
      userMessage: "gender data can be compared across years.",
    },
  },
  mappingVersion: "1.0",
  assessedAt: Date.now(),
};

// Mock prompt utils functions
function formatMinimalCompatibilityMessage(metadata) {
  if (!metadata) return "";

  // Log formatting
  logger.info(
    `[COMPATIBILITY_FORMAT] Formatting minimal compatibility message`
  );

  let message = "";

  if (metadata.error) {
    message = `NOTE: ${metadata.error.message}\n`;
    return message;
  }

  if (metadata.isFullyCompatible) {
    message = "All requested data can be compared across years.";
  } else {
    message =
      "Some data cannot be compared across years due to methodology changes.";
  }

  return message;
}

function formatStandardCompatibilityMessage(metadata) {
  if (!metadata) return "";

  // Log formatting
  logger.info(
    `[COMPATIBILITY_FORMAT] Formatting standard compatibility message`
  );

  let message = "";

  if (metadata.error) {
    message = `IMPORTANT: ${metadata.error.message}\n`;
    return message;
  }

  if (metadata.isFullyCompatible) {
    message = "All requested data is fully comparable across years.\n";
  } else {
    message =
      "IMPORTANT: Some data limitations apply for year-on-year comparisons.\n\n";

    // Add non-comparable topics
    const nonComparableTopics = Object.entries(
      metadata.topicCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable && info.availableYears.length > 1)
      .map(([topic, info]) => `- ${topic}: ${info.userMessage}`)
      .join("\n");

    if (nonComparableTopics) {
      message += `Topic Limitations:\n${nonComparableTopics}\n\n`;
    }

    // Add non-comparable segments
    const nonComparableSegments = Object.entries(
      metadata.segmentCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([segment, info]) => `- ${segment}: ${info.userMessage}`)
      .join("\n");

    if (nonComparableSegments) {
      message += `Segment Limitations:\n${nonComparableSegments}\n`;
    }
  }

  return message;
}

function formatDetailedCompatibilityMessage(metadata) {
  if (!metadata) return "";

  // Log formatting
  logger.info(
    `[COMPATIBILITY_FORMAT] Formatting detailed compatibility message`
  );

  let message = "";

  if (metadata.error) {
    message = `IMPORTANT COMPATIBILITY NOTICE: ${metadata.error.message}\n\n`;
    message += `Details: ${
      metadata.error.details || "No additional details available."
    }\n`;
    return message;
  }

  message = `Data Compatibility Assessment (Version: ${
    metadata.mappingVersion
  }, Assessed: ${new Date(metadata.assessedAt).toISOString()})\n\n`;

  if (metadata.isFullyCompatible) {
    message += "All requested data is fully comparable across years.\n\n";
  } else {
    message +=
      "IMPORTANT: Year-on-year comparison limitations exist for the following data:\n\n";
  }

  // Add all topics with their compatibility status
  message += "Topic Compatibility:\n";
  Object.entries(metadata.topicCompatibility || {}).forEach(([topic, info]) => {
    message += `- ${topic}:\n`;
    message += `  - Comparable: ${info.comparable ? "Yes" : "No"}\n`;
    message += `  - Available Years: ${
      info.availableYears.join(", ") || "None"
    }\n`;
    message += `  - Available Markets: ${
      info.availableMarkets.length ? info.availableMarkets.join(", ") : "All"
    }\n`;
    message += `  - Notice: ${info.userMessage}\n`;
  });

  message += "\nSegment Compatibility:\n";
  Object.entries(metadata.segmentCompatibility || {}).forEach(
    ([segment, info]) => {
      message += `- ${segment}:\n`;
      message += `  - Comparable: ${info.comparable ? "Yes" : "No"}\n`;
      if (info.comparableValues.length) {
        message += `  - Comparable Values: ${info.comparableValues.join(
          ", "
        )}\n`;
      }
      message += `  - Notice: ${info.userMessage}\n`;
    }
  );

  return message;
}

function formatCompatibilityMetadataForPrompt(
  metadata,
  verbosity = "standard"
) {
  if (!metadata) return "";

  // Log the compatibility formatting
  logger.info(
    `[COMPATIBILITY_FORMAT] Formatting compatibility info with verbosity: ${verbosity}`
  );

  let formattedMessage = "";
  switch (verbosity) {
    case "minimal":
      formattedMessage = formatMinimalCompatibilityMessage(metadata);
      break;
    case "standard":
      formattedMessage = formatStandardCompatibilityMessage(metadata);
      break;
    case "detailed":
      formattedMessage = formatDetailedCompatibilityMessage(metadata);
      break;
    default:
      formattedMessage = formatStandardCompatibilityMessage(metadata);
  }

  // Log the size of the compatibility message
  if (formattedMessage) {
    logger.info(
      `[COMPATIBILITY_FORMAT] Generated ${formattedMessage.length} characters of compatibility information`
    );

    // Log incompatible topics and segments count
    const incompatibleTopics = Object.entries(metadata.topicCompatibility || {})
      .filter(([_, info]) => !info.comparable)
      .map(([topic]) => topic);

    const incompatibleSegments = Object.entries(
      metadata.segmentCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([segment]) => segment);

    if (incompatibleTopics.length > 0 || incompatibleSegments.length > 0) {
      logger.info(
        `[COMPATIBILITY_FORMAT] Included ${incompatibleTopics.length} incompatible topics and ${incompatibleSegments.length} incompatible segments`
      );
    }
  }

  return formattedMessage;
}

// Mock filtered data for testing
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

// Mock build prompt function
function buildPromptWithFilteredData(
  originalUserContent,
  filteredData,
  options = {}
) {
  // Simplified version just for testing
  let prompt = `Query: ${originalUserContent}\n\nData preview: ${filteredData.stats.length} stats found`;

  // Log stats count
  logger.info(
    `[DATA_STATS] Found ${filteredData.stats.length} data points for query`
  );

  // Add compatibility information if provided
  if (options.compatibilityMetadata) {
    const compatibilityVerbosity = options.compatibilityVerbosity || "standard";

    // Log that we're adding compatibility info to the prompt
    compatibilityLogger.logCompatibilityInPrompt(
      compatibilityVerbosity,
      originalUserContent.substring(0, 60),
      options.compatibilityMetadata.isFullyCompatible
    );

    const compatibilitySection = formatCompatibilityMetadataForPrompt(
      options.compatibilityMetadata,
      compatibilityVerbosity
    );

    if (compatibilitySection) {
      prompt +=
        "\n\n### Data Compatibility Information\n" + compatibilitySection;
    }
  }

  return prompt;
}

function testCompatibilityIntegration() {
  console.log("Starting compatibility integration test with logging...");

  // Test with different queries
  const queries = [
    "How fair do employees consider their compensation in 2025?",
    "How has compensation fairness changed from 2024 to 2025?",
    "Compare attracting new employees versus retaining existing ones across years.",
  ];

  // Test with different verbosity levels
  const verbosityLevels = ["minimal", "standard", "detailed"];

  for (const query of queries) {
    console.log(`\n=== QUERY: "${query}" ===`);

    // Log compatibility assessment for each query
    const topics = query.includes("compensation")
      ? ["Pay_and_Reward"]
      : ["Attraction_Factors"];

    const segments = ["country", "age", "gender"];

    // Simulate compatibility assessment logging
    compatibilityLogger.logCompatibilityAssessment(
      query,
      mockCompatibilityMetadata,
      topics,
      segments
    );

    // Mock logging to file
    compatibilityLogger.logCompatibilityToFile(
      query,
      "test-thread-123",
      mockCompatibilityMetadata
    );

    for (const verbosity of verbosityLevels) {
      console.log(`\n--- ${verbosity.toUpperCase()} VERBOSITY ---`);
      const prompt = buildPromptWithFilteredData(query, mockFilteredData, {
        compatibilityMetadata: mockCompatibilityMetadata,
        compatibilityVerbosity: verbosity,
      });

      console.log(prompt);
    }
  }

  console.log("\nCompatibility integration test with logging completed.");
}

testCompatibilityIntegration();
