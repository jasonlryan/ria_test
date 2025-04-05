#!/usr/bin/env node
/**
 * process_2025_data.js
 *
 * A script to harmonize the 2025 data format with the 2024 format, creating
 * a "best of both worlds" approach that preserves the detailed question text
 * from 2025 while using the numerical decimal format from 2024.
 *
 * This script:
 * 1. Takes the consolidated CSV from 2025_DATA directory
 * 2. Converts percentage values to decimals (e.g., "75%" → 0.75)
 * 3. Standardizes column names across both datasets
 * 4. Preserves the detailed question text from 2025
 * 5. Outputs a file that can be used with process_survey_data.js
 *
 * Usage:
 *   node process_2025_data.js --input=path/to/2025_global_data.csv --output=path/to/output/directory
 *
 * Can also be imported as a module by process_survey_data.js for the complete workflow.
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { stringify } = require("csv-stringify/sync");

// Parse command line arguments
function parseArgs(argv) {
  return argv.slice(2).reduce((acc, arg) => {
    // Handle --flag=value format
    if (arg.includes("=")) {
      const [key, value] = arg.split("=");
      acc[key.replace("--", "")] = value;
    }
    // Handle --flag format (boolean flags)
    else if (arg.startsWith("--")) {
      acc[arg.replace("--", "")] = true;
    }
    // Handle -h short format
    else if (arg === "-h") {
      acc.help = true;
    }
    return acc;
  }, {});
}

// Display help information
function displayHelp() {
  console.log(`
  2025 Data Harmonization Script
  ==============================
  
  DESCRIPTION
    This script harmonizes the 2025 survey data format with the 2024 format:
    - Converts percentage values to decimals (e.g., "75%" → 0.75)
    - Standardizes column names across datasets
    - Organizes questions by section
    - Creates mapping documentation
  
  USAGE
    node process_2025_data.js [OPTIONS]
    
  OPTIONS
    --input=<path>     Path to the 2025 consolidated CSV file
                       Default: ../2025_DATA/2025_global_data.csv
    
    --output=<path>    Output directory
                       Default: ./data/2025
    
    --verbose          Show detailed processing information
    
    --help, -h         Display this help message
    
  EXAMPLE
    node process_2025_data.js --input=./custom/2025_data.csv --output=./custom/output
  `);
}

// Set default values
const getDefaultOptions = (providedArgs = {}) => ({
  inputCsvPath:
    providedArgs.input ||
    path.join(__dirname, "data", "2025", "2025_global_data.csv"),
  outputDir: providedArgs.output || path.join(__dirname, "data", "2025"),
  verbose: providedArgs.verbose || false,
});

// Define standardized column mappings
// This represents our "best of both worlds" standardized format
const columnMapping = {
  // Core columns
  Question: "Question",
  Response: "Response",
  Total: "Total",
  Overall: "Overall",

  // Country mappings
  country_US: "country_USA",
  country_United_Kingdom: "country_UK",
  country_India: "country_India",
  country_France: "country_France",
  country_Germany: "country_Germany",
  country_Japan: "country_Japan",
  country_United_Arab_Emirates: "country_UAE",
  country_Brazil: "country_Brazil",
  country_Saudi_Arabia: "country_Saudi_Arabia",
  country_Australia: "country_Australia",

  // Age mappings - standardize to underscore format
  "age_18-24": "age_18_24",
  "age_25-34": "age_25_34",
  "age_35-44": "age_35_44",
  "age_45-54": "age_45_54",
  "age_55-65": "age_55_65",
  age_65_plus: "age_65_plus",

  // Generation mappings
  Gen_Z: "generation_gen_z",
  Millennials: "generation_millennials",
  Gen_X: "generation_gen_x",
  Baby_Boomers: "generation_baby_boomers",

  // Gender mappings
  gender_female: "gender_female",
  gender_male: "gender_male",

  // Organization size mappings
  "org_size_<10": "org_size_fewer_than_10",
  "org_size_10-49": "org_size_10_to_49",
  "org_size_50-99": "org_size_50_to_99",
  "org_size_100-500": "org_size_100_to_499",
  "org_size_501-1000": "org_size_500_to_999",
  "org_size_1000+": "org_size_1000_or_more",

  // Employment status mappings
  "employment_status_full-time": "employment_status_full_time",
  "employment_status_part-time": "employment_status_part_time",
  employment_status_contract: "employment_status_contract",
  employment_status_freelance: "employment_status_freelance",

  // Sector mappings
  sector_Automotive: "sector_automotive",
  sector_Business_administration: "sector_business_administration",
  sector_Technology: "sector_technology",
  sector_Construction: "sector_construction",
  sector_Consumer_Goods: "sector_consumer_goods",
  sector_Education: "sector_education",
  sector_Energy_Utilities: "sector_energy_utilities",
  sector_Financial_Services: "sector_financial_services",
  sector_Government: "sector_government",
  sector_Healthcare: "sector_healthcare_life_sciences",
  sector_Manufacturing_industrial: "sector_manufacturing_industrial",
  sector_Marketing_services: "sector_marketing_services",
  "sector_Not-for-profit": "sector_not_for_profit",
  "sector_Legal_in-house": "sector_legal_in_house",
  sector_Legal_agency: "sector_legal_agency",
  sector_Life_sciences: "sector_life_sciences",
  sector_Professional_Services: "sector_professional_services",
  sector_Real_Estate: "sector_real_estate_property_services",
  sector_Retail: "sector_retail",
  sector_Sales: "sector_sales",
  sector_Telecommunications: "sector_telecommunications",
  sector_Transport_storage: "sector_transport_storage",
  sector_Travel_Hospitality_Leisure: "sector_travel_hospitality_leisure",
  sector_Wholesale_Distribution: "sector_wholesale_distribution",
  sector_Other: "sector_other",

  // Job level mappings
  job_level_CEO: "job_level_CEO",
  job_level_Senior_Executive: "job_level_senior_executive",
  job_level_Senior_Leader: "job_level_senior_leader",
  "job_level_Mid-Level_Leader": "job_level_mid_level_leader",
  job_level_First_Level_Supervisor: "job_level_first_level_supervisor",
  job_level_Individual_Contributor: "job_level_individual_contributor",

  // Marital status mappings
  marital_status_Single: "relationship_status_single",
  "marital_status_Co-habiting": "relationship_status_cohabiting",
  marital_status_Married: "relationship_status_married",
  marital_status_Divorced_separated: "relationship_status_divorced_separated",
  marital_status_Widowed: "relationship_status_widowed",

  // Education mappings
  education_Secondary: "education_secondary",
  education_Tertiary: "education_tertiary",
  education_Professional_Certifications:
    "education_professional_certifications",
  "education_Under-graduate_degree": "education_undergraduate",
  "education_Post-graduate_Masters_degree": "education_postgraduate",
  education_Doctorate_Phd: "education_doctorate",
};

// Question formatting - keep the detailed Q format from 2025 data
// but add the numbered sections for organization like in 2024 data
const questionSections = {
  Q1: "1. Most important factors when looking for a new Job",
  Q2: "2. Factors to Stay at Current Company",
  Q3: "3. Factors to Leave Current Company",
  Q4: "4. Workplace Location",
  Q5: "5. AI and Skills",
  Q6: "6. Workplace Statements",
  Q7: "7. General Statements",
  Q8: "8. Statements About Work",
  Q9: "9. Statement Agreement",
  Q10: "10. Inclusion and Social Responsibility",
  Q11: "11. Compensation",
  Q12: "12. Job Intent",
  Q13: "13. Ideal Role",
  Q14: "14. Generational Challenges",
  Q15: "15. Generational Collaboration",
  Q16: "16. Work-Life Balance",
  Q17: "17. Agreement Statements",
  Q18: "18. Miscellaneous",
};

/**
 * Extract the question number (e.g., "Q1") from the full question text
 * @param {string} questionText - Full question text from the 2025 data
 * @returns {string} - The question number (e.g., "Q1")
 */
