// OpenAI Integration for Data Retrieval System
// This file implements the OpenAI integration for identifying relevant files and generating analysis

import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for the canonical topic mapping to avoid repeated file reads
let canonicalTopicMapping = null;

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
 * Identify relevant data files based on a user query
 * @param {string} query - The user's query
 * @returns {Promise<{file_ids: string[], explanation: string}>} - The identified file IDs and explanation
 */
export async function identifyRelevantFiles(query) {
  try {
    // Load the canonical topic mapping for more accurate file identification
    const mapping = loadCanonicalTopicMapping();

    // Extract only the necessary data for file identification to reduce token usage
    const simplifiedMapping = {
      themes: mapping.themes.map((theme) => ({
        name: theme.name,
        topics: theme.topics.map((topic) => ({
          id: topic.id,
          canonicalQuestion: topic.canonicalQuestion,
          alternatePhrasings: topic.alternatePhrasings,
          mapping: topic.mapping,
        })),
      })),
    };

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert data analyst specialized in workforce survey data. 
Your task is to identify which data files are needed to answer the user's query by matching with topics in the canonical topic mapping.

Here's how the mapping works:
1. The canonical topic mapping contains themes, topics, and their corresponding data files
2. Each topic has a canonical question and alternate phrasings that can be used to match with user queries
3. For matching topics, you should include ALL linked files for both 2024 and 2025 to ensure comprehensive data

Always identify topics conceptually - don't just look for exact keyword matches. Identify ALL potentially relevant topics.

ONLY return the file IDs needed (without .json extension) - do not attempt to answer the question.`,
        },
        {
          role: "user",
          content: `Here is the canonical topic structure:
${JSON.stringify(simplifiedMapping, null, 2)}

My query is: "${query}"

Please identify the most relevant topics and their associated file IDs.`,
        },
      ],
      functions: [
        {
          name: "identify_files",
          description: "Identify the data files needed to answer the query",
          parameters: {
            type: "object",
            properties: {
              file_ids: {
                type: "array",
                items: { type: "string" },
                description:
                  "Array of file IDs needed to answer the query (without .json extension)",
              },
              matched_topics: {
                type: "array",
                items: { type: "string" },
                description: "Array of topic IDs that matched the query",
              },
              explanation: {
                type: "string",
                description:
                  "Brief explanation of why these topics and files were chosen",
              },
            },
            required: ["file_ids", "matched_topics"],
          },
        },
      ],
      function_call: { name: "identify_files" },
      temperature: 0.1, // Use lower temperature for more consistent matching
    });

    const functionCall = response.choices[0].message.function_call;
    if (!functionCall) {
      throw new Error("Failed to identify relevant files");
    }

    return JSON.parse(functionCall.arguments);
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
  // Create a more concise data representation to save tokens
  const formattedData = {
    files: dataFiles.files.map((file) => {
      return {
        id: file.id,
        data: file.data,
        error: file.error,
      };
    }),
    metadata: {
      dataPointCount: dataFiles.metadata.total_data_points,
      fileCount: dataFiles.metadata.succeeded,
    },
  };

  return formattedData;
}

/**
 * Generate analysis based on a query and retrieved data files
 * @param {string} query - The user's query
 * @param {object} dataFiles - The retrieved data files
 * @param {array} matchedTopics - Topics that matched the query
 * @returns {Promise<string>} - The generated analysis
 */
export async function generateAnalysis(query, dataFiles, matchedTopics) {
  try {
    // Load the canonical topic mapping to provide question context
    const mapping = loadCanonicalTopicMapping();

    // Extract the canonical questions for matched topics
    const topicQuestions = [];
    for (const theme of mapping.themes) {
      for (const topic of theme.topics) {
        if (matchedTopics.includes(topic.id)) {
          topicQuestions.push({
            topic: topic.id,
            theme: theme.name,
            question: topic.canonicalQuestion,
          });
        }
      }
    }

    // Format data efficiently
    const formattedData = formatDataForAnalysis(dataFiles);

    const startTime = Date.now();
    console.log(
      "Starting analysis generation at",
      new Date(startTime).toISOString()
    );

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a workforce analytics expert analyzing survey data.

CRITICAL REQUIREMENTS:
1. ONLY use percentage values that ACTUALLY APPEAR in the provided data files.
2. NEVER fabricate data or use rounded estimates - use EXACT numbers from the data.
3. NEVER report a percentage not explicitly found in the data files.
4. For strategic questions, analyze ALL available countries with data.
5. Format your response with clear sections and headers.
6. Bold important percentages using **X%** format.
7. Follow the TWO SEGMENT RULE: Never combine demographic segments in analysis (e.g., don't analyze country+age together).
8. Highlight significant findings and patterns in the data.
9. Double-check all percentages before including them - they MUST exist in the data files.

FORMAT REQUIREMENTS:
- Use markdown format with headers (###) for main sections
- Format data in easy-to-read lists or tables
- Bold key statistics using **X%** format
- Include a brief conclusion summarizing key findings

The matched topics for this query are:
${JSON.stringify(topicQuestions, null, 2)}

The complete data files have been provided to you. Use ONLY this data.`,
        },
        { role: "user", content: query },
        {
          role: "assistant",
          content:
            "I'll analyze this query using only the exact values from the provided data files.",
        },
        {
          role: "user",
          content: `Here are the complete data files you need for analysis: ${JSON.stringify(
            formattedData
          )}`,
        },
      ],
      temperature: 0.2, // Lower temperature for more factual responses
      max_tokens: 2000, // Set reasonable limit to prevent excessive processing time
    });

    const endTime = Date.now();
    console.log(
      `Analysis generation completed in ${(endTime - startTime) / 1000} seconds`
    );

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating analysis:", error);
    throw error;
  }
}

