// OpenAI Integration for Data Retrieval System
// This file implements the OpenAI integration for identifying relevant files and generating analysis

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Step 1: Identify needed files
export async function identifyRelevantFiles(query) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `You are an expert data analyst specialized in workforce survey data. 
Your task is to identify which data files are needed to answer the user's query.
The data files follow these naming patterns:
- 2025_[topic]_[subtopic].json for 2025 data
- 2024_[topic]_[subtopic].json for 2024 data

Available topics include:
- workforce_trends
- ai_impact
- leadership
- remote_work
- organizational_agility
- innovation
- future_skills
- employee_engagement
- global_competitiveness

ONLY return the file IDs needed - do not attempt to answer the question.`,
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
              description: "Array of file IDs needed to answer the query",
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
}

// Step 2: Analyze with complete data
export async function generateAnalysis(query, dataFiles) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `You are a workforce analytics expert analyzing survey data.
CRITICAL REQUIREMENTS:
1. ONLY use percentage values that ACTUALLY APPEAR in the provided data files.
2. NEVER fabricate data or use rounded estimates.
3. For strategic questions, analyze ALL 10 countries with data from each.
4. Format your response with clear sections and headers.
5. Bold important percentages using **X%** format.
6. Remember, users can verify if you're using real data, so be accurate.

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
}

// Main function to process a query
export async function processQueryWithData(query) {
  // Step 1: Identify relevant files
  const { file_ids, explanation } = await identifyRelevantFiles(query);
  console.log(`Identified files: ${file_ids.join(", ")}`);
  console.log(`Explanation: ${explanation}`);

  // Step 2: Retrieve the files
  const apiUrl =
    process.env.NODE_ENV === "production"
      ? "https://your-production-url.vercel.app/api/retrieve-data"
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

  // Step 4: Validate the analysis
  const validationResult = validateAnalysis(analysis, dataFiles);

  return {
    analysis,
    validation: validationResult,
    files_used: file_ids,
    data_points: dataFiles.metadata.total_data_points,
  };
}

// Optional: Add caching to improve performance
const cache = new Map();

export async function processQueryWithCaching(query) {
  const cacheKey = query.trim().toLowerCase();

  if (cache.has(cacheKey)) {
    console.log("Cache hit for query:", query);
    return cache.get(cacheKey);
  }

  const result = await processQueryWithData(query);

  // Only cache if validation passes
  if (result.validation.valid) {
    cache.set(cacheKey, result);
  }

  return result;
}

// Export endpoint handler for API route
export default async function analyzeHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Invalid query parameter" });
  }

  try {
    const result = await processQueryWithData(query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error processing query:", error);
    return res.status(500).json({ error: error.message });
  }
}
