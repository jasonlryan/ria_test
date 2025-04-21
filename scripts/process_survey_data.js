#!/usr/bin/env node
/**
 * process_survey_data.js
 *
 * A unified script that orchestrates the complete survey data processing workflow:
 * 1. For 2025 data: Harmonize the CSV format (convert percentages to decimals)
 * 2. Process CSV to global JSON
 * 3. Split global JSON into individual files with metadata
 *
 * Usage:
 *   node process_survey_data.js --input=path/to/csv/file.csv --year=2024 --output=path/to/output/directory
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { stringify } = require("csv-stringify/sync");
const { promisify } = require("util");
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// Import the harmonization module for 2025 data
const harmonizer = require("./process_2025_data");

// Define global COUNTRY_MAPPINGS constant at the top of the file
// This will be the single source of truth for all country mappings
const COUNTRY_MAPPINGS = {
  // United States variations
  US: "united_states",
  USA: "united_states",
  "U.S.": "united_states",
  "U.S.A.": "united_states",
  "United States": "united_states",
  "United States of America": "united_states",
  America: "united_states",
  "The United States": "united_states",

  // United Kingdom variations
  UK: "united_kingdom",
  "U.K.": "united_kingdom",
  "United Kingdom": "united_kingdom",
  "Great Britain": "united_kingdom",
  Britain: "united_kingdom",
  England: "united_kingdom",

  // India variations
  India: "india",
  "Republic of India": "india",

  // France variations
  France: "france",
  "French Republic": "france",

  // Germany variations
  Germany: "germany",
  "Federal Republic of Germany": "germany",
  Deutschland: "germany",

  // Japan variations
  Japan: "japan",
  Nippon: "japan",

  // United Arab Emirates variations
  UAE: "united_arab_emirates",
  "U.A.E.": "united_arab_emirates",
  "United Arab Emirates": "united_arab_emirates",
  Emirates: "united_arab_emirates",

  // Brazil variations
  Brazil: "brazil",
  Brasil: "brazil",
  "Federative Republic of Brazil": "brazil",

  // Saudi Arabia variations
  "Saudi Arabia": "saudi_arabia",
  KSA: "saudi_arabia",
  "Kingdom of Saudi Arabia": "saudi_arabia",
  Saudi: "saudi_arabia",

  // Australia variations
  Australia: "australia",
  "Commonwealth of Australia": "australia",
  Aus: "australia",

  // Support for all common prefixed formats
  country_US: "united_states",
  country_USA: "united_states",
  country_United_States: "united_states",
  country_UK: "united_kingdom",
  country_United_Kingdom: "united_kingdom",
  country_India: "india",
  country_France: "france",
  country_Germany: "germany",
  country_Japan: "japan",
  country_UAE: "united_arab_emirates",
  country_United_Arab_Emirates: "united_arab_emirates",
  country_Brazil: "brazil",
  country_Saudi_Arabia: "saudi_arabia",
  country_Australia: "australia",

  // Support for percentage suffix formats
  "US %": "united_states",
  "UK %": "united_kingdom",
  "India %": "india",
  "France %": "france",
  "Germany %": "germany",
  "Japan %": "japan",
  "UAE %": "united_arab_emirates",
  "Brazil %": "brazil",
  "Saudi Arabia %": "saudi_arabia",
  "Australia %": "australia",
};

// Parse command line arguments with enhanced support for flags
const args = process.argv.slice(2).reduce((acc, arg, index, allArgs) => {
  // Handle --flag=value format
  if (arg.includes("=")) {
    const [key, value] = arg.split("=");
    acc[key.replace("--", "")] = value;
  }
  // Handle --flag format for boolean flags
  else if (arg.startsWith("--")) {
    const key = arg.replace("--", "");

    // Check if next argument exists and is not a flag (for --flag value format)
    if (index + 1 < allArgs.length && !allArgs[index + 1].startsWith("--")) {
      acc[key] = allArgs[index + 1];
      // Mark this argument as consumed to skip it in the next iteration
      allArgs[index + 1] = "--CONSUMED--";
    } else {
      // If no value follows, treat as boolean flag
      acc[key] = true;
    }
  }
  // Skip consumed arguments
  else if (arg === "--CONSUMED--") {
    // Do nothing
  }
  // Handle -h short format
  else if (arg === "-h") {
    acc.help = true;
  }
  return acc;
}, {});

// Check for help flag first
if (args.help || args.h) {
  displayHelp();
  process.exit(0);
}

// Set default values with enhanced options
const options = {
  input:
    args.input ||
    path.join(
      __dirname,
      "data",
      args.year || "2024",
      `${args.year || "2024"}_global_data.csv`
    ),
  year: args.year || "2024",
  output: args.output || path.join(__dirname, "output", "split_data"),
  skipHarmonization: args.skipHarmonization || false,
  skipGlobal: args.skipGlobal || false,
  skipSplit: args.skipSplit || false,
  validateOnly: args.validateOnly || false,
  force: args.force || false,
  verbose: args.verbose || false,
  question: args.question || null,
};

// Derived values
const csvPath = options.input;
const year = options.year;
const outputDir = options.output;
const globalOutputPath = path.join(outputDir, `global_${year}_data.json`);
const splitOutputDir = outputDir;

/**
 * Display comprehensive help information
 */
function displayHelp() {
  const helpText = `
  Survey Data Processing Workflow
  ==============================
  
  DESCRIPTION
    This script orchestrates the complete survey data processing pipeline,
    from raw CSV input to individualized JSON output files with metadata.
    
  USAGE
    node process_survey_data.js [OPTIONS]
    
  OPTIONS
    Basic Configuration:
      --input=<path>             Path to the input CSV file
                                Default: ./data/{year}/{year}_global_data.csv
      
      --year=<year>              Survey year to process (2024, 2025)
                                Default: 2024
      
      --output=<path>            Output directory for all generated files
                                Default: ./output
      
      --question=<id>            Process only a single question (e.g., "1" or "Q1")
                                Default: process all questions
    
    Process Control:
      --skip-global              Skip generating the global JSON file
      
      --skip-split               Skip splitting into individual files
      
      --force                    Override existing files without confirmation
    
    Validation:
      --validate-only            Only validate existing outputs without processing
      
      --verbose                  Show detailed output during processing
    
    Help:
      --help, -h                 Display this help message
    
  EXAMPLES
    # Process 2024 data with default settings
    node process_survey_data.js --year=2024
    
    # Process 2025 data (using CSV from data/2025 directory)
    node process_survey_data.js --year=2025
    
    # Process only question 1 from 2025 data
    node process_survey_data.js --year=2025 --question=1
    
    # Process only question 1 from 2025 data with verbose output
    node process_survey_data.js --year=2025 --question=1 --verbose
    
    # Process 2025 data with custom input file
    node process_survey_data.js --year=2025 --input=./custom/input.csv
    
    # Only validate existing outputs for 2024
    node process_survey_data.js --year=2024 --validate-only
    
    # Process only up to the global JSON generation
    node process_survey_data.js --year=2024 --skip-split
    
  WORKFLOW FOR 2025 DATA
    1. Run generate_consolidated_csv.js in the 2025_DATA_PROCESSING directory
    2. Copy the resulting 2025_global_data.csv to scripts/data/2025/
    3. Run this script with --year=2025
    
  PIPELINE STEPS
    1. CSV to Global JSON conversion
    2. Global JSON splitting into individual files with metadata
    
  OUTPUT FILES
    - {output}/global_{year}_data.json         Primary consolidated JSON
    - {output}/split_data/{year}_{id}.json     Individual question files
    - {output}/{year}_file_index.json          Index of all generated files
  `;

  console.log(helpText);
}

/**
 * Process the CSV file to a global JSON format
 */
