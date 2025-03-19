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

// Import the harmonization module for 2025 data
const harmonizer = require("./process_2025_data");

// Parse command line arguments with enhanced support for flags
const args = process.argv.slice(2).reduce((acc, arg) => {
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
  output: args.output || path.join(__dirname, "output"),
  skipHarmonization: args.skipHarmonization || false,
  skipGlobal: args.skipGlobal || false,
  skipSplit: args.skipSplit || false,
  validateOnly: args.validateOnly || false,
  force: args.force || false,
  verbose: args.verbose || false,
};

// Derived values
const csvPath = options.input;
const year = options.year;
const outputDir = options.output;
const globalOutputPath = path.join(outputDir, `global_${year}_data.json`);
const splitOutputDir = path.join(outputDir, "split_data");

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

  // Standard field mappings
  const FIELD_MAPPINGS = {
    country_UK: "united_kingdom",
    country_USA: "united_states",
    country_Australia: "australia",
    country_India: "india",
    country_Brazil: "brazil",
    country_Saudi_Arabia_UAE: "saudi_arabia_uae",
  };

  // First read to get headers
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("headers", (csvHeaders) => {
        headers.push(...csvHeaders);
      })
      .on("data", (row) => {
        // If first column has a value, it's a new question
        if (row[headers[0]]) {
          currentQuestion = row[headers[0]];
        }

        if (currentQuestion && row[headers[1]]) {
          const response = row[headers[1]];
          const dataObj = { region: {} };

          // Process region/country data
          Object.entries(FIELD_MAPPINGS).forEach(([csvField, jsonField]) => {
            const value = parseFloat(row[csvField]);
            if (!isNaN(value)) {
              dataObj.region[jsonField] = value;
            }
          });

          // Calculate country_overall
          const countryValues = Object.values(dataObj.region).filter(
            (v) => !isNaN(v)
          );
          if (countryValues.length > 0) {
            const average =
              countryValues.reduce((sum, val) => sum + val, 0) /
              countryValues.length;
            dataObj.region.country_overall = parseFloat(average.toFixed(2));
          }

          // Add demographic data
          // Age
          dataObj.age = {};
          ["18-24", "25-34", "35-44", "45-54", "55-65"].forEach((age) => {
            const value = parseFloat(
              row[`age_${age.replace("-", "_")}`] || row[`age_${age}`]
            );
            if (!isNaN(value)) {
              dataObj.age[age] = value;
            }
          });

          // Gender
          dataObj.gender = {};
          ["male", "female"].forEach((gender) => {
            const value = parseFloat(row[`gender_${gender}`]);
            if (!isNaN(value)) {
              dataObj.gender[gender] = value;
            }
          });

          // Organization size
          dataObj.org_size = {};
          const orgSizes = {
            fewer_than_10: "fewer_than_10",
            "10_to_49": "10_to_49",
            "50_to_99": "50_to_99",
            "100_to_249": "100_to_249",
            "250_to_499": "250_to_499",
            "500_to_999": "500_to_999",
            "1000_or_more": "1000_or_more",
          };

          Object.entries(orgSizes).forEach(([csvField, jsonField]) => {
            const value = parseFloat(row[`org_size_${csvField}`]);
            if (!isNaN(value)) {
              dataObj.org_size[jsonField] = value;
            }
          });

          // Sector
          dataObj.sector = {};
          const sectors = [
            "agriculture_forestry_fishing",
            "automotive",
            "business_administration_support_services",
            "clean_technology",
            "technology",
            "construction",
            "education",
            "energy_utilities",
            "financial_services",
            "food_drink",
            "government",
            "healthcare_life_sciences",
            "leisure_sport_entertainment_recreation",
            "manufacturing_industrial",
            "marketing_services",
            "media_entertainment",
            "not_for_profit",
            "real_estate_property_services",
            "retail",
            "sports",
            "telecommunications",
            "transport_storage",
            "travel_hospitality_leisure",
            "wholesale_distribution",
            "other",
          ];

          sectors.forEach((sector) => {
            const value = parseFloat(row[`sector_${sector}`]);
            if (!isNaN(value)) {
              dataObj.sector[sector] = value;
            }
          });

          // Job level
          dataObj.job_level = {};
          const jobLevels = {
            ceo: "ceo",
            senior_executive: "senior_executive",
            senior_leader: "senior_leader",
            mid_level_leader: "mid_level_leader",
            first_level_supervisor: "first_level_supervisor",
            individual_contributor: "individual_contributor",
          };

          Object.entries(jobLevels).forEach(([csvField, jsonField]) => {
            const value = parseFloat(row[`job_level_${csvField}`]);
            if (!isNaN(value)) {
              dataObj.job_level[jsonField] = value;
            }
          });

          // Relationship status
          dataObj.relationship_status = {};
          const relationshipStatuses = [
            "single",
            "cohabiting",
            "married",
            "divorced_separated",
            "widowed",
          ];

          relationshipStatuses.forEach((status) => {
            const value = parseFloat(row[`relationship_status_${status}`]);
            if (!isNaN(value)) {
              dataObj.relationship_status[status] = value;
            }
          });

          // Education
          dataObj.education = {};
          const educationLevels = [
            "secondary",
            "tertiary",
            "undergraduate",
            "postgraduate",
            "doctorate",
          ];

          educationLevels.forEach((level) => {
            const value = parseFloat(row[`education_${level}`]);
            if (!isNaN(value)) {
              dataObj.education[level] = value;
            }
          });

          // Add generation and employment_status as empty objects for now
          dataObj.generation = {};
          dataObj.employment_status = {};

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
    const result = await harmonizer.harmonize2025Data(harmonizeOptions);

    if (!result.success) {
      throw new Error(`Harmonization failed: ${result.error}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Data harmonized successfully in ${duration} seconds.`);
    console.log(`   Output: ${result.outputPath}`);
    console.log(`   Processed ${result.recordCount} records.`);

    return result.outputPath;
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
 * Split global data into individual files with metadata
 */
async function splitGlobalDataToFiles(params) {
  try {
    const inputFile = params.input;
    const year = params.year;
    const outputDir = params.output;
    const verboseOutput = params.verbose || false;

    console.log(`Reading global data file: ${inputFile}`);
    const globalData = JSON.parse(fs.readFileSync(inputFile, "utf8"));

    console.log(`Read ${globalData.length} items from global data file`);

    // Load canonical mapping for proper file naming
    const canonicalMappingPath = path.join(
      __dirname,
      "reference files",
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
        data,
      });

      // If it's a sub-question, also store it separately
      if (subQuestionId) {
        const mainQuestion = questionsById.get(mainQuestionId);

        if (!mainQuestion.subQuestions.has(subQuestionId)) {
          mainQuestion.subQuestions.set(subQuestionId, []);
        }

        mainQuestion.subQuestions.get(subQuestionId).push({
          response,
          data,
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
            primaryMetric: "country_overall",
            valueFormat: "decimal",
            sortOrder: "descending",
          },
        };

        // Create file data
        const fileData = {
          metadata,
          question: questionData,
          responses: responseItems,
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
