const fs = require("fs");
const { parse } = require("csv-parse");
const readline = require("readline");
const path = require("path");

// Create an interface for reading input from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to get current timestamp in YYYYMMDD_HHMMSS format
function getTimestamp() {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/[T.]/g, "_")
    .slice(0, 15);
}

// Ensure output directory exists
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Prompt the user for the filename
rl.question(
  "Enter the CSV file name (without extension): ",
  (fileInputName) => {
    async function parseCSV(callback) {
      const inputPath = path.join(__dirname, "data", `${fileInputName}.csv`);
      console.log(`Reading input file: ${inputPath}`);

      fs.readFile(inputPath, "utf-8", (err, csv) => {
        if (err) {
          console.error("Error reading CSV file:", err);
          rl.close();
          return;
        }
        parse(
          csv,
          { columns: true, trim: true, skip_empty_lines: true },
          (err, records) => {
            if (err) {
              console.error("Error parsing CSV:", err);
              rl.close();
              return;
            }
            callback(records);
          }
        );
      });
    }

    function formatData(records) {
      const result = [];
      let currentQuestion = "";

      records.forEach((record) => {
        if (record["Question"]) {
          currentQuestion = record["Question"];
        }
        const response = record["Response"];
        const groupedData = {
          region: {},
          age: {},
          gender: {},
          org_size: {},
          sector: {},
          job_level: {},
          relationship_status: {},
          education: {},
        };

        Object.keys(record).forEach((key) => {
          if (key.startsWith("region_")) {
            const regionName = key.replace("region_", "");
            groupedData.region[regionName] = record[key];
          } else if (key.startsWith("age_")) {
            const ageGroup = key.replace("age_", "");
            groupedData.age[ageGroup] = record[key];
          } else if (key.startsWith("gender_")) {
            const genderGroup = key.replace("gender_", "");
            groupedData.gender[genderGroup] = record[key];
          } else if (key.startsWith("org_size_")) {
            const orgSizeGroup = key.replace("org_size_", "");
            groupedData.org_size[orgSizeGroup] = record[key];
          } else if (key.startsWith("sector_")) {
            const sectorGroup = key.replace("sector_", "");
            groupedData.sector[sectorGroup] = record[key];
          } else if (key.startsWith("job_level_")) {
            const jobLevelGroup = key.replace("job_level_", "");
            groupedData.job_level[jobLevelGroup] = record[key];
          } else if (key.startsWith("relationship_status_")) {
            const relationshipStatusGroup = key.replace(
              "relationship_status_",
              ""
            );
            groupedData.relationship_status[relationshipStatusGroup] =
              record[key];
          } else if (key.startsWith("education_")) {
            const educationGroup = key.replace("education_", "");
            groupedData.education[educationGroup] = record[key];
          }
        });

        if (!response || response === "Total") {
          return;
        }

        result.push({
          question: currentQuestion,
          response: response,
          data: groupedData,
        });
      });

      return result;
    }

    parseCSV((records) => {
      const formattedData = formatData(records);
      const timestamp = getTimestamp();
      const outputPath = path.join(
        outputDir,
        `${fileInputName}_${timestamp}.json`
      );

      console.log(`Writing output to: ${outputPath}`);
      fs.writeFile(
        outputPath,
        JSON.stringify(formattedData, null, 2),
        (err) => {
          if (err) {
            console.error("Error writing JSON file:", err);
          } else {
            console.log("JSON file has been saved!");
          }
          rl.close();
        }
      );
    });
  }
);
