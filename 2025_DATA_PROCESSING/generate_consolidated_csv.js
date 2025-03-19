#!/usr/bin/env node
/**
 * generate_consolidated_csv.js
 *
 * PURPOSE:
 * This script processes all 2025 survey question CSV files and consolidates them into a single
 * standardized CSV file (2025_global_data.csv) that can be used with the main RIA25 processing pipeline.
 *
 * KEY FEATURES:
 * - Processes all standard question files (q1_global.csv through q17_global.csv)
 * - Handles special cases:
 *   - Q4 with two sub-parts (q4a_global.csv and q4b_global.csv)
 *   - Q10 with two sub-parts (q10_global.csv and q10b_global.csv)
 * - Fixes formatting issues:
 *   - Removes Unicode BOM characters from question text
 *   - Normalizes whitespace and formatting
 *   - Handles quotes in CSV data properly
 *   - Maintains consistent column structure
 * - Organizes questions in correct order by question number
 *
 * USAGE:
 * $ node generate_consolidated_csv.js
 *
 * OUTPUT:
 * - Creates 2025_global_data.csv in the current directory
 *
 * NEXT STEPS:
 * After running this script, use process_2025_data.js (in the /scripts directory) to harmonize
 * the data format with the 2024 format, converting percentages to decimals and standardizing
 * column names for compatibility with the main processing script.
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

// Define the target CSV header for the output
const TARGET_HEADER = [
  "Question",
  "Response",
  "Total",
  "Overall",
  "country_US",
  "country_United_Kingdom",
  "country_India",
  "country_France",
  "country_Germany",
  "country_Japan",
  "country_United_Arab_Emirates",
  "country_Brazil",
  "country_Saudi_Arabia",
  "country_Australia",
  "age_18-24",
  "age_25-34",
  "age_35-44",
  "age_45-54",
  "age_55-65",
  "age_65_plus",
  "Gen_Z",
  "Millennials",
  "Gen_X",
  "Baby_Boomers",
  "gender_female",
  "gender_male",
  "org_size_<10",
  "org_size_10-49",
  "org_size_50-99",
  "org_size_100-500",
  "org_size_501-1000",
  "org_size_1000+",
  "employment_status_full-time",
  "employment_status_part-time",
  "employment_status_contract",
  "employment_status_freelance",
  "sector_Automotive",
  "sector_Business_administration",
  "sector_Technology",
  "sector_Construction",
  "sector_Consumer_Goods",
  "sector_Education",
  "sector_Energy_Utilities",
  "sector_Financial_Services",
  "sector_Government",
  "sector_Healthcare",
  "sector_Manufacturing_industrial",
  "sector_Marketing_services",
  "sector_Not-for-profit",
  "sector_Legal_in-house",
  "sector_Legal_agency",
  "sector_Life_sciences",
  "sector_Professional_Services",
  "sector_Real_Estate",
  "sector_Retail",
  "sector_Sales",
  "sector_Telecommunications",
  "sector_Transport_storage",
  "sector_Travel_Hospitality_Leisure",
  "sector_Wholesale_Distribution",
  "sector_Other",
  "job_level_CEO",
  "job_level_Senior_Executive",
  "job_level_Senior_Leader",
  "job_level_Mid-Level_Leader",
  "job_level_First_Level_Supervisor",
  "job_level_Individual_Contributor",
  "marital_status_Single",
  "marital_status_Co-habiting",
  "marital_status_Married",
  "marital_status_Divorced_separated",
  "marital_status_Widowed",
  "education_Secondary",
  "education_Tertiary",
  "education_Professional_Certifications",
  "education_Under-graduate_degree",
  "education_Post-graduate_Masters_degree",
  "education_Doctorate_Phd",
];

// Define the column mappings based on the file structure
// The indices are based on the actual positions in the CSV file
const columnMappings = {
  Total: 1,
  Overall: 2,
  US: 3,
  "United Kingdom": 4,
  India: 5,
  France: 6,
  Germany: 7,
  Japan: 8,
  "United Arab Emirates": 9,
  Brazil: 10,
  "Saudi Arabia": 11,
  Australia: 12,
  "18-24": 13,
  "25-34": 14,
  "35-44": 15,
  "45-54": 16,
  "55-65": 17,
  "65+": 18,
  "Gen Z": 19,
  Millennials: 20,
  "Gen X": 21,
  "Baby Boomers": 22,
  Female: 23,
  Male: 24,
  "<10": 25,
  "10-49": 26,
  "50-99": 27,
  "100-500": 28,
  "501-1000": 29,
  "1000+": 30,
  "Full Time": 31,
  "Part Time": 32,
  Contract: 33,
  Freelance: 34,
  Automotive: 35,
  "Business administration/support services": 36,
  Technology: 37,
  Construction: 38,
  "Consumer Goods": 39,
  Education: 40,
  "Energy & Utilities e.g. oil, electricity, gas": 41,
  "Financial Services": 42,
  Government: 43,
  Healthcare: 44,
  "Manufacturing/ industrial": 45,
  "Marketing services e.g. advertising, PR, design": 46,
  "Not-for-profit": 47,
  "Legal (in-house)": 48,
  "Legal (agency)": 49,
  "Life sciences": 50,
  "Professional Services": 51,
  "Real Estate & Property Services": 52,
  Retail: 53,
  Sales: 54,
  Telecommunications: 55,
  "Transport & storage (inc. postal)": 56,
  "Travel, Hospitality and Leisure": 57,
  "Wholesale & Distribution": 58,
  Other: 59,
  CEO: 60,
  "Senior Executive": 61,
  "Senior Leader": 62,
  "Mid-Level Leader": 63,
  "First Level Supervisor / Manager": 64,
  "Individual Contributor": 65,
  Single: 66,
  "Co-habiting": 67,
  Married: 68,
  "Divorced / separated": 69,
  Widowed: 70,
  Secondary: 71,
  Tertiary: 72,
  "Professional Certifications": 73,
  "Under-graduate degree": 74,
  "Post-graduate / Master's degree": 75,
  "Doctorate / Phd": 76,
};

// Define the target mappings
const targetMappings = {
  Total: "Total",
  Overall: "Overall",
  US: "country_US",
  "United Kingdom": "country_United_Kingdom",
  India: "country_India",
  France: "country_France",
  Germany: "country_Germany",
  Japan: "country_Japan",
  "United Arab Emirates": "country_United_Arab_Emirates",
  Brazil: "country_Brazil",
  "Saudi Arabia": "country_Saudi_Arabia",
  Australia: "country_Australia",
  "18-24": "age_18-24",
  "25-34": "age_25-34",
  "35-44": "age_35-44",
  "45-54": "age_45-54",
  "55-65": "age_55-65",
  "65+": "age_65_plus",
  "Gen Z": "Gen_Z",
  Millennials: "Millennials",
  "Gen X": "Gen_X",
  "Baby Boomers": "Baby_Boomers",
  Female: "gender_female",
  Male: "gender_male",
  "<10": "org_size_<10",
  "10-49": "org_size_10-49",
  "50-99": "org_size_50-99",
  "100-500": "org_size_100-500",
  "501-1000": "org_size_501-1000",
  "1000+": "org_size_1000+",
  "Full Time": "employment_status_full-time",
  "Part Time": "employment_status_part-time",
  Contract: "employment_status_contract",
  Freelance: "employment_status_freelance",
  Automotive: "sector_Automotive",
  "Business administration/support services": "sector_Business_administration",
  Technology: "sector_Technology",
  Construction: "sector_Construction",
  "Consumer Goods": "sector_Consumer_Goods",
  Education: "sector_Education",
  "Energy & Utilities e.g. oil, electricity, gas": "sector_Energy_Utilities",
  "Financial Services": "sector_Financial_Services",
  Government: "sector_Government",
  Healthcare: "sector_Healthcare",
  "Manufacturing/ industrial": "sector_Manufacturing_industrial",
  "Marketing services e.g. advertising, PR, design":
    "sector_Marketing_services",
  "Not-for-profit": "sector_Not-for-profit",
  "Legal (in-house)": "sector_Legal_in-house",
  "Legal (agency)": "sector_Legal_agency",
  "Life sciences": "sector_Life_sciences",
  "Professional Services": "sector_Professional_Services",
  "Real Estate & Property Services": "sector_Real_Estate",
  Retail: "sector_Retail",
  Sales: "sector_Sales",
  Telecommunications: "sector_Telecommunications",
  "Transport & storage (inc. postal)": "sector_Transport_storage",
  "Travel, Hospitality and Leisure": "sector_Travel_Hospitality_Leisure",
  "Wholesale & Distribution": "sector_Wholesale_Distribution",
  Other: "sector_Other",
  CEO: "job_level_CEO",
  "Senior Executive": "job_level_Senior_Executive",
  "Senior Leader": "job_level_Senior_Leader",
  "Mid-Level Leader": "job_level_Mid-Level_Leader",
  "First Level Supervisor / Manager": "job_level_First_Level_Supervisor",
  "Individual Contributor": "job_level_Individual_Contributor",
  Single: "marital_status_Single",
  "Co-habiting": "marital_status_Co-habiting",
  Married: "marital_status_Married",
  "Divorced / separated": "marital_status_Divorced_separated",
  Widowed: "marital_status_Widowed",
  Secondary: "education_Secondary",
  Tertiary: "education_Tertiary",
  "Professional Certifications": "education_Professional_Certifications",
  "Under-graduate degree": "education_Under-graduate_degree",
  "Post-graduate / Master's degree": "education_Post-graduate_Masters_degree",
  "Doctorate / Phd": "education_Doctorate_Phd",
};

// Output file path
const outputFile = path.join(__dirname, "2025_global_data.csv");

// Add a function to clean question text by removing BOM characters and normalizing whitespace
function cleanQuestionText(text) {
  if (!text) return "";

  // Remove Unicode BOM character (EF BB BF or \uFEFF)
  const cleanedText = text
    .replace(/^\uFEFF/, "")
    .replace(/^\u00EF\u00BB\u00BF/, "");

  // Normalize whitespace (trim excess spaces, replace multiple spaces with single space)
  return cleanedText.trim().replace(/\s+/g, " ");
}

// Function to process a standard CSV file
function processStandardCSVFile(inputFile) {
  try {
    console.log(`Processing standard file: ${inputFile}`);

    // Read the input file
    let fileContent = fs.readFileSync(inputFile, { encoding: "utf-8" });

    // Remove BOM if present
    if (fileContent.charCodeAt(0) === 0xfeff) {
      fileContent = fileContent.slice(1);
    }

    // Parse the CSV content with more relaxed options
    const rows = parse(fileContent, {
      skip_empty_lines: false, // Don't skip empty lines to maintain row indices
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: true,
      trim: true,
    });

    // Extract the question text from the first cell of the first row
    const questionText = cleanQuestionText(rows[0][0] || "");
    console.log("Question text:", questionText);

    // Prepare a list to hold mapped rows
    const mappedRows = [];

    // Process data rows (starting from row 16)
    const dataStartIndex = 16;

    for (let i = dataStartIndex; i < rows.length; i++) {
      // Skip empty rows or rows with no data
      if (rows[i].length === 0 || !rows[i][0] || rows[i][0].trim() === "")
        continue;

      // Create a new row with keys from TARGET_HEADER
      const newRow = {};
      TARGET_HEADER.forEach((field) => {
        newRow[field] = "";
      });

      // Set the question text
      newRow["Question"] = questionText;

      // Set the response (from the first column)
      newRow["Response"] = rows[i][0] ? rows[i][0].trim() : "";

      // Map data from the row to the target fields using the column mappings
      Object.keys(columnMappings).forEach((columnName) => {
        const columnIndex = columnMappings[columnName];
        const targetField = targetMappings[columnName];

        if (targetField && rows[i][columnIndex]) {
          newRow[targetField] = rows[i][columnIndex].trim();
        }
      });

      mappedRows.push(newRow);
    }

    console.log(
      `Processed ${mappedRows.length} rows from ${path.basename(inputFile)}`
    );
    return mappedRows;
  } catch (error) {
    console.error(`Error processing CSV file ${inputFile}:`, error);
    return [];
  }
}

// Function to process Q10 and Q10b - special case with sub-questions
function processQ10Files(q10File, q10bFile) {
  try {
    console.log("Processing special case Q10 files");

    // Read the files
    const q10Data = fs.readFileSync(q10File, "utf8");
    const q10bData = fs.readFileSync(q10bFile, "utf8");

    // Parse CSV files
    const q10Rows = parse(q10Data);
    const q10bRows = parse(q10bData);

    // Process Q10 rows
    // The first row is the question text, second contains the sub-question
    const q10Question = cleanQuestionText(q10Rows[0][0]);
    const q10SubQuestion = q10Rows[1][0]
      .replace(/\*+\[(.*?)\]\*+/g, "$1")
      .trim(); // "Is your company committed to Diversity, Equity & Inclusion (DE&I) in the workplace?"

    // Find the data rows in Q10 file (skipping headers and empty rows)
    const q10DataRows = q10Rows.filter((row) => {
      const firstCell = row[0]?.trim() || "";
      return (
        firstCell.startsWith("(5)") ||
        firstCell.startsWith("(4)") ||
        firstCell.startsWith("(3)") ||
        firstCell.startsWith("(2)") ||
        firstCell.startsWith("(1)") ||
        firstCell === "TOP 2 BOX [NET]" ||
        firstCell === "BOTTOM 2 BOX [NET]" ||
        firstCell === "Don't know / no opinion"
      );
    });

    // Process Q10b rows
    const q10bSubQuestion = q10bRows[1][0]
      .replace(/\*+\[(.*?)\]\*+/g, "$1")
      .trim(); // "Is your company committed to corporate social responsibility and sustainability goals?"

    // Find the data rows in Q10b file (skipping headers and empty rows)
    const q10bDataRows = q10bRows.filter((row) => {
      const firstCell = row[0]?.trim() || "";
      return (
        firstCell.startsWith("(5)") ||
        firstCell.startsWith("(4)") ||
        firstCell.startsWith("(3)") ||
        firstCell.startsWith("(2)") ||
        firstCell.startsWith("(1)") ||
        firstCell === "TOP 2 BOX [NET]" ||
        firstCell === "BOTTOM 2 BOX [NET]" ||
        firstCell === "Don't know / no opinion"
      );
    });

    // Create new rows for the combined CSV file
    // Each response option becomes a row with the full question and response
    const mappedRows = [];

    // Add Q10 rows (DE&I)
    for (const row of q10DataRows) {
      if (
        row[0]?.trim() === "TOP 2 BOX [NET]" ||
        row[0]?.trim() === "BOTTOM 2 BOX [NET]"
      ) {
        continue; // Skip aggregated network rows
      }

      const responseText = row[0]?.trim() || "";

      // Create a new row with keys from TARGET_HEADER
      const newRow = {};
      TARGET_HEADER.forEach((field) => {
        newRow[field] = "";
      });

      // Set question and response
      newRow["Question"] = q10Question;
      newRow["Response"] = `${q10SubQuestion} - ${responseText}`;

      // Map data from the row to the target fields using the column mappings
      Object.keys(columnMappings).forEach((columnName) => {
        const columnIndex = columnMappings[columnName];
        const targetField = targetMappings[columnName];

        if (targetField && row[columnIndex]) {
          newRow[targetField] = row[columnIndex].trim();
        }
      });

      mappedRows.push(newRow);
    }

    // Add Q10b rows (corporate social responsibility)
    for (const row of q10bDataRows) {
      if (
        row[0]?.trim() === "TOP 2 BOX [NET]" ||
        row[0]?.trim() === "BOTTOM 2 BOX [NET]"
      ) {
        continue; // Skip aggregated network rows
      }

      const responseText = row[0]?.trim() || "";

      // Create a new row with keys from TARGET_HEADER
      const newRow = {};
      TARGET_HEADER.forEach((field) => {
        newRow[field] = "";
      });

      // Set question and response
      newRow["Question"] = q10Question;
      newRow["Response"] = `${q10bSubQuestion} - ${responseText}`;

      // Map data from the row to the target fields using the column mappings
      Object.keys(columnMappings).forEach((columnName) => {
        const columnIndex = columnMappings[columnName];
        const targetField = targetMappings[columnName];

        if (targetField && row[columnIndex]) {
          newRow[targetField] = row[columnIndex].trim();
        }
      });

      mappedRows.push(newRow);
    }

    console.log(
      `Processed ${mappedRows.length} rows from Q10 special case files`
    );
    return mappedRows;
  } catch (error) {
    console.error("Error processing Q10 files:", error);
    return [];
  }
}

// Function to process Q4a and Q4b - special case with sub-questions
function processQ4Files(q4aFile, q4bFile) {
  try {
    console.log("Processing special case Q4 files");

    // Read the files with explicit encoding handling
    let q4aData = fs.readFileSync(q4aFile, { encoding: "utf8" });
    let q4bData = fs.readFileSync(q4bFile, { encoding: "utf8" });

    // Remove BOM if present from both files
    if (q4aData.charCodeAt(0) === 0xfeff) {
      q4aData = q4aData.slice(1);
    }

    if (q4bData.charCodeAt(0) === 0xfeff) {
      q4bData = q4bData.slice(1);
    }

    // Parse CSV files with relaxed options
    const q4aRows = parse(q4aData, {
      skip_empty_lines: false,
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: true,
      trim: true,
    });

    const q4bRows = parse(q4bData, {
      skip_empty_lines: false,
      relax_column_count: true,
      relax_quotes: true,
      skip_records_with_error: true,
      trim: true,
    });

    // Extract the question text from the first cell of the first row
    const q4Question = cleanQuestionText(q4aRows[0][0] || "");
    let q4aSubQuestion = "";
    let q4bSubQuestion = "";

    // Safely extract sub-questions, handling possible format differences
    if (q4aRows.length > 1 && q4aRows[1] && q4aRows[1][0]) {
      q4aSubQuestion = q4aRows[1][0].replace(/\*+\[(.*?)\]\*+/g, "$1").trim();
    }

    if (q4bRows.length > 1 && q4bRows[1] && q4bRows[1][0]) {
      q4bSubQuestion = q4bRows[1][0].replace(/\*+\[(.*?)\]\*+/g, "$1").trim();
    }

    console.log("Q4 question:", q4Question);
    console.log("Q4a sub-question:", q4aSubQuestion);
    console.log("Q4b sub-question:", q4bSubQuestion);

    // Prepare a list to hold mapped rows
    const mappedRows = [];

    // Process data rows (starting from row 16)
    const dataStartIndex = 16;

    // Process Q4a data
    for (let i = dataStartIndex; i < q4aRows.length; i++) {
      // Skip empty rows or rows with no data
      if (
        !q4aRows[i] ||
        q4aRows[i].length === 0 ||
        !q4aRows[i][0] ||
        q4aRows[i][0].trim() === ""
      ) {
        continue;
      }

      // Create a new row with keys from TARGET_HEADER
      const newRow = {};
      TARGET_HEADER.forEach((field) => {
        newRow[field] = "";
      });

      // Set the question text
      newRow["Question"] = q4Question;

      // Set the response (from the first column with sub-question prefix)
      const responsePrefix = q4aSubQuestion ? `${q4aSubQuestion} - ` : "";
      newRow["Response"] = `${responsePrefix}${q4aRows[i][0].trim()}`;

      // Map data from the row to the target fields using the column mappings
      Object.keys(columnMappings).forEach((columnName) => {
        const columnIndex = columnMappings[columnName];
        const targetField = targetMappings[columnName];

        if (targetField && q4aRows[i][columnIndex]) {
          newRow[targetField] = q4aRows[i][columnIndex].trim();
        }
      });

      mappedRows.push(newRow);
    }

    // Process Q4b data
    for (let i = dataStartIndex; i < q4bRows.length; i++) {
      // Skip empty rows or rows with no data
      if (
        !q4bRows[i] ||
        q4bRows[i].length === 0 ||
        !q4bRows[i][0] ||
        q4bRows[i][0].trim() === ""
      ) {
        continue;
      }

      // Create a new row with keys from TARGET_HEADER
      const newRow = {};
      TARGET_HEADER.forEach((field) => {
        newRow[field] = "";
      });

      // Set the question text
      newRow["Question"] = q4Question;

      // Set the response (from the first column with sub-question prefix)
      const responsePrefix = q4bSubQuestion ? `${q4bSubQuestion} - ` : "";
      newRow["Response"] = `${responsePrefix}${q4bRows[i][0].trim()}`;

      // Map data from the row to the target fields using the column mappings
      Object.keys(columnMappings).forEach((columnName) => {
        const columnIndex = columnMappings[columnName];
        const targetField = targetMappings[columnName];

        if (targetField && q4bRows[i][columnIndex]) {
          newRow[targetField] = q4bRows[i][columnIndex].trim();
        }
      });

      mappedRows.push(newRow);
    }

    console.log(
      `Processed ${mappedRows.length} rows from Q4 special case files`
    );
    return mappedRows;
  } catch (error) {
    console.error("Error processing Q4 files:", error);
    console.error("Continuing with other questions...");
    return [];
  }
}

// Function to process all CSV files and consolidate results to a single output file
function processAllQuestions() {
  try {
    // Define paths to special case files
    const q4aFile = path.join(__dirname, "q4a_global.csv");
    const q4bFile = path.join(__dirname, "q4b_global.csv");
    const q10File = path.join(__dirname, "q10_global.csv");
    const q10bFile = path.join(__dirname, "q10b_global.csv");

    // Get all standard CSV files in the directory that match the pattern q*_global.csv
    // Exclude special case files
    const dataDir = __dirname;
    const specialCaseFiles = [
      "q4a_global.csv",
      "q4b_global.csv",
      "q10_global.csv",
      "q10b_global.csv",
    ];

    const files = fs
      .readdirSync(dataDir)
      .filter(
        (file) =>
          file.match(/^q\d+_global\.csv$/) && !specialCaseFiles.includes(file)
      )
      .map((file) => path.join(dataDir, file));

    console.log(`Found ${files.length} standard question files to process`);
    console.log("Special case files will be processed separately");

    if (
      files.length === 0 &&
      !specialCaseFiles.some((file) => fs.existsSync(path.join(dataDir, file)))
    ) {
      console.log("No question files found. Please check the directory.");
      return;
    }

    // Process each standard file and collect all mapped rows
    let allMappedRows = [];

    // Process standard files
    for (const file of files) {
      const mappedRows = processStandardCSVFile(file);
      allMappedRows = allMappedRows.concat(mappedRows);
    }

    // Process special case files if they exist
    // Process Q4 files
    if (fs.existsSync(q4aFile) && fs.existsSync(q4bFile)) {
      const q4Rows = processQ4Files(q4aFile, q4bFile);
      allMappedRows = allMappedRows.concat(q4Rows);
    } else {
      console.log("Q4 special case files not found, skipping Q4 processing");
    }

    // Process Q10 files
    if (fs.existsSync(q10File) && fs.existsSync(q10bFile)) {
      const q10Rows = processQ10Files(q10File, q10bFile);
      allMappedRows = allMappedRows.concat(q10Rows);
    } else {
      console.log("Q10 special case files not found, skipping Q10 processing");
    }

    // Sort all rows by question number
    allMappedRows.sort((a, b) => {
      // Clean and standardize question text before comparison
      const cleanedQA = cleanQuestionText(a.Question);
      const cleanedQB = cleanQuestionText(b.Question);

      // Extract the question number from each cleaned question text
      const qNumRegexA = cleanedQA.match(/Q(\d+)/i);
      const qNumRegexB = cleanedQB.match(/Q(\d+)/i);

      // If both have question numbers, compare them numerically (not as strings)
      if (qNumRegexA && qNumRegexB) {
        const qNumA = parseInt(qNumRegexA[1], 10);
        const qNumB = parseInt(qNumRegexB[1], 10);

        // Primary sort by question number
        if (qNumA !== qNumB) {
          return qNumA - qNumB;
        }

        // If question numbers are the same, check for sub-questions (Q4a, Q4b, etc.)
        const subQA = a.Response.split("-")[0].trim();
        const subQB = b.Response.split("-")[0].trim();
        return subQA.localeCompare(subQB);
      }

      // If pattern doesn't match, just do string comparison as fallback
      return cleanedQA.localeCompare(cleanedQB);
    });

    console.log(`Total rows processed: ${allMappedRows.length}`);

    // Ensure consistent formatting for question texts and clean any BOM characters
    allMappedRows.forEach((row) => {
      // Clean question text to remove BOM and normalize whitespace
      row.Question = cleanQuestionText(row.Question);

      // Remove any existing quotes
      if (row.Question.startsWith('"') && row.Question.endsWith('"')) {
        row.Question = row.Question.slice(1, -1);
      }
      if (
        row.Response &&
        row.Response.startsWith('"') &&
        row.Response.endsWith('"')
      ) {
        row.Response = row.Response.slice(1, -1);
      }

      // Ensure response is also trimmed
      if (row.Response) {
        row.Response = row.Response.trim();
      }
    });

    // Write all mapped rows to the output CSV with proper escaping
    const csvContent = stringify(allMappedRows, {
      header: true,
      columns: TARGET_HEADER,
      quoted: true, // Force quotes around string fields that need them
      quoted_string: true,
    });

    fs.writeFileSync(outputFile, csvContent);

    console.log(`Mapping complete. All data written to ${outputFile}`);
    console.log(
      "Next steps: Use this consolidated file with the main RIA25 processing script"
    );
  } catch (error) {
    console.error("Error processing all questions:", error);
  }
}

// Run the script
processAllQuestions();
