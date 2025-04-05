# RIA25 Data Retrieval Implementation

This document outlines the implementation plan for enhancing RIA's data retrieval capabilities to ensure comprehensive and accurate data usage in responses.

## Problem Statement

The current implementation has a critical flaw: while it claims to retrieve data files, it's only extracting sample data points as proof of retrieval but not actually using the complete data from the files. This results in:

1. Fabricated percentages in responses
2. Limited country coverage
3. Shallow analysis depth
4. Missing context and comparative data

## Solution Architecture

We'll implement a two-phase approach:

1. **File Identification**: Model identifies relevant data files
2. **Complete Data Retrieval**: External system retrieves full file contents
3. **Data-Driven Analysis**: Model generates response using only retrieved data
4. **Validation**: System verifies all percentages used are from actual data

### Architecture Diagram

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│  User Query  │────▶│ File          │────▶│ Data Retrieval │
└──────────────┘     │ Identification │     │ API (Vercel)   │
                     └───────────────┘     └────────────────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│  Response    │◀────│ Response      │◀────│ Complete Data  │
│  to User     │     │ Validation    │     │ Analysis       │
└──────────────┘     └───────────────┘     └────────────────┘
```

## Implementation Components

1. **Data Storage**: GitHub repository hosting JSON data files
2. **Vercel API Endpoint**: Serverless function to retrieve complete file contents
3. **OpenAI Integration**: Two-phase approach with function calling
4. **Validation Layer**: Verification of data usage in responses
5. **Frontend Interface**: Simple UI for testing the implementation

## Detailed Implementation

### 1. Data Storage Setup

We'll use GitHub for simplicity and speed of implementation:

```bash
# Setup commands
mkdir -p survey-data/2025
cp your-data-files/*.json survey-data/2025/
git init
git add .
git commit -m "Add survey data files"
git remote add origin https://github.com/your-username/survey-data.git
git push -u origin main
```

### 2. Vercel API Endpoint

Create a serverless function to retrieve complete data files:

```javascript
// pages/api/retrieve-data.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { file_ids } = req.body;

  if (!file_ids || !Array.isArray(file_ids)) {
    return res.status(400).json({ error: "Invalid file_ids parameter" });
  }

  try {
    // GitHub implementation (simplest)
    const files = await Promise.all(
      file_ids.map(async (id) => {
        try {
          // Sanitize file ID to prevent any path traversal
          const safeId = id.replace(/[^a-zA-Z0-9_\.-]/g, "");
          const url = `https://raw.githubusercontent.com/your-username/survey-data/main/2025/${safeId}`;

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
          }

          const data = await response.json();
          return { id, data, error: null };
        } catch (err) {
          console.error(`Error fetching ${id}:`, err);
          return { id, data: null, error: err.message };
        }
      })
    );

    // Count total data points for validation
    let totalDataPoints = 0;
    for (const file of files) {
      if (file.data) {
        totalDataPoints += countDataPoints(file.data);
      }
    }

    return res.status(200).json({
      success: true,
      files,
      metadata: {
        requested: file_ids.length,
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper to count data points in file
function countDataPoints(data) {
  let count = 0;
  function traverse(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === "number") {
          count++;
        } else {
          traverse(obj[key]);
        }
      }
    }
  }
  traverse(data);
  return count;
}
```

### 3. OpenAI Integration with Function Calling

```javascript
// lib/openai-integration.js
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
  const response = await fetch(
    "https://your-vercel-deployment.vercel.app/api/retrieve-data",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids }),
    }
  );

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
```

### 4. Response Validation

```javascript
// lib/validation.js
export function validateAnalysis(analysis, dataFiles) {
  // Extract all percentage mentions (e.g., 45%, 67%, etc.)
  const percentageRegex = /(\d{1,3})%/g;
  const mentionedPercentages = new Set();
  let match;

  while ((match = percentageRegex.exec(analysis)) !== null) {
    mentionedPercentages.add(parseInt(match[1], 10));
  }

  // Extract all actual percentages from the data files
  const actualPercentages = new Set();
  for (const file of dataFiles.files) {
    if (file.data) {
      extractAllPercentages(file.data, actualPercentages);
    }
  }

  // Find fabricated percentages
  const fabricatedPercentages = [];
  mentionedPercentages.forEach((percentage) => {
    if (!actualPercentages.has(percentage)) {
      fabricatedPercentages.push(percentage);
    }
  });

  // Check for country coverage in strategic responses
  let countryCount = 0;
  const strategicIndicators = [
    "strategic",
    "comprehensive",
    "future",
    "trends",
  ];
  const isStrategicQuery = strategicIndicators.some((indicator) =>
    analysis.toLowerCase().includes(indicator)
  );

  const countries = [
    "United Kingdom",
    "UK",
    "United States",
    "US",
    "USA",
    "Germany",
    "France",
    "China",
    "Japan",
    "India",
    "Brazil",
    "Australia",
    "Canada",
    "Singapore",
  ];

  for (const country of countries) {
    if (analysis.includes(country)) {
      countryCount++;
    }
  }

  return {
    valid: fabricatedPercentages.length === 0,
    fabricatedPercentages,
    percentagesUsed: mentionedPercentages.size,
    totalAvailablePercentages: actualPercentages.size,
    isStrategicQuery,
    countryCount,
    sufficientCountryCoverage: !isStrategicQuery || countryCount >= 8,
  };
}

function extractAllPercentages(data, percentageSet) {
  if (typeof data !== "object" || data === null) return;

  for (const key in data) {
    if (typeof data[key] === "number" && data[key] >= 0 && data[key] <= 100) {
      // Round to handle minor floating-point differences
      percentageSet.add(Math.round(data[key]));
    } else if (typeof data[key] === "object" && data[key] !== null) {
      extractAllPercentages(data[key], percentageSet);
    }
  }
}
```

### 5. Frontend Integration

The frontend component provides a simple UI for testing the implementation:

```javascript
// pages/index.js
import { useState } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Workforce Survey Insights</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about workforce survey data..."
            rows={4}
            className={styles.textarea}
          />
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        {result && (
          <div className={styles.result}>
            <div
              className={styles.analysis}
              dangerouslySetInnerHTML={{
                __html: result.analysis.replace(
                  /\*\*(\d+%)\*\*/g,
                  "<strong>$1</strong>"
                ),
              }}
            />

            <div className={styles.metadata}>
              <p>Files used: {result.files_used.join(", ")}</p>
              <p>Data points available: {result.data_points}</p>
              {!result.validation.valid && (
                <div className={styles.warning}>
                  <h3>⚠️ Fabricated Data Detected</h3>
                  <p>
                    The following percentages do not appear in the data:{" "}
                    {result.validation.fabricatedPercentages.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

## Implementation Timeline

| Task                 | Estimated Time  | Description                           |
| -------------------- | --------------- | ------------------------------------- |
| Setup                | 1-2 hours       | Create GitHub repo and Vercel project |
| Data Preparation     | 2 hours         | Format and upload data files          |
| API Development      | 2-3 hours       | Implement retrieve-data endpoint      |
| OpenAI Integration   | 2-3 hours       | Set up two-phase approach             |
| Validation Layer     | 1-2 hours       | Create validation logic               |
| Frontend             | 2 hours         | Build simple UI for testing           |
| Testing & Refinement | 2 hours         | Test and fix issues                   |
| **Total**            | **12-16 hours** | Can be compressed into a single day   |

## Key Advantages

1. **Forces Actual Data Usage**: System physically retrieves complete data files
2. **Validation**: Checks that all percentages in responses come from real data
3. **Transparency**: Shows which files were used and how many data points were available
4. **Efficiency**: Uses GitHub for data storage, enabling rapid implementation
5. **Extensibility**: Can be extended to use other storage options (S3, Vercel KV) later

## Implementation Notes

- The approach is designed for fast implementation while solving the core issue
- All percentage values must come from actual data files
- The system will flag responses that contain fabricated data
- For strategic questions, responses must include data from all countries
