const fs = require("fs");
const { parse } = require("csv-parse");

// UPDATE THE FILE NAME HERE
let fileInputName = "merged data-Table 1";

// const csv = `Question,Response,country_UK,country_USA,country_Australia,country_India,country_Brazil,country_Saudi_Arabia_UAE,age_18-24,age_25-34,age_35-44,age_45-54,age_55-65,gender_female,gender_male,org_size_fewer_than_10,org_size_10_to_49,org_size_50_to_99,org_size_100_to_249,org_size_250_to_499,org_size_500_to_999,org_size_1000_or_more,sector_agriculture_forestry_fishing,sector_automotive,sector_business_administration_support_services,sector_clean_technology,sector_technology,sector_construction,sector_education,sector_energy_utilities,sector_financial_services,sector_food_drink,sector_government,sector_healthcare_life_sciences,sector_leisure_sport_entertainment_recreation,sector_manufacturing_industrial,sector_marketing_services,sector_media_entertainment,sector_not_for_profit,sector_real_estate_property_services,sector_retail,sector_sports,sector_telecommunications,sector_transport_storage,sector_travel_hospitality_leisure,sector_wholesale_distribution,sector_other,job_level_CEO,job_level_senior_executive,job_level_senior_leader,job_level_mid_level_leader,job_level_first_level_supervisor,job_level_individual_contributor,relationship_status_single,relationship_status_cohabiting,relationship_status_married,relationship_status_divorced_separated,relationship_status_widowed,education_secondary,education_tertiary,education_undergraduate,education_postgraduate,education_doctorate
// 1. Most important factors when looking for a new Job,Flexible working hours,42%,33%,46%,33%,38%,33%,30%,36%,37%,43%,47%,42%,33%,44%,37%,34%,34%,36%,34%,44%,22%,26%,36%,20%,34%,34%,36%,36%,39%,35%,53%,44%,50%,39%,36%,42%,46%,38%,40%,29%,36%,38%,39%,44%,40%,33%,30%,33%,37%,40%,47%,37%,43%,37%,42%,32%,40%,44%,40%,34%,31%
// ,Generous salary /bonus/ compensation,44%,31%,45%,28%,46%,28%,27%,32%,36%,45%,52%,40%,34%,40%,34%,33%,35%,36%,34%,43%,20%,28%,38%,13%,30%,34%,38%,39%,35%,25%,51%,45%,37%,40%,33%,38%,47%,42%,38%,39%,35%,42%,39%,43%,41%,26%,29%,33%,37%,37%,50%,35%,47%,36%,46%,38%,36%,42%,41%,33%,30%
// ,"High job security (i.e., stable company/employer)",30%,26%,33%,33%,21%,32%,23%,28%,31%,33%,33%,31%,29%,23%,26%,25%,31%,28%,32%,36%,16%,28%,28%,18%,31%,27%,28%,27%,33%,18%,38%,33%,19%,29%,30%,32%,28%,30%,30%,11%,30%,27%,29%,35%,27%,27%,29%,27%,30%,31%,32%,26%,31%,31%,31%,21%,25%,34%,31%,30%,28%
// ,Excellent learning and development opportunities,22%,23%,22%,34%,34%,31%,24%,28%,29%,25%,20%,28%,26%,23%,25%,24%,25%,29%,31%,28%,26%,16%,24%,15%,30%,25%,31%,33%,26%,23%,23%,28%,34%,28%,28%,32%,25%,33%,24%,18%,29%,27%,27%,23%,24%,23%,30%,27%,28%,27%,25%,25%,26%,28%,21%,16%,19%,22%,28%,30%,29%
// ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// 2. Factors to Stay at Current Company,Generous salary / compensation,40%,32%,45%,28%,43%,33%,25%,34%,36%,43%,51%,38%,35%,34%,35%,32%,35%,35%,36%,43%,23%,27%,33%,17%,32%,37%,36%,35%,38%,29%,46%,40%,31%,38%,36%,39%,55%,45%,37%,26%,36%,44%,38%,43%,38%,29%,30%,35%,36%,38%,45%,34%,42%,37%,45%,28%,36%,40%,40%,33%,31%
// ,Total flexibility of working hours,31%,28%,33%,27%,30%,29%,24%,28%,30%,33%,39%,33%,27%,37%,29%,28%,28%,26%,28%,32%,18%,20%,27%,16%,28%,26%,29%,28%,27%,22%,32%,35%,37%,31%,30%,43%,37%,34%,33%,26%,29%,33%,40%,33%,34%,31%,26%,28%,28%,30%,34%,29%,31%,30%,35%,28%,30%,33%,30%,29%,28%
// ,High job security (of employment contract),28%,24%,28%,31%,25%,29%,24%,26%,28%,32%,28%,27%,28%,21%,23%,27%,27%,30%,28%,33%,13%,23%,24%,17%,31%,27%,29%,22%,28%,18%,33%,31%,24%,32%,30%,22%,31%,32%,27%,29%,25%,28%,22%,32%,23%,24%,29%,27%,28%,28%,27%,24%,28%,30%,25%,20%,23%,28%,27%,30%,27%`;

async function parseCSV(callback) {
  fs.readFile(__dirname + `/data/${fileInputName}.csv`, "utf-8", (err, csv) => {
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
  // console.log("file", file);
}

function formatData(records) {
  let result = "";
  let currentQuestion = "";

  records.forEach((record) => {
    if (record["Question"]) {
      currentQuestion = record["Question"];
      result += `\n${currentQuestion}`;
    }

    const response = record["Response"];

    const countryCodes = {
      global: "Global",
      uk: "UK",
      usa: "USA",
      aus: "Australia",
      ind: "India",
      br: "Brazil",
      me: "Saudi Arabia/UAE",
    };

    // Iterate over all possible country codes to capture data for each country
    for (let code in countryCodes) {
      let country = countryCodes[code];

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

      let countryDataExists = false;

      Object.keys(record).forEach((rawKey) => {
        if (rawKey.startsWith(`${code}_`)) {
          countryDataExists = true;
          const key = rawKey.replace(`${code}_`, "");

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

      // Only add to the result if there was data for this country
      if (countryDataExists && response && response !== "Total") {
        result += `\n${country}`;
        result += `\n    ${response}:`;

        for (const group in groupedData) {
          result += `\n        ${
            group.charAt(0).toUpperCase() + group.slice(1)
          }: `;
          const entries = Object.entries(groupedData[group])
            .filter(([key, value]) => value !== "100%" && value !== "")
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          result += `(${entries})`;
        }
      }
    }
  });

  return result.trim();
}

parseCSV((records) => {
  // console.log("records", records);
  const formattedData = formatData(records);
  // console.log("formattedData", formattedData);
  fs.writeFile(
    `${__dirname}/data/${fileInputName}.txt`,
    formattedData,
    (err) => {
      if (err) {
        console.error(err);
      } else {
        // file written successfully
      }
    }
  );
});
