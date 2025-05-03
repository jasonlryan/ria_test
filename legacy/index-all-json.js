const fs = require("fs");
const { parse } = require("csv-parse");
const path = require("path");

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

// Input/Output configuration
const config = {
  inputFile: "merged data-Table 1",
  outputFiles: [
    { code: "global", name: "global_data" },
    { code: "uk", name: "uk_data" },
    { code: "usa", name: "usa_data" },
    { code: "aus", name: "australia_data" },
    { code: "ind", name: "india_data" },
    { code: "br", name: "brazil_data" },
    { code: "me", name: "saudi_uae_data" },
  ],
};

async function parseCSV(callback) {
  const inputPath = path.join(__dirname, "data", `${config.inputFile}.csv`);
  console.log(`Reading input file: ${inputPath}`);

  fs.readFile(inputPath, "utf-8", (err, csv) => {
    if (err) {
      console.error("Error reading CSV file:", err);
      return;
    }
    parse(
      csv,
      { columns: true, trim: true, skip_empty_lines: true },
      (err, records) => {
        if (err) {
          console.error("Error parsing CSV:", err);
          return;
        }
        callback(records);
      }
    );
  });
}

function formatCountryData(records, countryCode) {
  const result = [];
  let currentQuestion = "";

  records.forEach((record) => {
    if (record["Question"]) {
      currentQuestion = record["Question"];
    }

    const response = record["Response"];
    if (!response || response === "Total") return;

    const groupedData = {
      country: {},
      age: {},
      gender: {},
      org_size: {},
      sector: {},
      job_level: {},
      relationship_status: {},
      education: {},
    };

    let hasData = false;

    Object.keys(record).forEach((rawKey) => {
      if (rawKey.startsWith(`${countryCode}_`)) {
        hasData = true;
        const key = rawKey.replace(`${countryCode}_`, "");

        if (key.startsWith("country_")) {
          const countryName = key.replace("country_", "");
          groupedData.country[countryName] = record[rawKey];
        } else if (key.startsWith("age_")) {
          const ageGroup = key.replace("age_", "");
          groupedData.age[ageGroup] = record[rawKey];
        } else if (key.startsWith("gender_")) {
          const genderGroup = key.replace("gender_", "");
          groupedData.gender[genderGroup] = record[rawKey];
        } else if (key.startsWith("org_size_")) {
          const orgSizeGroup = key.replace("org_size_", "");
          groupedData.org_size[orgSizeGroup] = record[rawKey];
        } else if (key.startsWith("sector_")) {
          const sectorGroup = key.replace("sector_", "");
          groupedData.sector[sectorGroup] = record[rawKey];
        } else if (key.startsWith("job_level_")) {
          const jobLevelGroup = key.replace("job_level_", "");
          groupedData.job_level[jobLevelGroup] = record[rawKey];
        } else if (key.startsWith("relationship_status_")) {
          const relationshipStatusGroup = key.replace(
            "relationship_status_",
            ""
          );
          groupedData.relationship_status[relationshipStatusGroup] =
            record[rawKey];
        } else if (key.startsWith("education_")) {
          const educationGroup = key.replace("education_", "");
          groupedData.education[educationGroup] = record[rawKey];
        }
      }
    });

    if (hasData) {
      result.push({
        question: currentQuestion,
        response: response,
        data: groupedData,
      });
    }
  });

  return result;
}

function generateReport(outputs) {
  const timestamp = getTimestamp();
  const inputPath = path.join(__dirname, "data", `${config.inputFile}.csv`);

  return {
    timestamp,
    inputFile: inputPath,
    outputs: outputs.map((o) => ({
      country: o.name,
      file: o.outputPath,
      records: o.data.length,
    })),
  };
}

parseCSV((records) => {
  const timestamp = getTimestamp();
  const outputs = [];

  // Process each country's data
  config.outputFiles.forEach(({ code, name }) => {
    const data = formatCountryData(records, code);
    const outputPath = path.join(outputDir, `${name}.json`);

    console.log(`Processing ${name}...`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    outputs.push({ name, outputPath, data });
  });

  // Generate and save report
  const report = generateReport(outputs);
  const reportPath = path.join(
    outputDir,
    `processing_report_${timestamp}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\nProcessing complete!");
  console.log("Files generated:");
  outputs.forEach((o) =>
    console.log(`- ${o.name}.json (${o.data.length} records)`)
  );
  console.log(`- processing_report_${timestamp}.json`);
});
