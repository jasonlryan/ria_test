# Assistant Tests

**Last Updated:** Sat May 31 12:07:48 UTC 2025

This directory contains test scripts for evaluating different aspects of the application.

## Structure

```
tests/
├── data/              # Test data files (CSV format) for OpenAI Assistant tests
├── test-results/      # Generated test results with timestamps
├── repository/        # Repository pattern unit tests (Vitest)
│   ├── test-factory.ts    # Test object factories
│   ├── mocks.ts           # Mock implementations
│   ├── adapters/          # Adapter tests
│   └── implementations/   # Implementation tests
├── manual_tests/      # Manual test scripts (not in automated test suite)
│   ├── test_compatibility_pipeline.js # End-to-end compatibility tests
│   └── README.md          # Test descriptions and status
├── setup.ts           # Vitest setup configuration
├── index.js           # Main test runner for OpenAI Assistant tests
├── index-tests.js     # OpenAI Assistant test implementation
└── README.md          # This file
```

## Running Tests

### OpenAI Assistant Tests

To run OpenAI Assistant tests:

```bash
npm test
```

You can optionally specify a different assistant ID:

```bash
npm test -- --assistant=asst_your_assistant_id
```

### Repository Pattern Unit Tests

To run repository pattern unit tests with Vitest:

```bash
npm run test:unit           # Run all unit tests
npm run test:unit <path>    # Run tests in a specific path
npm run test:watch          # Run in watch mode
npm run test:coverage       # Run with coverage report
```

Example:

```bash
npm run test:unit tests/repository/QueryContext.test.ts
```

## Repository Pattern Implementation

The repository pattern has been fully implemented with a gradual rollout strategy. The implementation includes:

1. **Core Components**:

   - FileRepository: Abstraction for file access operations
   - QueryProcessor: Handles query processing with retrieved data
   - QueryContext: Standardized context for query operations

2. **Adapters**:

   - retrieval-adapter.ts: Compatible wrapper for utils/openai/retrieval.js
   - service-adapter.ts: Compatible wrapper for dataRetrievalService.js

3. **Feature Flag System**:

   - Environment variable: USE_REPOSITORY_PATTERN
   - Traffic percentage: REPOSITORY_TRAFFIC_PERCENTAGE

4. **Monitoring System**:
   - Performance metrics tracking for original vs. repository implementations
   - Error rate comparison
   - Operation timing statistics

### Repository Toggle Scripts

The repository pattern implementation includes a toggle script for controlling the rollout:

```bash
npm run repo:status      # Check current rollout status
npm run repo:test5       # Test with 5% traffic
npm run repo:test10      # Test with 10% traffic
npm run repo:test25      # Test with 25% traffic
npm run repo:test50      # Test with 50% traffic
npm run repo:full        # Full implementation (100%)
npm run repo:off         # Turn off repository pattern
```

## OpenAI Assistant Tests

The test runner will:

1. Show available test types based on CSV files in the data directory
2. Let you select which test to run
3. Process questions through the OpenAI Assistant
4. Save results to a timestamped file in test-results/

### Adding New OpenAI Tests

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

## Repository Pattern Tests

The repository pattern tests use Vitest and verify:

1. Interface implementations (QueryContext, FileRepository, QueryProcessor)
2. Adapter implementations for backward compatibility
3. Shadow testing between original and new implementations
4. Performance metrics for comparative analysis

### Adding New Repository Tests

To add repository tests:

1. Create a test file in the appropriate directory:

   - `/tests/repository/implementations/` for implementation tests
   - `/tests/repository/adapters/` for adapter tests

2. Follow the existing test patterns with describe/it blocks
3. Use the mock factories in `test-factory.ts` for consistent test objects
4. Run the tests with `npm run test:unit`

## Environment Variables

OpenAI tests use these environment variables from the root `.env` file:

- `OPENAI_API_KEY` - Required for OpenAI API access
- `OPENAI_ASSISTANT_ID` - Default assistant ID (can be overridden via CLI)

Repository pattern uses these environment variables:

- `USE_REPOSITORY_PATTERN` - Main feature flag for repository pattern (true/false)
- `REPOSITORY_TRAFFIC_PERCENTAGE` - Percentage of traffic to route through repository (0-100)

## Rollout Strategy

The repository pattern implementation follows a phased rollout approach:

1. **Limited Testing**: Route small percentage of traffic (5-10%) through repository
2. **Expanded Testing**: Increase traffic allocation (25-50%)
3. **Full Implementation**: Switch all traffic to repository pattern implementation
4. **Cleanup**: Remove original implementation code after stable period


_Last updated: Sat May 31 12:07:48 UTC 2025_
