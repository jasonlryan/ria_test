/**
 * OpenAI Integration for Data Retrieval System
 * Refactored for smart filtering and incremental caching
 */

import OpenAI from "openai";
const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger").default;

const { DEFAULT_SEGMENTS } = require("../data/segment_keys");
// Import smart filtering and incremental cache modules
const {
  parseQueryIntent,
  mapIntentToDataScope,
  getBaseData,
  getSpecificData,
} = require("../data/smart_filtering");
const {
  getThreadCache,
  updateThreadCache,
  getDataScope,
  getIncrementalData,
  calculateMissingDataScope,
} = require("../data/incremental_cache");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurable constants
const CANONICAL_MAPPING_PATH = path.join(
  process.cwd(),
  "scripts",
  "reference files",
  "2025",
  "canonical_topic_mapping.json"
);
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const PROMPTS_DIR = path.join(process.cwd(), "utils", "openai");
const DATA_DIR = path.join(process.cwd(), "scripts", "output", "split_data");

// Directory for precompiled starter data
const PRECOMPILED_STARTERS_DIR = path.join(
  process.cwd(),
  "utils",
  "openai",
  "precompiled_starters"
);

// Cache for the canonical topic mapping to avoid repeated file reads
let canonicalTopicMapping = null;

// Cache for query results to avoid repeated OpenAI calls for similar queries
const queryCache = new Map();

/**
 * Loads and returns the precompiled data for a given starter question code.
 * @param {string} code - The starter question code (e.g., "SQ1")
 * @returns {object|null} The precompiled data object, or null if not found
 */
function getPrecompiledStarterData(code) {
  if (!code || typeof code !== "string") return null;
  const filename = `${code.toUpperCase()}.json`;
  const filePath = path.join(PRECOMPILED_STARTERS_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Precompiled starter data not found: ${filePath}`);
      return null;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error loading precompiled starter data for ${code}:`, error);
    return null;
  }
}

/**
 * Detects if the prompt is a starter question code (e.g., "SQ1", "SQ2", case-insensitive).
 * @param {string} prompt - The prompt or code to check
 * @returns {boolean} True if the prompt matches the starter question code pattern
 */
function isStarterQuestion(prompt) {
  if (!prompt || typeof prompt !== "string") return false;
  return /^SQ\d+$/i.test(prompt.trim());
}

export { getPrecompiledStarterData, isStarterQuestion };

/**
 * Load the canonical topic mapping file - results are cached for performance
 * @returns {object} The parsed canonical topic mapping
 */
function loadCanonicalTopicMapping() {
  if (canonicalTopicMapping) return canonicalTopicMapping;

  try {
    const mappingPath = path.join(
      process.cwd(),
      "scripts",
      "reference files",
      "2025",
      "canonical_topic_mapping.json"
    );
    const mappingData = fs.readFileSync(mappingPath, "utf8");
    canonicalTopicMapping = JSON.parse(mappingData);
    if (process.env.DEBUG) {
      logger.debug("Canonical topic mapping loaded and cached");
    }
    return canonicalTopicMapping;
  } catch (error) {
    logger.error("Error loading canonical topic mapping:", error);
    throw new Error("Failed to load canonical topic mapping");
  }
}

/**
 * Generate a cache key for a query
 * @param {string} query - The user's query
 * @returns {string} - The cache key
 */
