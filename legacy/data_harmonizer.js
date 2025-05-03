#!/usr/bin/env node

/**
 * data_harmonizer.js
 *
 * PURPOSE:
 * This script harmonizes survey data structures from 2024 and 2025, ensuring consistency
 * in format, categorization, and naming conventions to enable accurate year-to-year comparisons.
 *
 * FUNCTIONALITY:
 * 1. Reads raw JSON data files from both 2024 and 2025 surveys
 * 2. Standardizes demographic category keys (region, age, gender, etc.)
 * 3. Properly categorizes demographic data that might be miscategorized
 * 4. Converts percentage strings to decimal values for consistency
 * 5. Ensures identical data structure between years
 * 6. Outputs harmonized files for both years
 *
 * DATA HARMONIZATION CHALLENGES ADDRESSED:
 * - Misplaced demographic data (e.g., region data in age category)
 * - Inconsistent naming conventions
 * - Different organizational size brackets between years
 * - Missing or misplaced gender data
 * - Inconsistent sector naming
 * - Generation data categorization
 */

const fs = require("fs");
const path = require("path");

// Input and output paths
const INPUT_2024 = path.join(__dirname, "output/global_2024_data.json");
const INPUT_2025 = path.join(__dirname, "output/global_2025_data.json");
const OUTPUT_2024 = path.join(
  __dirname,
  "output/harmonized/global_2024_harmonized.json"
);
const OUTPUT_2025 = path.join(
  __dirname,
  "output/harmonized/global_2025_harmonized.json"
);

console.log("Starting data harmonization process...");

/**
 * Helper function to convert percentage strings to decimal values
 * Handles both "84%" format and "0.84" string format
 *
 * @param {string|number} value - The value to convert
 * @return {number} The decimal representation of the percentage
 */
function convertPercentToDecimal(value) {
  if (typeof value === "string") {
    if (value.includes("%")) {
      // Convert "84%" to 0.84
      return parseFloat(value.replace("%", "")) / 100;
    } else {
      // Convert "0.84" to 0.84
      return parseFloat(value);
    }
  }
  return value;
}

/**
 * Strict categorization mapping for 2025 data
 *
 * This explicit mapping solves the key problems with the 2025 dataset:
 * 1. Misplaced data (e.g., country_australia in age category)
 * 2. Inconsistent prefixes and naming conventions
 * 3. Organization size bracket differences
 *
 * Each entry maps an original key to:
 * - category: The correct demographic category the data belongs to
 * - standardKey: The standardized key name for consistency
 */
