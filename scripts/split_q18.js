const fs = require("fs");
const path = require("path");

// Define the input and output paths
const inputFilePath = path.join(
  __dirname,
  "output",
  "split_data",
  "2024_18.json"
);
const outputDir = path.join(__dirname, "output", "split_data");

// Read the original file
console.log(`Reading file: ${inputFilePath}`);
const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

// Define the questions to split (based on the canonical mapping)
const q18_splits = [
  {
    id: "18_1",
    question:
      "18_1. Motivation - I feel motivated to do more than is required of me.",
  },
  { id: "18_2", question: "18_2. Feel fulfilled in my job" },
  { id: "18_3", question: "18_3. Happy in current role" },
  { id: "18_4", question: "18_4. Can fully utilize my skills" },
  { id: "18_5", question: "18_5. Growth opportunities" },
  { id: "18_6", question: "18_6. Leadership confidence" },
  { id: "18_7", question: "18_7. Organization adapt to change" },
  { id: "18_8", question: "18_8. Organization cultural values" },
];

// Create a file for each split
q18_splits.forEach((split, index) => {
  // Create a copy of the data structure with the new question
  const newData = {
    question: split.question,
    responses: data.responses,
  };

  // Write the new file
  const outputFilePath = path.join(outputDir, `2024_${split.id}.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify(newData, null, 2));
  console.log(`Created file: ${outputFilePath}`);
});

console.log("Split completed successfully!");
