#!/usr/bin/env node
/**
 * process_survey_data.js
 *
 * A unified script that orchestrates the complete survey data processing workflow:
 * 1. Process CSV to global JSON
 * 2. Split global JSON into individual files with metadata
 *
 * Usage:
 *   node process_survey_data.js --input=path/to/csv/file.csv --year=2024 --output=path/to/output/directory
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split("=");
  acc[key.replace("--", "")] = value;
  return acc;
}, {});

// Set default values
const csvPath =
  args.input || path.join(__dirname, "data", "2024", "Global- Table 1.csv");
const year = args.year || "2024";
const outputDir = args.output || path.join(__dirname, "output");
const globalOutputPath = path.join(outputDir, `global_${year}_data.json`);
const splitOutputDir = path.join(outputDir, "split_data");

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
 * Find the canonical topic for a question
 */
function findCanonicalTopic(question, canonicalMapping, year) {
  if (!canonicalMapping || !canonicalMapping.topics) {
    return null;
  }

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

    console.log(`Reading global data file: ${inputFile}`);
    const globalData = JSON.parse(fs.readFileSync(inputFile, "utf8"));

    console.log(`Read ${globalData.length} items from global data file`);

    // Load canonical mapping for proper file naming
    const canonicalMappingPath = path.join(__dirname, "canonical_mapping.json");
    let canonicalMapping = null;

    try {
      if (fs.existsSync(canonicalMappingPath)) {
        console.log(`Loading canonical mapping from: ${canonicalMappingPath}`);
        canonicalMapping = JSON.parse(
          fs.readFileSync(canonicalMappingPath, "utf8")
        );
      } else {
        console.log(
          "Canonical mapping file not found, using basic topic mapping"
        );
        canonicalMapping = createBasicCanonicalMapping();
      }
    } catch (error) {
      console.warn(`Error loading canonical mapping: ${error.message}`);
      console.log("Using basic topic mapping as fallback");
      canonicalMapping = createBasicCanonicalMapping();
    }

    // Group data by question
    const groupedData = {};
    const questionToTopicMap = new Map();
    const questionSubQuestionMap = new Map();

    // Create a mapping of question IDs to topics for easy lookup
    const topicByQuestionId = {};
    if (canonicalMapping && canonicalMapping.topics) {
      canonicalMapping.topics.forEach((topic) => {
        if (topic.mapping && topic.mapping[year]) {
          topic.mapping[year].forEach((qId) => {
            topicByQuestionId[qId.replace(/^Q/i, "")] = topic;
          });
        }
      });
    }

    // Pre-process for Q18 to organize questions correctly
    let q18Data = [];
    const q18TopicData = topicByQuestionId["18"] || null;
    let q18MainQuestion = "";

    // First pass to identify and group Q18 data
    globalData.forEach((item, index) => {
      const { question, response } = item;

      // Identify Q18 questions
      if (question.startsWith("18.") || question.match(/^Q?18[.\s]/i)) {
        q18MainQuestion = question;
        q18Data.push({ index, item });
      }
    });

    // Group Q18 responses by sub-questions (if found)
    // For Q18, we want to extract sub-question numbers for proper file naming
    const q18SubQuestions = {};

    // Initialize common sub-questions (based on looking at orig/ files)
    for (let i = 1; i <= 8; i++) {
      q18SubQuestions[i] = {
        responses: [],
        question: q18MainQuestion,
      };
    }

    // Assign responses to sub-questions
    if (q18Data.length > 0) {
      // If we have exactly 8 or 16 responses (typical for Q18 with Agree/Disagree pairs)
      if (q18Data.length === 8 || q18Data.length === 16) {
        // Assume sequential numbering for simplicity
        let currentSubQuestion = 1;
        let responsesPerSubQ = q18Data.length / 8; // 1 for just agree/disagree, 2 for paired

        for (let i = 0; i < q18Data.length; i++) {
          const subQIdx = Math.floor(i / responsesPerSubQ) + 1;
          q18SubQuestions[subQIdx].responses.push(q18Data[i].item);

          // Store sub-question info for later use
          questionSubQuestionMap.set(q18Data[i].index, {
            subQuestionNum: subQIdx,
            response: q18Data[i].item.response,
          });
        }
      } else {
        // Fallback: try to parse sub-question numbers from responses
        q18Data.forEach(({ index, item }) => {
          const { response } = item;

          // Try patterns like "18_1", "Q18_1", "1. Agree", etc.
          let subQuestionNum = null;

          // Check numbered patterns
          const numMatch = response.match(/^(?:18_|Q18_)?(\d+)/i);
          if (numMatch) {
            subQuestionNum = parseInt(numMatch[1]);
          }
          // Check if there's a number before Agree/Disagree
          else if (
            response.includes("Agree") ||
            response.includes("Disagree")
          ) {
            const agreeMatch = response.match(/(\d+)[\s_-]*(Agree|Disagree)/i);
            if (agreeMatch) {
              subQuestionNum = parseInt(agreeMatch[1]);
            }
          }

          // If we found a sub-question number and it's within range
          if (subQuestionNum && subQuestionNum >= 1 && subQuestionNum <= 8) {
            q18SubQuestions[subQuestionNum].responses.push(item);

            // Store sub-question info for later use
            questionSubQuestionMap.set(index, {
              subQuestionNum,
              response: item.response,
            });
          } else {
            // Fallback: assign to a sub-question based on position
            const fallbackSubQ = (q18Data.indexOf({ index, item }) % 8) + 1;
            q18SubQuestions[fallbackSubQ].responses.push(item);

            // Store sub-question info for later use
            questionSubQuestionMap.set(index, {
              subQuestionNum: fallbackSubQ,
              response: item.response,
            });
          }
        });
      }
    }

    // Create special entries for Q18 sub-questions
    if (q18Data.length > 0) {
      for (let i = 1; i <= 8; i++) {
        if (q18SubQuestions[i].responses.length > 0) {
          const fileId = `${year}_18_${i}`;
          groupedData[fileId] = {
            question: q18MainQuestion,
            responses: q18SubQuestions[i].responses,
            topic: q18TopicData,
            isQ18SubQuestion: true,
            subQuestionNum: i,
          };
        }
      }
    }

    // Now process all non-Q18 items
    globalData.forEach((item, index) => {
      const { question, response, data } = item;

      // Skip Q18 items as they've been handled specially
      if (question.startsWith("18.") || question.match(/^Q?18[.\s]/i)) {
        return;
      }

      // Extract the exact ID from the question string
      let fileId;

      // First try to match sub-questions like "4_9. AI - I feel..."
      const subIdMatch = question.match(/^(\d+_\d+)[.\s]/i);
      if (subIdMatch) {
        fileId = `${year}_${subIdMatch[1]}`;
      } else {
        // Then try regular questions like "1. Most important factors..."
        const idMatch = question.match(/^Q?(\d+)[.\s]/i);
        if (idMatch) {
          fileId = `${year}_${idMatch[1]}`;
        } else {
          // Only use topic mapping if we can't determine ID directly from question
          const topic = findCanonicalTopic(question, canonicalMapping, year);
          if (topic) {
            fileId = `${year}_${topic.id}`;
            questionToTopicMap.set(question, topic);
          } else {
            // Last resort - create a hash ID and warn about it
            console.warn(
              `No ID or canonical mapping found for question: "${question.substring(
                0,
                50
              )}..."`
            );
            const hashId =
              "x" +
              Math.abs(
                question.split("").reduce((a, b) => {
                  a = (a << 5) - a + b.charCodeAt(0);
                  return a & a;
                }, 0)
              )
                .toString(16)
                .slice(0, 4);
            fileId = `${year}_${hashId}`;
          }
        }
      }

      // Get the question ID (for looking up in canonical mapping)
      let questionId = fileId.split("_").slice(1).join("_");

      // Find canonical topic if available
      const topic =
        topicByQuestionId[questionId] ||
        findCanonicalTopic(question, canonicalMapping, year);

      if (topic) {
        questionToTopicMap.set(question, topic);
      }

      // Initialize group if not exists
      if (!groupedData[fileId]) {
        groupedData[fileId] = {
          question,
          responses: [],
          topic: questionToTopicMap.get(question),
        };
      }

      // Add response
      groupedData[fileId].responses.push({
        response,
        data,
      });
    });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create files
    let fileCount = 0;

    for (const [fileId, fileData] of Object.entries(groupedData)) {
      // Extract details for metadata
      const questionParts = fileId.split("_");
      const questionIdBase = questionParts[1]; // e.g., "18" from "2024_18_1"
      const isSubQuestion = questionParts.length > 2;
      const subQuestionNum = isSubQuestion ? questionParts[2] : null;
      const fullQuestionId = isSubQuestion
        ? `${questionIdBase}_${subQuestionNum}`
        : questionIdBase;

      // Get topic data for this question
      const topic =
        fileData.topic ||
        topicByQuestionId[fullQuestionId] ||
        topicByQuestionId[questionIdBase];

      // Create rich metadata structure similar to the original files
      let metadata;

      // Special handling for Q18 sub-questions
      if (fileData.isQ18SubQuestion) {
        // Use the Motivation_and_Fulfillment topic for Q18
        const q18Topic = topicByQuestionId["18"] || {
          id: "Motivation_and_Fulfillment",
          theme: "Employee Experience",
          canonicalQuestion:
            "How motivated and fulfilled do you feel in your role?",
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
        };

        // Determine if responses are Agree/Disagree
        let subQuestion = "";
        if (
          fileData.responses.length > 0 &&
          (fileData.responses[0].response.includes("Agree") ||
            fileData.responses[0].response.includes("Disagree"))
        ) {
          subQuestion = fileData.responses[0].response.includes("Agree")
            ? "Agree"
            : "Disagree";
        }

        // Create metadata with fields in exact order matching the template
        metadata = {
          topicId: q18Topic.id,
          theme: q18Topic.theme || "Employee Experience",
          questionId: `Q${fullQuestionId}`,
          year: parseInt(year),
          keywords: q18Topic.keywords || [],
          canonicalQuestion: q18Topic.canonicalQuestion,
          subQuestion,
          comparable: q18Topic.comparable || false,
          userMessage: q18Topic.userMessage || "",
          availableMarkets: [],
          relatedTopics: q18Topic.relatedTopics || [],
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
      }
      // Enhanced metadata for other questions
      else if (topic) {
        // Create metadata with fields in exact order matching the template
        metadata = {
          topicId: topic.id,
          theme: topic.theme || "Employee Experience",
          questionId: `Q${fullQuestionId}`,
          year: parseInt(year),
          keywords: topic.keywords || [],
          canonicalQuestion: topic.canonicalQuestion,
          subQuestion: "", // Empty string for non-subquestions
          comparable: topic.comparable || false,
          userMessage: topic.userMessage || "",
          availableMarkets: [],
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
      }
      // Basic metadata for questions without topics
      else {
        // Create metadata with fields in exact order matching the template
        metadata = {
          topicId: "", // Empty string for unknown topic
          theme: "", // Empty string for unknown theme
          questionId: `Q${fullQuestionId}`,
          year: parseInt(year),
          keywords: [],
          canonicalQuestion: "",
          subQuestion: "",
          comparable: false,
          userMessage: "",
          availableMarkets: [],
          relatedTopics: [],
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
      }

      // Complete file data
      const completeFileData = {
        metadata,
        question: fileData.question,
        responses: fileData.responses,
      };

      // Write file
      const outputFile = path.join(outputDir, `${fileId}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(completeFileData, null, 2));

      console.log(
        `Created file: ${outputFile} with ${fileData.responses.length} responses`
      );
      fileCount++;
    }

    // Create a file mapping index for reference
    const fileMapping = Object.entries(groupedData).map(([fileId, data]) => ({
      file: `${fileId}.json`,
      question:
        data.question.substring(0, 100) +
        (data.question.length > 100 ? "..." : ""),
      topicId: data.topic ? data.topic.id : null,
    }));

    fs.writeFileSync(
      path.join(outputDir, `${year}_file_index.json`),
      JSON.stringify(fileMapping, null, 2)
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
 * Main function to run the complete survey data processing workflow
 */
async function main() {
  console.log("=== SURVEY DATA PROCESSING WORKFLOW ===");
  console.log(`CSV Input: ${csvPath}`);
  console.log(`Year: ${year}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log("=====================================\n");

  try {
    // Step 1: Process CSV to global JSON
    console.log("STEP 1: Processing CSV to global JSON...");
    const startTime1 = Date.now();

    const globalData = await processCSVToGlobal(csvPath);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write the global JSON file
    fs.writeFileSync(globalOutputPath, JSON.stringify(globalData, null, 2));

    const duration1 = ((Date.now() - startTime1) / 1000).toFixed(2);
    console.log(`✅ Global JSON created successfully in ${duration1} seconds.`);
    console.log(`   Output: ${globalOutputPath}`);

    // Step 2: Split global JSON and add metadata
    console.log("\nSTEP 2: Splitting global JSON and adding metadata...");
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

    // Final summary
    const totalDuration = ((Date.now() - startTime1) / 1000).toFixed(2);
    console.log("\n=== PROCESSING COMPLETE ===");
    console.log(`Total processing time: ${totalDuration} seconds`);
    console.log(
      `Total files created: ${
        fileCount + 1
      } (1 global JSON + ${fileCount} split files)`
    );
    console.log("=============================");

    return { success: true, fileCount: fileCount + 1 };
  } catch (error) {
    console.error("\n❌ ERROR in processing workflow:", error);
    return { success: false, error };
  }
}

// Check for --help flag
if (args.help || args.h) {
  console.log(`
  Survey Data Processing Workflow
  ------------------------------
  
  Usage:
    node process_survey_data.js [options]
  
  Options:
    --input=<path>    Path to the input CSV file
                      Default: ./data/2024/Global- Table 1.csv
    
    --year=<year>     Survey year (2024, 2025, etc.)
                      Default: 2024
    
    --output=<path>   Output directory for all generated files
                      Default: ./output
    
    --help, -h        Show this help message
  
  Examples:
    node process_survey_data.js --input=./data/2025/survey.csv --year=2025
    node process_survey_data.js --output=./custom_output
  `);
  process.exit(0);
}

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
      console.error("Failed to process survey data:", err);
      process.exit(1);
    });
}

module.exports = {
  processCSVToGlobal,
  splitGlobalDataToFiles,
  main,
};
