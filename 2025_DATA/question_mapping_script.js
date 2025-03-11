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

// Names for input and output files
const inputFile = path.join(__dirname, "q1_global.csv");
const outputFile = path.join(__dirname, "q1_mapped.csv");

// Process the CSV file
function processCSV() {
  try {
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
    const questionText = rows[0][0].replace(/^["']|["']$/g, "").trim();
    console.log("Question text:", questionText);

    // Prepare a list to hold mapped rows
    const mappedRows = [];

    // Process data rows (starting from row 16)
    const dataStartIndex = 16;

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
      "Business administration/support services":
        "sector_Business_administration",
      Technology: "sector_Technology",
      Construction: "sector_Construction",
      "Consumer Goods": "sector_Consumer_Goods",
      Education: "sector_Education",
      "Energy & Utilities e.g. oil, electricity, gas":
        "sector_Energy_Utilities",
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
      "Post-graduate / Master's degree":
        "education_Post-graduate_Masters_degree",
      "Doctorate / Phd": "education_Doctorate_Phd",
    };

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

    console.log(`Processed ${mappedRows.length} rows`);

    // Write the mapped rows to the output CSV
    const csvContent = stringify(mappedRows, {
      header: true,
      columns: TARGET_HEADER,
    });

    fs.writeFileSync(outputFile, csvContent);

    console.log(`Mapping complete. Mapped data written to ${outputFile}`);
  } catch (error) {
    console.error("Error processing CSV:", error);
  }
}

// Run the script
processCSV();