/**
 * Process a query using the two-step retrieval approach
 * @param {string} query - The user's query
 * @returns {Promise<object>} - The processed result
 */
export async function processQueryWithData(query) {
  const startTime = Date.now();
  console.log(
    `Starting query processing at ${new Date(startTime).toISOString()}`
  );

  try {
    // Step 1: Identify relevant files
    console.log("Step 1: Identifying relevant files...");
    const { file_ids, matched_topics, explanation } =
      await identifyRelevantFiles(query);
    console.log(
      `Identified ${file_ids.length} files for topics: ${matched_topics.join(
        ", "
      )}`
    );
    console.log(`Explanation: ${explanation}`);

    if (!file_ids.length) {
      return {
        analysis:
          "No relevant data files were identified for your query. Please try a different question related to workforce trends, leadership, skills, or employee experience.",
        validation: { valid: true },
        files_used: [],
        matched_topics: matched_topics || [],
        data_points: 0,
        processing_time_ms: Date.now() - startTime,
      };
    }

    // Step 2: Retrieve the files
    console.log("Step 2: Retrieving data files...");
    const fileRetrievalStart = Date.now();

    const apiUrl =
      process.env.NODE_ENV === "production"
        ? `${
            process.env.VERCEL_URL || "https://ria25.vercel.app"
          }/api/retrieve-data`
        : "http://localhost:3000/api/retrieve-data";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids }),
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve files: ${response.status}`);
    }

    const dataFiles = await response.json();
    console.log(
      `Retrieved ${dataFiles.metadata.succeeded} files with ${
        dataFiles.metadata.total_data_points
      } data points in ${(Date.now() - fileRetrievalStart) / 1000} seconds`
    );

    // Check if we actually got data
    const successfulFiles = dataFiles.files.filter((f) => !f.error);
    if (successfulFiles.length === 0) {
      return {
        analysis:
          "The system identified relevant files but was unable to retrieve them. This may be due to a technical issue or because the files don't exist in the current data collection.",
        validation: { valid: true },
        files_used: file_ids,
        matched_topics,
        data_points: 0,
        processing_time_ms: Date.now() - startTime,
      };
    }

    // Step 3: Generate analysis with complete data
    console.log("Step 3: Generating analysis...");
    const analysis = await generateAnalysis(query, dataFiles, matched_topics);

    // Step 4: Validate the analysis
    console.log("Step 4: Validating analysis...");
    let validationResult = { valid: true }; // Default if validation module is not yet integrated

    try {
      // Dynamic import to avoid circular dependencies
      const { validateAnalysis } = await import(
        "../validation/data-validation"
      );
      validationResult = validateAnalysis(analysis, dataFiles);
    } catch (error) {
      console.warn("Validation module not available:", error);
    }

    const totalTime = Date.now() - startTime;
    console.log(`Query processing completed in ${totalTime / 1000} seconds`);

    return {
      analysis,
      validation: validationResult,
      files_used: file_ids,
      matched_topics,
      data_points: dataFiles.metadata.total_data_points,
      processing_time_ms: totalTime,
    };
  } catch (error) {
    console.error("Error processing query:", error);
    const errorTime = Date.now() - startTime;

    return {
      analysis: `An error occurred while processing your query: ${error.message}`,
      validation: { valid: false, error: error.message },
      files_used: [],
      matched_topics: [],
      data_points: 0,
      processing_time_ms: errorTime,
      error: error.message,
    };
  }
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
