// OpenAI Integration for Data Retrieval System
// This file implements the data retrieval and OpenAI analysis integration

import OpenAI from "openai";
import fs from "fs";
import path from "path";

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

// Cache for the canonical topic mapping to avoid repeated file reads
let canonicalTopicMapping = null;

// Cache for query results to avoid repeated OpenAI calls for similar queries
const queryCache = new Map();

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
    console.log("Canonical topic mapping loaded and cached");
    return canonicalTopicMapping;
  } catch (error) {
    console.error("Error loading canonical topic mapping:", error);
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
      console.log("Using cached query results");
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
      console.log("Raw response content:", content.substring(0, 100) + "...");
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
      console.error("JSON parse error in response content:", parseError);
      console.error("Content that failed to parse:", content);

      // Provide a fallback result
      return {
        file_ids: [],
        matched_topics: [],
        explanation: "Error parsing OpenAI response: " + parseError.message,
      };
    }
  } catch (error) {
    console.error("Error identifying relevant files:", error);
    throw error;
  }
}

/**
 * Format data files for efficient analysis
 * @param {object} dataFiles - The raw data files
 * @returns {object} - Formatted data files optimized for OpenAI processing
 */
function formatDataForAnalysis(dataFiles) {
  console.log("Formatting data for analysis...");

  try {
    // Create a simplified data representation that EXPLICITLY includes percentages
    const formattedData = {
      files: dataFiles.files.map((file) => {
        // Skip files with errors
        if (file.error || !file.data || !Array.isArray(file.data)) {
          console.log(`Skipping file ${file.id} due to error or missing data`);
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

        console.log(
          `File ${file.id}: Found ${percentageCount} percentage values in ${percentageData.length} data points`
        );

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

    console.log(
      `Total: ${totalPercentageValues} percentage values in ${totalDataPointsWithPercentages} data points`
    );
    formattedData.metadata.percentageCount = totalPercentageValues;

    return formattedData;
  } catch (error) {
    console.error("Error in formatDataForAnalysis:", error);
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
    console.log(
      "Starting direct data extraction at",
      new Date(startTime).toISOString()
    );

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
    console.log(
      `Direct data extraction completed in ${
        (endTime - startTime) / 1000
      } seconds`
    );
    console.log(
      `Extracted ${percentageStats.length} percentage values from ${fileStats.length} files`
    );

    // Log a preview of the analysis
    console.log("====== ANALYSIS PREVIEW ======");
    console.log(analysisText.substring(0, 500) + "...");
    console.log("=============================");

    // Check for percentages in the analysis
    const percentageMatches = analysisText.match(/\d+%/g) || [];
    console.log(
      `Analysis contains ${
        percentageMatches.length
      } percentage values: ${percentageMatches.slice(0, 5).join(", ")}${
        percentageMatches.length > 5 ? "..." : ""
      }`
    );

    return analysisText;
  } catch (error) {
    console.error("Error generating direct data analysis:", error);
    return `Error extracting data: ${error.message}`;
  }
}

/**
 * Retrieve data files from the API
 * @param {string[]} fileIds - Array of file IDs to retrieve
 * @returns {Promise<object>} - The retrieved data
 */
export async function retrieveDataFiles(fileIds) {
  console.log(`Retrieving ${fileIds.length} data files...`);

  // In production on Vercel, read files directly from the file system
  // This avoids API cross-calling issues with authentication
  if (process.env.NODE_ENV === "production") {
    try {
      console.log("Using direct file system access in production environment");

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

            console.log(`Attempting to read file: ${filePath}`);

            // Ensure file exists
            if (!fs.existsSync(filePath)) {
              console.error(`File not found: ${filePath}`);
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
            console.error(`Error retrieving file ${fileId}:`, error);
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
      console.error("Error with direct file access:", error);
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
    console.log(
      `API response: ${result.files ? result.files.length : 0} files, ${
        result.totalDataPoints || 0
      } data points`
    );

    // Return the retrieved data in the expected format
    return {
      files: result.files || [],
      topics: result.topics || [],
      totalDataPoints: result.totalDataPoints || 0,
    };
  } catch (error) {
    console.error("Error retrieving data files:", error);
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
export async function processQueryWithData(query, context, cachedFileIds = []) {
  const startTime = performance.now();

  // Immediate early return for empty queries
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

  // Check cached files first - if we have them, prioritize fast response
  if (cachedFileIds && cachedFileIds.length > 0) {
    // Fast path for follow-up queries with cached files
    console.log(
      `Using thread continuity with ${cachedFileIds.length} cached files`
    );

    return {
      analysis: "Using existing thread data for your follow-up question",
      matched_topics: [],
      files_used: cachedFileIds,
      file_ids: cachedFileIds,
      data_points: cachedFileIds.length,
      status: "thread_continuity",
      processing_time_ms: Math.round(performance.now() - startTime),
    };
  }

  // Check if we're in direct mode - if so, we ONLY identify files, not extract data
  const isDirectMode = process.env.FILE_ACCESS_MODE === "direct";
  if (isDirectMode) {
    console.log(
      "⭐⭐⭐ DIRECT MODE: processQueryWithData is skipping data extraction"
    );

    // Only identify files but don't retrieve them
    const fileIdsResult = await identifyRelevantFiles(query, context);
    const fileIdArray = fileIdsResult?.file_ids || [];

    // Merge with cached files (avoid duplicates)
    const allRelevantFileIds = Array.from(
      new Set([...(cachedFileIds || []), ...(fileIdArray || [])])
    );

    // Return only the file IDs without retrieving data
    return {
      file_ids: allRelevantFileIds,
      matched_topics: fileIdsResult.matched_topics || [],
      files_used: allRelevantFileIds,
      data_points: allRelevantFileIds.length,
      analysis:
        "DIRECT MODE: Analysis will be performed by the assistant directly using the provided file IDs.",
      processing_time_ms: Math.round(performance.now() - startTime),
    };
  }

  // Standard mode - continue with full data retrieval and processing
  // Thread-based data continuity approach
  // If we have cached files for this thread, we apply thread continuity principles
  if (cachedFileIds && cachedFileIds.length > 0) {
    console.log(`Thread has ${cachedFileIds.length} cached files`);

    // PRINCIPLE 1: Topic-based cache validation
    // Check if this query needs additional data files that aren't in the cache
    // First, try to identify what files this query would typically need
    const topicFileIds = await identifyRelevantFiles(query, context);
    const potentiallyNeededFileIds = topicFileIds?.file_ids || [];

    // PRINCIPLE 2: Additional data detection
    // Check if we need any files that aren't in our cache
    const missingFileIds = potentiallyNeededFileIds.filter(
      (id) => !cachedFileIds.includes(id)
    );

    console.log(`Thread continuity analysis:
      - Cached files: ${cachedFileIds.length}
      - Potentially needed files: ${potentiallyNeededFileIds.length} 
      - Missing files: ${missingFileIds.length}`);

    // PRINCIPLE 3: If no files are needed or if the needed files are all in cache
    // Use existing thread data
    if (missingFileIds.length === 0 || potentiallyNeededFileIds.length === 0) {
      // No new files needed - use cached data
      // Note: potentiallyNeededFileIds.length === 0 means the query doesn't map to specific files
      // This happens with follow-ups, generic prompts, etc. - use thread continuity
      console.log(`Using thread continuity - this query will use cached files`);

      return {
        analysis: "Using existing thread data",
        matched_topics: [],
        files_used: cachedFileIds,
        file_ids: cachedFileIds,
        raw_data: "Using cached thread data",
        data_points: cachedFileIds.length,
        status: "thread_continuity",
        processing_time_ms: Math.round(performance.now() - startTime),
      };
    } else {
      // We need to get additional data files
      console.log(
        `This query needs ${missingFileIds.length} additional data files beyond what's in the thread`
      );

      // Continue with retrieval below, but only for the missing files
      // We'll merge with existing files later
    }
  }

  // If we don't have cached files or need additional files, proceed with identification
  console.log("Step 1: Identifying relevant files...");
  const fileIdsResult = await identifyRelevantFiles(query, context);

  // If result is an object with file_ids property, extract it; otherwise assume it's an array
  let fileIdArray = [];
  if (
    fileIdsResult &&
    typeof fileIdsResult === "object" &&
    fileIdsResult.file_ids
  ) {
    fileIdArray = fileIdsResult.file_ids;
  } else if (Array.isArray(fileIdsResult)) {
    fileIdArray = fileIdsResult;
  }

  console.log(`File IDs for retrieval: ${JSON.stringify(fileIdArray)}`);

  // If we have cached files, only retrieve the new ones
  let newFileIds = [];
  if (cachedFileIds.length > 0) {
    newFileIds = fileIdArray.filter((id) => !cachedFileIds.includes(id));
    console.log(`New file IDs to retrieve: ${JSON.stringify(newFileIds)}`);
  } else {
    newFileIds = fileIdArray;
  }

  if (
    (!fileIdArray || fileIdArray.length === 0) &&
    cachedFileIds.length === 0
  ) {
    // No files identified and no cached files - can't proceed
    console.log("No relevant files identified for query and no cached context");
    return {
      analysis:
        "I couldn't find any relevant data to answer your question. Please try asking about workforce trends, employee preferences, or organizational challenges.",
      matched_topics: [],
      files_used: [],
      file_ids: [],
      data_points: 0,
      status: "no_data",
    };
  } else if (
    (!fileIdArray || fileIdArray.length === 0) &&
    cachedFileIds.length > 0
  ) {
    // No new files identified but we have cached files - use thread continuity
    console.log(
      "No new files identified - using thread continuity with existing cached files"
    );
    return {
      analysis: "Using existing thread data for your question",
      matched_topics: [],
      files_used: cachedFileIds,
      file_ids: cachedFileIds,
      raw_data: "Using cached thread data",
      data_points: cachedFileIds.length,
      status: "thread_continuity",
      processing_time_ms: Math.round(performance.now() - startTime),
    };
  }

  // Step 2: Retrieve the files
  console.log("Step 2: Retrieving data files...");
  const retrievalStartTime = performance.now();

  let retrievedData;
  try {
    // Only retrieve new files if we have cached files, otherwise retrieve all
    if (cachedFileIds.length > 0 && newFileIds.length > 0) {
      console.log(
        `📥 RETRIEVING ${newFileIds.length} NEW FILES (already have ${cachedFileIds.length} cached)`
      );
      retrievedData = await retrieveDataFiles(newFileIds);
    } else if (newFileIds.length > 0) {
      console.log(
        `📥 RETRIEVING ALL ${newFileIds.length} FILES (no cache available)`
      );
      retrievedData = await retrieveDataFiles(newFileIds);
    } else {
      console.log("⚠️ NO FILES TO RETRIEVE - this shouldn't normally happen");
      // Create a placeholder for retrievedData since we're using only cached files
      retrievedData = {
        topics: [],
        totalDataPoints: cachedFileIds.length,
        data: {},
        files: [],
      };
    }
  } catch (error) {
    console.error("Error retrieving data files:", error);
    return {
      error: `Failed to retrieve data: ${error.message}`,
      status: "error",
    };
  }

  const retrievalEndTime = performance.now();
  console.log(
    `Retrieved ${retrievedData.files.length} files with ${
      retrievedData.totalDataPoints
    } data points in ${((retrievalEndTime - retrievalStartTime) / 1000).toFixed(
      3
    )} seconds`
  );

  if (!retrievedData.files || retrievedData.files.length === 0) {
    return {
      analysis:
        "I was able to identify relevant topics, but couldn't access the data files. Please try again or ask a different question.",
      matched_topics: [],
      files_used: fileIdArray,
      data_points: 0,
      status: "no_data",
    };
  }

  // Step 3: Prepare response for the assistant
  console.log("Step 3: Preparing response for assistant...");

  // Extract the important data from each file for analysis - OPTIMIZED to reduce payload size
  const raw_data = [];

  // Limit the number of files processed to reduce payload size
  const maxFilesToProcess = 8; // Reduced to process only most relevant files
  const filesToProcess = retrievedData.files.slice(0, maxFilesToProcess);

  // Process files in parallel for faster execution
  await Promise.all(
    filesToProcess.map(async (file) => {
      try {
        if (!file.data) {
          console.warn(`File ${file.id} has no data`);
          return;
        }

        // Create a direct simplified representation of the data
        // This avoids any nested extraction issues
        const extractedData = {
          file_id: file.id,
          topic:
            file.topic ||
            (file.data.metadata ? file.data.metadata.topicId : "Unknown"),
          question: file.data.question || "No question available",
          responses: [],
        };

        // Extract response data directly
        if (file.data.responses && Array.isArray(file.data.responses)) {
          // Create a more formatted representation with the question prominently displayed
          extractedData.question_text = `SURVEY QUESTION: ${
            file.data.question || "No question available"
          }`;

          // Add an array to store summarized top responses
          extractedData.top_responses = [];

          file.data.responses.forEach((response) => {
            if (response) {
              const simplifiedResponse = {
                text: response.response,
                data: {},
              };

              // Track highest value for this response to determine if it's a top response
              let highestValue = 0;

              // Directly extract percentage values without nesting
              if (response.data) {
                Object.entries(response.data).forEach(([category, values]) => {
                  // Filter based on context
                  const shouldIncludeCategory =
                    context === "all" ||
                    (context === "sectors" && category === "sector") ||
                    (context === "all-sector" && category !== "sector") ||
                    (context !== "sectors" &&
                      context !== "all" &&
                      context !== "all-sector" &&
                      category !== "sector");

                  if (
                    shouldIncludeCategory &&
                    values &&
                    typeof values === "object"
                  ) {
                    Object.entries(values).forEach(([key, value]) => {
                      // Store as flat key-value pair for simplicity
                      simplifiedResponse.data[`${category}_${key}`] = value;

                      // Track highest value
                      if (typeof value === "number" && value > highestValue) {
                        highestValue = value;
                      }
                    });
                  }
                });
              }

              // Only add responses that have data after filtering
              if (Object.keys(simplifiedResponse.data).length > 0) {
                extractedData.responses.push(simplifiedResponse);

                // Add to top responses if value is high (over 80%)
                if (highestValue >= 80) {
                  extractedData.top_responses.push({
                    text: response.response,
                    highest_value: highestValue,
                  });
                }
              }
            }
          });

          // Sort top responses by highest value
          extractedData.top_responses.sort(
            (a, b) => b.highest_value - a.highest_value
          );
        }

        // Only add files that have responses after filtering
        if (extractedData.responses.length > 0) {
          raw_data.push(extractedData);
          console.log(
            `Successfully extracted data from file ${file.id}: ${extractedData.responses.length} responses`
          );
        } else {
          console.log(
            `File ${file.id} had no relevant responses for context: ${context}`
          );
        }
      } catch (error) {
        console.error(`Error processing file data: ${error.message}`);
      }
    })
  );

  console.log(
    `Extracted data from ${raw_data.length} files for context: ${context}`
  );
  if (raw_data.length > 0) {
    const sampleFile = raw_data[0];
    const responseCount = sampleFile.responses?.length || 0;
    console.log(
      `Sample file ${sampleFile.file_id} has ${responseCount} responses with percentage data`
    );

    if (responseCount > 0) {
      const percentageKeys = Object.keys(sampleFile.responses[0].data || {});
      console.log(
        `First response has ${percentageKeys.length} percentage values`
      );
      if (percentageKeys.length > 0) {
        console.log(
          `Example percentages: ${percentageKeys.slice(0, 3).join(", ")}`
        );
      }
    }
  }

  // DIRECT FILE WRITING - save the raw data immediately
  const fs = require("fs");
  const path = require("path");

  try {
    // Only save debug files in development mode
    if (process.env.NODE_ENV === "development") {
      // Create a timestamp for unique filenames
      const timestamp = Date.now();

      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Save the raw data directly
      const rawDataPath = path.join(logsDir, `raw-data-${timestamp}.json`);
      fs.writeFileSync(rawDataPath, JSON.stringify(raw_data, null, 2), "utf8");
      console.log(`DIRECTLY SAVED RAW DATA TO: ${rawDataPath}`);

      // Save query metadata
      const metadataPath = path.join(
        logsDir,
        `query-metadata-${timestamp}.json`
      );
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(
          {
            query,
            topics: retrievedData.topics,
            files_used: fileIdArray,
            total_data_points: retrievedData.totalDataPoints,
            timestamp: new Date().toISOString(),
            context: context,
          },
          null,
          2
        ),
        "utf8"
      );
      console.log(`DIRECTLY SAVED QUERY METADATA TO: ${metadataPath}`);
    }
  } catch (error) {
    console.error("Error directly saving files:", error);
  }

  // Format simple response with key information about the data
  const analysis = `# Workforce Survey Data for "${query}"

Found data on topics: ${retrievedData.topics.join(", ")}.
Files used: ${fileIdArray.join(", ")}.
Total data points: ${retrievedData.totalDataPoints}.

## Survey Questions Overview:
${raw_data
  .map((file) => {
    let questionInfo = `### ${
      file.question_text || file.question || "Unknown Question"
    }
From file: ${file.file_id} (${file.topic})
Responses: ${file.responses ? file.responses.length : 0} options`;

    // Add top responses if available
    if (file.top_responses && file.top_responses.length > 0) {
      questionInfo += `\n\nTop responses (highest % agreement):`;
      file.top_responses.slice(0, 5).forEach((resp) => {
        questionInfo += `\n- ${resp.text} (up to ${resp.highest_value}%)`;
      });
    }

    return questionInfo;
  })
  .join("\n\n")}

The raw data below contains all relevant information from our workforce survey database. Please use this to provide accurate insights about ${query}.`;

  const endTime = performance.now();
  console.log(
    `Query processing completed in ${((endTime - startTime) / 1000).toFixed(
      2
    )} seconds`
  );

  // Return the data for the assistant
  return {
    analysis,
    matched_topics: retrievedData.topics,
    files_used: fileIdArray,
    data_points: retrievedData.totalDataPoints,
    raw_data: raw_data, // Include the raw data in the response
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
    console.error("Error processing query:", error);
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
    console.log(`Loaded prompt from ${originalPromptPath}`);
    return fs.readFileSync(originalPromptPath, "utf8");
  } catch (error) {
    console.log(
      `Error loading original prompt: ${error.message}, trying fallback locations...`
    );
    // Try public folder as fallback
    try {
      const publicPromptPath = path.join(
        process.cwd(),
        "public",
        "prompts",
        `${promptName}.md`
      );
      console.log(`Trying fallback prompt from ${publicPromptPath}`);
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
        console.log(
          `Trying alternative fallback prompt from ${altPublicPromptPath}`
        );
        return fs.readFileSync(altPublicPromptPath, "utf8");
      } catch (altFallbackError) {
        console.error(
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
