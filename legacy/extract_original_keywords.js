const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Directory to find files
const DATA_DIR = path.join(__dirname, "output/split_data");

// Output file
const OUTPUT_FILE = path.join(__dirname, "temp/original_keywords.json");

// Get list of 2025 files from the filesystem
const files = fs
  .readdirSync(DATA_DIR)
  .filter((file) => file.startsWith("2025_") && file.endsWith(".json"));

console.log(`Found ${files.length} files for 2025`);

// Object to store the original keywords
const originalKeywords = {};

// Process each file
files.forEach((file) => {
  try {
    // Get the file content from the Git repository
    const gitCommand = `git show origin/2025_1:scripts/output/split_data/${file}`;
    const fileContent = execSync(gitCommand).toString();

    // Parse JSON to extract metadata
    const data = JSON.parse(fileContent);

    // Check if metadata and keywords exist
    if (
      data.metadata &&
      data.metadata.keywords &&
      Array.isArray(data.metadata.keywords)
    ) {
      console.log(`Processing ${file}...`);

      // Store keywords with the topic ID as the key
      const topicId = data.metadata.topicId;

      if (!originalKeywords[topicId]) {
        originalKeywords[topicId] = {};
      }

      originalKeywords[topicId][file] = data.metadata.keywords;
    } else {
      console.log(`No keywords found in ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}: ${error.message}`);
  }
});

// Write the results to a file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(originalKeywords, null, 2));
console.log(`Extracted keywords saved to ${OUTPUT_FILE}`);

// Print a summary
console.log("\nSummary of extracted keywords:");
for (const topicId in originalKeywords) {
  const fileCount = Object.keys(originalKeywords[topicId]).length;
  console.log(`${topicId}: ${fileCount} files`);
}
