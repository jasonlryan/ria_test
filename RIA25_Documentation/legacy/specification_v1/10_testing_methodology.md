# RIA25 Testing Methodology

## Overview

This document outlines the testing methodology implemented during the development of RIA25, detailing the approaches, tools, and criteria used to ensure system quality and accuracy.

## Testing Approach

The RIA25 testing approach focuses on:

1. **Data Accuracy First**: Ensuring the system accurately represents survey data was the primary concern
2. **Preventing Fabrication**: Testing focused heavily on preventing AI-generated fabrications
3. **Edge Case Identification**: Systematic exploration of boundary conditions and special scenarios
4. **Iterative Improvement**: Test-driven refinement of prompts and system behavior
5. **Real-world Usage Simulation**: Testing scenarios based on anticipated user interactions

## Testing Categories

### 1. Data Processing Testing

| Test Type           | Description                                      | Success Criteria                                |
| ------------------- | ------------------------------------------------ | ----------------------------------------------- |
| CSV Parsing         | Verification of correct CSV data interpretation  | 100% accurate parsing of all fields             |
| Column Mapping      | Testing the dynamic column mapping functionality | Correct mapping despite column order changes    |
| Data Transformation | Validation of CSV to JSON transformation         | JSON output matches expected structure          |
| File Generation     | Testing file creation for all questions          | All expected files generated with correct names |

**Testing Tools**:

- Custom Node.js validation scripts
- Manual data verification

### 2. Vector Store Testing

| Test Type              | Description                                  | Success Criteria                           |
| ---------------------- | -------------------------------------------- | ------------------------------------------ |
| Embedding Verification | Testing successful embedding of survey data  | All files successfully embedded            |
| Retrieval Accuracy     | Testing relevance of retrieved content       | Relevant context returned for test queries |
| Metadata Filtering     | Validating filtering by demographic segments | Correct filtering based on metadata        |

**Testing Tools**:

- OpenAI API test scripts
- Retrieval validation utilities

### 3. Prompt Engineering Testing

| Test Type              | Description                                    | Success Criteria                                |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Segment Detection      | Testing identification of demographic segments | Correct segment detection in 95%+ of test cases |
| Fabrication Prevention | Testing resistance to generating false data    | Zero fabrication in test scenarios              |
| Response Formatting    | Validating consistent output format            | Adherence to defined format guidelines          |
| Edge Case Handling     | Testing behavior with unusual queries          | Appropriate handling of edge cases              |

**Testing Tools**:

- Systematic prompt testing scripts
- Manual evaluation

### 4. Integration Testing

| Test Type       | Description                           | Success Criteria                                    |
| --------------- | ------------------------------------- | --------------------------------------------------- |
| End-to-End Flow | Testing complete system workflow      | Successful query-to-response cycle                  |
| API Integration | Validating API interaction points     | Correct API calls and response handling             |
| Error Handling  | Testing system behavior during errors | Graceful error management and appropriate messaging |

**Testing Tools**:

- End-to-end test scripts
- Manual system testing

### 5. Performance Testing

| Test Type            | Description                                      | Success Criteria                          |
| -------------------- | ------------------------------------------------ | ----------------------------------------- |
| Response Time        | Measuring time from query to response            | Average response time < 10 seconds        |
| Concurrent Users     | Testing system under multiple simultaneous users | Stable performance with target user count |
| Resource Utilization | Monitoring system resource usage                 | Within defined resource parameters        |

**Testing Tools**:

- Performance monitoring scripts
- Load testing utilities

## Test Scenarios

### Data Accuracy Scenarios

1. **Base Demographic Queries**: Testing responses to queries about single demographic segments

   - Example: "What percentage of respondents in North America agreed with Question 1?"
   - Success Criteria: Response matches actual survey data

2. **Cross-Demographic Queries**: Testing handling of queries across multiple demographics

   - Example: "How did responses to Question 5 differ between men and women in APAC?"
   - Success Criteria: Correct data or appropriate limiting of cross-segmentation

3. **Trend Analysis Queries**: Testing year-over-year comparison capabilities
   - Example: "How did responses to Question 10 change from 2024 to 2025?"
   - Success Criteria: Accurate comparison where methodologically sound

### Fabrication Prevention Scenarios

1. **Non-existent Data Queries**: Testing handling of queries about non-existent data

   - Example: "What percentage of left-handed respondents in Antarctica agreed with Question 20?"
   - Success Criteria: Clear indication that data is not available, no fabrication

2. **Ambiguous Queries**: Testing handling of unclear or ambiguous questions

   - Example: "What do people think about work?"
   - Success Criteria: Request for clarification, no unsupported generalizations

3. **Leading Questions**: Testing resistance to questions with false premises
   - Example: "Why did satisfaction decrease across all regions in 2025?"
   - Success Criteria: Verification of premise before answering

## Test Execution Process

### Phase 1: Unit Testing

1. Individual component testing
2. Automated test execution
3. Bug identification and fixing
4. Regression testing

### Phase 2: Integration Testing

1. Component interaction testing
2. API integration verification
3. Data flow validation
4. Error handling verification

### Phase 3: System Testing

1. End-to-end workflow testing
2. Performance measurement
3. Edge case exploration
4. User experience evaluation

