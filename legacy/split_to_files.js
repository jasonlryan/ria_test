/**
 * LEGACY FILE - DEPRECATED
 *
 * This script has been deprecated in favor of the consolidated process_survey_data.js script.
 * All functionality from this file has been incorporated into process_survey_data.js with
 * significant improvements to question identification, metadata handling, and performance.
 *
 * Please use process_survey_data.js instead:
 *
 * node process_survey_data.js --year=2025 --verbose
 *
 * This wrapper is maintained for backward compatibility but may be removed in future versions.
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Display deprecation warning
console.log("\n⚠️  WARNING: DEPRECATED SCRIPT ⚠️");
console.log("=================================");
console.log(
  "split_to_files.js is deprecated and will be removed in future versions."
);
console.log(
  "Please use process_survey_data.js instead, which includes all functionality"
);
console.log("from this script with significant improvements.\n");
console.log("Example usage:");
console.log("  node process_survey_data.js --year=2025 --verbose");
console.log("=================================\n");

// Check if we should proceed with compatibility mode
const args = process.argv.slice(2);
const forceRun = args.includes("--force");

if (!forceRun) {
  console.log("Redirecting to process_survey_data.js...\n");

  // Determine which year to process
  const yearArg = args.find(
    (arg) => arg.startsWith("--year=") || arg === "2024" || arg === "2025"
  );
  const year = yearArg
    ? yearArg.includes("=")
      ? yearArg.split("=")[1]
      : yearArg
    : "2025";

  // Execute the new script with appropriate args
  const scriptPath = path.join(__dirname, "process_survey_data.js");

  if (fs.existsSync(scriptPath)) {
    const command = `node "${scriptPath}" --year=${year} --verbose`;

    console.log(`Executing: ${command}\n`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.log(stdout);

      console.log("\n✅ Process completed via process_survey_data.js");
      console.log(
        "Please update your scripts to use process_survey_data.js directly in the future."
      );
    });
  } else {
    console.error(
      `Error: Could not find process_survey_data.js at ${scriptPath}`
    );
    console.log(
      "Please ensure the new script exists or use --force to run this legacy script directly."
    );
    process.exit(1);
  }
} else {
  // Legacy functionality - truncated version with warning
  console.log("Running in legacy mode (--force flag detected).");
  console.log(
    "This mode is not recommended and may produce inconsistent results.\n"
  );

  // Source and destination paths
  const sourceDir = path.join(__dirname, "output");
  const destDir = path.join(__dirname, "output", "split_data");

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`Created directory: ${destDir}`);
  }

  // Basic check for available data files
  const years = ["2024", "2025"];
  let dataFound = false;

  for (const year of years) {
    const dataFilePath = path.join(sourceDir, `global_${year}_data.json`);

    if (fs.existsSync(dataFilePath)) {
      console.log(`Found data file for ${year}: ${dataFilePath}`);
      dataFound = true;

      try {
        const data = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
        console.log(`File contains ${data.length} data items`);
        console.log(
          `Run process_survey_data.js to process these data properly.`
        );
      } catch (error) {
        console.error(`Error reading data file: ${error.message}`);
      }
    }
  }

  if (!dataFound) {
    console.error("No global data files found in the output directory.");
    console.log(
      "Please run process_survey_data.js first to generate the global data files."
    );
  }

  console.log("\n⚠️  LEGACY MODE COMPLETE ⚠️");
  console.log(
    "No files were processed. Please use process_survey_data.js instead."
  );
}
