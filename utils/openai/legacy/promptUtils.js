/**
 * Helper function to build a natural language prompt with filtered data stats.
 * Groups stats by fileId, question, and response, then formats them into readable text.
 * @param {string} originalUserContent - The original user query.
 * @param {object} filteredData - The filtered data object containing stats array.
 * @param {object} options - Additional options for prompt building.
 * @param {object} [options.compatibilityMetadata] - Compatibility metadata for the query.
 * @param {string} [options.compatibilityVerbosity='standard'] - Verbosity level for compatibility info ('minimal', 'standard', 'detailed').
 * @param {string} [options.prefixInstruction] - Optional explicit instruction to add before the data.
 * @returns {string} - The constructed prompt string.
 */

import logger from "../shared/logger";

export function buildPromptWithFilteredData(
  originalUserContent,
  filteredData,
  options = {}
) {
  // Check for direct file data that might have been added by the controller
  if (
    filteredData &&
    filteredData.directFileData &&
    Array.isArray(filteredData.directFileData)
  ) {
    logger.info(
      `[PROMPT] Using direct file data (${filteredData.directFileData.length} files) instead of missing stats`
    );

    // Format the direct file data into a readable format
    const formattedDirectData = filteredData.directFileData.map((file) => {
      const fileHeader = `File: ${file.id} (${file.responseCount} responses)`;

      // Format example responses
      const exampleSections = file.examples.map((ex) => {
        let section = `Question/Response: ${ex.response}\n`;

        // Add segment data if available
        if (ex.segments && Object.keys(ex.segments).length > 0) {
          const segmentLines = [];

          // Add overall value if it exists
          if (ex.segments.overall !== undefined) {
            segmentLines.push(`- overall: ${ex.segments.overall}%`);
          }

          // Add other segment categories (region, age, gender, etc.)
          Object.entries(ex.segments).forEach(([segKey, segValue]) => {
            if (segKey !== "overall" && typeof segValue === "object") {
              const formattedValues = Object.entries(segValue)
                .map(([key, val]) => `${key}: ${val}%`)
                .join(", ");

              if (formattedValues) {
                segmentLines.push(`- ${segKey}: { ${formattedValues} }`);
              }
            }
          });

          // Add all segment lines to the section
          if (segmentLines.length > 0) {
            section += segmentLines.join("\n");
          }
        }

        return section;
      });

      return `${fileHeader}\n${exampleSections.join("\n\n")}`;
    });

    // Add the formatted direct data to our filteredData
    filteredData.formattedDirectData = formattedDirectData.join("\n\n");
  }

  // Defensive check for filteredData and stats
  if (!filteredData) {
    return originalUserContent;
  }

  // Check for alternative data sources in priority order
  let statsToUse = [];
  if (Array.isArray(filteredData.stats) && filteredData.stats.length > 0) {
    statsToUse = filteredData.stats;
    logger.info(
      `[PROMPT] Using primary stats array with ${statsToUse.length} items`
    );
  } else if (
    filteredData.filteredData &&
    Array.isArray(filteredData.filteredData.stats) &&
    filteredData.filteredData.stats.length > 0
  ) {
    statsToUse = filteredData.filteredData.stats;
    logger.info(
      `[PROMPT] Using nested filteredData.stats with ${statsToUse.length} items`
    );
  } else if (
    filteredData.filteredData &&
    Array.isArray(filteredData.filteredData) &&
    filteredData.filteredData.length > 0
  ) {
    statsToUse = filteredData.filteredData;
    logger.info(
      `[PROMPT] Using filteredData array directly with ${statsToUse.length} items`
    );
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

  // Generate the standard stats preview if we have stats
  let statsPreview = "No data matched for the selected segments.";
  if (statsToUse.length > 0) {
    let groupedStats = groupStats(statsToUse);
    // Hard cap on number of grouped entries to avoid huge prompt
    const GROUP_LIMIT = 500; // ~500 questions/responses is enough context
    if (groupedStats.length > GROUP_LIMIT) {
      logger.warn(
        `[PROMPT] groupedStats size ${groupedStats.length} > ${GROUP_LIMIT}; truncating.`
      );
      groupedStats = groupedStats.slice(0, GROUP_LIMIT);
    }

    if (groupedStats.length > 0) {
      statsPreview = formatGroupedStats(groupedStats);
    }
  }
  // Use the direct file data as fallback if available
  else if (filteredData.formattedDirectData) {
    statsPreview =
      "### Direct File Data (using raw response data):\n\n" +
      filteredData.formattedDirectData;
    logger.info(
      `[PROMPT] Using formatted direct file data (${filteredData.formattedDirectData.length} chars) as fallback`
    );
  }

  // Ensure prompt stays under 200k chars to avoid 256k OpenAI hard limit
  const MAX_PROMPT_CHARS = 200000;
  if (statsPreview.length > MAX_PROMPT_CHARS) {
    logger.warn(
      `[PROMPT] statsPreview length ${statsPreview.length} > ${MAX_PROMPT_CHARS}; truncating.`
    );
    statsPreview =
      statsPreview.slice(0, MAX_PROMPT_CHARS) + "\n\n[...truncated...]";
  }

  // Initialize the prompt - we'll build it in pieces
  let promptParts = {
    userQuery: originalUserContent,
    prefixInstruction: options.prefixInstruction || "",
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
    let effectiveVerbosity = compatibilityVerbosity;
    if (
      options.context &&
      options.context.hasIncomparableTopics &&
      compatibilityVerbosity === "minimal"
    ) {
      logger.info(
        "[COMPATIBILITY] Upgrading verbosity from minimal to standard due to incomparable topics"
      );
      effectiveVerbosity = "standard";
    }

    // Log that we're adding compatibility info to the prompt
    logger.info(
      `[COMPATIBILITY] Adding ${effectiveVerbosity} compatibility info to prompt: "${originalUserContent.substring(
        0,
        60
      )}..." (isFullyCompatible: ${
        options.compatibilityMetadata.isFullyCompatible
      })`
    );

    const compatibilitySection = formatCompatibilityMetadataForPrompt(
      options.compatibilityMetadata,
      effectiveVerbosity
    );

    if (compatibilitySection) {
      promptParts.compatibilityInfo =
        "\n\n### Data Compatibility Information\n" + compatibilitySection;
    }
  }

  // Assemble the prompt - putting incomparable topics warning FIRST for prominence
  let prompt = promptParts.userQuery;

  // Add prefix instruction if provided
  if (promptParts.prefixInstruction) {
    prompt +=
      "\n\n### INSTRUCTIONS FOR RESPONSE\n" + promptParts.prefixInstruction;
  }

  // Add incomparable topic notice FIRST if present
  if (promptParts.incomparableTopicNotice) {
    prompt += promptParts.incomparableTopicNotice;
  }

  // Add compatibility information next
  if (promptParts.compatibilityInfo) {
    prompt += promptParts.compatibilityInfo;
  }

  // Finally add the data preview with clear header
  prompt +=
    "\n\n### SURVEY DATA (USE THESE EXACT STATISTICS)\nBelow are the exact statistics you must use in your response. Do not make up or estimate any other percentages. Only use the numbers provided here:\n\n" +
    promptParts.data;

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