const categorization2025 = {
  // Region keys
  country_country_Overall: {
    category: "region",
    standardKey: "global_average",
  },
  country_country_US: { category: "region", standardKey: "united_states" },
  country_country_USA: { category: "region", standardKey: "united_states" },
  country_country_United_Kingdom: {
    category: "region",
    standardKey: "united_kingdom",
  },
  country_country_India: { category: "region", standardKey: "india" },
  country_country_France: { category: "region", standardKey: "france" },
  country_country_Germany: { category: "region", standardKey: "germany" },
  country_country_Japan: { category: "region", standardKey: "japan" },
  country_country_United_Arab_Emirates: {
    category: "region",
    standardKey: "united_arab_emirates",
  },
  country_country_Brazil: { category: "region", standardKey: "brazil" },
  country_country_Saudi_Arabia: {
    category: "region",
    standardKey: "saudi_arabia",
  },
  country_country_Australia: { category: "region", standardKey: "australia" },
  age_country_Australia: { category: "region", standardKey: "australia" }, // Fix for misplaced australia data

  // Age keys
  "age_age_18-24": { category: "age", standardKey: "18-24" },
  "age_age_25-34": { category: "age", standardKey: "25-34" },
  "age_age_35-44": { category: "age", standardKey: "35-44" },
  "age_age_45-54": { category: "age", standardKey: "45-54" },
  "age_age_55-65": { category: "age", standardKey: "55-65" },

  // Gender keys
  gender_gender_female: { category: "gender", standardKey: "female" },
  gender_gender_male: { category: "gender", standardKey: "male" },
  gender_gender_other: { category: "gender", standardKey: "other" },
  company_size_gender_male: { category: "gender", standardKey: "male" }, // Fix for misplaced male gender data

  // Organization size keys - standardizing size ranges between years
  "company_size_org_size_<10": {
    category: "org_size",
    standardKey: "fewer_than_10",
  },
  "company_size_org_size_10-49": {
    category: "org_size",
    standardKey: "10_to_49",
  },
  "company_size_org_size_50-99": {
    category: "org_size",
    standardKey: "50_to_99",
  },
  "company_size_org_size_100-500": {
    // Map to match 2024's bracket
    category: "org_size",
    standardKey: "100_to_249",
  },
  "company_size_org_size_501-1000": {
    // Map to match 2024's bracket
    category: "org_size",
    standardKey: "500_to_999",
  },
  "company_size_org_size_1000+": {
    category: "org_size",
    standardKey: "1000_or_more",
  },
  "employment_type_org_size_1000+": {
    category: "org_size",
    standardKey: "1000_or_more",
  },

  // Job level keys
  job_level_job_level_CEO: { category: "job_level", standardKey: "ceo" },
  job_level_job_level_Senior_Executive: {
    category: "job_level",
    standardKey: "senior_executive",
  },
  job_level_job_level_Senior_Leader: {
    category: "job_level",
    standardKey: "senior_leader",
  },
  "job_level_job_level_Mid-Level_Leader": {
    category: "job_level",
    standardKey: "mid_level_leader",
  },
  job_level_job_level_First_Level_Supervisor: {
    category: "job_level",
    standardKey: "first_level_supervisor",
  },
  job_level_job_level_Individual_Contributor: {
    category: "job_level",
    standardKey: "individual_contributor",
  },

  // Relationship status keys
  relationship_marital_status_Single: {
    category: "relationship_status",
    standardKey: "single",
  },
  "relationship_marital_status_Co-habiting": {
    category: "relationship_status",
    standardKey: "cohabiting",
  },
  relationship_marital_status_Married: {
    category: "relationship_status",
    standardKey: "married",
  },
  relationship_marital_status_Divorced_separated: {
    category: "relationship_status",
    standardKey: "divorced_separated",
  },
  relationship_marital_status_Widowed: {
    category: "relationship_status",
    standardKey: "widowed",
  },

  // Education keys
  education_education_Secondary: {
    category: "education",
    standardKey: "secondary",
  },
  education_education_Tertiary: {
    category: "education",
    standardKey: "tertiary",
  },
  education_education_Professional_Certifications: {
    category: "education",
    standardKey: "professional_certifications",
  },
  "education_education_Under-graduate_degree": {
    category: "education",
    standardKey: "undergraduate",
  },
  "education_education_Post-graduate_Masters_degree": {
    category: "education",
    standardKey: "postgraduate",
  },
  education_education_Doctorate_Phd: {
    category: "education",
    standardKey: "doctorate",
  },

  // Generation keys - ensures proper categorization
  gender_gender_Baby_Boomers: {
    category: "generation",
    standardKey: "baby_boomers",
  },
  gender_Baby_Boomers: { category: "generation", standardKey: "baby_boomers" },
  age_age_65_plus: { category: "generation", standardKey: "age_65_plus" },
  generation_Gen_X: { category: "generation", standardKey: "gen_x" },
  generation_Gen_Z: { category: "generation", standardKey: "gen_z" },
  generation_Millennials: {
    category: "generation",
    standardKey: "millennials",
  },

  // Sector keys - these must be mapped based on specific sector names
  sector_sector_Automotive: { category: "sector", standardKey: "automotive" },
  sector_sector_Business_administration: {
    category: "sector",
    standardKey: "business_administration_support_services",
  },
  sector_sector_Technology: { category: "sector", standardKey: "technology" },
  sector_sector_Construction: {
    category: "sector",
    standardKey: "construction",
  },
  sector_sector_Consumer_Goods: {
    category: "sector",
    standardKey: "consumer_goods",
  },
  sector_sector_Education: { category: "sector", standardKey: "education" },
  sector_sector_Energy_Utilities: {
    category: "sector",
    standardKey: "energy_utilities",
  },
  sector_sector_Financial_Services: {
    category: "sector",
    standardKey: "financial_services",
  },
  sector_sector_Government: { category: "sector", standardKey: "government" },
  sector_sector_Healthcare: {
    category: "sector",
    standardKey: "healthcare_life_sciences",
  },
  sector_sector_Manufacturing_industrial: {
    category: "sector",
    standardKey: "manufacturing_industrial",
  },
  sector_sector_Marketing_services: {
    category: "sector",
    standardKey: "marketing_services",
  },
  "sector_sector_Not-for-profit": {
    category: "sector",
    standardKey: "not_for_profit",
  },
  "sector_sector_Legal_in-house": {
    category: "sector",
    standardKey: "legal_in-house",
  },
  sector_sector_Legal_agency: {
    category: "sector",
    standardKey: "legal_agency",
  },
  sector_sector_Life_sciences: {
    category: "sector",
    standardKey: "healthcare_life_sciences",
  },
  sector_sector_Professional_Services: {
    category: "sector",
    standardKey: "professional_services",
  },
  sector_sector_Real_Estate: {
    category: "sector",
    standardKey: "real_estate_property_services",
  },
  sector_sector_Retail: { category: "sector", standardKey: "retail" },
  sector_sector_Sales: { category: "sector", standardKey: "sales" },
  sector_sector_Telecommunications: {
    category: "sector",
    standardKey: "telecommunications",
  },
  sector_sector_Transport_storage: {
    category: "sector",
    standardKey: "transport_storage",
  },
  sector_sector_Travel_Hospitality_Leisure: {
    category: "sector",
    standardKey: "travel_hospitality_leisure",
  },
  sector_sector_Wholesale_Distribution: {
    category: "sector",
    standardKey: "wholesale_distribution",
  },
  sector_sector_Other: { category: "sector", standardKey: "other" },
  // Fix for misplaced freelance data
  sector_employment_status_freelance: {
    category: "employment_status",
    standardKey: "freelance",
  },
};