function generateCacheKey(query) {
  // Normalize query by removing punctuation, extra spaces, and converting to lowercase
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identify relevant data files based on a user query
 * @param {string} query - The user's query
 * @param {string} context - The context for filtering data
 * @returns {Promise<{file_ids: string[], matched_topics: string[], explanation: string}>} - The identified file IDs and explanation
 */
export async function identifyRelevantFiles(query, context) {
  try {
    // No more keyword checks - rely purely on semantic analysis

    // Check cache first
    const cacheKey = generateCacheKey(query);
    if (queryCache.has(cacheKey)) {
      if (process.env.DEBUG) {
        logger.debug("Using cached query results");
      }
      return queryCache.get(cacheKey);
    }

    // Load the canonical topic mapping for more accurate file identification
    const mapping = loadCanonicalTopicMapping();

    // Extract only the minimal necessary data for file identification to reduce token usage
    const simplifiedMapping = {
      themes: mapping.themes.map((theme) => ({
        name: theme.name,
        topics: theme.topics.map((topic) => ({
          id: topic.id,
          canonicalQuestion: topic.canonicalQuestion,
          // Only include first 3 alternate phrasings to reduce tokens
          alternatePhrasings: topic.alternatePhrasings
            ? topic.alternatePhrasings.slice(0, 3)
            : undefined,
          // Only include mapping info, not all details
          mapping: topic.mapping
            ? {
                2024: topic.mapping["2024"]
                  ? topic.mapping["2024"].map((m) => ({
                      file: m.file,
                    }))
                  : undefined,
                2025: topic.mapping["2025"]
                  ? topic.mapping["2025"].map((m) => ({
                      file: m.file,
                    }))
                  : undefined,
              }
            : undefined,
        })),
      })),
    };

    // Load the file identification prompt from markdown file
    let systemPrompt =
      "You analyze workforce survey queries to determine relevant data files. Be precise in your JSON responses.";
    let userPromptTemplate = loadPromptFromFile("1_data_retrieval");

    // Replace template variables
    const userPrompt = userPromptTemplate
      .replace("{{QUERY}}", query)
      .replace("{{MAPPING}}", JSON.stringify(simplifiedMapping, null, 2));

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    // Extract the content directly from the message
    const content = response.choices[0].message.content;

    try {
      // Parse the JSON content
      if (process.env.DEBUG) {
        logger.debug(
          "Raw response content: " + content.substring(0, 100) + "..."
        );
      }
      const result = JSON.parse(content);

      // Apply validations
      if (!result.file_ids || !Array.isArray(result.file_ids)) {
        result.file_ids = [];
      }

      if (!result.matched_topics || !Array.isArray(result.matched_topics)) {
        result.matched_topics = [];
      }

      if (!result.explanation) {
        result.explanation = "No explanation provided";
      }

      // Cache the result
      queryCache.set(cacheKey, result);

      return result;
    } catch (parseError) {
      logger.error("JSON parse error in response content:", parseError);
      logger.error("Content that failed to parse:", content);

      // Provide a fallback result
      return {
        file_ids: [],
        matched_topics: [],
        explanation: "Error parsing OpenAI response: " + parseError.message,
      };
    }
  } catch (error) {
    logger.error("Error identifying relevant files:", error);
    throw error;
  }
}

/**
 * Format data files for efficient analysis
 * @param {object} dataFiles - The raw data files
 * @returns {object} - Formatted data files optimized for OpenAI processing
 */
function formatDataForAnalysis(dataFiles) {
  if (process.env.DEBUG) {
    logger.debug("Formatting data for analysis...");
  }

  try {
    // Create a simplified data representation that EXPLICITLY includes percentages
    const formattedData = {
      files: dataFiles.files.map((file) => {
        // Skip files with errors
        if (file.error || !file.data || !Array.isArray(file.data)) {
          if (process.env.DEBUG) {
            logger.debug(
              `Skipping file ${file.id} due to error or missing data`
            );
          }
          return {
            id: file.id,
            error: file.error || "No valid data available",
          };
        }

        // Create an array to store all percentage data points
        const percentageData = [];
        let percentageCount = 0;

        // Process all data points in the file
        file.data.forEach((dataPoint, index) => {
          if (!dataPoint) return; // Skip null data points

          // Create a new data entry with explicit percentage formatting
          const formattedPoint = {
            question: dataPoint.question || "No question available",
            answer: dataPoint.answer || "No answer available",
            percentages: [],
          };

          // Check each potential category for numeric values
          [
            "global",
            "country",
            "age",
            "gender",
            "job_level",
            "generation",
          ].forEach((category) => {
            if (
              dataPoint[category] &&
              typeof dataPoint[category] === "object"
            ) {
              // Process each key in this category
              Object.entries(dataPoint[category]).forEach(([key, value]) => {
                // If numeric value, treat as percentage
                if (
                  typeof value === "number" ||
                  (typeof value === "string" && !isNaN(parseInt(value)))
                ) {
                  const numValue =
                    typeof value === "number" ? value : parseInt(value);

                  // Add formatted percentage to our list
                  formattedPoint.percentages.push({
                    category: category,
                    segment: key,
                    value: numValue,
                    formatted: `${numValue}%`,
                  });

                  // Also add it directly to make it easy to access
                  if (!formattedPoint[category]) formattedPoint[category] = {};
                  formattedPoint[category][key] = `${numValue}%`;

                  percentageCount++;
                }
              });
            }
          });

          // Add this point if it has percentages
          if (formattedPoint.percentages.length > 0) {
            percentageData.push(formattedPoint);
          }
        });

        if (process.env.DEBUG) {
          logger.debug(
            `File ${file.id}: Found ${percentageCount} percentage values in ${percentageData.length} data points`
          );
        }

        return {
          id: file.id,
          data: percentageData,
        };
      }),
      metadata: {
        totalFiles: dataFiles.files.length,
        dataPointCount: dataFiles.metadata.total_data_points,
      },
    };

    // Count total percentage values across all files
    let totalPercentageValues = 0;
    let totalDataPointsWithPercentages = 0;

    formattedData.files.forEach((file) => {
      if (file.data && Array.isArray(file.data)) {
        totalDataPointsWithPercentages += file.data.length;
        file.data.forEach((point) => {
          if (point.percentages) {
            totalPercentageValues += point.percentages.length;
          }
        });
      }
    });

    if (process.env.DEBUG) {
      logger.debug(
        `Total: ${totalPercentageValues} percentage values in ${totalDataPointsWithPercentages} data points`
      );
    }
    formattedData.metadata.percentageCount = totalPercentageValues;

    return formattedData;
  } catch (error) {
    logger.error("Error in formatDataForAnalysis:", error);
    return {
      files: [],
      metadata: {
        error: `Error formatting data: ${error.message}`,
      },
    };
  }
}

/**
 * Generate analysis directly from the data files - NO SECONDARY ANALYSIS
 * @param {string} query - The user's query
 * @param {object} dataFiles - The retrieved data files
 * @param {array} matchedTopics - Topics that matched the query
 * @returns {Promise<string>} - The extracted data formatted as text
 */
export async function generateAnalysis(query, dataFiles, matchedTopics) {
  try {
    const startTime = Date.now();
    if (process.env.DEBUG) {
      logger.debug(
        "Starting direct data extraction at " +
          new Date(startTime).toISOString()
      );
    }

    // Get information about matched topics
    const topicInfo = matchedTopics.map((topic) => {
      let question = "No question available";

      // Find the canonical question for this topic
      const mapping = loadCanonicalTopicMapping();
      for (const theme of mapping.themes) {
        for (const t of theme.topics) {
          if (t.id === topic) {
            question = t.canonicalQuestion;
            break;
          }
        }
      }

      return { topic, question };
    });

    // Build a structured text representation of the data
    let analysisText = `# Workforce Survey Data Analysis\n\n`;
    analysisText += `## Analysis for Query: "${query}"\n\n`;

    // Add topics section
    analysisText += `### Topics Analyzed\n`;
    topicInfo.forEach((info) => {
      analysisText += `- **${info.topic}**: ${info.question}\n`;
    });
    analysisText += `\n`;

    // Extract percentage data
    let percentageStats = [];
    let fileStats = [];

    for (const file of dataFiles.files) {
      if (file.error || !file.data || !Array.isArray(file.data)) continue;

      // Process data file
      let filePercentages = 0;
      const fileInfo = {
        id: file.id,
        dataPoints: file.data.length,
        percentages: [],
      };

      for (const dataPoint of file.data) {
        if (!dataPoint) continue;

        // Process each category looking for numeric values/percentages
        [
          "global",
          "country",
          "age",
          "gender",
          "job_level",
          "generation",
        ].forEach((category) => {
          if (dataPoint[category] && typeof dataPoint[category] === "object") {
            // Extract values from each key
            Object.entries(dataPoint[category]).forEach(([key, value]) => {
              if (
                typeof value === "number" ||
                (typeof value === "string" && !isNaN(parseInt(value)))
              ) {
                const numValue =
                  typeof value === "number" ? value : parseInt(value);

                // Add to our percentage stats
                percentageStats.push({
                  fileId: file.id,
                  question: dataPoint.question,
                  category,
                  segment: key,
                  value: numValue,
                });

                // Add to file info
                fileInfo.percentages.push({
                  category,
                  segment: key,
                  value: numValue,
                });

                filePercentages++;
              }
            });
          }
        });
      }

      fileInfo.percentageCount = filePercentages;
      fileStats.push(fileInfo);
    }

    // Add file info to analysis
    analysisText += `### Files and Data Points\n`;
    fileStats.forEach((file) => {
      analysisText += `- **${file.id}**: ${file.dataPoints} data points, ${file.percentageCount} percentage values\n`;
    });
    analysisText += `\n`;

    // Add key percentage data
    analysisText += `### Key Percentage Values\n\n`;

    // Group percentages by topic
    const topicGroups = {};
    matchedTopics.forEach((topic) => {
      topicGroups[topic] = [];
    });

    // Assign percentages to topics based on file_id pattern
    percentageStats.forEach((stat) => {
      const fileId = stat.fileId;

      // Map file IDs to topics
      let matchedTopic = null;
      if (fileId.includes("2025_1")) matchedTopic = "Attraction_Factors";
      else if (fileId.includes("2025_2")) matchedTopic = "Retention_Factors";
      else if (fileId.includes("2025_3")) matchedTopic = "Attrition_Factors";
      else if (fileId.includes("2025_7")) matchedTopic = "Intention_to_Leave";

      if (matchedTopic && topicGroups[matchedTopic]) {
        topicGroups[matchedTopic].push(stat);
      }
    });

    // Add percentage data by topic
    Object.entries(topicGroups).forEach(([topic, stats]) => {
      if (stats.length === 0) return;

      analysisText += `#### ${topic}\n`;

      // Group by question
      const questionGroups = {};
      stats.forEach((stat) => {
        if (!questionGroups[stat.question]) {
          questionGroups[stat.question] = [];
        }
        questionGroups[stat.question].push(stat);
      });

      // Add data for each question
      Object.entries(questionGroups).forEach(([question, questionStats]) => {
        analysisText += `**${question}**\n`;

        // Group by category
        const categoryGroups = {};
        questionStats.forEach((stat) => {
          if (!categoryGroups[stat.category]) {
            categoryGroups[stat.category] = [];
          }
          categoryGroups[stat.category].push(stat);
        });

        // Add data for each category
        Object.entries(categoryGroups).forEach(([category, categoryStats]) => {
          analysisText += `- ${category}:\n`;
          categoryStats.forEach((stat) => {
            analysisText += `  - ${stat.segment}: **${stat.value}%**\n`;
          });
        });

        analysisText += `\n`;
      });
    });

    // Add metadata
    analysisText += `### Analysis Metadata\n`;
    analysisText += `- Total data points: ${dataFiles.metadata.total_data_points}\n`;
    analysisText += `- Total percentage values: ${percentageStats.length}\n`;
    analysisText += `- Files analyzed: ${fileStats.length}\n`;
    analysisText += `- Topics covered: ${matchedTopics.join(", ")}\n`;

    const endTime = Date.now();
    if (process.env.DEBUG) {
      logger.debug(
        `Direct data extraction completed in ${
          (endTime - startTime) / 1000
        } seconds`
      );
      logger.debug(
        `Extracted ${percentageStats.length} percentage values from ${fileStats.length} files`
      );

      // Log a preview of the analysis
      logger.debug("====== ANALYSIS PREVIEW ======");
      logger.debug(analysisText.substring(0, 500) + "...");
      logger.debug("=============================");

      // Check for percentages in the analysis
      const percentageMatches = analysisText.match(/\d+%/g) || [];
      logger.debug(
        `Analysis contains ${
          percentageMatches.length
        } percentage values: ${percentageMatches.slice(0, 5).join(", ")}${
          percentageMatches.length > 5 ? "..." : ""
        }`
      );
    }

    return analysisText;
  } catch (error) {
    logger.error("Error generating direct data analysis:", error);
    return `Error extracting data: ${error.message}`;
  }
}

/**
 * Retrieve data files from the API
 * @param {string[]} fileIds - Array of file IDs to retrieve
 * @returns {Promise<object>} - The retrieved data
 */
export async function retrieveDataFiles(fileIds) {
  if (process.env.DEBUG) {
    logger.debug(`Retrieving ${fileIds.length} data files...`);
  }

  // In production on Vercel, read files directly from the file system
  // This avoids API cross-calling issues with authentication
  if (process.env.NODE_ENV === "production") {
    try {
      if (process.env.DEBUG) {
        logger.debug(
          "Using direct file system access in production environment"
        );
      }

      // Topics to collect
      const topics = new Set();

      // Process each file ID and read directly from file system
      const files = await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            // Normalize file ID to include .json extension if missing
            const normalizedId = fileId.endsWith(".json")
              ? fileId
              : `${fileId}.json`;

            // Construct absolute path to the data file
            const filePath = path.join(
              process.cwd(),
              "scripts",
              "output",
              "split_data",
              normalizedId
            );

            if (process.env.DEBUG) {
              logger.debug(`Attempting to read file: ${filePath}`);
            }

            // Ensure file exists
            if (!fs.existsSync(filePath)) {
              logger.error(`File not found: ${filePath}`);
              return {
                id: fileId,
                error: `File not found: ${filePath}`,
              };
            }

            // Read the file content
            const fileContent = fs.readFileSync(filePath, "utf8");

            // Parse the file content as JSON
            const jsonData = JSON.parse(fileContent);

            // Extract topic from file_id
            let topic = "Unknown";
            if (fileId.includes("_1")) topic = "Attraction_Factors";
            else if (fileId.includes("_2")) topic = "Retention_Factors";
            else if (fileId.includes("_3")) topic = "Attrition_Factors";
            else if (fileId.includes("_7")) topic = "Intention_to_Leave";
            else if (fileId.includes("_12")) topic = "Work_Preferences";

            // Add topic to set
            topics.add(topic);

            // Return file data
            return {
              id: fileId,
              topic: topic,
              data: jsonData,
            };
          } catch (error) {
            logger.error(`Error retrieving file ${fileId}:`, error);
            return {
              id: fileId,
              error: error.message,
            };
          }
        })
      );

      // Calculate total data points
      let totalDataPoints = 0;
      files.forEach((file) => {
        if (file.data && Array.isArray(file.data)) {
          totalDataPoints += file.data.length;
        } else if (file.data && typeof file.data === "object") {
          totalDataPoints += 1;
        }
      });

      return {
        files: files || [],
        topics: Array.from(topics) || [],
        totalDataPoints: totalDataPoints || 0,
      };
    } catch (error) {
      logger.error("Error with direct file access:", error);
      throw error;
    }
  }

  // For development, continue using the API
  // Determine API URL based on environment
  const apiUrl = "http://localhost:3000/api/retrieve-data";

  try {
    // Call the API to retrieve data files
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve files: ${response.status}`);
    }

    // Parse the API response
    const result = await response.json();
    if (process.env.DEBUG) {
      logger.debug(
        `API response: ${result.files ? result.files.length : 0} files, ${
          result.totalDataPoints || 0
        } data points`
      );
    }

    // Return the retrieved data in the expected format
    return {
      files: result.files || [],
      topics: result.topics || [],
      totalDataPoints: result.totalDataPoints || 0,
    };
  } catch (error) {
    logger.error("Error retrieving data files:", error);
    throw error;
  }
}

/**
 * Process a query using the two-step retrieval approach
 * @param {string} query - The user's query
 * @param {string} context - The context for filtering data (e.g., 'sectors', 'all')
 * @param {Array} cachedFileIds - Optional array of file IDs that are already cached
 * @returns {Promise<object>} - The processed result
 */
/**
 * Process a query using smart filtering and incremental caching
 * @param {string} query - The user's query
 * @param {string} context - The context for filtering data (e.g., 'sectors', 'all')
 * @param {Array} cachedFileIds - Optional array of file IDs that are already cached
 * @param {string} threadId - Optional thread ID for cache (to be integrated with API)
 * @returns {Promise<object>} - The processed result
 */
export async function processQueryWithData(
  query,
  context,
  cachedFileIds = [],
  threadId = "default"
) {
  const startTime = performance.now();

  // Early return for empty queries
  if (!query || query.trim().length === 0) {
    return {
      analysis: "No query provided",
      matched_topics: [],
      files_used: [],
      file_ids: [],
      data_points: 0,
      status: "no_query",
      processing_time_ms: 0,
    };
  }

  // 1. Use OpenAI to identify relevant files (semantic mapping)
  const fileIdResult = await identifyRelevantFiles(query, context);
  const fileIds = fileIdResult.file_ids || [];
  const matchedTopics = fileIdResult.matched_topics || [];
  const explanation = fileIdResult.explanation || "";

  // Use segments from LLM response if present, otherwise fallback to default
  let segments = [];
  if (
    fileIdResult.segments &&
    Array.isArray(fileIdResult.segments) &&
    fileIdResult.segments.length > 0
  ) {
    segments = fileIdResult.segments;
  } else {
    segments = DEFAULT_SEGMENTS;
    logger.warn(
      "[RETRIEVAL] No segments returned by LLM, using default segments:",
      segments
    );
  }

  // LOGGING: Output what files, topics, and segments are being retrieved
  // (Removed unconditional console.log statements for cleaner output)

  // 2. Load only the relevant files
  const fs = require("fs");
  const path = require("path");
  const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
  let files = [];
  if (process.env.DEBUG) {
    logger.debug("=== DEBUG: File loading step ===");
    logger.debug("File IDs returned by LLM:", fileIds);
  }
  for (const fileId of fileIds) {
    const fileName = fileId.endsWith(".json") ? fileId : fileId + ".json";
    const filePath = path.join(dataDir, fileName);
    if (process.env.DEBUG) {
      logger.debug(`Attempting to load file: ${filePath}`);
    }
    try {
      if (!fs.existsSync(filePath)) {
        logger.error(`File does not exist: ${filePath}`);
        continue;
      }
      const fileContent = fs.readFileSync(filePath, "utf8");
      let jsonData;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseErr) {
        logger.error(`JSON parse error for file ${filePath}:`, parseErr);
        continue;
      }
      // Log structure of loaded data
      if (process.env.DEBUG && jsonData && typeof jsonData === "object") {
        if (Array.isArray(jsonData.responses)) {
          logger.debug(
            `File ${fileName} loaded. responses[] length: ${jsonData.responses.length}`
          );
        } else if (Array.isArray(jsonData.data)) {
          logger.debug(
            `File ${fileName} loaded. data[] length: ${jsonData.data.length}`
          );
        } else {
          logger.debug(
            `File ${fileName} loaded. Top-level keys:`,
            Object.keys(jsonData)
          );
        }
      }
      files.push({
        id: fileId.replace(/\.json$/, ""),
        data: jsonData,
      });
    } catch (e) {
      logger.error(`Error loading file ${filePath}:`, e);
      continue;
    }
  }
  // --- BEGIN: Data structure normalization and debug logging ---
  // Normalize: ensure file.data is always an object with a 'responses' array
  files = files.map((file) => {
    if (Array.isArray(file.data)) {
      return { ...file, data: { responses: file.data } };
    }
    return file;
  });

  // Unconditional debug logging of first loaded file structure
  if (files.length > 0) {
    const first = files[0];
    if (first.data && typeof first.data === "object") {
      logger.debug(
        "UNCONDITIONAL LOG: file.data keys:",
        Object.keys(first.data)
      );
      if (Array.isArray(first.data.responses)) {
        const resp0 = first.data.responses[0];
        if (resp0 && typeof resp0 === "object") {
          logger.debug(
            "UNCONDITIONAL LOG: first.data.responses[0] keys:",
            Object.keys(resp0)
          );
          // Print a shallow preview, not the full object
          const preview = JSON.stringify(resp0, null, 2);
          logger.debug(
            "UNCONDITIONAL LOG: first.data.responses[0] preview:",
            preview.length > 200
              ? preview.substring(0, 200) + " ... (truncated)"
              : preview
          );
        } else {
          logger.debug("UNCONDITIONAL LOG: first.data.responses[0]:", resp0);
        }
      }
    } else {
      logger.debug(
        "UNCONDITIONAL LOG: first file data is not an object:",
        typeof first.data
      );
    }
  }
  // --- END: Data structure normalization and debug logging ---
  // NOTE: mapIntentToDataScope is now only used for logging/monitoring, not for filtering
  const dataScope = { segments: new Set(segments) };

  // 3. Construct loadedData for filtering
  const loadedData = { files };

  // 4. Filter data using segments from LLM
  // Pass segments as a parameter to the filtering functions
  let filteredData;
  // Always use getSpecificData, passing segments as demographics
  filteredData = getSpecificData(loadedData, { demographics: segments });

  // 5. Prepare result object
  const endTime = performance.now();

  // DEBUG: Log filteredData for inspection
  if (process.env.DEBUG) {
    logger.debug(
      "=== DEBUG: filteredData being returned from processQueryWithData ==="
    );
    try {
      logger.debug(
        JSON.stringify(filteredData, null, 2).substring(0, 2000) +
          (JSON.stringify(filteredData).length > 2000 ? "... (truncated)" : "")
      );
    } catch (e) {
      logger.debug("Could not stringify filteredData for debug log.");
    }
    logger.debug(
      "==================================================================="
    );
  }

  // ENHANCED LOGGING: If no stats found, log available vs requested segments for debugging
  if (
    filteredData &&
    Array.isArray(filteredData.filteredData) &&
    filteredData.filteredData.length === 0 &&
    loadedData.files.length > 0
  ) {
    const firstFile = loadedData.files[0];
    let availableSegments = [];
    if (
      firstFile.data &&
      typeof firstFile.data === "object" &&
      Array.isArray(firstFile.data.responses) &&
      firstFile.data.responses.length > 0
    ) {
      // Collect all unique segment keys from the first file's responses
      const segmentSet = new Set();
      for (const resp of firstFile.data.responses) {
        if (resp.data && typeof resp.data === "object") {
          Object.keys(resp.data).forEach((k) => segmentSet.add(k));
        }
      }
      availableSegments = Array.from(segmentSet);
    }
    logger.warn(
      "[RETRIEVAL] No stats matched for selected segments.",
      "\nRequested segments:",
      segments,
      "\nAvailable segments in first file:",
      availableSegments
    );
  }

  return {
    analysis: "LLM-driven file identification and smart filtering result",
    filteredData,
    segments,
    dataScope,
    fileIds,
    matchedTopics,
    explanation,
    data_points:
      filteredData && Array.isArray(filteredData.filteredData)
        ? filteredData.filteredData.length
        : 0,
    stats:
      filteredData && Array.isArray(filteredData.filteredData)
        ? filteredData.filteredData
        : [],
    processing_time_ms: Math.round(endTime - startTime),
    // TODO: Add more fields as needed for downstream processing
  };
}

/**
 * Handle a query through the API
 * @param {object} req - The request object
 * @param {object} res - The response object
 */
export async function handleQueryAPI(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Invalid query parameter" });
    }

    const result = await processQueryWithData(query);
    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error processing query:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Load a prompt from a markdown file
 * @param {string} promptName - The name of the prompt file without extension
 * @returns {string} - The prompt content
 */
function loadPromptFromFile(promptName) {
  try {
    // Try the original location first
    const originalPromptPath = path.join(PROMPTS_DIR, `${promptName}.md`);
    if (process.env.DEBUG) {
      logger.debug(`Loaded prompt from ${originalPromptPath}`);
    }
    return fs.readFileSync(originalPromptPath, "utf8");
  } catch (error) {
    if (process.env.DEBUG) {
      logger.debug(
        `Error loading original prompt: ${error.message}, trying fallback locations...`
      );
    }
    // Try public folder as fallback
    try {
      const publicPromptPath = path.join(
        process.cwd(),
        "public",
        "prompts",
        `${promptName}.md`
      );
      if (process.env.DEBUG) {
        logger.debug(`Trying fallback prompt from ${publicPromptPath}`);
      }
      return fs.readFileSync(publicPromptPath, "utf8");
    } catch (fallbackError) {
      // Try public/prompt_files as another fallback
      try {
        const altPublicPromptPath = path.join(
          process.cwd(),
          "public",
          "prompt_files",
          `${promptName}.md`
        );
        if (process.env.DEBUG) {
          logger.debug(
            `Trying alternative fallback prompt from ${altPublicPromptPath}`
          );
        }
        return fs.readFileSync(altPublicPromptPath, "utf8");
      } catch (altFallbackError) {
        logger.error(
          `Failed to load prompt ${promptName} from any location:`,
          error.message
        );
        throw new Error(
          `Failed to load prompt file ${promptName}: ${error.message}`
        );
      }
    }
  }
}
