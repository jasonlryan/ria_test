const fs = require("fs");
const path = require("path");

// Source and destination paths
const sourceDir = path.join(__dirname, "output");
const destDir = path.join(__dirname, "output", "split_data");

// Load the survey question definitions to ensure we only process valid questions
const surveyQuestions2024Path = path.join(
  __dirname,
  "reference files",
  "survey_questions_2024.json"
);
const surveyQuestions2025Path = path.join(
  __dirname,
  "reference files",
  "survey_questions_2025.json"
);

// Load the canonical topic mapping to understand how questions map to topics
const canonicalMappingPath = path.join(
  __dirname,
  "reference files",
  "canonical_topic_mapping.json"
);

let surveyQuestions2024 = {};
let surveyQuestions2025 = {};
let canonicalMapping = {};

try {
  surveyQuestions2024 = JSON.parse(
    fs.readFileSync(surveyQuestions2024Path, "utf8")
  );
  console.log("Loaded 2024 survey questions definition");
} catch (error) {
  console.error("Error loading 2024 survey questions:", error.message);
}

try {
  surveyQuestions2025 = JSON.parse(
    fs.readFileSync(surveyQuestions2025Path, "utf8")
  );
  console.log("Loaded 2025 survey questions definition");
} catch (error) {
  console.error("Error loading 2025 survey questions:", error.message);
}

try {
  canonicalMapping = JSON.parse(fs.readFileSync(canonicalMappingPath, "utf8"));
  console.log("Loaded canonical topic mapping");
} catch (error) {
  console.error(
    "Error loading canonical mapping:",
    error.message,
    "- Will proceed without topic mapping"
  );
}

// Extract the response statement to subquestion ID mappings from canonical mapping
function extractStatementMapping(canonicalMapping, year) {
  const statementMapping = {};

  if (!canonicalMapping || !canonicalMapping.themes) {
    console.log(
      "No canonical mapping available for extracting statement mappings"
    );
    return statementMapping;
  }

  // Iterate through all themes and topics to extract mappings
  canonicalMapping.themes.forEach((theme) => {
    theme.topics.forEach((topic) => {
      const mapping = topic.mapping;
      if (mapping && mapping[year]) {
        const questionIds = Array.isArray(mapping[year])
          ? mapping[year]
          : [mapping[year]];

        // Store the mapping for each question ID
        questionIds.forEach((qId) => {
          if (qId.includes("_")) {
            // This is a subquestion ID (e.g., Q7_1)
            statementMapping[qId] = {
              topic: topic.id,
              theme: theme.name,
            };
          }
        });
      }
    });
  });

  return statementMapping;
}

// Get all valid question IDs (both main and sub-questions) from the survey definitions
function getAllValidQuestionIds(surveyQuestions) {
  const validIds = [];

  // Extract all top-level question IDs
  Object.keys(surveyQuestions).forEach((key) => {
    if (key !== "metadata" && key !== "role_and_purpose") {
      // Add the top-level ID
      validIds.push(key);

      // Check if there are nested responses as an object
      const question = surveyQuestions[key];
      if (
        question.responses &&
        typeof question.responses === "object" &&
        !Array.isArray(question.responses)
      ) {
        // Add all nested question IDs
        Object.keys(question.responses).forEach((subKey) => {
          validIds.push(subKey);
        });
      }
    }
  });

  return validIds;
}

