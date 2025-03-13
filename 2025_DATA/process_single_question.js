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
  "65 plus": 18,
  "Gen Z": 19,
  Millennials: 20,
  "Gen X": 21,
  "Baby Boomers": 22,
  Female: 23,
  Male: 24,
  "<10": 25,
  "'10-49": 26,
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

// Define the target field mappings
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
  "65 plus": "age_65_plus",
  "Gen Z": "Gen_Z",
  Millennials: "Millennials",
  "Gen X": "Gen_X",
  "Baby Boomers": "Baby_Boomers",
  Female: "gender_female",
  Male: "gender_male",
  "<10": "org_size_<10",
  "'10-49": "org_size_10-49",
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

// Default output file path
const DEFAULT_OUTPUT_FILE = path.join(__dirname, "all_questions_mapped.csv");

// Function to process a single CSV file
function processCSVFile(inputFile) {
  try {
    console.log(`Processing file: ${inputFile}`);
    const fileName = path.basename(inputFile).toLowerCase();

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

    // Log debug info
    console.log(`Total rows parsed: ${rows.length}`);

    // Extract the question text from the first cell of the first row
    let questionText = "";
    if (rows && rows.length > 0 && rows[0] && rows[0][0]) {
      questionText = rows[0][0].replace(/^["']|["']$/g, "").trim();
    } else {
      console.log("Warning: Could not extract question text from first row");
      questionText = "Unknown Question";
    }

    // Modify question text for specific files to provide clarity
    if (fileName === "q4a_global.csv") {
      questionText = `${questionText} - Current place of work`;
      console.log("Processing current place of work data");
    } else if (fileName === "q4b_global.csv") {
      questionText = `${questionText} - Ideal place of work`;
      console.log("Processing ideal place of work data");
    } else if (fileName === "q11_global.csv") {
      console.log("Processing compensation data");
    } else if (fileName === "q12_global.csv") {
      console.log("Processing job leaving data");
    }

    console.log("Question text:", questionText);

    // Prepare a list to hold mapped rows
    const mappedRows = [];

    // GENERIC ROW SCANNER - Find all rows that contain response data by looking for percentage values
    // This works for most question files including Q11, Q12, etc.
    let responseRows = [];
    let capturedResponses = new Set(); // Track what we've already found to avoid duplicates

    for (let i = 0; i < rows.length; i++) {
      // Skip empty rows or rows with no data
      if (!rows[i] || !rows[i][0] || rows[i][0].trim() === "") {
        continue;
      }

      // Skip rows that have "Sigma" or are headers
      if (
        rows[i][0].includes("Sigma") ||
        rows[i][0].includes("Base:") ||
        rows[i][0].includes("Total Respondents")
      ) {
        continue;
      }

      // Check if this row has percentage values which indicates it's a response row
      let hasPercentage = false;
      for (let j = 1; j < Math.min(5, rows[i].length); j++) {
        if (rows[i][j] && rows[i][j].includes("%")) {
          hasPercentage = true;
          break;
        }
      }

      // If the row has a non-empty first cell and percentage values, it's likely a response
      if (hasPercentage && rows[i][0].trim() !== "") {
        const responseText = rows[i][0].trim();

        // If we haven't seen this response yet, add it
        if (!capturedResponses.has(responseText)) {
          console.log(
            `Found response at row ${i}: "${responseText.substring(0, 50)}..."`
          );
          responseRows.push(i);
          capturedResponses.add(responseText);
        }
      }
    }

    console.log(`Found ${responseRows.length} unique responses`);

    // Process each identified response row
    for (let rowIndex of responseRows) {
      // Create a new row with keys from TARGET_HEADER
      const mappedRow = {};
      TARGET_HEADER.forEach((key) => (mappedRow[key] = ""));

      // Set the question text for this row
      mappedRow.Question = questionText;

      // Get the response text
      let responseText = rows[rowIndex][0].trim();
      console.log(`Processing response: "${responseText.substring(0, 50)}..."`);

      // Set the response text for this row
      mappedRow.Response = responseText;

      // Map the column values to our target headers
      for (let j = 1; j < rows[rowIndex].length; j++) {
        if (j <= TARGET_HEADER.length - 2) {
          mappedRow[TARGET_HEADER[j + 1]] = rows[rowIndex][j] || "";
        }
      }

      // Add to our collection of mapped rows
      mappedRows.push(mappedRow);
    }

    console.log(
      `Processed ${mappedRows.length} rows from ${path.basename(inputFile)}`
    );
    return mappedRows;
  } catch (error) {
    console.error("Error processing CSV file:", error);
    throw error;
  }
}

// Function to append mapped rows to an existing output file or create a new one
function appendToOutputFile(mappedRows, outputFile = DEFAULT_OUTPUT_FILE) {
  try {
    let existingRows = [];
    let writeHeader = true;

    // Check if the output file already exists
    if (fs.existsSync(outputFile)) {
      try {
        // Read existing data as raw text
        const existingContent = fs.readFileSync(outputFile, {
          encoding: "utf-8",
        });

        // Only try to parse if the file has content
        if (existingContent && existingContent.trim()) {
          try {
            // Parse the existing CSV content WITHOUT using column headers initially
            // This gives us raw arrays instead of objects with potentially mismatched field names
            const rawData = parse(existingContent, {
              columns: false, // Don't convert to objects yet - get raw arrays
              skip_empty_lines: true,
              relax_quotes: true,
              relax_column_count: true,
            });

            // Get the header row (first row)
            const headerRow = rawData[0];

            // Verify we have data rows beyond the header
            if (rawData.length > 1) {
              // Convert the raw data to objects with consistent field names
              existingRows = [];
              for (let i = 1; i < rawData.length; i++) {
                const row = {};
                const dataRow = rawData[i];

                // Skip empty rows
                if (
                  !dataRow ||
                  dataRow.every((cell) => !cell || cell.trim() === "")
                ) {
                  continue;
                }

                // Map each column to the appropriate field in the TARGET_HEADER
                TARGET_HEADER.forEach((field, index) => {
                  if (index < dataRow.length) {
                    row[field] = dataRow[index];
                  } else {
                    row[field] = "";
                  }
                });

                // Only add rows that have actual data (at least one non-empty value)
                if (
                  Object.values(row).some(
                    (val) => val && val.trim && val.trim() !== ""
                  )
                ) {
                  existingRows.push(row);
                }
              }

              console.log(
                `Found existing output file with ${existingRows.length} valid rows`
              );

              // Debug: Check the first row
              if (existingRows.length > 0) {
                console.log(
                  "First row sample:",
                  existingRows[0].Question
                    ? existingRows[0].Question.substring(0, 30) + "..."
                    : "No Question field"
                );
              }

              writeHeader = false;
            } else {
              console.log(
                "Existing file has only header row. Creating a new file."
              );
              existingRows = [];
              writeHeader = true;
            }
          } catch (parseError) {
            console.error(`Error parsing existing file: ${parseError.message}`);
            console.log("Creating a new file due to parse error.");

            // Backup the problematic file
            const backupFile = `${outputFile}.backup.${Date.now()}.csv`;
            fs.copyFileSync(outputFile, backupFile);
            console.log(`Backed up problematic file to ${backupFile}`);

            // Reset to create a new file
            existingRows = [];
            writeHeader = true;
          }
        } else {
          console.log("Existing file is empty. Creating a new file.");
          existingRows = [];
          writeHeader = true;
        }
      } catch (readError) {
        console.error(
          `Error reading existing output file: ${readError.message}`
        );
        console.log("Creating a new output file instead");
        existingRows = [];
        writeHeader = true;
      }
    }

    // Filter out any empty or invalid rows
    existingRows = existingRows.filter((row) => {
      // Check if the row has any non-empty values
      return Object.values(row).some(
        (value) => value && value.trim && value.trim() !== ""
      );
    });

    // Combine existing rows with new rows
    const allRows = [...existingRows, ...mappedRows];

    // Write all rows to the output CSV with consistent quoting
    const csvContent = stringify(allRows, {
      header: writeHeader,
      columns: TARGET_HEADER,
      quoted: true, // Force quotes around all fields
      quoted_string: true,
      quoted_empty: true,
    });

    // Write to a temporary file first to avoid corruption
    const tempFile = `${outputFile}.temp`;
    fs.writeFileSync(tempFile, csvContent);

    // Verify the temp file was written correctly
    if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
      // Replace the original file with the temp file
      fs.renameSync(tempFile, outputFile);
      console.log(
        `Mapping complete. ${mappedRows.length} rows appended to ${outputFile}`
      );
      console.log(`Total rows in output file: ${allRows.length}`);
    } else {
      throw new Error("Failed to write temporary file");
    }
  } catch (error) {
    console.error("Error appending to output file:", error);
    throw error; // Re-throw to allow the calling function to handle it
  }
}

// Function to process a single question file and append to output
function processSingleQuestion(inputFile, outputFile = DEFAULT_OUTPUT_FILE) {
  try {
    console.log(`\n=== Processing ${path.basename(inputFile)} ===`);

    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
      console.error(`Input file not found: ${inputFile}`);
      return;
    }

    // Process the input file
    const mappedRows = processCSVFile(inputFile);

    if (mappedRows.length === 0) {
      console.log("No rows were processed. Check the input file.");
      return;
    }

    // Backup the output file if it exists
    if (fs.existsSync(outputFile)) {
      const backupFile = `${outputFile}.backup.${Date.now()}.csv`;
      fs.copyFileSync(outputFile, backupFile);
      console.log(`Backed up existing output file to ${backupFile}`);
    }

    // Append the mapped rows to the output file
    appendToOutputFile(mappedRows, outputFile);

    console.log(`=== Successfully processed ${path.basename(inputFile)} ===\n`);
  } catch (error) {
    console.error(
      `ERROR processing ${path.basename(inputFile)}: ${error.message}`
    );
    console.error("Stack trace:", error.stack);
  }
}

// Check if this script is being run directly
if (require.main === module) {
  // Get command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      "Usage: node process_single_question.js <input_file> [output_file]"
    );
    console.log(
      "Example: node process_single_question.js 2025_DATA/q1_global.csv 2025_DATA/all_questions_mapped.csv"
    );
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args.length > 1 ? args[1] : DEFAULT_OUTPUT_FILE;

  processSingleQuestion(inputFile, outputFile);
} else {
  // Export functions for use in other scripts
  module.exports = {
    processCSVFile,
    appendToOutputFile,
    processSingleQuestion,
  };
}
