const fs = require("fs");
const path = require("path");

// Constants
const DATA_DIR = path.join(__dirname, "output/split_data");
const CANONICAL_MAPPING_PATH = path.join(
  __dirname,
  "reference files/canonical_topic_mapping.json"
);
const YEARS = [2024, 2025];

// Load canonical topic mapping
console.log("Loading canonical topic mapping...");
const canonicalMapping = JSON.parse(
  fs.readFileSync(CANONICAL_MAPPING_PATH, "utf8")
);

// Load original keywords if available
let originalKeywords = {};
const ORIGINAL_KEYWORDS_PATH = path.join(
  __dirname,
  "temp/original_keywords.json"
);

try {
  if (fs.existsSync(ORIGINAL_KEYWORDS_PATH)) {
    console.log("Loading original keywords...");
    originalKeywords = JSON.parse(
      fs.readFileSync(ORIGINAL_KEYWORDS_PATH, "utf8")
    );
    console.log(
      `Loaded keywords for ${Object.keys(originalKeywords).length} topics`
    );
  } else {
    console.log("No original keywords file found. Will generate keywords.");
  }
} catch (error) {
  console.warn(`Could not load original keywords: ${error.message}`);
}

// Verify canonical mapping file for comparable topics
function verifyCanonicalMapping() {
  console.log("Verifying canonical mapping for comparable topics...");

  const comparableTopics = [];
  const nonComparableTopics = [];
  const q123Topics = [];

  // Find all topics and their comparable status
  for (const theme of canonicalMapping.themes) {
    for (const topic of theme.topics) {
      // Check if this topic contains Q1, Q2, or Q3
      let containsQ123 = false;
      if (topic.mapping) {
        for (const year of ["2024", "2025"]) {
          if (topic.mapping[year]) {
            for (const mapping of topic.mapping[year]) {
              if (
                mapping.id === "Q1" ||
                mapping.id === "Q2" ||
                mapping.id === "Q3" ||
                mapping.id === "1" ||
                mapping.id === "2" ||
                mapping.id === "3"
              ) {
                containsQ123 = true;
                q123Topics.push({
                  id: topic.id,
                  questionId: mapping.id,
                  year: year,
                  comparable: topic.comparable,
                  file: mapping.file,
                });
              }
            }
          }
        }
      }

      // Record topic in appropriate category
      if (topic.comparable === true) {
        comparableTopics.push({
          id: topic.id,
          available2024:
            topic.mapping &&
            topic.mapping["2024"] &&
            topic.mapping["2024"].length > 0,
          available2025:
            topic.mapping &&
            topic.mapping["2025"] &&
            topic.mapping["2025"].length > 0,
          availableMarkets: topic.availableMarkets || [],
          containsQ123: containsQ123,
        });
      } else {
        nonComparableTopics.push({
          id: topic.id,
          available2024:
            topic.mapping &&
            topic.mapping["2024"] &&
            topic.mapping["2024"].length > 0,
          available2025:
            topic.mapping &&
            topic.mapping["2025"] &&
            topic.mapping["2025"].length > 0,
          containsQ123: containsQ123,
        });
      }
    }
  }

  // Log information about comparable topics
  console.log(`Found ${comparableTopics.length} comparable topics:`);
  for (const topic of comparableTopics) {
    console.log(
      `  - ${topic.id} (2024: ${topic.available2024 ? "Yes" : "No"}, 2025: ${
        topic.available2025 ? "Yes" : "No"
      }, Markets: ${topic.availableMarkets.length}${
        topic.containsQ123 ? ", CONTAINS Q1/Q2/Q3!" : ""
      })`
    );
  }

  // Log information about non-comparable topics
  console.log(`\nFound ${nonComparableTopics.length} non-comparable topics:`);
  for (const topic of nonComparableTopics) {
    if (topic.available2024 && topic.available2025) {
      console.log(
        `  - ${topic.id} (Available in BOTH years but marked as non-comparable${
          topic.containsQ123 ? ", contains Q1/Q2/Q3" : ""
        })`
      );
    } else {
      console.log(
        `  - ${topic.id} (2024: ${topic.available2024 ? "Yes" : "No"}, 2025: ${
          topic.available2025 ? "Yes" : "No"
        }${topic.containsQ123 ? ", contains Q1/Q2/Q3" : ""})`
      );
    }
  }

  // Check for Q1, Q2, Q3 that might be marked as comparable
  const q123Issues = q123Topics.filter((q) => q.comparable === true);
  if (q123Issues.length > 0) {
    console.log(
      "\nWARNING: Q1, Q2, or Q3 are marked as comparable in some topics:"
    );
    for (const issue of q123Issues) {
      console.log(
        `  - ${issue.questionId} in topic ${issue.id} (${issue.year}, file: ${issue.file})`
      );
    }
    console.log(
      "  These will be forcibly set to non-comparable during processing."
    );
  }

  // Check for potential problems - topics with data in both years but marked as non-comparable
  const potentialIssues = nonComparableTopics.filter(
    (topic) => topic.available2024 && topic.available2025 && !topic.containsQ123
  );
  if (potentialIssues.length > 0) {
    console.log("\nPotential issues found:");
    console.log(
      "The following topics have data in both 2024 and 2025 but are marked as non-comparable:"
    );
    for (const topic of potentialIssues) {
      console.log(`  - ${topic.id}`);
    }
    console.log(
      "  Note: This might be intentional if the questions were significantly reformulated between years."
    );
  }

  // Summary of themes and their topics' comparable settings
  console.log("\nTheme-level comparability breakdown:");
  for (const theme of canonicalMapping.themes) {
    const themeTopics = theme.topics.map((t) => ({
      id: t.id,
      comparable: t.comparable,
      containsQ123: q123Topics.some((q) => q.id === t.id),
    }));

    const comparableCount = themeTopics.filter((t) => t.comparable).length;
    const nonComparableCount = themeTopics.filter((t) => !t.comparable).length;

    console.log(
      `  - ${theme.name}: ${comparableCount} comparable, ${nonComparableCount} non-comparable topics`
    );

    if (comparableCount > 0 && nonComparableCount > 0) {
      console.log("    Topics with mixed comparability settings:");
      for (const topic of themeTopics) {
        console.log(
          `      - ${topic.id}: ${
            topic.comparable ? "comparable" : "non-comparable"
          }${topic.containsQ123 ? " (contains Q1/Q2/Q3)" : ""}`
        );
      }
    }
  }

  return {
    comparableTopics,
    nonComparableTopics,
    q123Topics,
    q123Issues,
    potentialIssues,
  };
}