function extractQuestionNumber(questionText) {
  const match = questionText.match(/Q(\d+)/i);
  return match ? match[0] : null;
}

/**
 * Add the section heading to the question text
 * @param {string} questionText - Full question text from the 2025 data
 * @returns {string} - The formatted question text with section heading
 */
function formatQuestionText(questionText) {
  const qNumber = extractQuestionNumber(questionText);
  if (qNumber && questionSections[qNumber]) {
    // Keep the original detailed question text
    return questionText;
  }
  return questionText;
}

/**
 * Convert percentage strings to integer values
 * @param {string} percentStr - Percentage string to convert (e.g., "75%")
 * @returns {number|null} - Converted integer value or null if invalid
 */
function percentToDecimal(percentStr) {
  if (!percentStr || typeof percentStr !== "string") {
    return null;
  }

  // Remove any % sign and whitespace
  const cleanPercentStr = percentStr.trim().replace("%", "");

  // Check if it's a valid number
  if (cleanPercentStr === "" || isNaN(cleanPercentStr)) {
    return null;
  }

  // Convert to integer without dividing by 100
  return Math.round(parseFloat(cleanPercentStr));
}

/**
 * Map 2025 column names to standardized format
 * @param {string} columnName - Original column name
 * @returns {string} - Mapped column name
 */
