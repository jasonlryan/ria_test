#!/usr/bin/env node
/**
 * process_2025_data.js
 *
 * A script to adapt the 2025 data format to work with the 2024 processing script.
 * This script:
 * 1. Takes the consolidated CSV from 2025_DATA directory
 * 2. Transforms it to match the format expected by the 2024 processing script
 * 3. Outputs a file that can be used with process_survey_data.js
 *
 * Usage:
 *   node process_2025_data.js --input=path/to/all_questions_mapped.csv --output=path/to/output/directory
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { stringify } = require("csv-stringify/sync");

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split("=");
  acc[key.replace("--", "")] = value;
  return acc;
}, {});

// Set default values
const inputCsvPath =
  args.input ||
  path.join(__dirname, "..", "2025_DATA", "all_questions_mapped.csv");
const outputDir = args.output || path.join(__dirname, "data", "2025");
const outputCsvPath = path.join(outputDir, "Global- Table 1.csv");

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Define mapping from 2025 format to 2024 format
const columnMapping = {
  Question: "Question",
  Response: "Response",
  Total: "Total",
  country_US: "country_USA",
  country_United_Kingdom: "country_UK",
  country_India: "country_India",
  country_Brazil: "country_Brazil",
  country_Australia: "country_Australia",
  // Add any other mappings needed for 2024 format
};

// Demographic mappings for 2024 format
const demographicMappings = {
  "age_18-24": "age_18_24",
  "age_25-34": "age_25_34",
  "age_35-44": "age_35_44",
  "age_45-54": "age_45_54",
  "age_55-65": "age_55_65",
  gender_female: "gender_female",
  gender_male: "gender_male",
  "org_size_<10": "org_size_fewer_than_10",
  "org_size_10-49": "org_size_10_to_49",
  "org_size_50-99": "org_size_50_to_99",
  "org_size_100-500": "org_size_100_to_249",
  // Map the rest of org sizes accordingly
  "employment_status_full-time": "employment_status_full_time",
  "employment_status_part-time": "employment_status_part_time",
  // Add other demographic mappings
};

/**
 * Convert percentage strings to decimal values
 * @param {string} percentStr - Percentage string (e.g., "75%")
 * @returns {number} - Decimal value (e.g., 0.75)
 */
function percentToDecimal(percentStr) {
  if (!percentStr || percentStr === "-") return 0;

  // Remove the percentage sign and convert to decimal
  const numStr = percentStr.replace("%", "").trim();
  return parseFloat(numStr) / 100;
}

/**
 * Process the 2025 consolidated CSV to 2024 format
 */
async function convertCsvFormat() {
  console.log(`Converting 2025 data format from: ${inputCsvPath}`);
  console.log(`Output will be saved to: ${outputCsvPath}`);

  const records = [];
  const headerRow = {};
  let headerProcessed = false;

  return new Promise((resolve, reject) => {
    fs.createReadStream(inputCsvPath)
      .pipe(csv())
      .on("headers", (headers) => {
        // Process headers to create the mapping
        headers.forEach((header) => {
          // Map to 2024 format using the defined mappings
          if (columnMapping[header]) {
            headerRow[header] = columnMapping[header];
          } else if (demographicMappings[header]) {
            headerRow[header] = demographicMappings[header];
          } else {
            // Keep the original header if no mapping exists
            headerRow[header] = header;
          }
        });
        headerProcessed = true;
      })
      .on("data", (row) => {
        const processedRow = {};

        // Process each column according to the mapping
        Object.keys(row).forEach((key) => {
          let value = row[key];

          // Convert percentages to decimals for data columns
          if (key !== "Question" && key !== "Response" && value.includes("%")) {
            value = percentToDecimal(value);
          }

          // Use the mapped column name
          const targetKey = headerRow[key] || key;
          processedRow[targetKey] = value;
        });

        records.push(processedRow);
      })
      .on("end", () => {
        // Get all keys from all records to ensure we have a complete set of columns
        const allKeys = new Set();
        records.forEach((record) => {
          Object.keys(record).forEach((key) => allKeys.add(key));
        });

        // Convert to the format expected by the 2024 script
        const output = stringify(records, {
          header: true,
          columns: Array.from(allKeys),
        });

        fs.writeFileSync(outputCsvPath, output);
        console.log(`Conversion complete. Processed ${records.length} rows.`);
        resolve();
      })
      .on("error", (error) => {
        console.error("Error processing CSV:", error);
        reject(error);
      });
  });
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log("Starting 2025 data format conversion");
    await convertCsvFormat();
    console.log(
      `Successfully created 2025 data file in 2024 format at: ${outputCsvPath}`
    );
    console.log(
      "You can now use this file with the process_survey_data.js script:"
    );
    console.log(
      `node scripts/process_survey_data.js --input="${outputCsvPath}" --year=2025 --output=scripts/output`
    );
  } catch (error) {
    console.error("Error in data conversion:", error);
    process.exit(1);
  }
}

// Run the script
main();
