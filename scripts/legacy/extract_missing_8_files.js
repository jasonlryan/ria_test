const fs = require("fs");
const path = require("path");

// Paths
const sourceFilePath = path.join(__dirname, "output", "global_2025_data.json");
const outputDir = path.join(__dirname, "output", "split_data");

// Load the global data
console.log(`Reading global data from: ${sourceFilePath}`);
const globalData = JSON.parse(fs.readFileSync(sourceFilePath, "utf8"));

// Define the missing files and their response text patterns to search for
const missingFiles = [
  {
    fileName: "2025_8_2.json",
    responsePattern: "Leaders at my organization are often not aligned",
    topicId: "Leadership_Confidence",
    questionId: "Q8_2",
    canonicalQuestion:
      "How confident are you in your organization's leadership?",
    keywords: [
      "trust in leadership",
      "executive confidence",
      "leadership effectiveness",
      "management trust",
    ],
    relatedTopics: ["Culture_and_Values", "Organizational_Adaptation"],
  },
  {
    fileName: "2025_8_7.json",
    responsePattern:
      "I frequently doubt my ability to fulfill my work responsibilities",
    topicId: "DEI",
    questionId: "Q8_7",
    canonicalQuestion:
      "How committed is your organization to diversity, equity, and inclusion?",
    keywords: [
      "diversity initiatives",
      "equity programs",
      "inclusion efforts",
      "workplace diversity",
    ],
    relatedTopics: ["Culture_and_Values", "Leadership_Confidence"],
  },
  {
    fileName: "2025_8_8.json",
    responsePattern: "I struggle with imposter syndrome",
    topicId: "DEI",
    questionId: "Q8_8",
    canonicalQuestion:
      "How committed is your organization to diversity, equity, and inclusion?",
    keywords: [
      "diversity initiatives",
      "equity programs",
      "inclusion efforts",
      "workplace diversity",
    ],
    relatedTopics: ["Culture_and_Values", "Leadership_Confidence"],
  },
  {
    fileName: "2025_8_9.json",
    responsePattern: "I share negative reviews about my employer",
    topicId: "DEI",
    questionId: "Q8_9",
    canonicalQuestion:
      "How committed is your organization to diversity, equity, and inclusion?",
    keywords: [
      "diversity initiatives",
      "equity programs",
      "inclusion efforts",
      "workplace diversity",
    ],
    relatedTopics: ["Culture_and_Values", "Leadership_Confidence"],
  },
];

// Process each missing file
for (const file of missingFiles) {
  // Find the item in the global data
  const item = globalData.find(
    (item) =>
      item.response &&
      item.response.toLowerCase().includes(file.responsePattern.toLowerCase())
  );

  if (!item) {
    console.error(
      `Could not find response matching "${file.responsePattern}" for ${file.fileName}`
    );
    continue;
  }

  // Create the properly formatted file with metadata
  const fileData = {
    metadata: {
      topicId: file.topicId,
      questionId: file.questionId,
      year: 2025,
      canonicalQuestion: file.canonicalQuestion,
      comparable: false,
      userMessage:
        file.topicId === "DEI"
          ? "Compare with caution due to expanded question set in 2025."
          : "Compare with caution due to differences in question framing between years.",
      keywords: file.keywords,
      availableMarkets: [],
      relatedTopics: file.relatedTopics,
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
    },
    question: item.question,
    responses: [
      {
        response: item.response,
        data: item.data,
      },
    ],
  };

  // Write the output file
  const outputFilePath = path.join(outputDir, file.fileName);
  console.log(`Writing ${file.fileName} to: ${outputFilePath}`);
  fs.writeFileSync(outputFilePath, JSON.stringify(fileData, null, 2));
  console.log(`${file.fileName} created successfully`);
}

console.log("All missing files have been created successfully");
