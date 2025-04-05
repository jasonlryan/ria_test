// OpenAI Integration for Data Retrieval System
// This file implements the OpenAI integration for identifying relevant files and generating analysis

import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Identify relevant data files based on a user query
 * @param {string} query - The user's query
 * @returns {Promise<{file_ids: string[], explanation: string}>} - The identified file IDs and explanation
 */
export async function identifyRelevantFiles(query) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert data analyst specialized in workforce survey data. 
Your task is to identify which data files are needed to answer the user's query.

The data files follow this pattern: [YEAR]_[SECTION_NUMBER] or [YEAR]_[SECTION_NUMBER]_[SUBSECTION]
Example: 2025_1.json, 2025_5_7.json

Available data categories include:
- Leadership and confidence
- AI impact and future of work
- Remote/hybrid work
- Organizational agility
- Innovation capability
- Skills and career development
- Employee engagement and satisfaction
- Workplace culture
- Global competitiveness

ONLY return the file IDs needed (without .json extension) - do not attempt to answer the question.
Choose files that are MOST likely to contain relevant data for the query.
When in doubt, include more files rather than fewer.

Example response:
For query "Leadership confidence in UK vs US":
{
  "file_ids": ["2025_1", "2025_2", "2025_3"],
  "explanation": "These files contain leadership confidence data across countries which would include UK and US comparisons."
}`,
        },
        { role: "user", content: query },
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
              explanation: {
                type: "string",
                description: "Brief explanation of why these files were chosen",
              },
            },
            required: ["file_ids"],
          },
        },
      ],
      function_call: { name: "identify_files" },
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
 * Generate analysis based on a query and retrieved data files
 * @param {string} query - The user's query
 * @param {object} dataFiles - The retrieved data files
 * @returns {Promise<string>} - The generated analysis
 */
export async function generateAnalysis(query, dataFiles) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a workforce analytics expert analyzing survey data.
CRITICAL REQUIREMENTS:
1. ONLY use percentage values that ACTUALLY APPEAR in the provided data files.
2. NEVER fabricate data or use rounded estimates.
3. For strategic questions, analyze ALL available countries with data.
4. Format your response with clear sections and headers.
5. Bold important percentages using **X%** format.
6. Remember, users can verify if you're using real data, so be accurate.
7. Follow the TWO SEGMENT RULE: Never combine demographic segments in analysis (e.g., don't analyze country+age together).
8. Highlight significant findings and patterns in the data.

The complete data files have been provided to you. Use ONLY this data.`,
        },
        { role: "user", content: query },
        {
          role: "assistant",
          content: "I'll analyze this query using the provided data files.",
        },
        {
          role: "user",
          content: `Here are the complete data files you need for analysis: ${JSON.stringify(
            dataFiles
          )}`,
        },
      ],
      temperature: 0.2, // Lower temperature for more factual responses
    });

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
  try {
    // Step 1: Identify relevant files
    const { file_ids, explanation } = await identifyRelevantFiles(query);
    console.log(`Identified files: ${file_ids.join(", ")}`);
    console.log(`Explanation: ${explanation}`);

    // Step 2: Retrieve the files
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
      `Retrieved ${dataFiles.metadata.succeeded} files with ${dataFiles.metadata.total_data_points} data points`
    );

    // Step 3: Generate analysis with complete data
    const analysis = await generateAnalysis(query, dataFiles);

    // Step 4: Validate the analysis (import from validation module)
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

    return {
      analysis,
      validation: validationResult,
      files_used: file_ids,
      data_points: dataFiles.metadata.total_data_points,
    };
  } catch (error) {
    console.error("Error processing query:", error);
    throw error;
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
