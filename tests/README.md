# Assistant Tests

This directory contains test scripts for evaluating different aspects of the OpenAI Assistant's responses.

## Structure

```
tests/
├── data/              # Test data files (CSV format)
├── test-results/      # Generated test results with timestamps
├── index.js          # Main test runner
├── index-tests.js    # OpenAI Assistant test implementation
└── README.md         # This file
```

## Running Tests

To run tests:

```bash
npm test
```

You can optionally specify a different assistant ID:

```bash
npm test -- --assistant=asst_your_assistant_id
```

The test runner will:

1. Show available test types based on CSV files in the data directory
2. Let you select which test to run
3. Process questions through the OpenAI Assistant
4. Save results to a timestamped file in test-results/

## Adding New Tests

To add a new type of test:

1. Create a CSV file in `tests/data/` following the naming convention:

   ```
   [Test Type] Questions.csv
   ```

   For example:

   - `Bias Evaluation Questions.csv`
   - `Performance Testing Questions.csv`
   - `Language Analysis Questions.csv`

2. The CSV should have these columns:
   - `Question No` - Unique identifier for the question
   - `Category` - Question category or type
   - `Question` - The actual question to test

Results will be saved as:

```
test-results/[Original Filename]_YYYYMMDD_HHMMSS.csv
```

## Test Data

Test files are stored in the `tests/data` directory:

- Input: CSV files containing questions for different types of tests
- Output: Results are saved to `test-results/` with timestamps

## Environment Variables

Tests use these environment variables from the root `.env` file:

- `OPENAI_API_KEY` - Required for OpenAI API access
- `OPENAI_ASSISTANT_ID` - Default assistant ID (can be overridden via CLI)
