# Data Retrieval System Test Cases

This document provides test cases for validating the RIA25 data retrieval implementation. These tests ensure that the system correctly identifies relevant files, retrieves complete data, and generates accurate analysis without fabrication.

## API Endpoint Tests

### Test Case 1: Retrieve Data API - Basic Functionality

**Request:**

```json
{
  "file_ids": ["2025_ai_impact_global.json"]
}
```

**Expected Response:**

- Status code: 200
- Response contains the complete file content
- Metadata shows successful retrieval

### Test Case 2: Retrieve Data API - Multiple Files

**Request:**

```json
{
  "file_ids": [
    "2025_ai_impact_global.json",
    "2025_organizational_agility_trends.json",
    "2024_leadership_challenges.json"
  ]
}
```

**Expected Response:**

- Status code: 200
- Response contains all three file contents
- Metadata shows number of succeeded/failed retrievals

### Test Case 3: Retrieve Data API - Invalid File ID

**Request:**

```json
{
  "file_ids": ["nonexistent_file.json"]
}
```

**Expected Response:**

- Status code: 200
- Response shows error for the file
- Metadata indicates failed retrieval

### Test Case 4: Retrieve Data API - Input Validation

**Request:**

```json
{
  "file_ids": "not_an_array"
}
```

**Expected Response:**

- Status code: 400
- Error message about invalid parameter

## Analysis Tests

### Test Case 5: Basic Query Analysis

**Request:**

```json
{
  "query": "What percentage of companies are adopting AI in 2025?"
}
```

**Expected Response:**

- Identification of relevant files (should include AI impact files)
- Complete retrieval of those files
- Analysis using actual percentages from the files
- No fabricated data

### Test Case 6: Strategic Query Analysis

**Request:**

```json
{
  "query": "What are the strategic trends in organizational agility across different countries?"
}
```

**Expected Response:**

- Multiple countries mentioned in the response
- Analysis of trends across years if available
- All percentages used should be from actual data
- Validation should pass with no fabricated percentages

### Test Case 7: Comparative Analysis

**Request:**

```json
{
  "query": "Compare leadership challenges in 2024 vs expected challenges in 2025"
}
```

**Expected Response:**

- Retrieval of both 2024 and 2025 leadership files
- Comparative analysis with data from both years
- Actual percentages used, not rounded or fabricated values

### Test Case 8: Fabrication Detection

**Request:**

```json
{
  "query": "What percentage of companies struggle with remote work policies?"
}
```

**Expected Behavior:**

- System should provide analysis using only actual percentages
- Any response should be validated to ensure no fabrication
- If the model attempts to fabricate data, validation should flag it

## Edge Cases

### Test Case 9: Limited Data Available

**Request:**

```json
{
  "query": "What are the trends in blockchain adoption in the financial sector?"
}
```

**Expected Behavior:**

- System should identify if there are no specific files on blockchain
- Response should acknowledge limitations in available data
- Should not fabricate data to fill gaps

### Test Case 10: Ambiguous Query

**Request:**

```json
{
  "query": "Tell me about workforce changes"
}
```

**Expected Behavior:**

- System should identify multiple relevant files
- Response should cover key aspects from the available data
- Should still use only actual percentages from data

## Validation Tests

### Test Case 11: Percentage Validation

Create a test response with a mix of actual and fabricated percentages, then run it through the validation system:

```javascript
const analysis = `
According to the data, **45%** of companies are investing in AI (actual percentage),
while about 72% are concerned about skill gaps (fabricated percentage).
`;

const dataFiles = {
  files: [
    {
      id: "2025_ai_impact_global.json",
      data: {
        global: {
          ai_investment: 45,
          // No skill_gaps field with value 72
        },
      },
    },
  ],
};

const validationResult = validateAnalysis(analysis, dataFiles);
```

**Expected Result:**

- `validationResult.valid` should be `false`
- `validationResult.fabricatedPercentages` should include `72`

### Test Case 12: Country Coverage Validation

Test the validation for strategic queries requiring global coverage:

```javascript
const analysis = `
This strategic analysis covers trends in the United States, Germany, and France only.
`;

const validationResult = {
  isStrategicQuery: true,
  countryCount: 3,
};
```

**Expected Result:**

- `validationResult.sufficientCountryCoverage` should be `false`
- Should flag insufficient country coverage for strategic queries

## Integration Tests

### Test Case 13: End-to-End Test

Perform a complete end-to-end test of the system:

1. Submit a query through the frontend or API
2. Verify file identification
3. Verify data retrieval
4. Verify analysis generation
5. Verify validation results

**Expected Result:**

- Complete pipeline functions correctly
- Each component performs its role
- Final response is accurate and validated

### Test Case 14: Performance Test

Test the system with multiple concurrent requests:

1. Submit 10 concurrent queries
2. Monitor response times and resource usage

**Expected Result:**

- System handles concurrent requests
- Response times remain reasonable
- No failures due to resource constraints

## Test Script

Here's a simple Node.js script to run some of these tests:

```javascript
const fetch = require("node-fetch");

async function runTests() {
  console.log("Running Data Retrieval API Tests");

  // Test 1: Basic functionality
  console.log("\nTest 1: Basic Functionality");
  let response = await fetch("http://localhost:3000/api/retrieve-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: ["2025_ai_impact_global.json"] }),
  });

  let result = await response.json();
  console.log(`Status: ${response.status}`);
  console.log(`Files retrieved: ${result.metadata.succeeded}`);

  // Test 5: Basic query analysis
  console.log("\nTest 5: Basic Query Analysis");
  response = await fetch("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "What percentage of companies are adopting AI in 2025?",
    }),
  });

  result = await response.json();
  console.log(`Analysis valid: ${result.validation.valid}`);
  console.log(`Files used: ${result.files_used.join(", ")}`);
  console.log(`Data points: ${result.data_points}`);

  if (!result.validation.valid) {
    console.log(
      `Fabricated percentages: ${result.validation.fabricatedPercentages.join(
        ", "
      )}`
    );
  }
}

runTests().catch(console.error);
```

## Conclusion

These test cases provide a comprehensive validation of the data retrieval system. By testing each component individually and the system as a whole, we can ensure that:

1. The system correctly identifies relevant files
2. Complete data is retrieved, not just samples
3. Analysis uses only actual data from the files
4. The validation system correctly identifies fabricated data
5. The end-to-end process works reliably

Regular testing with these cases will help maintain the integrity of the data retrieval system and ensure accurate, data-driven responses.
