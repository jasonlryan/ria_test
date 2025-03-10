const fs = require("fs");

let csvToJson = require("convert-csv-to-json");
let fileInputName = "Global Survey results";

let json = csvToJson
  .fieldDelimiter(",")
  .supportQuotedField(true)
  .getJsonFromCsv(`${fileInputName}.csv`);

let lastQuestion = "";

const DATA = json.reduce((total, response) => {
  const question = response["QUESTION"] || lastQuestion;
  // console.log("question", question);
  total[question] = total[question] || [];

  // Don't process a row if there's no response
  if (!response["RESPONSE"]) {
    return total;
  }

  // Store this question as the last question if the question exists
  // NOTE: This is to work with CSV where the question is only entered on the first row of the responses
  if (response["QUESTION"]) {
    lastQuestion = response["QUESTION"];
  }

  // We don't need these in the JSON response
  delete response["QUESTION"];

  // Push the response to the question array
  total[question].push(response);

  return total;
}, {});

// Build up indexes system prompt
let indexPrompt = "";

// Build up line number to use for indexPrompt
let lineNumber = 1;

// console.log("DATA", DATA);
//
const output = Object.keys(DATA).reduce((total, nextKey) => {
  const data = DATA[nextKey];

  // console.log("nextKey", nextKey);
  indexPrompt += `${nextKey}\n`;

  // If there's no question then skip
  if (!nextKey) {
    return total;
  }
  lineNumber++;

  // indexPrompt += ` (Lines ${lineNumber} - `;

  const content = data
    .map((question) => {
      const questionKeys = Object.keys(question);
      // console.log("questionKeys", questionKeys);
      // console.log("rowIndex", rowIndex);
      //   if (!question) {
      //     return "";
      //   }

      // Don't show Totals, as they're all 100%
      if (question["RESPONSE"] === "Total") {
        return "";
      }

      // console.log("questionKeys", questionKeys);

      const responses = questionKeys
        .map((responseKey, responseIndex) => {
          console.log("responseKey", responseKey);
          const response = question[responseKey];

          // If there's no response, then we don't need to include the data
          if (!response) {
            return "";
          }

          // If it's tht total row ignore too, as they're all 100%
          if (responseKey === "RESPONSE" && response === "Total") {
            return "";
          }

          return `${
            responseIndex === 0 ? "\t" : "\t\t"
          }${responseKey}: ${response}`;
        })
        .filter(Boolean);
      lineNumber += responses.length;

      return responses.join("\n");
    })
    .filter(Boolean);
  // indexPrompt += `${lineNumber})\n`;

  return `${total}\n${nextKey}\n${content.join("\n")}`;
}, "");

// console.log("------\nindexPrompt\n------\n", indexPrompt);

fs.writeFile(`${__dirname}/${fileInputName}.md`, output, (err) => {
  if (err) {
    console.error(err);
  } else {
    // file written successfully
  }
});
