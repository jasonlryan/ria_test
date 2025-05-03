// Test script for canonical mapping extraction
const fs = require("fs");
const path = require("path");

// Paths
const CLEAN_PROMPT_PATH = path.join(__dirname, "../prompts/clean_prompt.md");
const CANONICAL_MAPPING_PATH = path.join(
  __dirname,
  "../scripts/reference files/canonical_topic_mapping.json"
);

// Load files
function loadFiles() {
  try {
    const prompt = fs.readFileSync(CLEAN_PROMPT_PATH, "utf8");
    const canonicalMapping = JSON.parse(
      fs.readFileSync(CANONICAL_MAPPING_PATH, "utf8")
    );
    return { prompt, canonicalMapping };
  } catch (error) {
    console.error("Error loading files:", error);
    process.exit(1);
  }
}

// Test extraction
function testExtraction() {
  const { prompt, canonicalMapping } = loadFiles();

  // Print canonical mapping info
  console.log("=== CANONICAL MAPPING DETAILS ===");
  console.log(`Themes count: ${canonicalMapping.themes.length}`);

  // Test with specific topics
  const testTopics = ["Attraction_Factors", "Retention_Factors"];

  testTopics.forEach((topicId) => {
    console.log(`\n=== TESTING TOPIC: ${topicId} ===`);

    // Find the topic in the canonical mapping
    let found = false;

    canonicalMapping.themes.forEach((theme, themeIndex) => {
      theme.topics.forEach((topic, topicIndex) => {
        if (topic.id === topicId) {
          found = true;
          console.log(
            `Found in: Theme "${theme.name}" at index ${themeIndex}, Topic index ${topicIndex}`
          );
          console.log(`Topic ID: ${topic.id}`);
          console.log(`Comparable: ${topic.comparable}`);
          console.log(`UserMessage: "${topic.userMessage}"`);

          console.log("\nFiles:");
          if (topic.mapping["2025"]) {
            console.log(
              "2025:",
              topic.mapping["2025"].map((item) => item.file)
            );
          } else {
            console.log("2025: No files found");
          }

          if (topic.mapping["2024"]) {
            console.log(
              "2024:",
              topic.mapping["2024"].map((item) => item.file)
            );
          } else {
            console.log("2024: No files found");
          }
        }
      });
    });

    if (!found) {
      console.log(`Topic "${topicId}" not found in canonical mapping!`);
    }
  });

  console.log("\n=== TEST QUERY ===");
  console.log(
    "[VERIFY] Compare the factors that attract candidates with the factors that make them stay."
  );
  console.log("\nPlease run this query with the clean_prompt.md system prompt");
}

// Run the test
testExtraction();
