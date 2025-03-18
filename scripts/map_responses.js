const fs = require("fs");
const path = require("path");

// Define the base path for data files
const basePath = "scripts/output/split_data/";

// Read the original file
const originalFilePath = path.join(basePath, "2025_6_1.json.original");
const originalData = JSON.parse(fs.readFileSync(originalFilePath, "utf8"));

// Map each response to its correct file based on the canonical mapping
const responseToFileMap = {
  "I feel my company provides a variety of ways to communicate and connect with colleagues":
    "2025_6_1.json", // Communication_and_Connection
  "I have strong connections with my remote colleagues": "2025_6_1.json", // Communication_and_Connection
  "I feel leaders in my company respect the needs of employees across generations":
    "2025_6_2.json", // Intergenerational_Collaboration
  "I feel my company provides adequate support for employee mental well-being":
    "2025_6_3.json", // Employee_Wellbeing
  "I would stay at a job if it allowed me flexibility, even if I hated the role.":
    "2025_6_6.json", // Work_Life_Flexibility
  "My organization has taken steps to reduce cultural gaps between different generations of workers":
    "2025_6_7.json", // Intergenerational_Collaboration
  "I feel I work better with people my own age": "2025_6_8.json", // Intergenerational_Collaboration
};

// Define metadata for each file
const fileMetadata = {
  "2025_6_1.json": {
    topicId: "Communication_and_Connection",
    questionId: "Q6_1",
    year: 2025,
    canonicalQuestion:
      "How comfortable are you communicating and connecting with colleagues?",
    comparable: false,
    userMessage:
      "Compare with caution due to differences in question framing between years.",
    keywords: [
      "workplace relationships",
      "peer communication",
      "colleague connections",
      "collaboration comfort",
    ],
    relatedTopics: ["Culture_and_Values", "Manager_Capability"],
  },
  "2025_6_2.json": {
    topicId: "Intergenerational_Collaboration",
    questionId: "Q6_2",
    year: 2025,
    canonicalQuestion:
      "How effectively do different generations collaborate in your workplace?",
    comparable: false,
    userMessage: "New in 2025; no year‑on‑year comparison.",
    keywords: [
      "generational diversity",
      "age-diverse teams",
      "cross-generational work",
      "multigenerational workplace",
    ],
    relatedTopics: ["Culture_and_Values", "DEI"],
  },
  "2025_6_3.json": {
    topicId: "Employee_Wellbeing",
    questionId: "Q6_3",
    year: 2025,
    canonicalQuestion:
      "How supported do you feel in terms of wellbeing at work?",
    comparable: false,
    userMessage:
      "Compare with caution due to differences in question framing between years.",
    keywords: [
      "health support",
      "wellbeing initiatives",
      "work-life support",
      "mental health",
    ],
    relatedTopics: ["Work_Life_Flexibility", "Motivation_and_Fulfillment"],
  },
  "2025_6_4.json": {
    topicId: "Communication_and_Connection",
    questionId: "Q6_4",
    year: 2025,
    canonicalQuestion:
      "How comfortable are you communicating and connecting with colleagues?",
    comparable: false,
    userMessage:
      "Compare with caution due to differences in question framing between years.",
    keywords: [
      "workplace relationships",
      "peer communication",
      "colleague connections",
      "collaboration comfort",
    ],
    relatedTopics: ["Culture_and_Values", "Manager_Capability"],
  },
  "2025_6_5.json": {
    topicId: "Pay_and_Reward",
    questionId: "Q6_5",
    year: 2025,
    canonicalQuestion:
      "How fair do you consider your compensation relative to your contribution?",
    comparable: true,
    availableMarkets: [
      "United Kingdom",
      "United States",
      "Australia",
      "India",
      "Brazil",
    ],
    userMessage: "Note: Wording differs between Q8 (2024) and Q11 (2025).",
    keywords: [
      "compensation fairness",
      "salary satisfaction",
      "pay equity",
      "reward adequacy",
    ],
    relatedTopics: ["Retention_Factors", "Attrition_Factors"],
  },
  "2025_6_6.json": {
    topicId: "Work_Life_Flexibility",
    questionId: "Q6_6",
    year: 2025,
    canonicalQuestion:
      "How important is flexibility in your work arrangements?",
    comparable: false,
    userMessage:
      "Compare with caution due to differences in question framing between years.",
    keywords: [
      "flexible working",
      "work from anywhere",
      "work-life balance",
      "flexible arrangements",
    ],
    relatedTopics: ["Employee_Wellbeing", "Retention_Factors"],
  },
  "2025_6_7.json": {
    topicId: "Intergenerational_Collaboration",
    questionId: "Q6_7",
    year: 2025,
    canonicalQuestion:
      "How effectively do different generations collaborate in your workplace?",
    comparable: false,
    userMessage: "New in 2025; no year‑on‑year comparison.",
    keywords: [
      "generational diversity",
      "age-diverse teams",
      "cross-generational work",
      "multigenerational workplace",
    ],
    relatedTopics: ["Culture_and_Values", "DEI"],
  },
  "2025_6_8.json": {
    topicId: "Intergenerational_Collaboration",
    questionId: "Q6_8",
    year: 2025,
    canonicalQuestion:
      "How effectively do different generations collaborate in your workplace?",
    comparable: false,
    userMessage: "New in 2025; no year‑on‑year comparison.",
    keywords: [
      "generational diversity",
      "age-diverse teams",
      "cross-generational work",
      "multigenerational workplace",
    ],
    relatedTopics: ["Culture_and_Values", "DEI"],
  },
};

// Common data structure
const dataStructure = {
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
};

// Create a mapping of files to their responses
const filesToResponses = {};

// Group responses by file
originalData.responses.forEach((responseObj) => {
  const targetFile = responseToFileMap[responseObj.response];
  if (!targetFile) {
    console.error(`No mapping found for response: ${responseObj.response}`);
    return;
  }

  if (!filesToResponses[targetFile]) {
    filesToResponses[targetFile] = [];
  }

  filesToResponses[targetFile].push(responseObj);
});

// Create each file with its responses
Object.keys(filesToResponses).forEach((filename) => {
  const responses = filesToResponses[filename];
  const metadata = fileMetadata[filename];

  if (!metadata) {
    console.error(`No metadata found for file: ${filename}`);
    return;
  }

  // Create the file with proper structure
  const fileData = {
    metadata: {
      ...metadata,
      dataStructure: dataStructure,
    },
    question: originalData.question,
    responses: responses,
  };

  fs.writeFileSync(
    path.join(basePath, filename),
    JSON.stringify(fileData, null, 2)
  );
  console.log(`Created ${filename} with ${responses.length} response(s)`);
});

// Create Q6_4.json and Q6_5.json with empty responses as they don't have matching responses in the original file
["2025_6_4.json", "2025_6_5.json"].forEach((filename) => {
  if (!filesToResponses[filename]) {
    const metadata = fileMetadata[filename];

    // Create the file with proper structure but empty responses
    const fileData = {
      metadata: {
        ...metadata,
        dataStructure: dataStructure,
      },
      question: originalData.question,
      responses: [],
    };

    fs.writeFileSync(
      path.join(basePath, filename),
      JSON.stringify(fileData, null, 2)
    );
    console.log(
      `Created ${filename} with empty responses (no matching data in original file)`
    );
  }
});

console.log("All files created with proper mappings");
