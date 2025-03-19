#!/usr/bin/env node

/**
 * update_canonical_mapping.js
 *
 * This script updates the canonical_topic_mapping.json file to explicitly
 * reference split data files instead of using question IDs only.
 *
 * It transforms:
 *   "mapping": { "2025": ["Q7_6", "Q8_1"] }
 *
 * Into:
 *   "mapping": {
 *     "2025": [
 *       {"id": "Q7_6", "file": "2025_7_6.json"},
 *       {"id": "Q8_1", "file": "2025_8_1.json"}
 *     ]
 *   }
 */

const fs = require("fs");
const path = require("path");

// File paths
const CANONICAL_FILE = path.join(
  __dirname,
  "reference files",
  "canonical_topic_mapping.json"
);
const OUTPUT_FILE = CANONICAL_FILE; // Overwrite the original file

console.log("Updating canonical mapping with explicit file references...");

// Read the canonical mapping file
let canonicalMapping;
try {
  const fileContents = fs.readFileSync(CANONICAL_FILE, "utf8");
  canonicalMapping = JSON.parse(fileContents);
  console.log("Successfully read canonical mapping file");
} catch (error) {
  console.error("Error reading canonical mapping file:", error.message);
  process.exit(1);
}

// Update the dataAccess section
canonicalMapping.dataAccess = {
  basePath: "scripts/output/split_data/",
  comparableMarkets: canonicalMapping.dataAccess.comparableMarkets,
};

console.log("Updated dataAccess section");

// Function to convert a question ID to a filename
function questionIdToFilename(year, questionId) {
  // Remove 'Q' prefix if present
  const cleanId = questionId.replace(/^Q/i, "");
  return `${year}_${cleanId}.json`;
}

// Process all themes and topics
let totalUpdates = 0;

canonicalMapping.themes.forEach((theme) => {
  theme.topics.forEach((topic) => {
    // Update mappings for each year
    for (const [year, mapping] of Object.entries(topic.mapping)) {
      if (Array.isArray(mapping)) {
        // Array of question IDs
        topic.mapping[year] = mapping.map((questionId) => ({
          id: questionId,
          file: questionIdToFilename(year, questionId),
        }));
        totalUpdates += mapping.length;
      } else if (typeof mapping === "string") {
        // Single question ID
        topic.mapping[year] = [
          {
            id: mapping,
            file: questionIdToFilename(year, mapping),
          },
        ];
        totalUpdates += 1;
      }
    }
  });
});

console.log(
  `Updated ${totalUpdates} question ID mappings with explicit file references`
);

// Write the updated canonical mapping back to file
try {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(canonicalMapping, null, 4));
  console.log(`Successfully wrote updated canonical mapping to ${OUTPUT_FILE}`);
} catch (error) {
  console.error("Error writing updated canonical mapping:", error.message);
  process.exit(1);
}

console.log("Done!");