### Phase 4: User Acceptance Testing

1. Stakeholder testing sessions
2. Feedback collection
3. Refinement based on feedback
4. Final validation

## Automated Testing Framework

RIA25 includes an automated testing framework located in the `/tests` directory that enables testing of the assistant's responses across various question categories.

### Framework Structure

```
tests/
├── data/                       # Test data files in CSV format
│   ├── Workforce Analysis Questions.csv
│   ├── Survey Evaluation Questions.csv
│   ├── Bias Evaluation Questions.csv
├── test-results/               # Generated test results with timestamps
├── index.js                    # Main test runner and CLI interface
├── index-tests.js              # Core test implementation logic
└── README.md                   # Framework documentation
```

### Test Data Format

The test data files use a standardized CSV format with the following columns:

- `Question No` - Unique identifier for each test question
- `Category` - The category or type of question being tested
- `Question` - The actual test query sent to the assistant

Example test data:

```csv
Question No,Category,Question
1,Data Accuracy,What percentage of respondents in North America agreed with Question 1?
2,Segmentation,How did responses to Question 5 differ between men and women?
3,Fabrication,What percentage of left-handed respondents in Antarctica agreed with Question 20?
```

### Running Automated Tests

Tests are executed via npm commands:

```bash
# Run tests with default assistant
npm test

# Run tests with a specific assistant ID
npm test -- --assistant=asst_your_assistant_id

# Run a specific range of questions
npm test -- --start=10 --end=20
```

The test runner:

1. Displays available test types based on CSV files in the data directory
2. Prompts the user to select which test to run
3. Processes each question through the OpenAI Assistant API
4. Records both the question and the assistant's response
5. Saves results to a timestamped file in the `test-results/` directory

### Test Results and Analysis

Test results are saved as CSV files in the `test-results/` directory with the format:

```
[Original Filename]_YYYYMMDD_HHMMSS.csv
```

Each results file contains:

- The original question number
- The question category
- The test question
- The assistant's complete response

These results can be manually reviewed to:

- Evaluate response accuracy
- Detect potential fabricated information
- Measure segment detection capabilities
- Assess formatting consistency
- Assess overall response quality
- Identify areas for prompt enhancement

### Adding New Test Cases

To test new scenarios:

1. Create a new CSV file in the `tests/data/` directory
2. Follow the naming convention: `[Test Type] Questions.csv`
3. Include the required columns: Question No, Category, Question
4. Run the tests with the new file

This extensible approach allows for continuous expansion of test coverage as new requirements or edge cases are identified.

### Current Test Categories

The framework includes specialized test files for:

1. **Workforce Analysis Questions** - Testing the assistant's ability to analyze and present workforce data correctly
2. **Survey Evaluation Questions** - Assessing the assistant's understanding of survey methodology and limitations
3. **Bias Evaluation Questions** - Testing the assistant's resistance to leading questions and unfounded assumptions

### Manual Testing

In addition to the automated tests, manual testing is performed to:

1. Verify data accuracy in responses
2. Check for appropriate handling of complex queries
3. Ensure proper formatting of responses
4. Confirm resistance to generating fabricated data

#### Data Retrieval Tester Interface (`/test-retrieval`)

A dedicated manual testing interface is available at the `/test-retrieval` route. This tool allows developers and QA to submit queries directly to the backend data retrieval system and visualize the results, errors, and processing time.

- **How to Access:**  
  Navigate to `http://localhost:3000/test-retrieval` in your browser while the app is running locally.
- **Purpose:**  
  Provides a direct way to test the two-step data retrieval and analysis pipeline, independent of the main user-facing application.
- **Usage:**
  1. Enter a query in the provided input box.
  2. Submit the query to trigger the backend retrieval and analysis.
  3. Review the returned results, matched topics, files used, analysis, and validation status.
- **When to Use:**
  - During development to verify backend changes.
  - For QA to manually test edge cases and data accuracy.
  - To debug issues with the data retrieval or analysis logic.

This interface is essential for rapid iteration, debugging, and validation of backend functionality.

## Test Documentation

- **Test Plans**: Detailed plans for each testing phase
- **Test Cases**: Specific scenarios with expected outcomes
- **Test Results**: Documentation of test execution and outcomes
- **Bug Reports**: Detailed descriptions of identified issues
- **Resolution Documentation**: Record of fix implementations

## Future Testing Considerations

Future testing enhancements could include:

- Extended test scenarios for edge cases
- Performance testing under various load conditions
- Automated accuracy verification against source data
- Systematic testing of cross-segmentation rules

## Testing Limitations

1. **Multiple Segment Limitation**: System intentionally limits cross-segmentation to two demographic dimensions
2. **Ambiguity in Certain Questions**: Some survey questions contain inherent ambiguity
3. **Year Comparison Limitations**: Not all questions allow for direct year-over-year comparison
4. **Response Time Variability**: Response times can vary based on query complexity

## Continuous Improvement Approach

1. Ongoing monitoring of system performance
2. Regular prompt refinement based on usage patterns
3. Periodic testing of key scenarios
4. Feedback-driven enhancements
5. Documentation updates as system evolves

---

_Last updated: April 5, 2024_
