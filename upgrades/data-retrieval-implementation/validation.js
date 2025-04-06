// Validation Module for Data Retrieval System
// This file implements the validation logic to ensure responses use actual data

/**
 * Validates that an analysis uses only percentages that exist in the data files
 * @param {string} analysis - The analysis text containing percentage values
 * @param {object} dataFiles - The object containing the data files with their data
 * @returns {object} - Validation results including whether the analysis is valid
 */
export function validateAnalysis(analysis, dataFiles) {
  // Extract all percentage mentions (e.g., 45%, 67%, etc.)
  const percentageRegex = /(\d{1,3})%/g;
  const mentionedPercentages = new Set();
  let match;

  while ((match = percentageRegex.exec(analysis)) !== null) {
    mentionedPercentages.add(parseInt(match[1], 10));
  }

  // Extract all actual percentages from the data files
  const actualPercentages = new Set();
  for (const file of dataFiles.files) {
    if (file.data) {
      extractAllPercentages(file.data, actualPercentages);
    }
  }

  // Find fabricated percentages
  const fabricatedPercentages = [];
  mentionedPercentages.forEach((percentage) => {
    if (!actualPercentages.has(percentage)) {
      fabricatedPercentages.push(percentage);
    }
  });

  // Check for country coverage in strategic responses
  let countryCount = 0;
  const strategicIndicators = [
    "strategic",
    "comprehensive",
    "future",
    "trends",
  ];
  const isStrategicQuery = strategicIndicators.some((indicator) =>
    analysis.toLowerCase().includes(indicator)
  );

  const countries = [
    "United Kingdom",
    "UK",
    "United States",
    "US",
    "USA",
    "Germany",
    "France",
    "China",
    "Japan",
    "India",
    "Brazil",
    "Australia",
    "Canada",
    "Singapore",
  ];

  for (const country of countries) {
    if (analysis.includes(country)) {
      countryCount++;
    }
  }

  // Create a validation report
  const validationReport = {
    valid: fabricatedPercentages.length === 0,
    fabricatedPercentages,
    percentagesUsed: mentionedPercentages.size,
    totalAvailablePercentages: actualPercentages.size,
    isStrategicQuery,
    countryCount,
    sufficientCountryCoverage: !isStrategicQuery || countryCount >= 8,
    // Additional validation metrics
    dataPointsUsed: calculateDataPointsUsed(mentionedPercentages.size),
    percentageUsageRatio:
      mentionedPercentages.size > 0
        ? (mentionedPercentages.size / actualPercentages.size).toFixed(2)
        : 0,
    potentialIssues: [],
  };

  // Check for additional potential issues
  if (mentionedPercentages.size < 5 && analysis.length > 1000) {
    validationReport.potentialIssues.push(
      "Low data density: long response with few data points"
    );
  }

  if (isStrategicQuery && countryCount < 8) {
    validationReport.potentialIssues.push(
      "Insufficient country coverage for strategic query"
    );
  }

  if (fabricatedPercentages.length > 0) {
    validationReport.potentialIssues.push(
      `Fabricated percentages detected: ${fabricatedPercentages.join(", ")}`
    );
  }

  return validationReport;
}

/**
 * Recursively extracts all percentage values from a data object
 * @param {object} data - The data object to extract percentages from
 * @param {Set} percentageSet - The set to add the extracted percentages to
 */
function extractAllPercentages(data, percentageSet) {
  if (typeof data !== "object" || data === null) return;

  for (const key in data) {
    if (typeof data[key] === "number" && data[key] >= 0 && data[key] <= 100) {
      // Round to handle minor floating-point differences
      percentageSet.add(Math.round(data[key]));
    } else if (typeof data[key] === "object" && data[key] !== null) {
      extractAllPercentages(data[key], percentageSet);
    }
  }
}

/**
 * Estimates the number of data points used based on percentages mentioned
 * @param {number} percentageCount - Number of percentage values used
 * @returns {number} - Estimated data points used
 */
function calculateDataPointsUsed(percentageCount) {
  // This is a simple estimate - in reality, we'd need more sophisticated logic
  return percentageCount * 1.5;
}

/**
 * Generates a human-readable validation summary
 * @param {object} validationResult - The validation result object
 * @returns {string} - A human-readable validation summary
 */
export function generateValidationSummary(validationResult) {
  if (validationResult.valid) {
    return `✓ Valid analysis using ${validationResult.percentagesUsed} percentage values from the data.`;
  } else {
    return `⚠️ Invalid analysis: ${validationResult.fabricatedPercentages.length} fabricated percentages detected.`;
  }
}

/**
 * Checks if the data coverage is sufficient for the query type
 * @param {object} dataFiles - The data files object
 * @param {string} query - The user's query
 * @returns {boolean} - Whether data coverage is sufficient
 */
export function checkDataCoverage(dataFiles, query) {
  // Count total countries covered in the data
  const countriesInData = new Set();
  for (const file of dataFiles.files) {
    if (file.data) {
      extractCountries(file.data, countriesInData);
    }
  }

  const strategicKeywords = [
    "strategic",
    "future",
    "trend",
    "global",
    "worldwide",
  ];
  const isStrategicQuery = strategicKeywords.some((keyword) =>
    query.toLowerCase().includes(keyword)
  );

  // Strategic queries need data from at least 8 countries
  if (isStrategicQuery && countriesInData.size < 8) {
    return false;
  }

  // Regular queries need at least 1000 data points
  const totalDataPoints = dataFiles.metadata?.total_data_points || 0;
  if (totalDataPoints < 1000) {
    return false;
  }

  return true;
}

/**
 * Extracts countries mentioned in the data
 * @param {object} data - The data object to extract countries from
 * @param {Set} countrySet - The set to add the extracted countries to
 */
function extractCountries(data, countrySet) {
  const countryKeywords = [
    "uk",
    "united kingdom",
    "us",
    "united states",
    "germany",
    "france",
    "china",
    "japan",
    "india",
    "brazil",
    "australia",
    "canada",
    "singapore",
  ];

  function traverse(obj, path = "") {
    if (typeof obj !== "object" || obj === null) return;

    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;

      // Check if the key or path contains a country name
      for (const country of countryKeywords) {
        if (newPath.toLowerCase().includes(country)) {
          countrySet.add(country);
          break;
        }
      }

      if (typeof obj[key] === "object" && obj[key] !== null) {
        traverse(obj[key], newPath);
      }
    }
  }

  traverse(data);
}