// Get all data files from the directory
function getDataFiles() {
  console.log(`Reading files from ${DATA_DIR}...`);
  return fs
    .readdirSync(DATA_DIR)
    .filter((file) => /^(2024|2025)_\d+(_\d+)?\.json$/.test(file))
    .map((file) => path.join(DATA_DIR, file));
}

// Parse file name to get year and question ID
function parseFileName(filePath) {
  const fileName = path.basename(filePath);
  const match = fileName.match(/^(\d{4})_(.+?)\.json$/);
  if (match) {
    return {
      year: parseInt(match[1]),
      questionId: match[2],
      fileName: fileName,
    };
  }
  return null;
}

// Find the topic for a given question ID in a specific year
function findTopicForQuestion(year, questionId, fileName) {
  const yearStr = year.toString();

  // Try different formats of the question ID for matching
  const formats = [
    questionId, // Original (e.g., "5_4")
    `Q${questionId}`, // With Q prefix (e.g., "Q5_4")
    questionId.replace("_", ""), // Without underscore (e.g., "54")
    `Q${questionId.replace("_", "")}`, // With Q prefix, without underscore (e.g., "Q54")
    questionId.includes("_") ? questionId.split("_")[0] : questionId, // Just the first part (e.g., "5")
    questionId.includes("_")
      ? `Q${questionId.split("_")[0]}`
      : `Q${questionId}`, // First part with Q (e.g., "Q5")
  ];

  console.log(
    `  Searching for topic for ${yearStr}_${questionId} (${fileName})...`
  );

  // Debug Leadership_Confidence mapping
  if (fileName === "2024_7.json" || fileName.includes("2025_7_6")) {
    console.log("\n--- DEBUG: Looking for Leadership_Confidence mapping ---");
    for (const theme of canonicalMapping.themes) {
      for (const topic of theme.topics) {
        if (topic.id === "Leadership_Confidence") {
          console.log(`  Found Leadership_Confidence in canonical mapping:`);
          console.log(`  - comparable: ${topic.comparable}`);
          console.log(
            `  - availableMarkets: ${JSON.stringify(topic.availableMarkets)}`
          );
          console.log(`  - userMessage: "${topic.userMessage}"`);

          if (topic.mapping && topic.mapping[yearStr]) {
            console.log(`  - mapping for ${yearStr}:`);
            topic.mapping[yearStr].forEach((mapping) => {
              console.log(`    - id: ${mapping.id}, file: ${mapping.file}`);
            });
          } else {
            console.log(`  - No mapping for ${yearStr}`);
          }
        }
      }
    }
    console.log("--- END DEBUG ---\n");
  }

  // First, try direct matching with the mapping ID and file
  for (const theme of canonicalMapping.themes) {
    for (const topic of theme.topics) {
      if (topic.mapping && topic.mapping[yearStr]) {
        for (const mapping of topic.mapping[yearStr]) {
          // Check for exact file match first
          if (mapping.file === fileName) {
            console.log(
              `  ✓ Found exact file match: ${topic.id} (comparable: ${topic.comparable})`
            );
            return { themeId: theme.name, topic: topic };
          }

          // Then try all question ID formats
          for (const format of formats) {
            if (mapping.id === format) {
              console.log(
                `  ✓ Found ID match: ${format} → ${topic.id} (comparable: ${topic.comparable})`
              );
              return { themeId: theme.name, topic: topic };
            }
          }
        }
      }
    }
  }

  // If no direct match, try pattern matching on the file name
  for (const theme of canonicalMapping.themes) {
    for (const topic of theme.topics) {
      if (topic.mapping && topic.mapping[yearStr]) {
        for (const mapping of topic.mapping[yearStr]) {
          if (
            mapping.file &&
            mapping.file.includes(`${yearStr}_${questionId}`)
          ) {
            console.log(
              `  ✓ Found filename pattern match: ${mapping.file} → ${topic.id} (comparable: ${topic.comparable})`
            );
            return { themeId: theme.name, topic: topic };
          }

          // Try matching sub-questions of a main question
          if (
            questionId.includes("_") &&
            mapping.file &&
            mapping.file.includes(`${yearStr}_${questionId.split("_")[0]}`)
          ) {
            console.log(
              `  ✓ Found parent question match: ${mapping.file} → ${topic.id} (comparable: ${topic.comparable})`
            );
            return { themeId: theme.name, topic: topic };
          }
        }
      }
    }
  }

  // Log diagnostic information for debugging
  console.warn(
    `  WARNING: Could not find topic for ${yearStr}_${questionId} (${fileName})`
  );
  console.log(`  Tried formats: ${formats.join(", ")}`);

  return null;
}

