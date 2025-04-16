/**
 * OpenAI Integration for Data Retrieval System
 * Refactored for smart filtering and incremental caching
 */

import OpenAI from "openai";
const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger").default;
const {
  logPerformanceMetrics,
  logPerformanceToFile,
} = require("../../utils/shared/loggerHelpers");

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
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
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
 * Load a prompt from a markdown file
 * @param {string} promptName - The name of the prompt file without extension
 * @returns {string} - The prompt content
 */
function loadPromptFromFile(promptName) {
  try {
    // Try the original location first
    const originalPromptPath = path.join(PROMPTS_DIR, `${promptName}.md`);
    // if (process.env.DEBUG) {
    //   logger.debug(`Loaded prompt from ${originalPromptPath}`);
    // }
    return fs.readFileSync(originalPromptPath, "utf8");
  } catch (error) {
    // if (process.env.DEBUG) {
    //   logger.debug(
    //     `Error loading original prompt: ${error.message}, trying fallback locations...`
    //   );
    // }
    // Try public folder as fallback
    try {
      const publicPromptPath = path.join(
        process.cwd(),
        "public",
        "prompts",
        `${promptName}.md`
      );
      // if (process.env.DEBUG) {
      //   logger.debug(`Trying fallback prompt from ${publicPromptPath}`);
      // }
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
        // if (process.env.DEBUG) {
        //   logger.debug(
        //     `Trying alternative fallback prompt from ${altPublicPromptPath}`
        //   );
        // }
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

/**
 * Loads and returns the precompiled data for a given starter question code.
 * @param {string} code - The starter question code (e.g., "SQ1")
 * @returns {object|null} The precompiled data object, or null if not found
 */
function getPrecompiledStarterData(code) {
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
function isStarterQuestion(prompt) {
  // Add detailed logging
  // console.log(
  //   `[STARTER DEBUG] isStarterQuestion called with: "${prompt}" (type: ${typeof prompt})`
  // );

  if (!prompt || typeof prompt !== "string") {
    // console.log(
    //   "[STARTER DEBUG] isStarterQuestion result: false (prompt is null, undefined, or not a string)"
    // );
    return false;
  }

  const trimmed = prompt.trim();
  // Fix the regex pattern - remove the escaped backslashes that are breaking the pattern
  const result = /^SQ\d+$/i.test(trimmed);
  // console.log(
  //   `[STARTER DEBUG] isStarterQuestion trimmed: "${trimmed}", regex test result: ${result}`
  // );

  return result;
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
    // if (process.env.DEBUG) {
    //   logger.debug("Canonical topic mapping loaded and cached");
    // }
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
    .replace(/[^\\w\\s]/g, "")
    .replace(/\\s+/g, " ")
    .trim();
}

/**
 * Identify relevant data files based on a user query
 * @param {string} query - The user's query
 * @param {string} context - The context for filtering data
 * @param {boolean} isFollowUp - Whether the query is a follow-up
 * @param {string} previousQuery - The previous query
 * @param {string} previousAssistantResponse - The previous assistant response
 * @returns {Promise<{file_ids: string[], matched_topics: string[], explanation: string}>} - The identified file IDs and explanation
 */
export async function identifyRelevantFiles(
  query,
  context,
  isFollowUp = false,
  previousQuery = "",
  previousAssistantResponse = ""
) {
  try {
    // No more keyword checks - rely purely on semantic analysis

    // Check cache first (Cache key should ideally include context for follow-ups)
    const cacheKey = generateCacheKey(
      query + (isFollowUp ? `_followup_${previousQuery.substring(0, 50)}` : "")
    );
    if (queryCache.has(cacheKey)) {
      // if (process.env.DEBUG) {
      //   logger.debug("Using cached query results");
      // }
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

    // Replace template variables, including new context placeholders
    const userPrompt = userPromptTemplate
      .replace("{{IS_FOLLOWUP}}", String(isFollowUp))
      .replace("{{PREVIOUS_QUERY}}", previousQuery)
      .replace("{{PREVIOUS_ASSISTANT_RESPONSE}}", previousAssistantResponse)
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
      // if (process.env.DEBUG) {
      //   logger.debug(
      //     "Raw response content: " + content.substring(0, 100) + "..."
      //   );
      // }
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

      // ENFORCE: If isFollowUp is true, forcibly set out_of_scope to false
      if (isFollowUp === true || isFollowUp === "true") {
        result.out_of_scope = false;
        // Optionally, clear out_of_scope_message if present
        if ("out_of_scope_message" in result) {
          result.out_of_scope_message = "";
        }
        // Optionally, update explanation
        result.explanation +=
          " (out_of_scope forcibly set to false for follow-up)";
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
  // if (process.env.DEBUG) {
  //   logger.debug("Formatting data for analysis...");
  // }

  try {
    // Create a simplified data representation that EXPLICITLY includes percentages
    const formattedData = {
      files: dataFiles.files.map((file) => {
        // Skip files with errors
        if (file.error || !file.data || !Array.isArray(file.data)) {
          // if (process.env.DEBUG) {
          //   logger.debug(
          //     `Skipping file ${file.id} due to error or missing data`
          //   );
          // }
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

        // if (process.env.DEBUG) {
        //   logger.debug(
        //     `File ${file.id}: Found ${percentageCount} percentage values in ${percentageData.length} data points`
        //   );
        // }

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

    // if (process.env.DEBUG) {
    //   logger.debug(
    //     `Total: ${totalPercentageValues} percentage values in ${totalDataPointsWithPercentages} data points`
    //   );
    // }
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
    // if (process.env.DEBUG) {
    //   logger.debug(
    //     "Starting direct data extraction at " +
    //       new Date(startTime).toISOString()
    //   );
    // }

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
    let analysisText = `# Workforce Survey Data Analysis\\n\\n`;
    analysisText += `## Analysis for Query: "${query}"\\n\\n`;

    // Add topics section
    analysisText += `### Topics Analyzed\\n`;
    topicInfo.forEach((info) => {
      analysisText += `- **${info.topic}**: ${info.question}\\n`;
    });
    analysisText += `\\n`;

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
    analysisText += `### Files and Data Points\\n`;
    fileStats.forEach((file) => {
      analysisText += `- **${file.id}**: ${file.dataPoints} data points, ${file.percentageCount} percentage values\\n`;
    });
    analysisText += `\\n`;

    // Add key percentage data
    analysisText += `### Key Percentage Values\\n\\n`;

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

      analysisText += `#### ${topic}\\n`;

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
        analysisText += `**${question}**\\n`;

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
          analysisText += `- ${category}:\\n`;
          categoryStats.forEach((stat) => {
            analysisText += `  - ${stat.segment}: **${stat.value}%**\\n`;
          });
        });

        analysisText += `\\n`;
      });
    });

    // Add metadata
    analysisText += `### Analysis Metadata\\n`;
    analysisText += `- Total data points: ${dataFiles.metadata.total_data_points}\\n`;
    analysisText += `- Total percentage values: ${percentageStats.length}\\n`;
    analysisText += `- Files analyzed: ${fileStats.length}\\n`;
    analysisText += `- Topics covered: ${matchedTopics.join(", ")}\\n`;

    const endTime = Date.now();
    // if (process.env.DEBUG) {
    //   logger.debug(
    //     `Direct data extraction completed in ${
    //       (endTime - startTime) / 1000
    //     } seconds`
    //   );
    //   logger.debug(
    //     `Extracted ${percentageStats.length} percentage values from ${fileStats.length} files`
    //   );

    //   // Log a preview of the analysis
    //   logger.debug("====== ANALYSIS PREVIEW ======");
    //   logger.debug(analysisText.substring(0, 500) + "...");
    //   logger.debug("=============================");

    //   // Check for percentages in the analysis
    //   const percentageMatches = analysisText.match(/\\d+%/g) || [];
    //   logger.debug(
    //     `Analysis contains ${
    //       percentageMatches.length
    //     } percentage values: ${percentageMatches.slice(0, 5).join(", ")}${
    //       percentageMatches.length > 5 ? "..." : ""
    //     }`
    //   );
    // }

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
  // if (process.env.DEBUG) {
  //   logger.debug(`Retrieving ${fileIds.length} data files...`);
  // }

  // In production on Vercel, read files directly from the file system
  // This avoids API cross-calling issues with authentication
  if (process.env.NODE_ENV === "production") {
    try {
      // if (process.env.DEBUG) {
      //   logger.debug(
      //     "Using direct file system access in production environment"
      //   );
      // }

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

            // if (process.env.DEBUG) {
            //   logger.debug(`Attempting to read file: ${filePath}`);
            // }

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
    // if (process.env.DEBUG) {
    //   logger.debug(
    //     `API response: ${result.files ? result.files.length : 0} files, ${
    //       result.totalDataPoints || 0
    //     } data points`
    //   );
    // }

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
  threadId = "default",
  // Add parameters to receive context from caller
  isFollowUpContext = false,
  previousQueryContext = "",
  previousAssistantResponseContext = ""
) {
  const startTime = performance.now();

  // DIAGNOSTIC LOGGING: Log the received query and starter check
  // logger.info(`[processQueryWithData] Received query: "${query}"`);
  // logger.info(
  //   `[processQueryWithData] isStarterQuestion: ${isStarterQuestion(query)}`
  // );

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

  // === STARTER QUESTION HANDLING ===
  if (isStarterQuestion(query)) {
    // Refactored per starter_question_plan.md
    // 1. Load the starter data
    const starterData = getPrecompiledStarterData(query);
    if (!starterData) {
      return {
        error: `Starter question data not found for code: ${query}`,
        status: "error_starter_not_found",
        processing_time_ms: Math.round(performance.now() - startTime),
      };
    }

    // 2. Validate required fields
    if (
      !starterData.data_files ||
      !Array.isArray(starterData.data_files) ||
      !starterData.segments ||
      !Array.isArray(starterData.segments) ||
      !starterData.question
    ) {
      return {
        error: `Starter data for ${query} is missing required fields (data_files, segments, question)`,
        status: "error_starter_invalid",
        processing_time_ms: Math.round(performance.now() - startTime),
      };
    }

    // 3. Extract fields
    const fileIds = starterData.data_files;
    const segments = starterData.segments;
    const naturalLanguageQuery = starterData.question;
    const matchedTopics = starterData.matched_topics || [];

    // 4. Bypass LLM: do NOT call identifyRelevantFiles
    // 5. Load files based on fileIds
    const fs = require("fs");
    const path = require("path");
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    let files = [];
    for (const fileId of fileIds) {
      const fileName = fileId.endsWith(".json") ? fileId : fileId + ".json";
      const filePath = path.join(dataDir, fileName);
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
        files.push({
          id: fileId.replace(/\\.json$/, ""),
          data: jsonData,
        });
      } catch (e) {
        logger.error(`Error loading file ${filePath}:`, e);
        continue;
      }
    }
    files = files.map((file) => {
      if (Array.isArray(file.data)) {
        return { ...file, data: { responses: file.data } };
      }
      return file;
    });

    // 6. Filter data using segments from starter
    const loadedData = { files };
    let filteredData = getSpecificData(loadedData, { demographics: segments });

    // Ensure filteredData has correct structure
    if (!filteredData) filteredData = { filteredData: [], stats: [] };
    // Ensure filteredData.filteredData is always an array
    if (!Array.isArray(filteredData.filteredData)) {
      filteredData.filteredData = Object.values(
        filteredData.filteredData || {}
      );
      if (!Array.isArray(filteredData.filteredData)) {
        filteredData.filteredData = [];
      }
    }

    // 7. Format statsPreview for the assistant prompt
    function formatStats(stats) {
      if (!Array.isArray(stats) || stats.length === 0)
        return "No data available.";
      let lines = [];
      for (const stat of stats) {
        lines.push(
          `Segment: ${stat.category} | Value: ${stat.value} | Question: ${stat.question} | Response: ${stat.response} | Stat: ${stat.stat} (${stat.formatted})`
        );
      }
      return lines.join("\\n");
    }
    const statsPreview = formatStats(filteredData.filteredData);

    const endTime = performance.now();

    return {
      analysis: "Starter question direct data retrieval",
      filteredData,
      segments,
      dataScope: { segments: new Set(segments) },
      fileIds,
      matchedTopics,
      naturalLanguageQuery,
      statsPreview,
      data_points:
        filteredData && Array.isArray(filteredData.filteredData)
          ? filteredData.filteredData.length
          : 0,
      stats:
        filteredData && Array.isArray(filteredData.filteredData)
          ? filteredData.filteredData
          : [],
      processing_time_ms: Math.round(endTime - startTime),
    };
  }

  // === NORMAL QUESTION HANDLING ===

  // 1. Use OpenAI to identify relevant files (semantic mapping)
  // Pass the received context down to identifyRelevantFiles
  const fileIdResult = await identifyRelevantFiles(
    query,
    context,
    isFollowUpContext,
    previousQueryContext,
    previousAssistantResponseContext
  );

  // --- START DEBUG LOGGING ---
  logger.info("--- Retrieval Step Analysis ---");
  logger.info(`Query: "${query.substring(0, 100)}..."`);
  logger.info(`isFollowUp: ${isFollowUpContext}`); // Use the actual variable name
  logger.info(`Cached File IDs: [${(cachedFileIds || []).join(", ")}]`);
  logger.info(`LLM Result - out_of_scope: ${fileIdResult?.out_of_scope}`);
  logger.info(
    `LLM Result - file_ids: [${(fileIdResult?.file_ids || []).join(", ")}]`
  );
  logger.info(
    `LLM Result - matched_topics: [${(fileIdResult?.matched_topics || []).join(
      ", "
    )}]`
  );
  logger.info(
    `LLM Result - segments: [${(fileIdResult?.segments || []).join(", ")}]`
  );
  logger.info(`LLM Result - explanation: ${fileIdResult?.explanation}`);
  logger.info("-----------------------------");
  // --- END DEBUG LOGGING ---

  // === OUT OF SCOPE HANDLING (Revised) ===
  if (fileIdResult && fileIdResult.out_of_scope === true) {
    // The prompt no longer includes the message, so the backend handles it.
    // The 'explanation' field from fileIdResult might be useful for logging.
    logger.warn(
      `[processQueryWithData] Query flagged as out_of_scope by initial check. Explanation: ${fileIdResult.explanation}`
    );
    return {
      out_of_scope: true,
      // Standard rejection message generated here by the backend
      out_of_scope_message:
        "I'm a workforce insights specialist. Your question is outside my scope. I can help with any queries you have related to the workforce.",
      explanation:
        fileIdResult.explanation ||
        "Query determined out of scope by initial analysis.", // Keep explanation for internal use
    };
  }

  // If not out_of_scope, proceed with loading files and filtering...
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

  // 2. Load only the relevant files
  const fs = require("fs");
  const path = require("path");
  const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");

  // DEBUG: Log the data directory path and check if it exists
  // logger.info(`[DEBUG FILES] Data directory path: ${dataDir}`);
  // logger.info(`[DEBUG FILES] Data directory exists: ${fs.existsSync(dataDir)}`);
  // if (fs.existsSync(dataDir)) {
  //   try {
  //     const dirContents = fs.readdirSync(dataDir);
  //     logger.info(
  //       `[DEBUG FILES] Data directory contains ${dirContents.length} files`
  //     );
  //     logger.info(
  //       `[DEBUG FILES] First 5 files: ${dirContents.slice(0, 5).join(", ")}`
  //     );
  //   } catch (dirError) {
  //     logger.error(
  //       `[DEBUG FILES] Error reading data directory: ${dirError.message}`
  //     );
  //   }
  // }

  // Log the file IDs we're trying to load
  // logger.info(
  //   `[DEBUG FILES] Attempting to load ${fileIds.length} files: ${fileIds.join(
  //     ", "
  //   )}`
  // );

  let files = [];
  // if (process.env.DEBUG) {
  //   logger.debug("=== DEBUG: File loading step ===");
  //   logger.debug("File IDs returned by LLM:", fileIds);
  // }

  // Ensure we have valid file IDs - validate before attempting to load
  const validFileIds = fileIds.filter(
    (id) => id && typeof id === "string" && id.trim() !== ""
  );

  if (validFileIds.length === 0) {
    logger.warn("[RETRIEVAL] No valid file IDs to process.");
  }

  // Process each valid file ID
  for (const fileId of validFileIds) {
    const fileName = fileId.endsWith(".json") ? fileId : fileId + ".json";
    const filePath = path.join(dataDir, fileName);

    // DEBUG: Log each file path and existence check
    // logger.info(`[DEBUG FILES] Checking file: ${filePath}`);
    // logger.info(`[DEBUG FILES] File exists: ${fs.existsSync(filePath)}`);

    // if (process.env.DEBUG) {
    //   logger.debug(`Attempting to load file: ${filePath}`);
    // }
    try {
      if (!fs.existsSync(filePath)) {
        logger.error(`File does not exist: ${filePath}`);
        continue;
      }
      const fileContent = fs.readFileSync(filePath, "utf8");

      // DEBUG: Log file size
      // logger.info(
      //   `[DEBUG FILES] Successfully read file: ${filePath}, size: ${fileContent.length} bytes`
      // );

      let jsonData;
      try {
        jsonData = JSON.parse(fileContent);
        // logger.info(
        //   `[DEBUG FILES] Successfully parsed JSON from file: ${filePath}`
        // );
      } catch (parseErr) {
        logger.error(`JSON parse error for file ${filePath}:`, parseErr);
        continue;
      }
      // Log structure of loaded data
      // if (process.env.DEBUG && jsonData && typeof jsonData === "object") {
      //   if (Array.isArray(jsonData.responses)) {
      //     logger.debug(
      //       `File ${fileName} loaded. responses[] length: ${jsonData.responses.length}`
      //     );
      //   } else if (Array.isArray(jsonData.data)) {
      //     logger.debug(
      //       `File ${fileName} loaded. data[] length: ${jsonData.data.length}`
      //     );
      //   } else {
      //     logger.debug(
      //       `File ${fileName} loaded. Top-level keys:`,
      //       Object.keys(jsonData)
      //     );
      //   }
      // }
      files.push({
        id: fileId.replace(/\\.json$/, ""),
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
  // if (files.length > 0) {
  //   const first = files[0];
  //   if (first.data && typeof first.data === "object") {
  //     logger.debug(
  //       "UNCONDITIONAL LOG: file.data keys:",
  //       Object.keys(first.data)
  //     );
  //     if (Array.isArray(first.data.responses)) {
  //       const resp0 = first.data.responses[0];
  //       if (resp0 && typeof resp0 === "object") {
  //         logger.debug(
  //           "UNCONDITIONAL LOG: first.data.responses[0] keys:",
  //           Object.keys(resp0)
  //         );
  //         // Print a shallow preview, not the full object
  //         const preview = JSON.stringify(resp0, null, 2);
  //         logger.debug(
  //           "UNCONDITIONAL LOG: first.data.responses[0] preview:",
  //           preview.length > 200
  //             ? preview.substring(0, 200) + " ... (truncated)"
  //             : preview
  //         );
  //       } else {
  //         logger.debug("UNCONDITIONAL LOG: first.data.responses[0]:", resp0);
  //       }
  //     }
  //   } else {
  //     logger.debug(
  //       "UNCONDITIONAL LOG: first file data is not an object:",
  //       typeof first.data
  //     );
  //   }
  // }
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

  // Ensure filteredData has correct structure
  if (!filteredData) filteredData = { filteredData: [], stats: [] };

  // Ensure filteredData.filteredData is always an array
  if (!filteredData.filteredData) filteredData.filteredData = [];
  if (!Array.isArray(filteredData.filteredData)) {
    logger.error(
      `[ERROR] filteredData.filteredData is not an array: ${typeof filteredData.filteredData}`
    );
    filteredData.filteredData = [];
  }

  // Add debug info about filteredData.filteredData and fix array check
  // If filteredData.filteredData is not an array, use filteredData.stats or just set to empty array
  if (filteredData.filteredData && !Array.isArray(filteredData.filteredData)) {
    logger.error(
      `[FIX] filteredData.filteredData is not an array, fixing structure`
    );
    // Extract stats data from whatever is available
    filteredData.filteredData = Array.isArray(filteredData.stats)
      ? filteredData.stats
      : [];
  }

  // console.log(
  //   "[processQueryWithData] Extracted",
  //   filteredData.filteredData ? filteredData.filteredData.length : 0,
  //   "stats items from getSpecificData result"
  // );

  // 5. Prepare result object
  const endTime = performance.now();

  // DEBUG: Log filteredData for inspection
  // if (process.env.DEBUG) {
  //   logger.debug(
  //     "=== DEBUG: filteredData being returned from processQueryWithData ==="
  //   );
  //   try {
  //     logger.debug(
  //       JSON.stringify(filteredData, null, 2).substring(0, 2000) +
  //         (JSON.stringify(filteredData).length > 2000 ? "... (truncated)" : "")
  //     );
  //   } catch (e) {
  //     logger.debug("Could not stringify filteredData for debug log.");
  //   }
  //   logger.debug(
  //     "==================================================================="
  //   );
  // }

  // ENHANCED LOGGING: If no stats found, log available vs requested segments for debugging
  if (filteredData.stats.length === 0 && loadedData.files.length > 0) {
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
      "\\nRequested segments:",
      segments,
      "\\nAvailable segments in first file:",
      availableSegments
    );
  }

  return {
    analysis: "LLM-driven file identification and smart filtering result",
    filteredData,
    stats: filteredData.stats, // Include stats directly at the top level
    segments,
    dataScope,
    fileIds: validFileIds,
    matchedTopics,
    explanation,
    data_points: filteredData.stats.length,
    processing_time_ms: Math.round(endTime - startTime),
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
