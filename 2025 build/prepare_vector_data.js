/**
 * prepare_vector_data.js
 *
 * This script prepares the 2025 Global Workforce Survey data for use in OpenAI's vector store.
 * It creates optimized documents that can be efficiently retrieved by the assistant.
 */

const fs = require("fs");
const path = require("path");

// Define paths
const DATA_DIR = path.join(__dirname, "..", "scripts", "output");
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");
const OUTPUT_DIR = path.join(__dirname, "vector_data");

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load data sources
console.log("Loading data sources...");
const comparableDataIndex = require(path.join(
  PROMPTS_DIR,
  "comparable_data_index.json"
));

// Find the latest 2025 data file
const files = fs.readdirSync(DATA_DIR);
const dataFile2025 = files.find((file) =>
  file.match(/all_questions_global_\d+\.json/)
);

if (!dataFile2025) {
  console.error("Error: 2025 data file not found!");
  process.exit(1);
}

console.log(`Using 2025 data file: ${dataFile2025}`);
const data2025 = require(path.join(DATA_DIR, dataFile2025));

// Load 2024 data files
const data2024 = {
  global: require(path.join(DATA_DIR, "global_data.json")),
};

// Load country-specific 2024 data
const countryFiles = {
  "United States": "usa_data.json",
  "United Kingdom": "uk_data.json",
  Australia: "australia_data.json",
  India: "india_data.json",
  Brazil: "brazil_data.json",
  "Saudi Arabia": "saudi_uae_data.json", // Note: 2024 combines Saudi Arabia and UAE
};

for (const [country, filename] of Object.entries(countryFiles)) {
  if (fs.existsSync(path.join(DATA_DIR, filename))) {
    data2024[country] = require(path.join(DATA_DIR, filename));
    console.log(`Loaded 2024 data for ${country}`);
  } else {
    console.warn(`Warning: 2024 data file for ${country} not found!`);
  }
}

// Create a map of question IDs to full question text in 2025 data
function createQuestionMap() {
  const questionMap = {};

  // Map based on question ID pattern (e.g., Q1, Q2, etc.)
  Object.keys(data2025).forEach((questionText) => {
    const match = questionText.match(/Q(\d+)/);
    if (match) {
      const baseQuestionId = match[0];

      if (!questionMap[baseQuestionId]) {
        questionMap[baseQuestionId] = [];
      }

      questionMap[baseQuestionId].push(questionText);
    }
  });

  // For more specific matching with comparable data index
  comparableDataIndex.questions.forEach((indexQuestion) => {
    const id = indexQuestion.id;
    const baseMatch = id.match(/Q(\d+)/);

    if (baseMatch) {
      const baseId = baseMatch[0];
      const candidateQuestions = questionMap[baseId] || [];

      // Try to find the most relevant match
      // For questions like "Q4_1", look for something with that specific sub-question
      if (id.includes("_")) {
        const subNumber = id.split("_")[1];
        // Look for questions that might contain this sub-number or key phrases
        const bestMatch = findBestMatch(candidateQuestions, indexQuestion.text);

        if (bestMatch) {
          if (!questionMap[id]) {
            questionMap[id] = [];
          }
          questionMap[id].push(bestMatch);
        }
      }
    }
  });

  return questionMap;
}