// Create mapping of question text to question ID
function createQuestionTextToIdMap(surveyQuestions) {
  const map = {};

  // Add special handling for Q4 in 2025 which has a nested structure
  Object.entries(surveyQuestions).forEach(([key, value]) => {
    if (value.question && typeof value.question === "string") {
      // Add mappings for variants of the question text to handle slight differences
      map[value.question] = key;

      // Add special mapping for Q4 (location question)
      if (key === "4" && value.question.includes("location")) {
        map["Please confirm the location of your current place"] = key;
      }

      // Add special mappings for statement questions (Q6, Q7, Q8, Q9, Q17 in 2025)
      // Map partial strings to handle potential variations in the data
      if (value.question.includes("To what extent do you agree")) {
        // Extract the topic from the question to create unique mappings
        const lowerQuestion = value.question.toLowerCase();
        if (lowerQuestion.includes("workplace")) {
          map[
            "To what extent do you agree with the following statements with regards to your workplace"
          ] = key;
        } else if (
          lowerQuestion.includes("economic") ||
          lowerQuestion.includes("values")
        ) {
          map[
            "To what extent do you agree with the following statements regarding your current role"
          ] = key;
        } else if (
          lowerQuestion.includes("barriers") ||
          lowerQuestion.includes("discrimination")
        ) {
          map[
            "To what extent do you agree with the following statements regarding your organization"
          ] = key;
        } else if (
          lowerQuestion.includes("manager") ||
          lowerQuestion.includes("dynamics")
        ) {
          map[
            "To what extent do you agree with the following statements regarding your manager"
          ] = key;
        } else if (
          lowerQuestion.includes("satisfaction") ||
          lowerQuestion.includes("motivation")
        ) {
          map[
            "To what extent do you agree with the following statements regarding your work motivation"
          ] = key;
        } else if (
          lowerQuestion.includes("ai") ||
          lowerQuestion.includes("skills")
        ) {
          map[
            "To what extent do you agree with the following statements regarding AI"
          ] = key;
        }
      }
    }
  });

  // Handle nested questions (like 4_1, 4_2, etc.)
  Object.entries(surveyQuestions).forEach(([key, value]) => {
    if (
      value.responses &&
      typeof value.responses === "object" &&
      !Array.isArray(value.responses)
    ) {
      Object.entries(value.responses).forEach(([subKey, subValue]) => {
        if (typeof subValue === "string") {
          // Map the sub-question text to its ID
          map[subValue] = subKey;

          // Also map the formatted text (e.g., "4_1. Text") to its ID
          const formattedText = `${subKey}. ${subValue}`;
          map[formattedText] = subKey;
        }
      });
    }
  });

  return map;
}

// Get valid question IDs
const validQuestionIds2024 = getAllValidQuestionIds(surveyQuestions2024);
const validQuestionIds2025 = getAllValidQuestionIds(surveyQuestions2025);

console.log(`Valid 2024 question IDs: ${validQuestionIds2024.join(", ")}`);
console.log(`Valid 2025 question IDs: ${validQuestionIds2025.join(", ")}`);

// Create question text to ID maps
const questionTextToId2024 = createQuestionTextToIdMap(surveyQuestions2024);
const questionTextToId2025 = createQuestionTextToIdMap(surveyQuestions2025);

// Extract the statement mappings from canonical mapping for 2025
const statement2025Mapping = extractStatementMapping(canonicalMapping, "2025");
console.log(
  `Found ${
    Object.keys(statement2025Mapping).length
  } statement mappings for 2025`
);

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`Created directory: ${destDir}`);
}

// Process 2024 data
console.log("Processing 2024 data...");
try {
  const data2024FilePath = path.join(sourceDir, "global_2024_data.json");
  console.log(`Reading from: ${data2024FilePath}`);

  if (fs.existsSync(data2024FilePath)) {
    const data2024 = JSON.parse(fs.readFileSync(data2024FilePath, "utf8"));
    processData(
      data2024,
      destDir,
      "2024",
      validQuestionIds2024,
      questionTextToId2024
    );
  } else {
    console.error(`File not found: ${data2024FilePath}`);
  }
} catch (error) {
  console.error("Error processing 2024 data:", error.message);
}

// Process 2025 data
console.log("Processing 2025 data...");
try {
  const data2025FilePath = path.join(sourceDir, "global_2025_data.json");
  console.log(`Reading from: ${data2025FilePath}`);

  if (fs.existsSync(data2025FilePath)) {
    const data2025 = JSON.parse(fs.readFileSync(data2025FilePath, "utf8"));
    processData(
      data2025,
      destDir,
      "2025",
      validQuestionIds2025,
      questionTextToId2025,
      statement2025Mapping
    );
  } else {
    console.error(`File not found: ${data2025FilePath}`);
  }
} catch (error) {
  console.error("Error processing 2025 data:", error.message);
}

/**
 * Process data and split into individual question files
 * @param {Array} data - The survey data
 * @param {string} outputDir - Output directory
 * @param {string} year - Survey year
 * @param {Array} validQuestionIds - List of valid question IDs
 * @param {Object} questionTextToIdMap - Mapping from question text to ID
 * @param {Object} statementMapping - Mapping for statement subquestions
 */