// Generate appropriate keywords based on topic
function generateKeywords(topic, fileName) {
  // First check if the topic has alternatePhrasings in the canonical mapping
  if (
    topic.alternatePhrasings &&
    Array.isArray(topic.alternatePhrasings) &&
    topic.alternatePhrasings.length > 0
  ) {
    console.log(
      `  Using alternatePhrasings from canonical mapping for ${topic.id}`
    );
    // Start with the alternate phrasings from the canonical mapping
    let keywords = [...topic.alternatePhrasings];

    // Add topic ID as a keyword if not already included
    if (!keywords.includes(topic.id)) {
      keywords.push(topic.id);
    }

    // Add topic-specific keywords if available
    const topicSpecificKeywords = {
      AI_Attitudes: [
        "artificial intelligence",
        "ai sentiment",
        "technology acceptance",
        "ai perception",
        "ai impact",
        "optimism about ai",
      ],
      AI_Readiness: [
        "ai readiness",
        "ai training",
        "effective use of ai",
        "ai adoption",
        "ai competence",
        "proficiency with ai",
        "ai tool training",
        "ai integration",
        "readiness for ai",
        "experimentation with ai",
      ],
      DEI: [
        "diversity",
        "equity",
        "inclusion",
        "workplace diversity",
        "inclusive culture",
        "belonging",
        "equal opportunity",
      ],
      Leadership_Confidence: [
        "leadership trust",
        "confidence in management",
        "executive effectiveness",
        "leadership quality",
        "senior leadership",
      ],
    };

    // Add topic-specific keywords if available
    if (topicSpecificKeywords[topic.id]) {
      for (const specificKeyword of topicSpecificKeywords[topic.id]) {
        if (!keywords.includes(specificKeyword)) {
          keywords.push(specificKeyword);
        }
      }
    }

    // Limit to 10 keywords for consistency
    if (keywords.length > 10) {
      keywords = keywords.slice(0, 10);
    }

    return keywords;
  }

  // If we reach here, there were no alternatePhrasings in the canonical mapping
  // Fall back to previous logic of checking the original keywords file
  if (
    fileName &&
    originalKeywords[topic.id] &&
    originalKeywords[topic.id][fileName]
  ) {
    console.log(`  Using original keywords for ${fileName}`);
    return originalKeywords[topic.id][fileName];
  }

  // If we have keywords for this topic from any file, use those
  if (originalKeywords[topic.id]) {
    const files = Object.keys(originalKeywords[topic.id]);
    if (files.length > 0) {
      console.log(`  Using original keywords for ${topic.id} from ${files[0]}`);
      return originalKeywords[topic.id][files[0]];
    }
  }

  // Fall back to the final keyword generation logic
  console.log(`  Generating keywords programmatically for ${topic.id}`);

  // Start with an empty array
  let keywords = [];

  // Add topic ID as a keyword if not already included
  if (!keywords.includes(topic.id)) {
    keywords.push(topic.id);
  }

  // Add topic ID variations
  if (topic.id.includes("_")) {
    // Add underscore-separated parts
    const parts = topic.id.split("_");
    for (const part of parts) {
      if (part.length > 3 && !keywords.includes(part.toLowerCase())) {
        keywords.push(part.toLowerCase());
      }
    }
  }

  // Add words from the canonical question
  if (topic.canonicalQuestion) {
    const questionWords = topic.canonicalQuestion
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3) // Only include words longer than 3 chars
      .filter(
        (word) =>
          ![
            "what",
            "how",
            "would",
            "your",
            "with",
            "that",
            "this",
            "from",
            "have",
            "been",
            "does",
            "which",
            "when",
            "they",
            "will",
            "are",
            "and",
            "for",
            "the",
          ].includes(word)
      );

    // Add unique words
    for (const word of questionWords) {
      if (!keywords.includes(word)) {
        keywords.push(word);
      }
    }
  }

  // Add common topic-specific keywords based on the topic ID
  const topicSpecificKeywords = {
    AI_Attitudes: [
      "artificial intelligence",
      "ai sentiment",
      "technology acceptance",
      "ai perception",
      "ai impact",
      "optimism about ai",
    ],
    AI_Readiness: [
      "ai readiness",
      "ai training",
      "effective use of ai",
      "ai adoption",
      "ai competence",
      "proficiency with ai",
      "ai tool training",
      "ai integration",
      "readiness for ai",
      "experimentation with ai",
    ],
    DEI: [
      "diversity",
      "equity",
      "inclusion",
      "workplace diversity",
      "inclusive culture",
      "belonging",
      "equal opportunity",
    ],
    Leadership_Confidence: [
      "leadership trust",
      "confidence in management",
      "executive effectiveness",
      "leadership quality",
      "senior leadership",
    ],
  };

  // Add topic-specific keywords if available
  if (topicSpecificKeywords[topic.id]) {
    for (const specificKeyword of topicSpecificKeywords[topic.id]) {
      if (!keywords.includes(specificKeyword)) {
        keywords.push(specificKeyword);
      }
    }
  }

  // Limit to 10 keywords for consistency
  if (keywords.length > 10) {
    keywords = keywords.slice(0, 10);
  }

  return keywords;
}