// Helper function to find best matching question based on text similarity
function findBestMatch(candidateQuestions, referenceText) {
  if (!candidateQuestions || candidateQuestions.length === 0) return null;

  // If there's only one candidate, return it
  if (candidateQuestions.length === 1) return candidateQuestions[0];

  // Simple text matching - could be improved with more sophisticated algorithms
  const wordsToMatch = referenceText.toLowerCase().split(/\s+/);

  let bestMatch = null;
  let highestScore = 0;

  for (const question of candidateQuestions) {
    const questionLower = question.toLowerCase();
    let score = 0;

    for (const word of wordsToMatch) {
      if (word.length > 3 && questionLower.includes(word)) {
        // Only count meaningful words
        score++;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = question;
    }
  }

  return bestMatch;
}

// Process 2024 data to extract question responses
function extract2024Data(data, questionId) {
  // This is a placeholder function - you'll need to adapt it based on your data structure
  // The exact implementation depends on how the 2024 data is formatted

  // Example implementation (modify as needed):
  if (!data) return null;

  // For questions in format Q4_1, Q4_2, etc.
  if (questionId.includes("_")) {
    const [baseQ, subQ] = questionId.split("_");

    // Look for matching questions
    // This will depend on your data structure
    return data[questionId] || null;
  }

  // For top-level questions
  return data[questionId] || null;
}

// Create vector-optimized documents
function createVectorDocuments() {
  console.log("Creating vector documents...");
  const questionMap = createQuestionMap();
  const vectorDocuments = [];
  const comparableMarkets = comparableDataIndex.comparableMarkets;

  // Document 1: Survey Overview
  vectorDocuments.push({
    id: "survey_overview",
    content: JSON.stringify({
      title: "2025 Global Workforce Survey Overview",
      description:
        "This document provides an overview of the 2025 Global Workforce Survey, including methodology, scope, and key findings.",
      questions: Object.keys(data2025).length,
      markets: Object.keys(data2024).filter((k) => k !== "global"),
    }),
    metadata: {
      type: "reference",
      category: "overview",
    },
  });

  // Document 2: Comparison Rules
  vectorDocuments.push({
    id: "comparison_rules",
    content: JSON.stringify({
      title: "Year-over-Year Comparison Rules",
      comparableMarkets: comparableDataIndex.comparableMarkets,
      rules: comparableDataIndex.comparisonRules,
      note: "Only certain questions and markets can be compared between 2024 and 2025 surveys.",
    }),
    metadata: {
      type: "reference",
      category: "rules",
    },
  });

  // Documents for each question's comparability info
  comparableDataIndex.questions.forEach((question) => {
    const id = question.id;

    vectorDocuments.push({
      id: `comparability_${id}`,
      content: JSON.stringify({
        questionId: id,
        text: question.text,
        comparable: question.comparable,
        availableSurveys: question.availableSurveys,
        notes: question.notes,
        userMessage: question.userMessage,
      }),
      metadata: {
        type: "comparability_info",
        questionId: id,
        comparable: question.comparable,
      },
    });
  });

  // Process 2025 data
  console.log("Processing 2025 data...");
  Object.entries(data2025).forEach(([question, responses]) => {
    // Create a document for each question
    vectorDocuments.push({
      id: `data2025_${question.replace(/\s+/g, "_")}`,
      content: JSON.stringify({
        question,
        data: responses,
        year: "2025",
      }),
      metadata: {
        type: "survey_data",
        year: "2025",
        question,
      },
    });

    // Find matching question ID in comparable data index
    const matchingIds = [];
    for (const [id, questions] of Object.entries(questionMap)) {
      if (questions.includes(question)) {
        matchingIds.push(id);
      }
    }

    // For each matching ID that is comparable, create comparison documents
    matchingIds.forEach((id) => {
      const questionInfo = comparableDataIndex.questions.find(
        (q) => q.id === id
      );
      if (questionInfo && questionInfo.comparable) {
        // For each comparable market
        comparableMarkets.forEach((market) => {
          if (data2024[market]) {
            const data2024ForMarket = extract2024Data(data2024[market], id);

            if (data2024ForMarket) {
              vectorDocuments.push({
                id: `comparison_${id}_${market.replace(/\s+/g, "_")}`,
                content: JSON.stringify({
                  questionId: id,
                  market,
                  text: question,
                  data2024: data2024ForMarket,
                  data2025: responses,
                  userMessage: questionInfo.userMessage,
                }),
                metadata: {
                  type: "comparison_data",
                  questionId: id,
                  market,
                  comparable: true,
                },
              });
            }
          }
        });
      }
    });
  });

  console.log(`Created ${vectorDocuments.length} vector documents`);
  return vectorDocuments;
}

// Main function
async function main() {
  try {
    // Create vector documents
    const vectorDocuments = createVectorDocuments();

    // Split documents into smaller files if needed
    const MAX_DOCUMENTS_PER_FILE = 100;
    const fileCount = Math.ceil(
      vectorDocuments.length / MAX_DOCUMENTS_PER_FILE
    );

    for (let i = 0; i < fileCount; i++) {
      const startIndex = i * MAX_DOCUMENTS_PER_FILE;
      const endIndex = Math.min(
        startIndex + MAX_DOCUMENTS_PER_FILE,
        vectorDocuments.length
      );
      const fileDocuments = vectorDocuments.slice(startIndex, endIndex);

      const filename =
        fileCount === 1
          ? "vector_documents.json"
          : `vector_documents_part${i + 1}.json`;

      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        JSON.stringify(fileDocuments, null, 2)
      );

      console.log(`Wrote ${fileDocuments.length} documents to ${filename}`);
    }

    // Create question mapping file
    const questionMap = createQuestionMap();
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "question_mapping.json"),
      JSON.stringify(questionMap, null, 2)
    );

    console.log("Data preparation complete!");
  } catch (error) {
    console.error("Error preparing vector data:", error);
    process.exit(1);
  }
}

main();
