/**
 * Helper function to build a natural language prompt with filtered data stats.
 * Groups stats by fileId, question, and response, then formats them into readable text.
 * @param {string} originalUserContent - The original user query.
 * @param {object} filteredData - The filtered data object containing stats array.
 * @param {object} options - Additional options for prompt building.
 * @param {object} [options.compatibilityMetadata] - Compatibility metadata for the query.
 * @param {string} [options.compatibilityVerbosity='standard'] - Verbosity level for compatibility info ('minimal', 'standard', 'detailed').
 * @returns {string} - The constructed prompt string.
 */

import { logCompatibilityInPrompt } from "../shared/compatibilityLogger";
import logger from "../logger";

export function buildPromptWithFilteredData(
  originalUserContent,
  filteredData,
  options = {}
) {
  // Defensive check for filteredData and stats
  if (!filteredData || !Array.isArray(filteredData.stats)) {
    return originalUserContent;
  }

  // Group filteredStats by fileId, question, response
  const groupStats = (stats) => {
    const grouped = [];
    const keyMap = new Map();
    for (const stat of stats) {
      const key = `${stat.fileId}||${stat.question}||${stat.response}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          fileId: stat.fileId,
          question: stat.question,
          response: stat.response,
          overall: null,
          region: {},
          age: {},
          gender: {},
        });
      }
      const entry = keyMap.get(key);
      if (stat.segment === "overall") {
        entry.overall = stat.percentage;
      } else if (stat.segment.startsWith("region:")) {
        const region = stat.segment.split(":")[1];
        entry.region[region] = stat.percentage;
      } else if (stat.segment.startsWith("age:")) {
        const age = stat.segment.split(":")[1];
        entry.age[age] = stat.percentage;
      } else if (stat.segment.startsWith("gender:")) {
        const gender = stat.segment.split(":")[1];
        entry.gender[gender] = stat.percentage;
      }
    }
    return Array.from(keyMap.values());
  };

  const formatGroupedStats = (grouped) => {
    return grouped
      .map((entry) => {
        let lines = [];
        lines.push("Question: " + entry.question);
        lines.push("Response: " + entry.response);
        if (entry.overall !== null) {
          lines.push("- overall: " + entry.overall + "%");
        }
        if (Object.keys(entry.region).length > 0) {
          lines.push(
            "- region { " +
              Object.entries(entry.region)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        if (Object.keys(entry.age).length > 0) {
          lines.push(
            "- age { " +
              Object.entries(entry.age)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        if (Object.keys(entry.gender).length > 0) {
          lines.push(
            "- gender { " +
              Object.entries(entry.gender)
                .map(([k, v]) => k + ": " + v + "%")
                .join(", ") +
              " }"
          );
        }
        return lines.join("\n");
      })
      .join("\n\n");
  };

  const groupedStats = groupStats(filteredData.stats);
  const statsPreview =
    groupedStats.length > 0
      ? formatGroupedStats(groupedStats)
      : "No data matched for the selected segments.";

  // Initialize the prompt - we'll build it in pieces
  let promptParts = {
    userQuery: originalUserContent,
    incomparableTopicNotice: "",
    compatibilityInfo: "",
    data: statsPreview,
  };

  // Add specific incomparable topic messages if any topics were filtered out - do this FIRST
  if (
    options.incomparableTopicMessages ||
    (options.context && options.context.incomparableTopicMessages) ||
    (options.context && options.context.hasIncomparableTopics)
  ) {
    const incomparableTopics =
      options.incomparableTopicMessages ||
      (options.context && options.context.incomparableTopicMessages) ||
      {};

    if (Object.keys(incomparableTopics).length > 0) {
      promptParts.incomparableTopicNotice =
        "\n\n### ⚠️ IMPORTANT NOTICE ON INCOMPARABLE TOPICS ⚠️\n" +
        "The following topics cannot be compared between years:\n\n";

      for (const [topic, message] of Object.entries(incomparableTopics)) {
        promptParts.incomparableTopicNotice += `⚠️ **${topic}**: ${message}\n\n`;
      }

      promptParts.incomparableTopicNotice +=
        "For the above topics, you MUST NOT attempt to make year-on-year comparisons. " +
        "Instead, present only the available data and explicitly state the limitation. " +
        "The data for these topics has been intentionally excluded from this response.";

      logger.info(
        `[COMPATIBILITY] Added prominent incomparable topics notice for ${
          Object.keys(incomparableTopics).length
        } topics`
      );
    }
  }

  // Add compatibility information if provided
  if (options.compatibilityMetadata) {
    const compatibilityVerbosity = options.compatibilityVerbosity || "standard";

    // If we have incomparable topics and this is a comparison query,
    // promote verbosity to at least "standard" to ensure clear warnings
    if (
      options.context &&
      options.context.hasIncomparableTopics &&
      compatibilityVerbosity === "minimal"
    ) {
      logger.info(
        "[COMPATIBILITY] Upgrading verbosity from minimal to standard due to incomparable topics"
      );
      compatibilityVerbosity = "standard";
    }

    // Log that we're adding compatibility info to the prompt
    logCompatibilityInPrompt(
      compatibilityVerbosity,
      originalUserContent.substring(0, 60),
      options.compatibilityMetadata.isFullyCompatible
    );

    const compatibilitySection = formatCompatibilityMetadataForPrompt(
      options.compatibilityMetadata,
      compatibilityVerbosity
    );

    if (compatibilitySection) {
      promptParts.compatibilityInfo =
        "\n\n### Data Compatibility Information\n" + compatibilitySection;
    }
  }

  // Assemble the prompt - putting incomparable topics warning FIRST for prominence
  let prompt = promptParts.userQuery;

  // Add incomparable topic notice FIRST if present
  if (promptParts.incomparableTopicNotice) {
    prompt += promptParts.incomparableTopicNotice;
  }

  // Add compatibility information next
  if (promptParts.compatibilityInfo) {
    prompt += promptParts.compatibilityInfo;
  }

  // Finally add the data preview
  prompt += "\n\n" + promptParts.data;

  return prompt;
}

/**
 * Formats compatibility metadata for insertion into a prompt with appropriate verbosity level
 * @param {object} metadata - The compatibility metadata
 * @param {string} verbosity - Verbosity level ('minimal', 'standard', 'detailed')
 * @returns {string} Formatted compatibility information for the prompt
 */
export function formatCompatibilityMetadataForPrompt(
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

/**
 * Formats compatibility metadata with minimal details
 * @param {object} metadata - The compatibility metadata
 * @returns {string} Minimal compatibility information
 */
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
    // Find the non-comparable topics
    const nonComparableTopics = Object.entries(
      metadata.topicCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([topic]) => topic);

    if (nonComparableTopics.length > 0) {
      message = `⚠️ IMPORTANT: The following topics CANNOT be compared across years due to methodology changes: ${nonComparableTopics.join(
        ", "
      )}. You must not make direct year-on-year comparisons for these topics.`;
    } else {
      message =
        "Some data cannot be compared across years due to methodology changes.";
    }
  }

  return message;
}

/**
 * Formats compatibility metadata with standard level of detail
 * @param {object} metadata - The compatibility metadata
 * @returns {string} Standard compatibility information
 */
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

    // Add non-comparable topics with stronger, more prominent warning
    const nonComparableTopics = Object.entries(
      metadata.topicCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable && info.availableYears.length > 1)
      .map(([topic, info]) => `- ${topic}: ${info.userMessage}`)
      .join("\n");

    if (nonComparableTopics) {
      message += `⚠️ CRITICAL - DIRECT YEAR COMPARISON PROHIBITED FOR THESE TOPICS ⚠️\n${nonComparableTopics}\n\nWhen analyzing the above topics, you MUST NOT make direct comparisons between years. Present data for each year separately if requested, but explicitly state the comparison limitation.\n\n`;
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

/**
 * Formats compatibility metadata with detailed information
 * @param {object} metadata - The compatibility metadata
 * @returns {string} Detailed compatibility information
 */
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

    // Add strong warning about non-comparable topics
    const nonComparableTopics = Object.entries(
      metadata.topicCompatibility || {}
    )
      .filter(([_, info]) => !info.comparable)
      .map(([topic]) => topic);

    if (nonComparableTopics.length > 0) {
      message += `⚠️ CRITICAL RESTRICTION: YOU MUST NOT DIRECTLY COMPARE YEARS FOR THESE TOPICS: ${nonComparableTopics.join(
        ", "
      )} ⚠️\n`;
      message += `For these topics, you must present data for each year separately and explicitly note the comparison limitations. Do not draw conclusions about trends, changes, or patterns between years.\n\n`;
    }
  }

  // Add all topics with their compatibility status
  message += "Topic Compatibility:\n";
  Object.entries(metadata.topicCompatibility || {}).forEach(([topic, info]) => {
    message += `- ${topic}:\n`;
    message += `  - Comparable: ${info.comparable ? "Yes" : "No"}\n`;
    if (!info.comparable) {
      message += `  - IMPORTANT: DO NOT COMPARE years for this topic!\n`;
    }
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
      if (!info.comparable) {
        message += `  - IMPORTANT: DO NOT COMPARE ${segment} data across years!\n`;
      }
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