// Extract subQuestion from file data if present
function extractSubQuestion(fileData, questionId) {
  // If this is a sub-question file (format: X_Y), try to extract the sub-question text
  if (
    questionId.includes("_") &&
    fileData.question &&
    fileData.responses &&
    fileData.responses.length > 0
  ) {
    // For statement-based questions, the sub-question is often the first response
    return fileData.responses[0].response;
  }
  return null;
}

// Find related topics for a given topic
function findRelatedTopics(topic, themeId) {
  const allRelatedTopics = [];

  // First, add topics from the same theme (higher priority)
  const sameThemeTopics =
    canonicalMapping.themes
      .find((theme) => theme.name === themeId)
      ?.topics.filter((t) => t.id !== topic.id)
      .map((t) => t.id) || [];

  allRelatedTopics.push(...sameThemeTopics);

  // Then try to find related topics based on keywords
  const topicKeywords = new Set([
    ...generateKeywords(topic, null),
    ...(topic.alternatePhrasings || []),
  ]);

  // Look through all topics in other themes
  for (const theme of canonicalMapping.themes.filter(
    (t) => t.name !== themeId
  )) {
    for (const otherTopic of theme.topics) {
      if (otherTopic.id === topic.id) continue;

      // Generate keywords for the other topic
      const otherKeywords = new Set([
        ...generateKeywords(otherTopic, null),
        ...(otherTopic.alternatePhrasings || []),
      ]);

      // Count matches between keywords
      let matchCount = 0;
      for (const keyword of topicKeywords) {
        if (otherKeywords.has(keyword)) {
          matchCount++;
        }
      }

      // If there are at least 2 matching keywords, consider it related
      if (
        matchCount >= 2 ||
        otherTopic.canonicalQuestion
          ?.toLowerCase()
          .includes(topic.id.toLowerCase()) ||
        topic.canonicalQuestion
          ?.toLowerCase()
          .includes(otherTopic.id.toLowerCase())
      ) {
        allRelatedTopics.push(otherTopic.id);
      }
    }
  }

  // Common topic pairings hardcoded for better results
  const commonPairings = {
    AI_Attitudes: ["AI_Readiness", "Skills_Utilization"],
    AI_Readiness: ["AI_Attitudes", "Learning_and_Development"],
    DEI: ["Culture_and_Values", "Employee_Wellbeing"],
    Leadership_Confidence: ["Manager_Capability", "Organizational_Adaptation"],
    Learning_and_Development: ["Skills_Utilization", "AI_Readiness"],
    Work_Life_Flexibility: ["Employee_Wellbeing", "Motivation_and_Fulfillment"],
  };

  // Add known pairings if applicable
  if (commonPairings[topic.id]) {
    for (const pairedTopic of commonPairings[topic.id]) {
      if (!allRelatedTopics.includes(pairedTopic)) {
        allRelatedTopics.push(pairedTopic);
      }
    }
  }

  // Return unique values, limited to 3
  return [...new Set(allRelatedTopics)].slice(0, 3);
}