async function processCSVToGlobal(csvFilePath) {
  console.log(`Processing CSV file: ${csvFilePath}`);

  const results = [];
  const headers = [];
  let currentQuestion = "";

  // First read to get headers
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("headers", (csvHeaders) => {
        headers.push(...csvHeaders);
        console.log(`Found ${headers.length} headers in CSV`);
        // Log the first few headers to help with debugging
        console.log(`First 10 headers: ${headers.slice(0, 10).join(", ")}`);
      })
      .on("data", (row) => {
        // If first column has a value, it's a new question
        if (row[headers[0]]) {
          currentQuestion = row[headers[0]];
        }

        // Skip if we're filtering for a specific question and this isn't it
        if (options.question) {
          const targetQuestionPattern = new RegExp(
            `^Q?${options.question}[\\s\\.\\-]`,
            "i"
          );
          if (!targetQuestionPattern.test(currentQuestion)) {
            return; // Skip this row as it's not the question we're looking for
          }
          if (options.verbose) {
            console.log(`Processing question: ${currentQuestion}`);
          }
        }

        if (currentQuestion && row[headers[1]]) {
          const response = row[headers[1]];
          const dataObj = {}; // Initialize empty object without region

          // Extract Overall value (new code)
          if (row["Overall"] !== undefined) {
            let overallValue = row["Overall"];

            // Handle percentage format
            if (
              typeof overallValue === "string" &&
              overallValue.includes("%")
            ) {
              overallValue =
                parseFloat(overallValue.replace("%", "").trim()) / 100;
            } else {
              overallValue = parseFloat(overallValue);
            }

            // Store the overall value directly in the data object
            if (!isNaN(overallValue)) {
              dataObj.overall = overallValue;

              if (options.verbose) {
                console.log(
                  `Extracted Overall value: ${overallValue} for "${response}"`
                );
              }
            }
          }

          // For 2025 data, "Total" column contains the overall value
          else if (year === "2025" && row["Total"] !== undefined) {
            let overallValue = row["Total"];

            // Handle percentage format
            if (
              typeof overallValue === "string" &&
              overallValue.includes("%")
            ) {
              overallValue =
                parseFloat(overallValue.replace("%", "").trim()) / 100;
            } else {
              overallValue = parseFloat(overallValue);
            }

            // Store the overall value directly in the data object
            if (!isNaN(overallValue)) {
              dataObj.overall = overallValue;

              if (options.verbose) {
                console.log(
                  `Extracted Overall value from 'Total' column: ${overallValue} for "${response}"`
                );
              }
            }
          }

          // Now add region after overall is already set
          dataObj.region = {};

          // Process country data manually to ensure it works correctly
          if (year === "2024") {
            // For 2024, use the exact column names from the CSV
            const countryColumns = {
              country_UK: "united_kingdom",
              country_USA: "united_states",
              country_Australia: "australia",
              country_India: "india",
              country_Brazil: "brazil",
              country_Saudi_Arabia_UAE: "saudi_arabia_uae",
            };

            // Process each country column
            Object.entries(countryColumns).forEach(([csvColumn, regionKey]) => {
              if (row[csvColumn] !== undefined) {
                const value = parseFloat(row[csvColumn]);
                if (!isNaN(value)) {
                  dataObj.region[regionKey] = value;
                }
              }
            });
          } else if (year === "2025") {
            // For 2025, use the exact column names from the CSV
            const countryColumns = {
              country_US: "united_states",
              country_United_Kingdom: "united_kingdom",
              country_Australia: "australia",
              country_India: "india",
              country_Brazil: "brazil",
              country_Saudi_Arabia: "saudi_arabia",
              country_France: "france",
              country_Germany: "germany",
              country_Japan: "japan",
              country_United_Arab_Emirates: "united_arab_emirates",
            };

            // Process each country column
            Object.entries(countryColumns).forEach(([csvColumn, regionKey]) => {
              if (row[csvColumn] !== undefined) {
                let value = row[csvColumn];

                // Handle percentage format
                if (typeof value === "string" && value.includes("%")) {
                  value = parseFloat(value.replace("%", "").trim()) / 100;
                } else {
                  value = parseFloat(value);
                }

                if (!isNaN(value)) {
                  dataObj.region[regionKey] = value;
                }
              }
            });
          }

          // Continue with demographics processing
          // Add demographic data
          // Age
          dataObj.age = {};
          ["18-24", "25-34", "35-44", "45-54", "55-65"].forEach((age) => {
            // Try different possible field formats for age
            const possibleFields = [
              `age_${age.replace("-", "_")}`,
              `age_${age}`,
              `age_${age.replace("-", "to")}`,
            ];

            let value = null;
            for (const field of possibleFields) {
              if (row[field]) {
                value = parseFloat(row[field]);
                if (!isNaN(value)) {
                  dataObj.age[age] = value;
                  break;
                }
              }
            }
          });

          // Add age_65_plus separately (special case)
          if (row["age_65_plus"]) {
            const value = parseFloat(row["age_65_plus"]);
            if (!isNaN(value)) {
              dataObj.age["65+"] = value;
            }
          }

          // Gender
          dataObj.gender = {};
          ["male", "female"].forEach((gender) => {
            const value = parseFloat(row[`gender_${gender}`]);
            if (!isNaN(value)) {
              dataObj.gender[gender] = value;
            }
          });

          // Organization size - handle both 2024 and 2025 formats
          dataObj.org_size = {};

          // 2024 format fields
          const orgSizes2024 = {
            fewer_than_10: "fewer_than_10",
            "10_to_49": "10_to_49",
            "50_to_99": "50_to_99",
            "100_to_249": "100_to_249",
            "250_to_499": "250_to_499",
            "500_to_999": "500_to_999",
            "1000_or_more": "1000_or_more",
          };

          // 2025 format fields
          const orgSizes2025 = {
            "<10": "fewer_than_10",
            "10-49": "10_to_49",
            "50-99": "50_to_99",
            "100-500": "100_to_499",
            "501-1000": "500_to_999",
            "1000+": "1000_or_more",
          };

          // Process 2024 format
          Object.entries(orgSizes2024).forEach(([csvField, jsonField]) => {
            if (row[`org_size_${csvField}`]) {
              const value = parseFloat(row[`org_size_${csvField}`]);
              if (!isNaN(value)) {
                dataObj.org_size[jsonField] = value;
              }
            }
          });

          // Process 2025 format
          Object.entries(orgSizes2025).forEach(([csvField, jsonField]) => {
            if (row[`org_size_${csvField}`]) {
              const value = parseFloat(row[`org_size_${csvField}`]);
              if (!isNaN(value)) {
                dataObj.org_size[jsonField] = value;
              }
            }
          });

          // Sector - process both 2024 and 2025 formats
          dataObj.sector = {};

          // Common sectors that might be found in both years
          const commonSectors = [
            "agriculture_forestry_fishing",
            "automotive",
            "business_administration",
            "technology",
            "construction",
            "consumer_goods",
            "education",
            "energy_utilities",
            "financial_services",
            "food_drink",
            "government",
            "healthcare",
            "manufacturing_industrial",
            "marketing_services",
            "not_for_profit",
            "legal_in-house",
            "legal_agency",
            "life_sciences",
            "professional_services",
            "real_estate",
            "retail",
            "sales",
            "telecommunications",
            "transport_storage",
            "travel_hospitality_leisure",
            "wholesale_distribution",
            "other",
          ];

          // Check for sectors in CSV using different format patterns
          commonSectors.forEach((sectorBase) => {
            // Try different case formats and prefixes
            const variations = [
              `sector_${sectorBase}`,
              `sector_${
                sectorBase.charAt(0).toUpperCase() + sectorBase.slice(1)
              }`,
              `sector_${sectorBase
                .replace(/_/g, " ")
                .split(" ")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join("_")}`,
            ];

            let found = false;
            for (const fieldName of variations) {
              if (row[fieldName] !== undefined) {
                const value = parseFloat(row[fieldName]);
                if (!isNaN(value)) {
                  // Standardize the key to lowercase with underscores
                  const standardKey = sectorBase
                    .toLowerCase()
                    .replace(/\s/g, "_");
                  dataObj.sector[standardKey] = value;
                  found = true;
                  break;
                }
              }
            }
          });

          // Job level - process both 2024 and 2025 formats
          dataObj.job_level = {};

          // Map of possible job level fields and their standard keys
          const jobLevels = {
            CEO: "ceo",
            Senior_Executive: "senior_executive",
            Senior_Leader: "senior_leader",
            "Mid-Level_Leader": "mid_level_leader",
            First_Level_Supervisor: "first_level_supervisor",
            Individual_Contributor: "individual_contributor",
          };

          // Process job levels
          Object.entries(jobLevels).forEach(([csvField, jsonField]) => {
            // Try both lowercase and original case variations
            const fieldOptions = [
              `job_level_${csvField}`,
              `job_level_${csvField.toLowerCase()}`,
            ];

            for (const field of fieldOptions) {
              if (row[field] !== undefined) {
                const value = parseFloat(row[field]);
                if (!isNaN(value)) {
                  dataObj.job_level[jsonField] = value;
                  break;
                }
              }
            }
          });

          // Relationship/marital status
          dataObj.relationship_status = {};

          // Map of possible relationship status fields
          const relationshipStatuses = {
            Single: "single",
            "Co-habiting": "cohabiting",
            Married: "married",
            Divorced_separated: "divorced_separated",
            Widowed: "widowed",
          };

          // Process both formats (relationship_status_ and marital_status_ prefixes)
          Object.entries(relationshipStatuses).forEach(
            ([csvField, jsonField]) => {
              // Try multiple variants of the field name
              const variants = [
                `relationship_status_${csvField.toLowerCase()}`,
                `relationship_status_${csvField}`,
                `marital_status_${csvField.toLowerCase()}`,
                `marital_status_${csvField}`,
              ];

              // For 2024 data, also try with underscores instead of hyphens
              if (year === "2024") {
                variants.push(
                  `relationship_status_${csvField
                    .toLowerCase()
                    .replace(/-/g, "_")}`
                );
              }

              for (const fieldName of variants) {
                if (row[fieldName] !== undefined) {
                  const value = parseFloat(row[fieldName]);
                  if (!isNaN(value)) {
                    dataObj.relationship_status[jsonField] = value;
                    break;
                  }
                }
              }
            }
          );

          // Education
          dataObj.education = {};

          // Map of possible education fields
          const educationLevels = {
            Secondary: "secondary",
            Tertiary: "tertiary",
            Professional_Certifications: "professional_certifications",
            "Under-graduate_degree": "undergraduate",
            "Post-graduate_Masters_degree": "postgraduate",
            Doctorate_Phd: "doctorate",
            undergraduate: "undergraduate",
            postgraduate: "postgraduate",
            doctorate: "doctorate",
          };

          // Process education fields with more variants
          Object.entries(educationLevels).forEach(([csvField, jsonField]) => {
            // Try different variants of field names
            const variants = [
              `education_${csvField}`,
              `education_${csvField.toLowerCase()}`,
            ];

            // For 2024 data, also try direct field names as in CSV
            if (year === "2024") {
              variants.push(`education_${jsonField}`);
            }

            for (const fieldName of variants) {
              if (row[fieldName] !== undefined) {
                const value = parseFloat(row[fieldName]);
                if (!isNaN(value)) {
                  dataObj.education[jsonField] = value;
                  break;
                }
              }
            }
          });

          // Generation
          dataObj.generation = {};

          // Map of possible generation fields
          const generations = {
            Gen_Z: "gen_z",
            Millennials: "millennials",
            Gen_X: "gen_x",
            Baby_Boomers: "baby_boomers",
            "65_plus": "65_plus", // Special case for 65+ as a generation
          };

          // Handle generation data based on year
          if (year === "2024") {
            // For 2024, DO NOT derive generation data from age groups
            dataObj.generation = null;
          } else {
            // Process generation fields for other years
            Object.entries(generations).forEach(([csvField, jsonField]) => {
              if (row[csvField] !== undefined) {
                const value = parseFloat(row[csvField]);
                if (!isNaN(value)) {
                  dataObj.generation[jsonField] = value;
                }
              }
            });
          }

          // Employment status
          dataObj.employment_status = {};

          // Map of employment status fields
          const employmentStatuses = {
            "full-time": "full_time",
            "part-time": "part_time",
            contract: "contract",
            freelance: "freelance",
          };

          // Process employment status fields
          Object.entries(employmentStatuses).forEach(([csvKey, jsonField]) => {
            const field = `employment_status_${csvKey}`;
            if (row[field] !== undefined) {
              const value = parseFloat(row[field]);
              if (!isNaN(value)) {
                dataObj.employment_status[jsonField] = value;
              }
            }
          });

          // Before pushing to results, convert all percentage values to decimals for 2025 data
          if (year === "2025") {
            // Helper function to convert all numeric values that are percentages to decimals
            const convertPercentagesToDecimals = (obj) => {
              if (!obj || typeof obj !== "object") return;

              Object.keys(obj).forEach((key) => {
                if (typeof obj[key] === "number" && obj[key] > 1) {
                  // Numbers > 1 are likely percentages (e.g., 85 instead of 0.85)
                  obj[key] = obj[key] / 100;
                } else if (typeof obj[key] === "object") {
                  // Recursively process nested objects
                  convertPercentagesToDecimals(obj[key]);
                }
              });
            };

            // Convert all percentages in dataObj
            convertPercentagesToDecimals(dataObj);
          }

          results.push({
            question: currentQuestion,
            response: response,
            data: dataObj,
          });
        }
      })
      .on("end", () => {
        console.log(`Successfully processed ${results.length} rows from CSV`);
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Harmonize 2025 data format (convert percentages to decimals)
 * @param {string} inputPath - The input CSV file path
 * @param {string} outputDir - The output directory
 * @returns {Promise<string>} - Promise that resolves to the path of the harmonized file
 */
async function harmonize2025Data(inputPath, outputDir) {
  console.log(
    `\nSTEP 0: Harmonizing 2025 data format (converting percentages to decimals)...`
  );
  console.log(`Input: ${inputPath}`);

  // Check if the input file exists
  if (!fs.existsSync(inputPath)) {
    console.warn(`\nWarning: Input file not found at ${inputPath}`);

    // Try to find the file in 2025_DATA_PROCESSING directory as a fallback
    const alternativePath = path.join(
      __dirname,
      "..",
      "2025_DATA_PROCESSING",
      "2025_global_data.csv"
    );
    if (fs.existsSync(alternativePath)) {
      console.log(`Found alternative input file at: ${alternativePath}`);
      inputPath = alternativePath;
    } else {
      throw new Error(
        `2025 data CSV file not found at ${inputPath} or ${alternativePath}`
      );
    }
  }

  // If the output file already exists, we can skip harmonization
  const expectedOutputPath = path.join(
    path.dirname(outputDir),
    "2025_global_data.csv"
  );
  if (fs.existsSync(expectedOutputPath) && !options.force) {
    console.log(`\nHarmonized file already exists at: ${expectedOutputPath}`);
    console.log(`Use --force to regenerate it if needed.`);
    return expectedOutputPath;
  }

  const harmonizeOptions = {
    inputCsvPath: inputPath,
    outputDir: path.dirname(outputDir),
    verbose: options.verbose,
  };

  const startTime = Date.now();

  try {
    // Read CSV data
    const rows = [];

    // Create parser and read all rows
    await new Promise((resolve, reject) => {
      fs.createReadStream(inputPath)
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`Read ${rows.length} rows from CSV`);

    // Process each row to harmonize the data using our improved country processing
    const harmonizedData = rows.map((row) => {
      // Create the base structure for the harmonized row
      const harmonizedRow = {
        question: row.Question,
        response: row.Response,
        data: {
          region: {},
          age: {},
          gender: {},
          org_size: {},
          sector: {},
          job_level: {},
          relationship_status: {},
          education: {},
          generation: {},
          employment_status: {},
        },
      };

      // Use the consistent country processing function for all questions
      // This will properly handle both raw and prefixed country names
      processCountryData(row, harmonizedRow.data, year);

      // Process other demographic segments (age, gender, etc.)
      // ... existing demographic processing logic ...

      return harmonizedRow;
    });

    // Write harmonized data to the expected output path
    fs.writeFileSync(
      expectedOutputPath,
      JSON.stringify(harmonizedData, null, 2)
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Data harmonized successfully in ${duration} seconds.`);
    console.log(`   Output: ${expectedOutputPath}`);
    console.log(`   Processed ${harmonizedData.length} records.`);

    return expectedOutputPath;
  } catch (error) {
    console.error(`❌ Harmonization error: ${error.message}`);
    throw error;
  }
}

/**
 * Validate that outputs exist and meet basic criteria
 */
async function validateOutputs() {
  console.log(`\nValidating outputs for ${year} data...`);

  const issues = [];

  // Check if global JSON exists
  if (!fs.existsSync(globalOutputPath)) {
    issues.push(`Global JSON file not found: ${globalOutputPath}`);
  } else {
    // Basic validation of global JSON
    try {
      const globalData = JSON.parse(fs.readFileSync(globalOutputPath, "utf8"));
      console.log(`✓ Global JSON exists with ${globalData.length} items`);

      if (globalData.length === 0) {
        issues.push("Global JSON file exists but contains no data");
      }
    } catch (error) {
      issues.push(`Global JSON exists but is not valid JSON: ${error.message}`);
    }
  }

  // Check if split files directory exists
  if (!fs.existsSync(splitOutputDir)) {
    issues.push(`Split files directory not found: ${splitOutputDir}`);
  } else {
    // Count split files for this year
    const splitFiles = fs
      .readdirSync(splitOutputDir)
      .filter((file) => file.startsWith(`${year}_`));

    console.log(`✓ Found ${splitFiles.length} split files for ${year}`);

    if (splitFiles.length === 0) {
      issues.push(`No split files found for year ${year}`);
    }
  }

  if (issues.length > 0) {
    console.log(`\n❌ Validation found ${issues.length} issues:`);
    issues.forEach((issue) => console.log(`  - ${issue}`));
    return false;
  }

  console.log(`\n✅ All validation checks passed for ${year} data`);
  return true;
}

/**
 * Find the canonical topic for a question
 */
function findCanonicalTopic(question, canonicalMapping, year) {
  if (!canonicalMapping) {
    return null;
  }

  // Handle different canonical mapping structures

  // Traditional structure (legacy format)
  if (canonicalMapping.topics) {
    return findCanonicalTopicLegacy(question, canonicalMapping, year);
  }

  // New structure (themes -> topics structure)
  if (canonicalMapping.themes) {
    return findCanonicalTopicNew(question, canonicalMapping, year);
  }

  return null;
}

/**
 * Find the canonical topic using the legacy mapping format
 */
function findCanonicalTopicLegacy(question, canonicalMapping, year) {
  // Direct ID match - if question starts with a number like "1. "
  const idMatch = question.match(/^Q?(\d+)[.\s]/i);
  const questionId = idMatch ? idMatch[1] : null;

  // Extended match for sub-questions like "4_9."
  const subIdMatch = question.match(/^(\d+_\d+)[.\s]/i);
  const subQuestionId = subIdMatch ? subIdMatch[1] : null;

  // Check each topic
  for (const topic of canonicalMapping.topics) {
    // Check if this year's mapping includes this question ID (simple ID or sub-ID)
    if (topic.mapping && topic.mapping[year]) {
      if (questionId && topic.mapping[year].includes(questionId)) {
        return topic;
      }
      if (subQuestionId && topic.mapping[year].includes(subQuestionId)) {
        return topic;
      }
    }

    // Check for direct question text match
    if (
      topic.canonicalQuestion &&
      question.toLowerCase().includes(topic.canonicalQuestion.toLowerCase())
    ) {
      return topic;
    }

    // Check alternate phrasings
    if (topic.alternatePhrasings && topic.alternatePhrasings.length > 0) {
      for (const phrase of topic.alternatePhrasings) {
        if (question.toLowerCase().includes(phrase.toLowerCase())) {
          return topic;
        }
      }
    }
  }

  return null;
}

/**
 * Find the canonical topic using the new mapping format (themes -> topics)
 */
function findCanonicalTopicNew(question, canonicalMapping, year) {
  // Direct ID match - if question starts with a number like "1. "
  const idMatch = question.match(/^Q?(\d+)[.\s]/i);
  const questionId = idMatch ? idMatch[1] : null;

  // Extended match for sub-questions like "4_9."
  const subIdMatch = question.match(/^(\d+_\d+)[.\s]/i);
  const subQuestionId = subIdMatch ? subIdMatch[1] : null;

  // Search through all themes and their topics
  for (const theme of canonicalMapping.themes) {
    for (const topic of theme.topics) {
      // Check if this year's mapping includes this question ID
      if (topic.mapping && topic.mapping[year]) {
        const yearMapping = topic.mapping[year];

        // The mapping could be an array of strings or an array of objects
        for (const entry of yearMapping) {
          // Handle string format like "Q5" or object format like {id: "Q5", file: "2025_5.json"}
          const entryId = typeof entry === "object" ? entry.id : entry;
          const cleanEntryId = entryId.replace(/^Q/i, "");

          if (questionId && cleanEntryId === questionId) {
            return topic;
          }

          if (subQuestionId && cleanEntryId === subQuestionId) {
            return topic;
          }
        }
      }

      // Check for direct question text match
      if (
        topic.canonicalQuestion &&
        question.toLowerCase().includes(topic.canonicalQuestion.toLowerCase())
      ) {
        return topic;
      }

      // Check alternate phrasings
      if (topic.alternatePhrasings && topic.alternatePhrasings.length > 0) {
        for (const phrase of topic.alternatePhrasings) {
          if (question.toLowerCase().includes(phrase.toLowerCase())) {
            return topic;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Create a basic canonical mapping for proper file naming
 */
function createBasicCanonicalMapping() {
  return {
    topics: [
      {
        id: "Attraction_Factors",
        theme: "Talent Attraction & Retention",
        canonicalQuestion: "Most important factors when looking for a new job",
        mapping: { 2024: ["1", "Q1"] },
        alternatePhrasings: [
          "job attraction",
          "new job factors",
          "job search factors",
        ],
        comparable: false,
        keywords: [
          "job search",
          "job preferences",
          "talent attraction",
          "job priorities",
          "career decisions",
        ],
        userMessage:
          "These factors reflect what job seekers value most in potential employers.",
        relatedTopics: [
          "Retention_Factors",
          "Intention_to_Leave",
          "Work_Experience",
        ],
      },
      {
        id: "Retention_Factors",
        theme: "Talent Attraction & Retention",
        canonicalQuestion: "Factors to Stay at Current Company",
        mapping: { 2024: ["2", "Q2"] },
        alternatePhrasings: [
          "job retention",
          "stay factors",
          "retention drivers",
        ],
        comparable: false,
        keywords: [
          "employee retention",
          "talent retention",
          "retention strategies",
          "job loyalty",
          "stay factors",
        ],
        userMessage:
          "These factors are key to retaining employees in the current competitive market.",
        relatedTopics: [
          "Attraction_Factors",
          "Intention_to_Leave",
          "Leadership_Confidence",
        ],
      },
      {
        id: "Intention_to_Leave",
        theme: "Talent Attraction & Retention",
        canonicalQuestion: "Factors to Leave Current Company",
        mapping: { 2024: ["3", "Q3"] },
        alternatePhrasings: [
          "leave factors",
          "attrition drivers",
          "turnover factors",
        ],
        comparable: false,
        keywords: [
          "employee turnover",
          "attrition",
          "job leaving",
          "departure reasons",
          "resignation factors",
        ],
        userMessage:
          "Understanding these factors can help organizations address potential attrition risks.",
        relatedTopics: [
          "Retention_Factors",
          "Work_Experience",
          "Leadership_Confidence",
        ],
      },
      {
        id: "Work_Experience",
        theme: "Employee Experience",
        canonicalQuestion:
          "How would you describe your current work experience?",
        mapping: { 2024: ["4", "Q4"] },
        alternatePhrasings: [
          "current role",
          "job satisfaction",
          "work conditions",
        ],
        comparable: true,
        keywords: [
          "employee experience",
          "workplace satisfaction",
          "job experience",
          "work environment",
          "job quality",
        ],
        userMessage:
          "These insights reflect the overall employee experience across different dimensions.",
        relatedTopics: [
          "Wellbeing",
          "Leadership_Confidence",
          "Diversity_and_Inclusion",
        ],
      },
      {
        id: "Wellbeing",
        theme: "Employee Experience",
        canonicalQuestion: "How would you describe your wellbeing at work?",
        mapping: { 2024: ["5", "Q5"] },
        alternatePhrasings: [
          "work wellbeing",
          "employee wellness",
          "workplace health",
        ],
        comparable: true,
        keywords: [
          "workplace wellbeing",
          "employee wellness",
          "mental health",
          "work-life balance",
          "burnout prevention",
        ],
        userMessage:
          "Employee wellbeing is increasingly recognized as critical to organizational success.",
        relatedTopics: [
          "Work_Experience",
          "Work_Life_Flexibility",
          "Leadership_Confidence",
        ],
      },
      {
        id: "Diversity_and_Inclusion",
        theme: "Culture & Values",
        canonicalQuestion:
          "How would you describe diversity and inclusion at your workplace?",
        mapping: { 2024: ["6", "Q6"] },
        alternatePhrasings: [
          "diversity",
          "inclusion",
          "DE&I",
          "workplace diversity",
        ],
        comparable: true,
        keywords: [
          "diversity",
          "inclusion",
          "equity",
          "belonging",
          "DE&I initiatives",
        ],
        userMessage:
          "An inclusive workplace culture is essential for attracting and retaining diverse talent.",
        relatedTopics: [
          "Work_Experience",
          "Culture_and_Values",
          "Leadership_Confidence",
        ],
      },
      {
        id: "Leadership_Confidence",
        theme: "Leadership & Management",
        canonicalQuestion:
          "How confident are you in your organization's leadership?",
        mapping: { 2024: ["7", "Q7"] },
        alternatePhrasings: [
          "leadership quality",
          "management confidence",
          "leader effectiveness",
        ],
        comparable: true,
        keywords: [
          "leadership trust",
          "management confidence",
          "executive capability",
          "organizational leadership",
          "leadership effectiveness",
        ],
        userMessage:
          "Leadership confidence is a key driver of employee engagement and retention.",
        relatedTopics: [
          "Work_Experience",
          "Retention_Factors",
          "Culture_and_Values",
        ],
      },
      {
        id: "AI_Attitudes",
        theme: "Future of Work",
        canonicalQuestion:
          "What are your attitudes toward AI in the workplace?",
        mapping: { 2024: ["4_9", "4_10", "4_11"] },
        alternatePhrasings: [
          "AI perception",
          "artificial intelligence",
          "AI adoption",
        ],
        comparable: false,
        keywords: [
          "artificial intelligence",
          "AI adoption",
          "workplace technology",
          "digital transformation",
          "tech attitudes",
        ],
        userMessage:
          "Understanding employee attitudes toward AI is critical for successful technology implementation.",
        relatedTopics: [
          "Work_Experience",
          "Future_Skills",
          "Career_Development",
        ],
      },
      {
        id: "Motivation_and_Fulfillment",
        theme: "Employee Experience",
        canonicalQuestion:
          "How motivated and fulfilled do you feel in your role?",
        mapping: {
          2024: [
            "18",
            "Q18",
            "18_1",
            "18_2",
            "18_3",
            "18_4",
            "18_5",
            "18_6",
            "18_7",
            "18_8",
          ],
        },
        alternatePhrasings: [
          "job motivation",
          "workplace fulfillment",
          "employee engagement",
          "work motivation",
        ],
        comparable: false,
        keywords: [
          "job satisfaction",
          "work engagement",
          "employee motivation",
          "workplace fulfillment",
          "Motivation_and_Fulfillment",
        ],
        userMessage:
          "Compare with caution due to differences in question framing between years.",
        relatedTopics: [
          "Work_Life_Flexibility",
          "Culture_and_Values",
          "Employee_Wellbeing",
        ],
      },
    ],
  };
}

/**
 * Create response metadata with proper segments
 * @param {Array} segments - Array of segment names
 * @returns {Object} - Metadata object with segments including overall
 */
function createResponseMetadata(segments) {
  // Map segments to expected format for metadata
  const formattedSegments = segments.map((segment) => {
    return {
      key: segment,
      display:
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/_/g, " "),
    };
  });

  // Make sure 'overall' is included in the segments
  if (!formattedSegments.some((segment) => segment.key === "overall")) {
    formattedSegments.push({ key: "overall", display: "Overall" });
  }

  return {
    segments: formattedSegments,
    version: 1,
  };
}

/**
 * Split global data into individual files with metadata
 */
async function splitGlobalDataToFiles(params) {
  try {
    const inputFile = params.input;
    const year = params.year;
    const outputDir = params.output;
    const verboseOutput = params.verbose || false;
    const targetQuestion = params.question || null;

    console.log(`Reading global data file: ${inputFile}`);
    const globalData = JSON.parse(fs.readFileSync(inputFile, "utf8"));

    console.log(`Read ${globalData.length} items from global data file`);

    // If filtering by question, log this information
    if (targetQuestion) {
      console.log(`Filtering for question ID: Q${targetQuestion}`);
    }

    // Load canonical mapping for proper file naming
    const canonicalMappingPath = path.join(
      __dirname,
      "reference files",
      "2025",
      "canonical_topic_mapping.json"
    );
    let canonicalMapping = null;

    try {
      if (fs.existsSync(canonicalMappingPath)) {
        console.log(`Loading canonical mapping from: ${canonicalMappingPath}`);
        canonicalMapping = JSON.parse(
          fs.readFileSync(canonicalMappingPath, "utf8")
        );
      } else {
        console.error(
          "Canonical mapping file not found. This is required for processing."
        );
        throw new Error("Canonical mapping file not found");
      }
    } catch (error) {
      console.error(`Error loading canonical mapping: ${error.message}`);
      throw error;
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // OPTIMIZATION: Create a map of questions by their IDs for efficient lookup
    // This uses a more robust pattern matching for question identification
    const questionsById = new Map();
    const unmappedQuestions = [];

    // Enhanced regex patterns for extracting question IDs
    const mainQuestionPattern = /^Q?(\d+)[.\s-]/i;
    const subQuestionPattern = /^Q?(\d+)_(\d+)[.\s-]/i;
    const statementPattern = /^Q?(\d+)_(\d+)\.\s+(.+)/i;

    // Statement keywords for fuzzy matching statement questions (merged from split_to_files.js)
    const statementKeywords = {
      // Q5 - AI Readiness
      "ai readiness": "5_1",
      "effective use of ai": "5_2",
      "ai adoption": "5_3",
      "ai competence": "5_4",
      "proficiency with ai": "5_5",
      "ai integration": "5_6",
      "readiness for ai": "5_7",
      "experimentation with ai": "5_8",

      // Q6 - Workplace Flexibility
      "flexible work": "6_1",
      "remote work": "6_2",
      "hybrid work": "6_3",
      "work from home": "6_4",
      "work-life balance": "6_5",
      "workplace flexibility": "6_6",
      "flexible schedule": "6_7",
      "work arrangement": "6_8",

      // Q7 - Economic Security
      "organization handles decisions": "7_1",
      "job market": "7_2",
      "people over profits": "7_3",
      relocating: "7_4",
      immigration: "7_5",
      "economic security": "7_6",
      "dei initiatives": "7_7",
      "return to office": "7_8",

      // Q8 - Barriers and Discrimination
      "leadership has negatively impacted": "8_1",
      discrimination: "8_2",
      "stretched too far": "8_3",
      "overlooked for leadership": "8_4",
      "overlooked for training": "8_5",
      "overlooked for promotions": "8_6",
      "class barriers": "8_7",
      "race barriers": "8_8",
      "sex barriers": "8_9",
      "imposter syndrome": "8_10",
      "share negative reviews": "8_11",

      // Q9 - Manager Dynamics
      "manager empowers": "9_1",
      "welcomed by company leaders": "9_2",
      "comfortable telling my manager": "9_3",
      "manager appears directionless": "9_4",
      "comfortable discussing": "9_5",
      "manager appears overwhelmed": "9_6",
      "cut back on the number of managers": "9_7",
      "lack of managers": "9_8",

      // Q17 - Job Satisfaction
      "challenging and interesting work": "17_1",
      "good use of my skills": "17_2",
      "learning and development": "17_3",
      "best work": "17_4",
      "strategically adapting": "17_5",
      motivated: "17_6",
      "senior leadership team": "17_7",
      "care and concern for its employees": "17_8",
    };

    // Function to identify question ID using enhanced pattern matching
    function identifyQuestionId(question, response) {
      // Try direct ID extraction using regex patterns
      let subMatch = subQuestionPattern.exec(question);
      if (subMatch) {
        return `${subMatch[1]}_${subMatch[2]}`;
      }

      let mainMatch = mainQuestionPattern.exec(question);
      if (mainMatch) {
        return mainMatch[1];
      }

      // For statement questions, try to match based on response content
      if (
        question.toLowerCase().includes("to what extent do you agree") &&
        response
      ) {
        const lowerResponse = response.toLowerCase();

        // Check for keywords in the response
        for (const [keyword, id] of Object.entries(statementKeywords)) {
          if (lowerResponse.includes(keyword.toLowerCase())) {
            if (verboseOutput) {
              console.log(
                `Identified statement question ${id} based on keyword "${keyword}" in response`
              );
            }
            return id;
          }
        }

        // If no specific match, try to identify the main question category
        if (question.toLowerCase().includes("workplace")) return "6_1";
        if (
          question.toLowerCase().includes("economic") ||
          question.toLowerCase().includes("organization")
        )
          return "7_1";
        if (
          question.toLowerCase().includes("barriers") ||
          question.toLowerCase().includes("discrimination")
        )
          return "8_1";
        if (question.toLowerCase().includes("manager")) return "9_1";
        if (
          question.toLowerCase().includes("ai") ||
          question.toLowerCase().includes("technologies")
        )
          return "5_1";
        if (
          question.toLowerCase().includes("job satisfaction") ||
          question.toLowerCase().includes("motivation")
        )
          return "17_1";
      }

      // Handle special cases for certain questions
      if (
        question.toLowerCase().includes("location") ||
        question.toLowerCase().includes("place of work")
      ) {
        return "4";
      }

      if (question.toLowerCase().includes("ideal role")) {
        if (question.toLowerCase().includes("employment arrangement")) {
          return "13";
        }
        return "10";
      }

      // If all else fails, return null
      return null;
    }

    // Process all items to extract question IDs and their data
    globalData.forEach((item) => {
      const { question, response, data } = item;

      if (!question) {
        unmappedQuestions.push("Item with no question text");
        return;
      }

      // Get question ID using enhanced identification
      const questionId = identifyQuestionId(question, response);

      if (!questionId) {
        unmappedQuestions.push(question);
        if (verboseOutput) {
          console.log(
            `Could not identify question ID for: "${question.substring(
              0,
              50
            )}..."`
          );
        }
        return;
      }

      // Split into main question ID and sub-question ID if applicable
      let mainQuestionId = questionId;
      let subQuestionId = null;

      if (questionId.includes("_")) {
        [mainQuestionId, subQuestionId] = questionId.split("_");
      }

      // Store by main question ID
      if (!questionsById.has(mainQuestionId)) {
        questionsById.set(mainQuestionId, {
          question,
          responses: [],
          subQuestions: new Map(),
        });
      }

      // Add response to the main question
      questionsById.get(mainQuestionId).responses.push({
        response,
        data, // This preserves the complete data object with all demographic segments
      });

      // If it's a sub-question, also store it separately
      if (subQuestionId) {
        const mainQuestion = questionsById.get(mainQuestionId);

        if (!mainQuestion.subQuestions.has(subQuestionId)) {
          mainQuestion.subQuestions.set(subQuestionId, []);
        }

        mainQuestion.subQuestions.get(subQuestionId).push({
          response,
          data, // This preserves the complete data object with all demographic segments
        });
      }
    });

    // Report any unmapped questions
    if (unmappedQuestions.length > 0 && verboseOutput) {
      console.log(
        `\nWarning: ${unmappedQuestions.length} questions could not be identified:`
      );
      unmappedQuestions.slice(0, 5).forEach((q) => {
        console.log(`- "${q.substring(0, 50)}..."`);
      });
      if (unmappedQuestions.length > 5) {
        console.log(`... and ${unmappedQuestions.length - 5} more`);
      }
    }

    // Track created files
    let fileCount = 0;
    const createdFiles = new Set();

    // Parse canonical mapping and create files
    if (canonicalMapping && canonicalMapping.themes) {
      console.log("Processing canonical mapping to create files...");

      // Get all file entries from the canonical mapping
      const fileEntries = [];

      // Process each theme and topic
      canonicalMapping.themes.forEach((theme) => {
        theme.topics.forEach((topic) => {
          if (topic.mapping && topic.mapping[year]) {
            topic.mapping[year].forEach((entry) => {
              fileEntries.push({
                entry,
                topic,
                themeName: theme.name,
              });
            });
          }
        });
      });

      console.log(
        `Found ${fileEntries.length} file entries in canonical mapping`
      );

      // Create files based on the canonical mapping
      for (const { entry, topic, themeName } of fileEntries) {
        if (typeof entry !== "object" || !entry.id || !entry.file) {
          if (verboseOutput) {
            console.warn(`Skipping invalid entry: ${JSON.stringify(entry)}`);
          }
          continue;
        }

        // Get question ID without the 'Q' prefix
        const questionId = entry.id.replace(/^Q/i, "");

        // Skip if we're filtering for a specific question and this isn't it
        if (targetQuestion && !questionId.startsWith(targetQuestion)) {
          if (verboseOutput) {
            console.log(
              `Skipping question ID ${questionId} (looking for ${targetQuestion})`
            );
          }
          continue;
        }

        // Check if we have question data for this ID
        let questionData;
        let responseItems = [];

        // Handle main question vs sub-question
        if (questionId.includes("_")) {
          const [mainId, subId] = questionId.split("_");

          if (questionsById.has(mainId)) {
            const mainQuestion = questionsById.get(mainId);

            // Get the main question text
            questionData = mainQuestion.question;

            // Try to get the specific sub-question response
            if (mainQuestion.subQuestions.has(subId)) {
              responseItems = mainQuestion.subQuestions.get(subId);
            } else {
              // If specific sub-question not found, try using index
              const subIndex = parseInt(subId) - 1;
              if (subIndex >= 0 && subIndex < mainQuestion.responses.length) {
                responseItems = [mainQuestion.responses[subIndex]];
              }
            }
          }
        } else {
          // Direct question ID match
          if (questionsById.has(questionId)) {
            const mainQuestion = questionsById.get(questionId);
            questionData = mainQuestion.question;
            responseItems = mainQuestion.responses;
          }
        }

        // Skip if no data found
        if (!questionData || responseItems.length === 0) {
          console.warn(`No data found for question ID: ${questionId}`);
          continue;
        }

        // Prepare metadata from canonical - using ONLY the values directly from the canonical mapping
        const metadata = {
          topicId: topic.id,
          theme: themeName || "",
          questionId: `Q${questionId}`,
          year: parseInt(year),
          keywords: generateKeywords(topic),
          canonicalQuestion: topic.canonicalQuestion || "",
          subQuestion: responseItems[0].response || "",
          comparable: topic.comparable || false,
          userMessage: topic.userMessage || "",
          availableMarkets: topic.availableMarkets || [],
          relatedTopics: topic.relatedTopics || [],
          dataStructure: {
            questionField: "question",
            responsesArray: "responses",
            responseTextField: "response",
            dataField: "data",
            segments: [
              "overall",
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
            ],
            valueFormat: "decimal",
            sortOrder: "descending",
          },
          responseMetadata: createResponseMetadata([
            "overall",
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
          ]),
        };

        // Create file data
        const fileData = {
          metadata,
          question: questionData,
          responses: responseItems.map((item) => {
            // Ensure each response item has the overall field if it's missing
            if (item.data && item.data.overall === undefined) {
              item.data.overall = null; // Set to null if missing
            }
            return item;
          }),
        };

        // Output file path
        const outputFile = path.join(outputDir, entry.file);

        // Track created files
        createdFiles.add(entry.file);

        // Write the file
        fs.writeFileSync(outputFile, JSON.stringify(fileData, null, 2));
        console.log(
          `Created file: ${outputFile} with ${responseItems.length} responses`
        );
        fileCount++;
      }
    }

    // Create a file index
    const fileIndex = Array.from(createdFiles).map((file) => {
      // Try to read the file to get question and topic ID
      try {
        const fileData = JSON.parse(
          fs.readFileSync(path.join(outputDir, file), "utf8")
        );
        return {
          file,
          question:
            fileData.question.substring(0, 100) +
            (fileData.question.length > 100 ? "..." : ""),
          topicId: fileData.metadata?.topicId || null,
        };
      } catch (e) {
        return { file, question: "Error reading file", topicId: null };
      }
    });

    // Write the file index
    fs.writeFileSync(
      path.join(outputDir, `${year}_file_index.json`),
      JSON.stringify(fileIndex, null, 2)
    );

    console.log(
      `\nSuccessfully created ${fileCount} individual question files`
    );
    console.log(
      `Created file index at: ${path.join(
        outputDir,
        `${year}_file_index.json`
      )}`
    );

    return fileCount;
  } catch (error) {
    console.error("Error splitting global data to files:", error);
    throw error;
  }
}