function processData(
  data,
  outputDir,
  year,
  validQuestionIds,
  questionTextToIdMap,
  statementMapping = {}
) {
  // Group data by question ID
  const questionMap = new Map();
  const unmappedQuestions = new Set();

  // Special categorization for statement-type questions
  // Maps response statements to their corresponding question categories
  const statementToQuestionMap = {
    // Q7 - Economic Security and Organizational Values
    "organization handles decisions": "7_1",
    "people over profits": "7_3",
    relocating: "7_4",
    immigration: "7_5",
    "job market": "7_2",
    "dei initiatives": "7_7",
    "return to office": "7_8",

    // Q8 - Perceived Barriers and Discrimination
    "stretched too far": "8_3",
    "overlooked for leadership": "8_4",
    "overlooked for training": "8_5",
    "overlooked for promotions": "8_6",
    "imposter syndrome": "8_10",
    "share negative reviews": "8_11",
    "leadership has negatively impacted": "8_1",

    // Q9 - Manager-Employee Dynamics
    "manager empowers": "9_1",
    "manager appears overwhelmed": "9_6",
    "comfortable telling my manager": "9_3",
    "cut back on the number of managers": "9_7",
    "lack of managers": "9_8",
    "welcomed by company leaders": "9_2",
    "comfortable discussing": "9_5",

    // Q17 - Job Satisfaction and Organizational Effectiveness
    "good use of my skills": "17_2",
    "challenging and interesting work": "17_1",
    "learning and development": "17_3",
    motivated: "17_6",
    "best work": "17_4",
    "strategically adapting": "17_5",
    "senior leadership team": "17_7",
    "care and concern for its employees": "17_8",
  };

  // Special handling for 2025 questions with potential duplicates (Q10 and Q13)
  // Store original question text for each ID to help with disambiguation
  const originalQuestions = {};
  if (year === "2025") {
    Object.entries(questionTextToIdMap).forEach(([text, id]) => {
      if (!originalQuestions[id]) {
        originalQuestions[id] = text;
      }
    });
  }

  // Use a fuzzy matching approach for harder-to-match questions
  function fuzzyMatchQuestion(questionText, responseText = "") {
    // Special debug logging for statement questions
    if (questionText.startsWith("To what extent do you agree")) {
      console.log("\nDEBUG: Analyzing statement question:");
      console.log(`Question: ${questionText.substring(0, 50)}...`);

      if (responseText) {
        console.log(`Response: ${responseText.substring(0, 50)}...`);
        const lowerResponse = responseText.toLowerCase();

        // Check if response text contains any of our mapping keywords
        // This will return subquestion IDs (like 7_1, 8_3, etc.) for statement questions
        for (const [keyword, qId] of Object.entries(statementToQuestionMap)) {
          if (lowerResponse.includes(keyword.toLowerCase())) {
            console.log(
              `Matched Q${qId} based on response keyword "${keyword}"`
            );
            return qId;
          }
        }
      }

      // Extract some content after the prefix to help identify the question
      const contentAfterPrefix = questionText.substring(
        "To what extent do you agree with the following statements".length
      );
      console.log(
        `Content after prefix: ${contentAfterPrefix.substring(0, 50)}...`
      );

      // Let's examine the full content for clues
      const lowerText = questionText.toLowerCase();

      // Create an array of distinctive keywords for each question
      const keywordMatches = {
        5: [
          "ai",
          "technologies",
          "learning approaches",
          "experimentation",
          "tech",
          "trained to use",
        ],
        6: [
          "workplace",
          "flexibility",
          "communicate",
          "connect with colleagues",
          "mental well-being",
          "work better",
          "generations",
        ],
        7: [
          "economic",
          "security",
          "immigration",
          "organization handles",
          "relocation",
          "job market",
          "organization's leaders",
          "people over profits",
          "dei initiatives",
        ],
        8: [
          "barriers",
          "stretched",
          "capabilities",
          "discrimination",
          "overlooked",
          "leadership roles",
          "class",
          "race",
          "sex",
          "promotions",
          "imposter syndrome",
        ],
        9: [
          "manager",
          "empowers",
          "directionless",
          "overwhelmed",
          "personal life",
          "welcomed by company",
          "comfortable",
        ],
        17: [
          "satisfaction",
          "motivation",
          "best work",
          "challenging",
          "trust",
          "leadership team",
          "strategically",
          "skills and abilities",
        ],
      };

      // Count keyword matches for each question and pick the one with the most matches
      const matches = {};
      Object.entries(keywordMatches).forEach(([qId, keywords]) => {
        matches[qId] = 0;
        keywords.forEach((keyword) => {
          if (
            lowerText.includes(keyword) ||
            (responseText && responseText.toLowerCase().includes(keyword))
          ) {
            matches[qId]++;
            console.log(`Found keyword '${keyword}' for Q${qId}`);
          }
        });
      });

      console.log("Keyword match counts:", matches);

      // Return the question ID with the most keyword matches
      const matchEntries = Object.entries(matches);
      if (matchEntries.length > 0) {
        matchEntries.sort((a, b) => b[1] - a[1]); // Sort by count descending
        const bestMatch = matchEntries[0];
        if (bestMatch[1] > 0) {
          console.log(
            `Best match: Q${bestMatch[0]} with ${bestMatch[1]} keyword matches`
          );

          // If we only have the main question ID (e.g., 7) but not the subquestion (7_1),
          // and this is a statement question, we need to determine a default subquestion
          // based on the response content
          if (year === "2025" && responseText) {
            // For main questions that have subquestions in the mapping
            const mainQId = bestMatch[0];
            for (const [keyword, subQId] of Object.entries(
              statementToQuestionMap
            )) {
              if (
                subQId.startsWith(mainQId + "_") &&
                responseText.toLowerCase().includes(keyword.toLowerCase())
              ) {
                console.log(
                  `Found subquestion match: ${subQId} based on keyword "${keyword}"`
                );
                return subQId;
              }
            }
            // If no specific subquestion match, return a default subquestion ID
            // For now, we'll use _1 as a default
            return `${mainQId}_1`;
          }

          return bestMatch[0];
        }
      }

      // Now look for more specific content patterns in the statement questions
      if (contentAfterPrefix.toLowerCase().includes("workplace")) {
        console.log("Matched Q6 by 'workplace' in content after prefix");
        return "6";
      } else if (
        contentAfterPrefix.toLowerCase().includes("economic") ||
        contentAfterPrefix.toLowerCase().includes("organization")
      ) {
        console.log(
          "Matched Q7 by 'economic' or 'organization' in content after prefix"
        );
        return "7";
      } else if (
        contentAfterPrefix.toLowerCase().includes("barriers") ||
        contentAfterPrefix.toLowerCase().includes("discrimination") ||
        contentAfterPrefix.toLowerCase().includes("leadership roles")
      ) {
        console.log(
          "Matched Q8 by 'barriers', 'discrimination', or 'leadership roles' in content after prefix"
        );
        return "8";
      } else if (contentAfterPrefix.toLowerCase().includes("manager")) {
        console.log("Matched Q9 by 'manager' in content after prefix");
        return "9";
      } else if (
        contentAfterPrefix.toLowerCase().includes("job satisfaction") ||
        contentAfterPrefix.toLowerCase().includes("motivation")
      ) {
        console.log(
          "Matched Q17 by 'job satisfaction' or 'motivation' in content after prefix"
        );
        return "17";
      }

      // If we get here, we couldn't determine the question - assign to Q10 for now
      console.log("DEFAULT assignment to Q10 - couldn't determine category");
      return "10";
    }

    // Handle the Q4 location question - more precise matching
    if (
      questionText.includes("location") ||
      questionText.includes("place of work") ||
      questionText.includes("primary workplace")
    ) {
      return "4";
    }

    // Handle the duplicate "What would your ideal role be?" question
    if (questionText.includes("ideal role")) {
      if (questionText.includes("employment arrangement")) {
        return "13";
      }
      return "10";
    }

    return null;
  }

  data.forEach((item) => {
    if (!item.question) {
      console.log(
        `Skipping item with no question: ${JSON.stringify(item).substring(
          0,
          50
        )}...`
      );
      return;
    }

    // Extract question ID from the question text
    const questionText = item.question;
    let questionId = null;

    // First check if we have a direct mapping for this question text
    if (questionTextToIdMap[questionText]) {
      questionId = questionTextToIdMap[questionText];
      console.log(
        `Found direct mapping for "${questionText.substring(
          0,
          30
        )}...": ${questionId}`
      );
    } else {
      // Try fuzzy matching for special cases, also passing the response text
      // to help identify statement questions
      const fuzzyMatch = fuzzyMatchQuestion(questionText, item.response);
      if (fuzzyMatch) {
        questionId = fuzzyMatch;
        console.log(
          `Found fuzzy match for "${questionText.substring(
            0,
            30
          )}...": ${questionId}`
        );
      } else {
        // Try to extract ID from the question text itself
        // Check for formats like "Q4_1" or "4_1. Text"
        let match = questionText.match(/\b([Q]?)(\d+(?:_\d+)?)\b/i);
        if (match) {
          questionId = match[2]; // Use the numeric part

          // If it starts with 'Q', we've already captured that in the match
          if (match[1].toUpperCase() === "Q") {
            questionId = match[0].toUpperCase();
          }
        }

        // If we still don't have an ID, try other patterns
        if (!questionId) {
          // Try matching formats like "1. Question" or "4_1. Question"
          const mainIdMatch = questionText.match(/^(\d+)[.,:]\s+/);
          if (mainIdMatch) {
            questionId = mainIdMatch[1];
          } else {
            const subIdMatch = questionText.match(/^(\d+_\d+)[.,:]\s+/);
            if (subIdMatch) {
              questionId = subIdMatch[1];
            }
          }
        }

        // If we found an ID, verify it's valid
        if (questionId) {
          // Remove the 'Q' prefix if it exists for validation
          const cleanId = questionId.replace(/^Q/i, "");

          if (
            !validQuestionIds.includes(cleanId) &&
            !validQuestionIds.includes(questionId)
          ) {
            console.log(
              `Warning: Extracted ID ${questionId} not in valid question IDs list`
            );
            unmappedQuestions.add(questionText);
            return; // Skip this question
          }
        } else {
          console.log(
            `Could not extract ID for question: "${questionText.substring(
              0,
              50
            )}..."`
          );
          unmappedQuestions.add(questionText);
          return; // Skip this question
        }
      }
    }

    // Ensure the question ID is in the correct format
    if (!questionId.match(/^\d+_\d+$/) && !questionId.match(/^Q\d+/i)) {
      // Check if we're dealing with a statement question in 2025 that needs subquestion mapping
      let subQuestionId = null;
      if (
        year === "2025" &&
        questionId.match(/^[5-9]$|^1[0-7]$/) &&
        item.response
      ) {
        // This is a potential statement question in 2025, check if we have a subquestion mapping for this response
        const responseText = item.response.toLowerCase();
        for (const [keyword, subId] of Object.entries(statementToQuestionMap)) {
          if (
            subId.startsWith(questionId + "_") &&
            responseText.includes(keyword.toLowerCase())
          ) {
            console.log(
              `Found statement subquestion match: ${subId} based on response "${item.response.substring(
                0,
                30
              )}..."`
            );
            subQuestionId = subId;
            break;
          }
        }
      }

      // If we found a subquestion ID, use it; otherwise, use the main question ID with Q prefix
      questionId = subQuestionId || `Q${questionId}`;
    }

    // Special handling for duplicate question IDs in 2025
    if (
      year === "2025" &&
      questionId === "Q10" &&
      questionText.includes("employment arrangement")
    ) {
      // If it's about employment arrangement, use Q13 instead
      questionId = "Q13";
      console.log(`Changed ID to ${questionId} based on context`);
    }

    // Initialize question group if it doesn't exist
    if (!questionMap.has(questionId)) {
      questionMap.set(questionId, {
        question: questionText,
        responses: [],
      });
    }

    // Add response data to the question group
    questionMap.get(questionId).responses.push({
      response: item.response,
      data: item.data,
    });
  });

  // Write individual question files with year prefix
  for (const [questionId, questionData] of questionMap.entries()) {
    // Remove the 'Q' prefix if it exists for file naming
    const cleanId = questionId.replace(/^Q/i, "");
    const filename = `${year}_${cleanId}.json`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(questionData, null, 2));
    console.log(`Created ${filename}`);
  }

  // Report unmapped questions
  if (unmappedQuestions.size > 0) {
    console.log(
      `\nWarning: ${unmappedQuestions.size} questions could not be mapped to valid IDs in ${year} data:`
    );
    unmappedQuestions.forEach((q) =>
      console.log(`- "${q.substring(0, 50)}..."`)
    );
  }

  console.log(
    `${year} data processing complete. ${questionMap.size} question files created.`
  );
}