// Generate metadata for a file
function generateMetadata(year, questionId, fileData, topicInfo, fileName) {
  if (!topicInfo) {
    console.warn(`  WARNING: No topic found for ${year}_${questionId}.json`);
    return null;
  }

  const { topic, themeId } = topicInfo;

  // Add special debugging for Leadership_Confidence
  if (topic.id === "Leadership_Confidence") {
    console.log(`\n--- DEBUG: Generate Metadata for Leadership_Confidence ---`);
    console.log(
      `  - Topic comparable flag from canonical: ${topic.comparable}`
    );
    console.log(`  - Topic ID: ${topic.id}`);
    console.log(`  - Year: ${year}`);
    console.log(`  - QuestionId: ${questionId}`);
  }

  // Normalize question ID to include 'Q' prefix if needed
  const normalizedQuestionId = questionId.startsWith("Q")
    ? questionId
    : `Q${questionId}`;

  // Extract sub-question if present
  const subQuestion = extractSubQuestion(fileData, questionId);

  // Special case: Q1, Q2, and Q3 MUST be set to false regardless of topic setting
  const isQ123 =
    normalizedQuestionId === "Q1" ||
    normalizedQuestionId === "Q2" ||
    normalizedQuestionId === "Q3" ||
    questionId === "1" ||
    questionId === "2" ||
    questionId === "3";

  // Ensure the comparable flag is correctly set from the canonical mapping
  // BUT override for Q1, Q2, and Q3 to always be false
  const isComparable = isQ123 ? false : topic.comparable === true;

  // Special debug for Leadership_Confidence
  if (topic.id === "Leadership_Confidence") {
    console.log(`  - isQ123: ${isQ123}`);
    console.log(`  - Raw topic.comparable value: ${topic.comparable}`);
    console.log(`  - Type of topic.comparable: ${typeof topic.comparable}`);
    console.log(`  - Final isComparable value: ${isComparable}`);
    console.log(`  - Type of isComparable: ${typeof isComparable}`);
    console.log(`--- END METADATA DEBUG ---\n`);
  }

  // Log the comparable setting for verification
  console.log(
    `  Setting comparable=${isComparable} for ${topic.id} (${year}_${questionId})`
  );
  if (isQ123 && topic.comparable === true) {
    console.log(
      `  WARNING: Overriding comparable setting for ${normalizedQuestionId} from true to false as required`
    );
  }

  // Get available markets from canonical file if comparable, otherwise empty array
  const availableMarkets = isComparable
    ? topic.availableMarkets ||
      canonicalMapping.dataAccess.comparableMarkets ||
      []
    : [];

  // Find related topics using our new function
  const relatedTopics = findRelatedTopics(topic, themeId);

  // Generate keywords, now passing the filename
  const keywords = generateKeywords(topic, fileName);

  // Determine data structure segments based on first response
  const segments =
    fileData.responses && fileData.responses[0]?.data
      ? Object.keys(fileData.responses[0].data)
      : [
          "region",
          "age",
          "gender",
          "org_size",
          "sector",
          "job_level",
          "relationship_status",
          "education",
          "generation",
          "employment_status",
        ];

  // Adjust userMessage for Q1, Q2, Q3 if they are being overridden
  let userMessage = topic.userMessage;
  if (isQ123 && topic.comparable === true) {
    userMessage =
      "Year‑on‑year comparisons not available due to methodology changes.";
  }

  // Create metadata structure - matching the 2025_5_4.json template exactly
  return {
    topicId: topic.id,
    questionId: normalizedQuestionId,
    year: parseInt(year),
    keywords: keywords,
    canonicalQuestion: topic.canonicalQuestion,
    ...(subQuestion && { subQuestion }), // Only include if it exists
    comparable: isComparable, // Use our verified boolean value
    userMessage: userMessage,
    availableMarkets: availableMarkets,
    relatedTopics: relatedTopics,
    dataStructure: {
      questionField: "question",
      responsesArray: "responses",
      responseTextField: "response",
      dataField: "data",
      segments: segments,
      primaryMetric: "country_overall",
      valueFormat: "decimal",
      sortOrder: "descending",
    },
  };
}

