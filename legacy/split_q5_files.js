const fs = require("fs");
const path = require("path");

// Define paths
const dataDir = path.join(__dirname, "output", "split_data");
const sourceFile = path.join(dataDir, "2025_5.json");
const canonicalFile = path.join(
  __dirname,
  "reference files",
  "canonical_topic_mapping.json"
);

// Read source file and canonical mapping
const sourceData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const canonicalData = JSON.parse(fs.readFileSync(canonicalFile, "utf8"));

// Find AI topics in canonical mapping
const findTopic = (topicId) => {
  for (const theme of canonicalData.themes) {
    for (const topic of theme.topics) {
      if (topic.id === topicId) {
        return topic;
      }
    }
  }
  return null;
};

const aiAttitudesTopic = findTopic("AI_Attitudes");
const aiReadinessTopic = findTopic("AI_Readiness");

// Map responses to question IDs
// This is a heuristic based mapping using the response content
const responseToQuestionMap = [
  {
    // Q5_2 - AI_Attitudes (first question about organization encouraging experimentation)
    response:
      "My organization encourages experimentation with new technologies",
    questionId: "Q5_2",
    topicId: "AI_Attitudes",
  },
  {
    // Q5_3 - AI_Attitudes (positive attitude about AI)
    response:
      "I feel excited and positive about how emerging technologies like AI will change the way I work",
    questionId: "Q5_3",
    topicId: "AI_Attitudes",
  },
  {
    // Q5_4 - AI_Readiness (value of AI)
    response:
      "I think using AI in my role will bolster my value in the next three years",
    questionId: "Q5_4",
    topicId: "AI_Readiness",
  },
  {
    // Q5_5 - AI_Readiness (using AI for better results)
    response:
      "When I've been asked to use AI to help with my job, I found it produced better results and/or improved efficiency.",
    questionId: "Q5_5",
    topicId: "AI_Readiness",
  },
  {
    // Q5_6 - AI_Readiness (leaders understand AI)
    response: "I feel leaders in my organization understand AI",
    questionId: "Q5_6",
    topicId: "AI_Readiness",
  },
  {
    // Q5_7 - AI_Readiness (trained to use AI tools)
    response: "I feel adequately trained to use AI tools",
    questionId: "Q5_7",
    topicId: "AI_Readiness",
  },
  {
    // Q5_8 - AI_Attitudes (concern about replacement by AI)
    response:
      "I feel certain that my role will be replaced by AI/tech in the next three years",
    questionId: "Q5_8",
    topicId: "AI_Attitudes",
  },
];

// First response in the file appears to be a Learning Development question and already has its own file (2025_5_1.json)
// Skip it when processing
const firstResponseText =
  "My organization offers a broad enough range of learning approaches";

// Create individual files for each response
sourceData.responses.forEach((response) => {
  // Skip the first response about learning approaches
  if (response.response.includes(firstResponseText)) {
    console.log(
      `Skipping response (already in 2025_5_1.json): ${response.response.substring(
        0,
        30
      )}...`
    );
    return;
  }

  // Find the matching response in our map
  const mapping = responseToQuestionMap.find(
    (map) =>
      response.response.includes(map.response) ||
      map.response.includes(response.response)
  );

  if (!mapping) {
    console.error(
      `Could not find mapping for response: ${response.response.substring(
        0,
        30
      )}...`
    );
    return;
  }

  // Get the appropriate topic from canonical mapping
  const topic =
    mapping.topicId === "AI_Attitudes" ? aiAttitudesTopic : aiReadinessTopic;

  if (!topic) {
    console.error(`Could not find topic: ${mapping.topicId}`);
    return;
  }

  // Create metadata for the new file
  const newFileData = {
    metadata: {
      topicId: mapping.topicId,
      questionId: mapping.questionId,
      year: 2025,
      keywords: topic.alternatePhrasings || [],
      canonicalQuestion: topic.canonicalQuestion,
      comparable: topic.comparable || false,
      userMessage:
        topic.userMessage ||
        "Year‑on‑year comparisons not available due to new question additions in 2025.",
      availableMarkets: topic.availableMarkets || [],
      relatedTopics:
        mapping.topicId === "AI_Attitudes"
          ? ["AI_Readiness", "Learning_and_Development"]
          : ["AI_Attitudes", "Learning_and_Development"],
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
    question: sourceData.question,
    responses: [response],
  };

  // Use correct filename format: 2025_5_2.json instead of Q5_2.json
  const fileNumber = mapping.questionId.split("_")[1];
  const outputFile = path.join(dataDir, `2025_5_${fileNumber}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(newFileData, null, 2));
  console.log(`Created file: ${outputFile}`);
});

// Clean up previously generated files with incorrect names
responseToQuestionMap.forEach((mapping) => {
  const incorrectFile = path.join(dataDir, `${mapping.questionId}.json`);
  if (fs.existsSync(incorrectFile)) {
    fs.unlinkSync(incorrectFile);
    console.log(`Removed incorrectly named file: ${incorrectFile}`);
  }
});

console.log("File splitting complete.");
