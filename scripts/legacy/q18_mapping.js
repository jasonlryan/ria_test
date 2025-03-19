const fs = require("fs");
const path = require("path");

// Define the mapping of statements to file IDs
const statementToFileId = {
  "18. Motivation - I feel motivated to do more than is required of me.":
    "18_1",
  "18. Motivation - The company motivates me to do more than is required.":
    "18_2",
  "18. Motivation - My job provides opportunities to do challenging and interesting work.":
    "18_3",
  "18. Motivation - My job makes good use of my skills and abilities.": "18_4",
  "18. Motivation - I have good opportunities for learning and development at the company.":
    "18_5",
  "18. Motivation - I have trust and confidence in the company's senior leadership team.":
    "18_6",
  "18. Motivation - The company is responding effectively to changes in the business environment.":
    "18_7",
  "18. Motivation - The company shows care and concern for its employees.":
    "18_8",
};

// Function to create a corrected file for each Q18 statement
async function createCorrectedFiles() {
  // Read the global data file
  const globalData = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "output", "global_2024_data.json"),
      "utf8"
    )
  );

  // Process each statement
  for (const [statement, fileId] of Object.entries(statementToFileId)) {
    console.log(`Processing statement: ${statement}`);

    // Extract data for this statement
    const statementData = globalData.filter(
      (item) => item.question === statement
    );

    // Read the metadata from the original file
    const originalFile = path.join(
      __dirname,
      "..",
      "output",
      "split_data",
      `2024_${fileId}.json`
    );
    const originalData = JSON.parse(fs.readFileSync(originalFile, "utf8"));
    const metadata = originalData.metadata;

    // Create the corrected data structure
    const correctedData = {
      metadata,
      question: statement,
      responses: statementData.map((item) => ({
        response: item.response,
        data: item.data,
      })),
    };

    // Write to a new file
    const outputPath = path.join(__dirname, `corrected_2024_${fileId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(correctedData, null, 2));
    console.log(`Created corrected file: ${outputPath}`);
  }
}

createCorrectedFiles().catch(console.error);