// Process a single file
async function processFile(filePath) {
  try {
    const fileInfo = parseFileName(filePath);
    if (!fileInfo) {
      console.warn(`  Skipping file with invalid name: ${filePath}`);
      return false;
    }

    const { year, questionId, fileName } = fileInfo;
    console.log(`  Processing ${fileName}...`);

    // Read the file
    const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Skip if metadata already exists and we're not forcing overwrite
    if (fileData.metadata && !process.argv.includes("--force")) {
      console.log(
        `  Metadata already exists for ${fileName}. Use --force to overwrite.`
      );
      return false;
    }

    // Find topic for this question
    const topicInfo = findTopicForQuestion(year, questionId, fileName);

    // Generate metadata
    const metadata = generateMetadata(
      year,
      questionId,
      fileData,
      topicInfo,
      fileName
    );
    if (!metadata) {
      console.warn(
        `  Could not generate metadata for ${fileName} - topic not found.`
      );
      return false;
    }

    // Special handling for Leadership_Confidence to ensure metadata is applied correctly
    if (topicInfo?.topic?.id === "Leadership_Confidence") {
      console.log(`\n--- DEBUG: Metadata update for ${fileName} ---`);
      console.log(
        `  Original metadata.comparable: ${fileData.metadata?.comparable}`
      );
      console.log(`  New metadata.comparable: ${metadata.comparable}`);

      // Force the correct value for comparable
      metadata.comparable = topicInfo.topic.comparable === true;
      console.log(`  Final metadata.comparable: ${metadata.comparable}`);
      console.log(
        `  Setting availableMarkets: ${JSON.stringify(
          metadata.availableMarkets
        )}`
      );
      console.log(`  Setting userMessage: "${metadata.userMessage}"`);
      console.log(`--- END DEBUG ---\n`);
    }

    // Create new data object with metadata first to ensure it takes precedence
    const updatedData = {
      metadata: metadata, // Put metadata first explicitly
    };

    // Add all properties from fileData except metadata
    for (const key in fileData) {
      if (key !== "metadata") {
        updatedData[key] = fileData[key];
      }
    }

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
    console.log(`  ✓ Added metadata to ${fileName}`);
    return true;
  } catch (error) {
    console.error(`  ERROR processing ${filePath}: ${error.message}`);
    return false;
  }
}

