const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function parseTextFile(fileInputName, callback) {
  fs.readFile(
    __dirname + `/data/${fileInputName}.txt`,
    "utf-8",
    (err, data) => {
      if (err) {
        console.error("Error reading text file:", err);
        rl.close();
        return;
      }
      console.log("Text file read successfully."); // Log success
      const records = parseData(data);
      console.log("Parsed Records:", records); // Log parsed records
      callback(records, fileInputName);
    }
  );
}

function parseData(data) {
  const lines = data.split("\n");
  const result = {};
  let currentCategory = null;
  let currentSubcategory = null;

  lines.forEach((line) => {
    line = line.trim();
    if (line && !line.startsWith("(") && !line.includes(":")) {
      // This is a main category line
      currentCategory = line
        .toLowerCase()
        .replace(/ /g, "_")
        .replace(/[^\w_]/g, "");
      result[currentCategory] = {};
    } else if (line.includes(":") && currentCategory) {
      // This is a subcategory line with values
      const [subcategory, values] = line.split(":");
      currentSubcategory = subcategory.trim().replace(/ /g, "_");
      const parsedValues = {};

      if (values) {
        const valuePairs = values.match(/(\w+):\s*([\d.]+)/g);
        if (valuePairs) {
          valuePairs.forEach((pair) => {
            const [key, value] = pair.split(":").map((s) => s.trim());
            parsedValues[key] = parseFloat(value);
          });
        }
      }

      result[currentCategory][currentSubcategory] = parsedValues;
    }
  });

  return result;
}

function writeJSON(records, fileInputName) {
  const outputFileName = `${__dirname}/data/${fileInputName}.json`;

  fs.writeFile(outputFileName, JSON.stringify(records, null, 2), (err) => {
    if (err) {
      console.error("Error writing JSON file:", err);
    } else {
      console.log(`JSON file written successfully to ${outputFileName}`);
    }
    rl.close();
  });
}

rl.question(
  "Enter the name of the text file (without extension): ",
  (fileInputName) => {
    parseTextFile(fileInputName, writeJSON);
  }
);
