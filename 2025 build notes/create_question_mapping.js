/**
 * create_question_mapping.js
 *
 * This script creates a mapping between standardized question IDs and full question text
 * from the 2025 Global Workforce Survey data.
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

// Create a mapping from question ID to full question text
function createQuestionMapping() {
  const mapping = {
    baseQuestions: {}, // Simple Q1, Q2, etc. mappings
    subQuestions: {}, // Complex Q1_1, Q1_2, etc. mappings
    textToId: {}, // Reverse mapping from text to ID
    metadata: {
      totalQuestions: Object.keys(data2025).length,
      generatedAt: new Date().toISOString(),
      sourcefile: dataFile2025,
    },
  };

  // Step 1: Map base questions (Q1, Q2, etc.)
  Object.keys(data2025).forEach((questionText) => {
    const match = questionText.match(/^Q(\d+)/);
    if (match) {
      const baseQuestionId = `Q${match[1]}`;

      if (!mapping.baseQuestions[baseQuestionId]) {
        mapping.baseQuestions[baseQuestionId] = [];
      }

      mapping.baseQuestions[baseQuestionId].push(questionText);
      mapping.textToId[questionText] = baseQuestionId;
    }
  });

  // Step 2: Map questions from comparable data index
  if (comparableDataIndex && comparableDataIndex.questions) {
    comparableDataIndex.questions.forEach((indexQuestion) => {
      const id = indexQuestion.id;
      const text = indexQuestion.text;

      // For sub-questions (e.g., Q1_1, Q4_2)
      if (id.includes("_")) {
        mapping.subQuestions[id] = {
          reference_text: text,
          matched_2025_questions: findMatchingQuestions(
            text,
            mapping.baseQuestions,
            id
          ),
        };

        // Update reverse mapping for matched questions
        if (
          mapping.subQuestions[id].matched_2025_questions &&
          mapping.subQuestions[id].matched_2025_questions.length > 0
        ) {
          mapping.subQuestions[id].matched_2025_questions.forEach((q) => {
            mapping.textToId[q] = id;
          });
        }
      }
    });
  }

  // Step 3: Analyze mapping coverage
  const mappedQuestions = new Set();

  // Add all questions that have a mapping
  Object.values(mapping.textToId).forEach((id) => {
    Object.keys(mapping.textToId).forEach((text) => {
      if (mapping.textToId[text] === id) {
        mappedQuestions.add(text);
      }
    });
  });

  mapping.metadata.mappedQuestionCount = mappedQuestions.size;
  mapping.metadata.mappingCoveragePercent = (
    (mappedQuestions.size / mapping.metadata.totalQuestions) *
    100
  ).toFixed(2);

  return mapping;
}

// Helper function to find matching questions based on text similarity
function findMatchingQuestions(referenceText, baseQuestionMap, subQuestionId) {
  // Extract base question ID (e.g., Q4 from Q4_1)
  const baseId = subQuestionId.split("_")[0];

  // If we don't have any questions matching this base ID, return empty
  if (!baseQuestionMap[baseId] || baseQuestionMap[baseId].length === 0) {
    return [];
  }

  const candidateQuestions = baseQuestionMap[baseId];

  // If there's only one candidate, return it
  if (candidateQuestions.length === 1) {
    return candidateQuestions;
  }

  // Extract meaningful words for matching
  const referenceWords = referenceText
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 3); // Only meaningful words

  // Score each candidate question
  const scoredCandidates = candidateQuestions.map((question) => {
    const questionLower = question.toLowerCase();
    let score = 0;

    for (const word of referenceWords) {
      if (questionLower.includes(word)) {
        score++;
      }
    }

    // Sub-question number matching (e.g., for Q4_1, look for "1" in the question)
    const subNumber = subQuestionId.split("_")[1];
    if (
      question.includes(` ${subNumber}.`) ||
      question.includes(`(${subNumber})`) ||
      question.includes(`- ${subNumber}`) ||
      question.includes(`: ${subNumber}`)
    ) {
      score += 3; // Boost score for explicit sub-question number match
    }

    return { question, score };
  });

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Get questions with sufficiently high scores (at least 2 matching words or explicit number match)
  const goodMatches = scoredCandidates
    .filter((candidate) => candidate.score >= 2)
    .map((candidate) => candidate.question);

  return goodMatches;
}

// Main function
async function main() {
  try {
    // Create question mapping
    console.log("Creating question mapping...");
    const questionMapping = createQuestionMapping();

    // Write mapping to file
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "question_mapping.json"),
      JSON.stringify(questionMapping, null, 2)
    );

    console.log(
      `Question mapping created with ${questionMapping.metadata.mappedQuestionCount} mapped questions (${questionMapping.metadata.mappingCoveragePercent}% coverage)`
    );

    // Create a simplified version for reference
    const simplifiedMapping = {};

    // Add base question mappings
    Object.keys(questionMapping.baseQuestions).forEach((id) => {
      simplifiedMapping[id] = questionMapping.baseQuestions[id][0]; // Just take the first one for simplicity
    });

    // Add sub-question mappings
    Object.keys(questionMapping.subQuestions).forEach((id) => {
      const matches = questionMapping.subQuestions[id].matched_2025_questions;
      if (matches && matches.length > 0) {
        simplifiedMapping[id] = matches[0]; // Just take the first match
      } else {
        simplifiedMapping[id] =
          questionMapping.subQuestions[id].reference_text +
          " (NOT FOUND IN 2025 DATA)";
      }
    });

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "simplified_question_mapping.json"),
      JSON.stringify(simplifiedMapping, null, 2)
    );

    console.log("Simplified mapping created for quick reference");
  } catch (error) {
    console.error("Error creating question mapping:", error);
    process.exit(1);
  }
}

main();
