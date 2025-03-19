const fs = require("fs");
const { parse } = require("csv-parse");
const path = require("path");

// Constants
const INPUT_FILE = path.join(__dirname, "data", "all_questions_global.csv");
const OUTPUT_DIR = path.join(__dirname, "output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to get current timestamp in YYYYMMDD_HHMMSS format
function getTimestamp() {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/[T.]/g, "_")
    .slice(0, 15);
}

console.log(`Reading input file: ${INPUT_FILE}`);

async function parseCSV() {
  return new Promise((resolve, reject) => {
    fs.readFile(INPUT_FILE, "utf-8", (err, csv) => {
      if (err) {
        console.error("Error reading CSV file:", err);
        reject(err);
        return;
      }

      parse(
        csv,
        { columns: false, trim: true, skip_empty_lines: true },
        (err, records) => {
          if (err) {
            console.error("Error parsing CSV:", err);
            reject(err);
            return;
          }
          resolve(records);
        }
      );
    });
  });
}

function formatData(records) {
  // First row has headers
  const headerRow = records[0];

  // Create demographic mappings dynamically from the header row
  // Skip the first two columns which are Question and Response
  const demographicColumns = {};

  // Map all demographic columns starting from index 2
  for (let i = 2; i < headerRow.length; i++) {
    // Clean header name if needed and use as key
    const columnName = headerRow[i] ? headerRow[i].trim() : `column_${i}`;

    // If it's a country column
    if (i >= 3 && i <= 12) {
      demographicColumns[`country_${columnName}`] = i;
    }
    // Age groups
    else if (i >= 13 && i <= 18) {
      demographicColumns[`age_${columnName}`] = i;
    }
    // Generations
    else if (i >= 19 && i <= 22) {
      demographicColumns[`generation_${columnName}`] = i;
    }
    // Gender
    else if (i >= 23 && i <= 24) {
      demographicColumns[`gender_${columnName}`] = i;
    }
    // Company size
    else if (i >= 25 && i <= 30) {
      demographicColumns[`company_size_${columnName}`] = i;
    }
    // Employment type
    else if (i >= 31 && i <= 34) {
      demographicColumns[`employment_type_${columnName}`] = i;
    }
    // Industry sectors (varies widely)
    else if (i >= 35 && i <= 60) {
      demographicColumns[`sector_${columnName}`] = i;
    }
    // Job level
    else if (i >= 61 && i <= 66) {
      demographicColumns[`job_level_${columnName}`] = i;
    }
    // Relationship status
    else if (i >= 67 && i <= 71) {
      demographicColumns[`relationship_${columnName}`] = i;
    }
    // Education
    else if (i >= 72 && i <= 77) {
      demographicColumns[`education_${columnName}`] = i;
    }
    // For any other columns not specifically categorized
    else {
      demographicColumns[`demographic_${columnName}`] = i;
    }
  }

  // Special case for 'total' which is column 2
  demographicColumns["total"] = 2;

  console.log(
    `Mapped ${Object.keys(demographicColumns).length} demographic columns`
  );

  // Group by question
  const result = {};

  // Process each data row (starting from row 1, skipping headers)
  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    if (!row[0] || !row[1]) continue; // Skip rows without question or response

    const question = row[0];
    const response = row[1];

    // Initialize question if it doesn't exist
    if (!result[question]) {
      result[question] = [];
    }

    // Create demographic data object
    const demographicData = {};

    for (const [demographic, index] of Object.entries(demographicColumns)) {
      demographicData[demographic] = row[index] || "0%";
    }

    // Add response data to the question
    result[question].push({
      response: response,
      demographics: demographicData,
    });
  }

  return result;
}

async function main() {
  try {
    const records = await parseCSV();
    const formattedData = formatData(records);
    const timestamp = getTimestamp();
    const outputPath = path.join(
      OUTPUT_DIR,
      `all_questions_global_${timestamp}.json`
    );

    console.log(
      `Writing ${Object.keys(formattedData).length} questions to: ${outputPath}`
    );

    fs.writeFile(outputPath, JSON.stringify(formattedData, null, 2), (err) => {
      if (err) {
        console.error("Error writing JSON file:", err);
      } else {
        console.log("JSON file has been saved successfully!");
      }
    });
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

main();
