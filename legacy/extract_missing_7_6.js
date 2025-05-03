const fs = require("fs");
const path = require("path");

// Paths
const sourceFilePath = path.join(__dirname, "output", "global_2025_data.json");
const outputDir = path.join(__dirname, "output", "split_data");
const outputFilePath = path.join(outputDir, "2025_7_6.json");

// Load the global data
console.log(`Reading global data from: ${sourceFilePath}`);
const globalData = JSON.parse(fs.readFileSync(sourceFilePath, "utf8"));

// The leadership confidence response text to look for
const leadershipResponseText =
  "I have trust and confidence in the company's senior leadership team.";

// Find the specific response
const leadershipItem = globalData.find(
  (item) => item.response && item.response.includes(leadershipResponseText)
);

if (!leadershipItem) {
  console.error(
    "Could not find the leadership confidence response in the global data file"
  );
  process.exit(1);
}

// Create the properly formatted file with metadata
const fileData = {
  metadata: {
    topicId: "Leadership_Confidence",
    questionId: "Q7_6",
    year: 2025,
    canonicalQuestion:
      "How confident are you in your organization's leadership?",
    comparable: false,
    userMessage:
      "Compare with caution due to differences in question framing between years.",
    keywords: [
      "trust in leadership",
      "executive confidence",
      "leadership effectiveness",
      "management trust",
    ],
    relatedTopics: ["Culture_and_Values", "Organizational_Adaptation"],
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
  question: leadershipItem.question,
  responses: [
    {
      response: leadershipItem.response,
      data: leadershipItem.data,
    },
  ],
};

// Write the output file
console.log(`Writing 2025_7_6.json to: ${outputFilePath}`);
fs.writeFileSync(outputFilePath, JSON.stringify(fileData, null, 2));
console.log("File created successfully");