function mapColumnName(columnName) {
  // For country columns in the input file (which have spaces)
  if (Object.keys(columnMapping).includes(columnName)) {
    return columnMapping[columnName];
  }

  // For direct matches in the country name (e.g., "USA")
  if (
    columnName in
    {
      "United Kingdom": true,
      USA: true,
      Australia: true,
      India: true,
      Brazil: true,
      "Saudi Arabia & UAE": true,
    }
  ) {
    const mappedName = columnName
      .toLowerCase()
      .replace(/\s/g, "_")
      .replace(/&/g, "and");
    return `country_${mappedName}`;
  }

  // Keep original if no mapping found
  return columnName;
}

/**
 * Convert 2025 CSV data to harmonized format
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result
 */
async function harmonize2025Data(options = {}) {
  // Set defaults from provided options or defaults
  const resolvedOptions = getDefaultOptions(options);
  const { inputCsvPath, outputDir, verbose } = resolvedOptions;

  if (verbose) {
    console.log("Starting harmonization with options:");
    console.log("- Input CSV:", inputCsvPath);
    console.log("- Output Directory:", outputDir);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    if (verbose) {
      console.log(`Created output directory: ${outputDir}`);
    }
  }

  // Process the CSV data
  try {
    // Initialize counter for processed records
    let recordCount = 0;
    const results = [];
    let headers = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(inputCsvPath)
        .pipe(csv())
        .on("headers", (csvHeaders) => {
          headers = csvHeaders;
          if (verbose) {
            console.log(`Found ${headers.length} columns in CSV header.`);
          }
        })
        .on("data", (row) => {
          recordCount++;
          const newRow = {};

          // Process the row data
          const isQ10 = row["Question"] && row["Question"].includes("Q10");

          Object.entries(row).forEach(([key, value]) => {
            // Keep Question and Response columns as-is
            if (key === "Question") {
              newRow[key] = formatQuestionText(value);
            } else if (key === "Response") {
              newRow[key] = value;
            }
            // Special handler for Q10 country columns to ensure proper mapping
            else if (
              isQ10 &&
              (key.startsWith("country_") ||
                key === "United Kingdom" ||
                key === "India" ||
                key === "US" ||
                key === "Brazil" ||
                key === "France" ||
                key === "Germany" ||
                key === "Japan" ||
                key === "United Arab Emirates" ||
                key === "Saudi Arabia" ||
                key === "Australia")
            ) {
              // Direct mapping for Q10 country columns to ensure correct order
              let mappedKey = key;
              let originalKey = key;

              // Map country columns correctly for Q10
              if (key === "US") mappedKey = "country_USA";
              else if (key === "United Kingdom") mappedKey = "country_UK";
              else if (key === "India") mappedKey = "country_India";
              else if (key === "France") mappedKey = "country_France";
              else if (key === "Germany") mappedKey = "country_Germany";
              else if (key === "Japan") mappedKey = "country_Japan";
              else if (key === "United Arab Emirates")
                mappedKey = "country_UAE";
              else if (key === "Brazil") mappedKey = "country_Brazil";
              else if (key === "Saudi Arabia")
                mappedKey = "country_Saudi_Arabia";
              else if (key === "Australia") mappedKey = "country_Australia";
              else if (key === "country_US") mappedKey = "country_USA";
              else if (key === "country_United_Kingdom")
                mappedKey = "country_UK";
              else if (key === "country_United_Arab_Emirates")
                mappedKey = "country_UAE";

              // Convert percentage values to decimals
              if (value && value.includes("%")) {
                const decimal = percentToDecimal(value);
                if (decimal !== null) {
                  newRow[mappedKey] = decimal;

                  // Add logging for Q10 special case processing when verbose is enabled
                  if (verbose && recordCount < 10) {
                    console.log(
                      `Q10 Special Processing: ${originalKey} (${value}) → ${mappedKey} (${decimal})`
                    );
                  }
                }
              } else {
                // Try to parse as float if numeric
                const floatValue = parseFloat(value);
                newRow[mappedKey] = isNaN(floatValue) ? value : floatValue;

                // Add logging for Q10 special case processing when verbose is enabled
                if (verbose && recordCount < 10) {
                  console.log(
                    `Q10 Special Processing: ${originalKey} → ${mappedKey}`
                  );
                }
              }
            }
            // Convert percentage values to decimals
            else if (value && value.includes("%")) {
              const decimal = percentToDecimal(value);
              if (decimal !== null) {
                // Map the column name
                const mappedKey = mapColumnName(key);
                newRow[mappedKey] = decimal;
              }
            }
            // Handle non-percentage values
            else {
              const mappedKey = mapColumnName(key);
              // Try to parse as float if numeric
              const floatValue = parseFloat(value);
              newRow[mappedKey] = isNaN(floatValue) ? value : floatValue;
            }
          });

          results.push(newRow);
        })
        .on("end", () => {
          // Determine output file path
          const outputFileName = path.basename(inputCsvPath);
          const outputPath = path.join(outputDir, outputFileName);

          // Convert to CSV string
          const csvString = stringify(results, {
            header: true,
            columns: [
              "Question",
              "Response",
              "Total",
              ...Object.values(columnMapping).filter(
                (col) =>
                  col !== "Question" && col !== "Response" && col !== "Total"
              ),
            ].filter((col) => results.some((row) => row[col] !== undefined)),
          });

          // Write to file
          fs.writeFileSync(outputPath, csvString);

          if (verbose) {
            console.log(
              `Harmonization complete. Processed ${recordCount} records.`
            );
            console.log(`Output written to: ${outputPath}`);
          }

          resolve({
            success: true,
            outputPath,
            recordCount,
          });
        })
        .on("error", (error) => {
          console.error("Error processing CSV:", error);
          reject({
            success: false,
            error: error.message,
          });
        });
    });
  } catch (error) {
    console.error("Error in harmonization process:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main function to execute the harmonization process
 */
async function main() {
  // Get arguments for when run directly
  const args = parseArgs(process.argv);

  // Check for help flag
  if (args.help || args.h) {
    displayHelp();
    process.exit(0);
  }

  // Get options from command line args
  const options = getDefaultOptions(args);

  try {
    console.log("=== 2025 DATA HARMONIZATION ===");
    console.log(`Input: ${options.inputCsvPath}`);
    console.log(`Output directory: ${options.outputDir}`);

    const result = await harmonize2025Data(options);

    if (result.success) {
      console.log("\n✅ Harmonization successful!");
      console.log(`Processed ${result.recordCount} records`);
      console.log(`Output saved to: ${result.outputPath}`);
      return { success: true, ...result };
    } else {
      console.error(`\n❌ Harmonization failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("\n❌ Unexpected error:", error);
    return { success: false, error: error.message };
  }
}

// Run directly if called from command line
if (require.main === module) {
  main()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

// Export functions for use by process_survey_data.js
module.exports = {
  harmonize2025Data,
  percentToDecimal,
  mapColumnName,
  formatQuestionText,
};