/**
 * Standardizes keys for 2024 data
 * Converts keys from original format to a standardized format for each category
 *
 * @param {string} category - The demographic category
 * @param {string} key - The original key
 * @return {string} The standardized key
 */
function standardizeKey(category, key) {
  switch (category) {
    case "region":
      return key.toLowerCase();

    case "gender":
      return key.toLowerCase();

    case "org_size":
      // Map org size keys
      const orgSizeMapping = {
        "<10": "fewer_than_10",
        "10-49": "10_to_49",
        "50-99": "50_to_99",
        "100-249": "100_to_249",
        "100-500": "100_to_249", // Map 2025's 100-500 to 2024's 100_to_249
        "250-499": "250_to_499",
        "500-999": "500_to_999",
        "501-1000": "500_to_999",
        "1000+": "1000_or_more",
      };
      return orgSizeMapping[key] || key.toLowerCase();

    case "job_level":
      return key.toLowerCase();

    case "sector":
      // Special sector mappings
      const sectorMapping = {
        Business_administration: "business_administration_support_services",
        Healthcare: "healthcare_life_sciences",
        Life_sciences: "healthcare_life_sciences",
        "Not-for-profit": "not_for_profit",
        Real_Estate: "real_estate_property_services",
        Travel_Hospitality_Leisure: "travel_hospitality_leisure",
        Wholesale_Distribution: "wholesale_distribution",
      };
      return sectorMapping[key] || key.toLowerCase();

    case "relationship_status":
      // Map relationship statuses
      const relationshipMapping = {
        "Co-habiting": "cohabiting",
      };
      return relationshipMapping[key] || key.toLowerCase();

    case "education":
      // Map education levels
      const educationMapping = {
        "Under-graduate_degree": "undergraduate",
        "Post-graduate_Masters_degree": "postgraduate",
        Doctorate_Phd: "doctorate",
      };
      return educationMapping[key] || key.toLowerCase();

    case "generation":
      // Map generation labels
      const generationMapping = {
        Baby_Boomers: "baby_boomers",
        Gen_X: "gen_x",
        Gen_Z: "gen_z",
      };
      return generationMapping[key] || key.toLowerCase();

    default:
      return key.toLowerCase();
  }
}

