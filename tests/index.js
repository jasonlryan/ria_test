// Main test runner file
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Verify that the OpenAI API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY not found in environment variables.");
  console.error(
    "Please ensure the .env file at the project root contains a valid API key."
  );
  process.exit(1);
} else {
  console.log("OpenAI API key loaded successfully.");
}

// Check for assistant ID
const defaultAssistantId = process.env.OPENAI_ASSISTANT_ID;
const cliAssistantId = process.argv
  .find((arg) => arg.startsWith("--assistant="))
  ?.split("=")[1];
global.assistantId = cliAssistantId || defaultAssistantId;

if (!global.assistantId) {
  console.error("ERROR: No assistant ID provided.");
  console.error("Please either:");
  console.error("1. Set OPENAI_ASSISTANT_ID in your .env file");
  console.error(
    "2. Provide it via CLI: npm run scripts:tests -- --assistant=asst_xxx"
  );
  process.exit(1);
} else {
  console.log(`Using assistant ID: ${global.assistantId}`);
}

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  console.error(`ERROR: Data directory not found at ${dataDir}`);
  console.error(
    "Please ensure the tests/data directory exists and contains the required data files."
  );
  process.exit(1);
} else {
  console.log(`Data directory found at ${dataDir}`);
}

// Get available test files
function getAvailableTestFiles() {
  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".csv"))
    .map((file) => ({
      name: file,
      path: path.join(dataDir, file),
      // Extract test type from filename (e.g., "Bias Evaluation Questions.csv" -> "Bias Evaluation")
      type: path.parse(file).name.split(" ").slice(0, -1).join(" "),
    }));

  if (files.length === 0) {
    console.error("No test files found in the data directory.");
    process.exit(1);
  }

  return files;
}

// Present options to user
async function selectTestFile() {
  const files = getAvailableTestFiles();

  console.log("\nAvailable tests:");
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.type} (${file.name})`);
  });

  return new Promise((resolve) => {
    rl.question("\nSelect a test to run (enter number): ", (answer) => {
      const selection = parseInt(answer) - 1;
      if (selection >= 0 && selection < files.length) {
        const selectedFile = files[selection];
        console.log(`\nSelected: ${selectedFile.type} test`);
        // Set the selected file info as globals for the test runner
        global.selectedTestFile = path.parse(selectedFile.name).name;
        global.selectedTestType = selectedFile.type;
        resolve();
      } else {
        console.error("Invalid selection. Please run the tests again.");
        rl.close();
        process.exit(1);
      }
    });
  });
}

// Main execution
async function runTests() {
  await selectTestFile();
  console.log(`\nRunning ${global.selectedTestType} tests...`);

  // Run the OpenAI-dependent tests
  require("./index-tests.js");

  rl.close();
}

runTests().catch((error) => {
  console.error("Error running tests:", error);
  rl.close();
  process.exit(1);
});