// Process all files
async function processAllFiles() {
  try {
    const files = getDataFiles();
    console.log(`Found ${files.length} data files.`);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      const success = await processFile(file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`\nProcessing complete!`);
    console.log(`Successfully processed: ${successCount} files`);
    console.log(`Failed to process: ${failCount} files`);
  } catch (error) {
    console.error(`Error processing files: ${error.message}`);
  }
}

// Process specific year if provided
async function processYear(year) {
  try {
    const yearInt = parseInt(year);
    if (!YEARS.includes(yearInt)) {
      console.error(
        `Invalid year: ${year}. Must be one of: ${YEARS.join(", ")}`
      );
      return;
    }

    const files = getDataFiles().filter((file) =>
      path.basename(file).startsWith(`${yearInt}_`)
    );
    console.log(`Found ${files.length} data files for ${yearInt}.`);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      const success = await processFile(file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`\nProcessing complete for ${yearInt}!`);
    console.log(`Successfully processed: ${successCount} files`);
    console.log(`Failed to process: ${failCount} files`);
  } catch (error) {
    console.error(`Error processing year ${year}: ${error.message}`);
  }
}

// Handle file missing during operation
process.on("uncaughtException", (error) => {
  if (error.code === "ENOENT") {
    console.error(`ERROR: File not found - ${error.path}`);
  } else {
    console.error(`Uncaught Exception: ${error.message}`);
  }
});

// Main execution
(async function main() {
  console.log("Metadata Processor Started");

  try {
    // Check command line arguments for options
    const args = process.argv.slice(2);

    // Display help if requested
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
Metadata Processor - Add metadata to survey data files

Usage:
  node add_metadata.js [options]

Options:
  --year=YYYY    Process only files for the specified year (2024 or 2025)
  --force        Overwrite existing metadata even if already present
  --verify-only  Only verify the canonical mapping without processing files
  --help, -h     Display this help message

Examples:
  node add_metadata.js                 Process all files
  node add_metadata.js --year=2024     Process only 2024 files
  node add_metadata.js --force         Process all files, overwriting existing metadata
      `);
      return;
    }

    // Run verification on canonical mapping
    const verificationResults = verifyCanonicalMapping();

    // If --verify-only flag is present, exit after verification
    if (args.includes("--verify-only")) {
      console.log(
        "\nVerification complete. Use without --verify-only to process files."
      );
      return;
    }

    // Add a confirmation step if potential issues were found
    if (
      verificationResults.potentialIssues.length > 0 &&
      !args.includes("--no-confirm")
    ) {
      console.log(
        "\nPotential issues were found with the comparable settings."
      );
      console.log(
        "These topics have data in both years but are marked as non-comparable in the canonical file:"
      );
      for (const topic of verificationResults.potentialIssues) {
        console.log(`  - ${topic.id}`);
      }
      console.log(
        "\nThis might be intentional if these topics cannot be directly compared between years."
      );
      console.log(
        "Proceeding will use the comparable settings exactly as defined in the canonical file."
      );
      console.log("Add --no-confirm to skip this warning.\n");

      // Give user 5 seconds to interrupt if needed
      console.log("Continuing in 5 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.log("Proceeding with metadata generation...\n");
    }

    // Check if a specific year is requested
    const yearArg = args.find((arg) => arg.startsWith("--year="));
    if (yearArg) {
      const year = parseInt(yearArg.split("=")[1]);
      await processYear(year);
    } else {
      await processAllFiles();
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
})();