/**
 * Transforms 2024 survey data to harmonized format
 *
 * Process:
 * 1. Reads the raw 2024 data file
 * 2. Standardizes demographic keys for all categories
 * 3. Converts percentage values to decimal format
 * 4. Ensures consistent data structure
 * 5. Writes harmonized data to output file
 *
 * @return {Array} The transformed data
 */
async function transform2024Data() {
  try {
    console.log("Reading 2024 data...");
    const data2024 = JSON.parse(fs.readFileSync(INPUT_2024, "utf8"));

    console.log("Transforming 2024 data...");
    const transformedData = data2024.map((item) => {
      const transformedItem = {
        question: item.question,
        response: item.response,
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
          employment_status: {}, // Add employment status category
        },
      };

      // Process each demographic category
      for (const [category, values] of Object.entries(item.data)) {
        for (const [key, value] of Object.entries(values)) {
          // Convert string decimal to numeric value
          const numericValue = convertPercentToDecimal(value);
          const standardKey = standardizeKey(category, key);

          transformedItem.data[category][standardKey] = numericValue;
        }
      }

      return transformedItem;
    });

    console.log("Writing harmonized 2024 data...");
    fs.writeFileSync(OUTPUT_2024, JSON.stringify(transformedData, null, 2));
    console.log("2024 data harmonization complete!");
    return transformedData;
  } catch (error) {
    console.error("Error processing 2024 data:", error);
    throw error;
  }
}

/**
 * Transforms 2025 survey data to harmonized format
 *
 * This function handles the more complex 2025 data that has inconsistent categorization
 * and requires explicit mapping to ensure proper alignment with 2024 data.
 *
 * Process:
 * 1. Reads the raw 2025 data file
 * 2. Extracts clean question text
 * 3. Applies strict categorization mapping to demographics
 * 4. Handles fallbacks for any unmapped keys
 * 5. Ensures consistent data structure
 * 6. Writes harmonized data to output file
 *
 * @return {Array} The transformed data
 */