/**
 * Generate keywords for a topic based on add_metadata.js logic
 */
function generateKeywords(topic) {
  // Start with alternatePhrasings if available
  let keywords = [];

  if (
    topic.alternatePhrasings &&
    Array.isArray(topic.alternatePhrasings) &&
    topic.alternatePhrasings.length > 0
  ) {
    keywords = [...topic.alternatePhrasings];

    // Add topic ID if not already included
    if (!keywords.includes(topic.id)) {
      keywords.push(topic.id);
    }

    // Add topic-specific keywords for common topics
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

    // Add additional keywords if applicable
    if (topicSpecificKeywords[topic.id]) {
      for (const keyword of topicSpecificKeywords[topic.id]) {
        if (!keywords.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    // Limit to 10 keywords for consistency
    if (keywords.length > 10) {
      keywords = keywords.slice(0, 10);
    }
  } else if (topic.keywords && Array.isArray(topic.keywords)) {
    // Fallback to keywords if defined
    keywords = [...topic.keywords];
  } else {
    // Last resort - add topic ID
    keywords = [topic.id];
  }

  return keywords;
}

/**
 * Handle errors with a helpful message
 */
function handleError(error) {
  console.error(`\n❌ ERROR: ${error.message}`);
  console.log("\nTry running with --help for usage information");
  process.exit(1);
}

/**
 * Main function to run the complete survey data processing workflow
 */
async function main() {
  console.log("=== SURVEY DATA PROCESSING WORKFLOW ===");
  console.log(`Year: ${year}`);
  console.log(`Input: ${csvPath}`);
  console.log(`Output Directory: ${outputDir}`);

  // Display when processing a single question
  if (options.question) {
    console.log(`Processing single question: Q${options.question}`);
  }

  console.log("=====================================\n");

  try {
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    // If validation only mode is enabled, just validate and exit
    if (options.validateOnly) {
      console.log("VALIDATION MODE: Only checking existing outputs");
      await validateOutputs();
      return { success: true, message: "Validation complete" };
    }

    // For 2025 data, the consolidated CSV should already exist in scripts/data/2025/
    // No need to run harmonization as this is done by generate_consolidated_csv.js
    let inputFilePath = csvPath;

    // Just verify the input file exists
    if (!fs.existsSync(inputFilePath)) {
      console.error(`\n❌ ERROR: Input file not found at ${inputFilePath}`);
      console.error(`
For 2025 data, please ensure:
1. You've run generate_consolidated_csv.js in the 2025_DATA_PROCESSING directory
2. Copied the output to scripts/data/2025/2025_global_data.csv
      `);
      throw new Error(`Input file not found: ${inputFilePath}`);
    } else {
      console.log(`\nFound input CSV file: ${inputFilePath}`);
    }

    // Step 1: Process CSV to global JSON
    if (!options.skipGlobal) {
      console.log("\nSTEP 1: Processing CSV to global JSON...");
      const startTime1 = Date.now();

      const globalData = await processCSVToGlobal(inputFilePath);
      fs.writeFileSync(globalOutputPath, JSON.stringify(globalData, null, 2));

      const duration1 = ((Date.now() - startTime1) / 1000).toFixed(2);
      console.log(
        `✅ Global JSON created successfully in ${duration1} seconds.`
      );
      console.log(`   Output: ${globalOutputPath}`);
    } else {
      console.log("\nSTEP 1: SKIPPED - Not processing CSV to global JSON");
    }

    // Step 2: Split global JSON and add metadata
    if (!options.skipSplit) {
      console.log("\nSTEP 2: Splitting global JSON and adding metadata...");

      // Verify global JSON exists first
      if (!fs.existsSync(globalOutputPath)) {
        throw new Error(
          `Global JSON file not found: ${globalOutputPath}. Run without --skip-global first.`
        );
      }

      const startTime2 = Date.now();

      const fileCount = await splitGlobalDataToFiles({
        input: globalOutputPath,
        year: year,
        output: splitOutputDir,
        verbose: options.verbose,
        question: options.question,
      });

      const duration2 = ((Date.now() - startTime2) / 1000).toFixed(2);
      console.log(
        `✅ Split ${fileCount} files with metadata in ${duration2} seconds.`
      );
      console.log(`   Output directory: ${splitOutputDir}`);
    } else {
      console.log("\nSTEP 2: SKIPPED - Not splitting global JSON");
    }

    // Final summary
    const totalDuration = ((Date.now() - performanceStartTime) / 1000).toFixed(
      2
    );
    console.log("\n=== PROCESSING COMPLETE ===");
    console.log(`Total processing time: ${totalDuration} seconds`);
    if (!options.skipSplit && !options.skipGlobal) {
      console.log("All processing steps completed successfully");
    } else {
      console.log("Some processing steps were skipped as requested");
    }
    console.log("=============================");

    return { success: true };
  } catch (error) {
    handleError(error);
    return { success: false, error };
  }
}

// Track overall performance
const performanceStartTime = Date.now();

// Execute if run directly
if (require.main === module) {
  main()
    .then((result) => {
      if (result.success) {
        console.log("Survey data processing completed successfully.");
        process.exit(0);
      } else {
        console.error("Survey data processing failed.");
        process.exit(1);
      }
    })
    .catch((err) => {
      handleError(err);
    });
}

module.exports = {
  processCSVToGlobal,
  splitGlobalDataToFiles,
  harmonize2025Data,
  main,
};

// Replace or add this function for consistent country data processing across all questions
function processCountryData(row, dataObj, year) {
  // Initialize region object if not already done
  if (!dataObj.region) {
    dataObj.region = {};
  }

  // Process country data - use exact field names from the CSV
  if (year === 2024 || year === "2024") {
    // Use the exact column names from the 2024 CSV - fix the exact property access
    if (row["country_UK"] !== undefined)
      dataObj.region.united_kingdom = parseFloat(row["country_UK"]);
    if (row["country_USA"] !== undefined)
      dataObj.region.united_states = parseFloat(row["country_USA"]);
    if (row["country_Australia"] !== undefined)
      dataObj.region.australia = parseFloat(row["country_Australia"]);
    if (row["country_India"] !== undefined)
      dataObj.region.india = parseFloat(row["country_India"]);
    if (row["country_Brazil"] !== undefined)
      dataObj.region.brazil = parseFloat(row["country_Brazil"]);
    if (row["country_Saudi_Arabia_UAE"] !== undefined)
      dataObj.region.saudi_arabia_uae = parseFloat(
        row["country_Saudi_Arabia_UAE"]
      );

    // For debugging purposes only
    if (options.verbose) {
      const countryFields = Object.keys(row).filter((key) =>
        key.startsWith("country_")
      );
      if (
        countryFields.length > 0 &&
        Object.keys(dataObj.region).length === 0
      ) {
        console.log(
          `WARNING: Found country fields (${countryFields.join(
            ", "
          )}) but region object is empty`
        );
        console.log(`First field value: ${row[countryFields[0]]}`);
      }
    }
  } else if (year === 2025) {
    // For 2025 data
    if ("United Kingdom" in row)
      dataObj.region.united_kingdom = convertPercentToDecimal(
        row["United Kingdom"]
      );
    if ("United States" in row)
      dataObj.region.united_states = convertPercentToDecimal(
        row["United States"]
      );
    if ("Australia" in row)
      dataObj.region.australia = convertPercentToDecimal(row.Australia);
    if ("India" in row)
      dataObj.region.india = convertPercentToDecimal(row.India);
    if ("Brazil" in row)
      dataObj.region.brazil = convertPercentToDecimal(row.Brazil);
    if ("Saudi Arabia/UAE" in row)
      dataObj.region.saudi_arabia_uae = convertPercentToDecimal(
        row["Saudi Arabia/UAE"]
      );
  }

  // Process age data
  if (!dataObj.age) {
    dataObj.age = {};
  }

  // For both 2024 and 2025, check if the fields exist before adding
  if (year === 2024) {
    if ("age_18-24" in row) dataObj.age["18-24"] = parseFloat(row["age_18-24"]);
    if ("age_25-34" in row) dataObj.age["25-34"] = parseFloat(row["age_25-34"]);
    if ("age_35-44" in row) dataObj.age["35-44"] = parseFloat(row["age_35-44"]);
    if ("age_45-54" in row) dataObj.age["45-54"] = parseFloat(row["age_45-54"]);
    if ("age_55-65" in row) dataObj.age["55-65"] = parseFloat(row["age_55-65"]);
  } else if (year === 2025) {
    if ("18-24" in row)
      dataObj.age["18-24"] = convertPercentToDecimal(row["18-24"]);
    if ("25-34" in row)
      dataObj.age["25-34"] = convertPercentToDecimal(row["25-34"]);
    if ("35-44" in row)
      dataObj.age["35-44"] = convertPercentToDecimal(row["35-44"]);
    if ("45-54" in row)
      dataObj.age["45-54"] = convertPercentToDecimal(row["45-54"]);
    if ("55-65" in row)
      dataObj.age["55-65"] = convertPercentToDecimal(row["55-65"]);
    if ("65+" in row) dataObj.age["65+"] = convertPercentToDecimal(row["65+"]);
  }

  // Process gender data
  if (!dataObj.gender) {
    dataObj.gender = {};
  }

  if (year === 2024) {
    if ("gender_male" in row) dataObj.gender.male = parseFloat(row.gender_male);
    if ("gender_female" in row)
      dataObj.gender.female = parseFloat(row.gender_female);
  } else if (year === 2025) {
    if ("Male" in row) dataObj.gender.male = convertPercentToDecimal(row.Male);
    if ("Female" in row)
      dataObj.gender.female = convertPercentToDecimal(row.Female);
    if ("Non-binary / third gender" in row)
      dataObj.gender.non_binary = convertPercentToDecimal(
        row["Non-binary / third gender"]
      );
    if ("Prefer not to say" in row)
      dataObj.gender.prefer_not_to_say = convertPercentToDecimal(
        row["Prefer not to say"]
      );
  }

  // Process organization size data
  if (!dataObj.org_size) {
    dataObj.org_size = {};
  }

  if (year === 2024) {
    if ("org_size_fewer_than_10" in row)
      dataObj.org_size.fewer_than_10 = parseFloat(
        row["org_size_fewer_than_10"]
      );
    if ("org_size_10_to_49" in row)
      dataObj.org_size["10_to_49"] = parseFloat(row["org_size_10_to_49"]);
    if ("org_size_50_to_99" in row)
      dataObj.org_size["50_to_99"] = parseFloat(row["org_size_50_to_99"]);
    if ("org_size_100_to_249" in row)
      dataObj.org_size["100_to_249"] = parseFloat(row["org_size_100_to_249"]);
    if ("org_size_250_to_499" in row)
      dataObj.org_size["250_to_499"] = parseFloat(row["org_size_250_to_499"]);
    if ("org_size_500_to_999" in row)
      dataObj.org_size["500_to_999"] = parseFloat(row["org_size_500_to_999"]);
    if ("org_size_1000_or_more" in row)
      dataObj.org_size["1000_or_more"] = parseFloat(
        row["org_size_1000_or_more"]
      );
  } else if (year === 2025) {
    if ("Fewer than 10" in row)
      dataObj.org_size.fewer_than_10 = convertPercentToDecimal(
        row["Fewer than 10"]
      );
    if ("10 to 49" in row)
      dataObj.org_size["10_to_49"] = convertPercentToDecimal(row["10 to 49"]);
    if ("50 to 99" in row)
      dataObj.org_size["50_to_99"] = convertPercentToDecimal(row["50 to 99"]);
    if ("100 to 249" in row)
      dataObj.org_size["100_to_249"] = convertPercentToDecimal(
        row["100 to 249"]
      );
    if ("250 to 499" in row)
      dataObj.org_size["250_to_499"] = convertPercentToDecimal(
        row["250 to 499"]
      );
    if ("500 to 999" in row)
      dataObj.org_size["500_to_999"] = convertPercentToDecimal(
        row["500 to 999"]
      );
    if ("1000 or more" in row)
      dataObj.org_size["1000_or_more"] = convertPercentToDecimal(
        row["1000 or more"]
      );
  }

  // Process sector data
  if (!dataObj.sector) {
    dataObj.sector = {};
  }

  // There are many sectors, so we'll handle them dynamically
  if (year === 2024) {
    // Handle 2024 sector data
    Object.keys(row).forEach((key) => {
      if (key.startsWith("sector_")) {
        const sectorName = key.replace("sector_", "");
        dataObj.sector[sectorName] = parseFloat(row[key]);
      }
    });
  } else if (year === 2025) {
    // Map 2025 sectors to standardized format
    const sectorMap = {
      "Agriculture / forestry / fishing": "agriculture_forestry_fishing",
      Automotive: "automotive",
      "Business administration & support services":
        "business_administration_support_services",
      "Clean technology": "clean_technology",
      Technology: "technology",
      Construction: "construction",
      Education: "education",
      "Energy & utilities": "energy_utilities",
      "Financial services": "financial_services",
      "Food & drink": "food_drink",
      Government: "government",
      "Healthcare & life sciences": "healthcare_life_sciences",
      "Leisure, sport, entertainment & recreation":
        "leisure_sport_entertainment_recreation",
      "Manufacturing & industrial": "manufacturing_industrial",
      "Marketing services": "marketing_services",
      "Media & entertainment": "media_entertainment",
      "Not for profit": "not_for_profit",
      "Real estate & property services": "real_estate_property_services",
      Retail: "retail",
      Sports: "sports",
      Telecommunications: "telecommunications",
      "Transport & storage": "transport_storage",
      "Travel, hospitality & leisure": "travel_hospitality_leisure",
      "Wholesale & distribution": "wholesale_distribution",
      Other: "other",
    };

    Object.keys(sectorMap).forEach((sectorKey) => {
      if (sectorKey in row) {
        dataObj.sector[sectorMap[sectorKey]] = convertPercentToDecimal(
          row[sectorKey]
        );
      }
    });
  }

  // Process job level data
  if (!dataObj.job_level) {
    dataObj.job_level = {};
  }

  if (year === 2024) {
    if ("job_level_CEO" in row)
      dataObj.job_level.ceo = parseFloat(row["job_level_CEO"]);
    if ("job_level_senior_executive" in row)
      dataObj.job_level.senior_executive = parseFloat(
        row["job_level_senior_executive"]
      );
    if ("job_level_senior_leader" in row)
      dataObj.job_level.senior_leader = parseFloat(
        row["job_level_senior_leader"]
      );
    if ("job_level_first_level_supervisor" in row)
      dataObj.job_level.first_level_supervisor = parseFloat(
        row["job_level_first_level_supervisor"]
      );
    if ("job_level_individual_contributor" in row)
      dataObj.job_level.individual_contributor = parseFloat(
        row["job_level_individual_contributor"]
      );
  } else if (year === 2025) {
    if ("CEO" in row) dataObj.job_level.ceo = convertPercentToDecimal(row.CEO);
    if ("Senior executive (C-suite, EVP, SVP)" in row)
      dataObj.job_level.senior_executive = convertPercentToDecimal(
        row["Senior executive (C-suite, EVP, SVP)"]
      );
    if ("Senior leader (VP, Department Head)" in row)
      dataObj.job_level.senior_leader = convertPercentToDecimal(
        row["Senior leader (VP, Department Head)"]
      );
    if ("Mid-level leader (Director, Senior Manager)" in row)
      dataObj.job_level.mid_level_leader = convertPercentToDecimal(
        row["Mid-level leader (Director, Senior Manager)"]
      );
    if ("First-level supervisor" in row)
      dataObj.job_level.first_level_supervisor = convertPercentToDecimal(
        row["First-level supervisor"]
      );
    if ("Individual contributor" in row)
      dataObj.job_level.individual_contributor = convertPercentToDecimal(
        row["Individual contributor"]
      );
  }

  // Process relationship status data - only add if columns exist
  if (year === 2024) {
    if (
      row.hasOwnProperty("relationship_status_single") ||
      row.hasOwnProperty("relationship_status_cohabiting") ||
      row.hasOwnProperty("relationship_status_married") ||
      row.hasOwnProperty("relationship_status_divorced_separated") ||
      row.hasOwnProperty("relationship_status_widowed")
    ) {
      if (!dataObj.relationship_status) {
        dataObj.relationship_status = {};
      }

      if ("relationship_status_single" in row)
        dataObj.relationship_status.single = parseFloat(
          row["relationship_status_single"]
        );
      if ("relationship_status_cohabiting" in row)
        dataObj.relationship_status.cohabiting = parseFloat(
          row["relationship_status_cohabiting"]
        );
      if ("relationship_status_married" in row)
        dataObj.relationship_status.married = parseFloat(
          row["relationship_status_married"]
        );
      if ("relationship_status_divorced_separated" in row)
        dataObj.relationship_status.divorced_separated = parseFloat(
          row["relationship_status_divorced_separated"]
        );
      if ("relationship_status_widowed" in row)
        dataObj.relationship_status.widowed = parseFloat(
          row["relationship_status_widowed"]
        );
    }
  } else if (year === 2025) {
    if (!dataObj.relationship_status) {
      dataObj.relationship_status = {};
    }

    if ("Single" in row)
      dataObj.relationship_status.single = convertPercentToDecimal(row.Single);
    if ("Cohabiting" in row)
      dataObj.relationship_status.cohabiting = convertPercentToDecimal(
        row.Cohabiting
      );
    if ("Married" in row)
      dataObj.relationship_status.married = convertPercentToDecimal(
        row.Married
      );
    if ("Divorced/Separated" in row)
      dataObj.relationship_status.divorced_separated = convertPercentToDecimal(
        row["Divorced/Separated"]
      );
    if ("Widowed" in row)
      dataObj.relationship_status.widowed = convertPercentToDecimal(
        row.Widowed
      );
  }

  // Process education data - only add if columns exist
  if (year === 2024) {
    if (
      row.hasOwnProperty("education_secondary") ||
      row.hasOwnProperty("education_tertiary") ||
      row.hasOwnProperty("education_undergraduate") ||
      row.hasOwnProperty("education_postgraduate") ||
      row.hasOwnProperty("education_doctorate")
    ) {
      if (!dataObj.education) {
        dataObj.education = {};
      }

      if ("education_secondary" in row)
        dataObj.education.secondary = parseFloat(row["education_secondary"]);
      if ("education_tertiary" in row)
        dataObj.education.tertiary = parseFloat(row["education_tertiary"]);
      if ("education_undergraduate" in row)
        dataObj.education.undergraduate = parseFloat(
          row["education_undergraduate"]
        );
      if ("education_postgraduate" in row)
        dataObj.education.postgraduate = parseFloat(
          row["education_postgraduate"]
        );
      if ("education_doctorate" in row)
        dataObj.education.doctorate = parseFloat(row["education_doctorate"]);
    }
  } else if (year === 2025) {
    if (!dataObj.education) {
      dataObj.education = {};
    }

    if ("Secondary school" in row)
      dataObj.education.secondary = convertPercentToDecimal(
        row["Secondary school"]
      );
    if ("Tertiary school" in row)
      dataObj.education.tertiary = convertPercentToDecimal(
        row["Tertiary school"]
      );
    if ("Undergraduate degree" in row)
      dataObj.education.undergraduate = convertPercentToDecimal(
        row["Undergraduate degree"]
      );
    if ("Postgraduate degree" in row)
      dataObj.education.postgraduate = convertPercentToDecimal(
        row["Postgraduate degree"]
      );
    if ("Doctorate" in row)
      dataObj.education.doctorate = convertPercentToDecimal(row.Doctorate);
  }

  // Generation - REMOVED ALL DERIVATION FOR 2024
  // Process generation data - ONLY for 2025 data
  if (year === 2025) {
    if (
      "Gen_Z" in row ||
      "Millennials" in row ||
      "Gen_X" in row ||
      "Baby_Boomers" in row
    ) {
      if (!dataObj.generation) {
        dataObj.generation = {};
      }

      if ("Gen_Z" in row)
        dataObj.generation.gen_z = convertPercentToDecimal(row["Gen_Z"]);
      if ("Millennials" in row)
        dataObj.generation.millennials = convertPercentToDecimal(
          row["Millennials"]
        );
      if ("Gen_X" in row)
        dataObj.generation.gen_x = convertPercentToDecimal(row["Gen_X"]);
      if ("Baby_Boomers" in row)
        dataObj.generation.baby_boomers = convertPercentToDecimal(
          row["Baby_Boomers"]
        );
    }
  } else {
    // For 2024 and other years, set generation to null (NO DERIVATION)
    dataObj.generation = null;
  }

  // Process employment status data
  if (!dataObj.employment_status) {
    dataObj.employment_status = {};
  }

  if (year === 2024) {
    if ("employment_status_full-time" in row)
      dataObj.employment_status.full_time = parseFloat(
        row["employment_status_full-time"]
      );
    if ("employment_status_part-time" in row)
      dataObj.employment_status.part_time = parseFloat(
        row["employment_status_part-time"]
      );
    // Only add self-employed if present
    if ("employment_status_self-employed" in row)
      dataObj.employment_status.self_employed = parseFloat(
        row["employment_status_self-employed"]
      );
  } else if (year === 2025) {
    if ("Full-time" in row)
      dataObj.employment_status.full_time = convertPercentToDecimal(
        row["Full-time"]
      );
    if ("Part-time" in row)
      dataObj.employment_status.part_time = convertPercentToDecimal(
        row["Part-time"]
      );
  }
}