async function transform2025Data() {
  try {
    console.log("Reading 2025 data...");
    const data2025 = JSON.parse(fs.readFileSync(INPUT_2025, "utf8"));

    console.log("Transforming 2025 data...");
    const transformedArray = [];

    for (const [questionText, responses] of Object.entries(data2025)) {
      // Extract question text (remove question number if needed)
      const cleanQuestionText = questionText.replace(/^Q\d+\s*-\s*/, "");

      for (const responseItem of responses) {
        const transformedItem = {
          question: cleanQuestionText,
          response: responseItem.response,
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
            employment_status: {}, // Add employment status category
          },
        };

        // Process all demographics using strict mapping
        if (responseItem.demographics) {
          for (const [key, value] of Object.entries(
            responseItem.demographics
          )) {
            const numericValue = convertPercentToDecimal(value);

            // Skip total fields
            if (key === "total" || key === "demographic_Total") {
              continue;
            }

            // Try to find the key in our categorization map
            const mapping = categorization2025[key];

            if (mapping) {
              // Add to the proper category with standardized key
              transformedItem.data[mapping.category][mapping.standardKey] =
                numericValue;
            } else {
              // Fallback to a simple mapping for unknown keys
              // This can be improved based on patterns we see in actual data

              if (key.startsWith("country_")) {
                // Region
                const cleanKey = key
                  .replace(/^country_country_/, "")
                  .toLowerCase();
                transformedItem.data.region[cleanKey] = numericValue;
              } else if (key.startsWith("age_age_")) {
                // Age
                const cleanKey = key.replace(/^age_age_/, "");
                transformedItem.data.age[cleanKey] = numericValue;
              } else if (key.startsWith("gender_gender_")) {
                // Gender
                const cleanKey = key
                  .replace(/^gender_gender_/, "")
                  .toLowerCase();
                transformedItem.data.gender[cleanKey] = numericValue;
              } else if (
                key.startsWith("company_size_org_size_") ||
                key.includes("org_size")
              ) {
                // Organization size
                const cleanKey = key
                  .replace(/^company_size_org_size_/, "")
                  .replace(/^employment_type_org_size_/, "");

                // Apply standardization for org size
                let standardKey;
                switch (cleanKey) {
                  case "<10":
                    standardKey = "fewer_than_10";
                    break;
                  case "10-49":
                    standardKey = "10_to_49";
                    break;
                  case "50-99":
                    standardKey = "50_to_99";
                    break;
                  case "100-500":
                    standardKey = "100_to_249";
                    break;
                  case "501-1000":
                    standardKey = "500_to_999";
                    break;
                  case "1000+":
                    standardKey = "1000_or_more";
                    break;
                  default:
                    standardKey = cleanKey.toLowerCase();
                }

                transformedItem.data.org_size[standardKey] = numericValue;
              } else if (key.startsWith("sector_sector_")) {
                // Sector
                const cleanKey = key
                  .replace(/^sector_sector_/, "")
                  .toLowerCase();
                transformedItem.data.sector[cleanKey] = numericValue;
              } else if (key.startsWith("job_level_job_level_")) {
                // Job level
                const cleanKey = key
                  .replace(/^job_level_job_level_/, "")
                  .toLowerCase();
                transformedItem.data.job_level[cleanKey] = numericValue;
              } else if (key.startsWith("relationship_marital_status_")) {
                // Relationship status
                const cleanKey = key
                  .replace(/^relationship_marital_status_/, "")
                  .toLowerCase();
                transformedItem.data.relationship_status[cleanKey] =
                  numericValue;
              } else if (key.startsWith("education_education_")) {
                // Education
                const cleanKey = key
                  .replace(/^education_education_/, "")
                  .toLowerCase();
                transformedItem.data.education[cleanKey] = numericValue;
              } else if (key.startsWith("generation_")) {
                // Generation
                const cleanKey = key.replace(/^generation_/, "").toLowerCase();
                transformedItem.data.generation[cleanKey] = numericValue;
              } else if (key.startsWith("employment_type_employment_status_")) {
                // Employment status
                const cleanKey = key
                  .replace(/^employment_type_employment_status_/, "")
                  .toLowerCase();
                transformedItem.data.employment_status[cleanKey] = numericValue;
              } else if (key.includes("sector_employment_status_")) {
                // Employment status misplaced in sector
                const cleanKey = key
                  .replace(/^sector_employment_status_/, "")
                  .toLowerCase();
                transformedItem.data.employment_status[cleanKey] = numericValue;
              }
            }
          }
        }

        transformedArray.push(transformedItem);
      }
    }

    console.log("Writing harmonized 2025 data...");
    fs.writeFileSync(OUTPUT_2025, JSON.stringify(transformedArray, null, 2));
    console.log("2025 data harmonization complete!");
    return transformedArray;
  } catch (error) {
    console.error("Error processing 2025 data:", error);
    throw error;
  }
}

/**
 * Main function to run both data transformations in sequence
 * Orchestrates the entire harmonization process
 */
async function runHarmonization() {
  try {
    await transform2024Data();
    await transform2025Data();
    console.log("All data harmonization complete!");
  } catch (error) {
    console.error("Harmonization process failed:", error);
  }
}

// Execute the harmonization process
runHarmonization();
