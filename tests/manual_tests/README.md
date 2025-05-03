# Manual Tests

This directory contains manual test scripts that can be run on-demand but are not part of the automated test suite. They serve as supplementary tests for specific functionality or as temporary tests until proper Vitest tests are implemented.

## Test Files

### Critical Tests (Maintain)

- **compatibility_smoke_test.js** - Smoke test for the unified compatibility module that determines if data is comparable across years

  - Run with: `node tests/manual_tests/compatibility_smoke_test.js`
  - **Status:** Maintain as manual test

- **test_compatibility_pipeline.js** - End-to-end test of the compatibility assessment pipeline
  - Run with: `node tests/manual_tests/test_compatibility_pipeline.js`
  - **Status:** Keep for now, eventually convert to Vitest test

### Tests Pending Migration (Convert to Vitest)

- **test_query_normalization.js** - Tests the query normalization functionality
  - Run with: `node tests/manual_tests/test_query_normalization.js`
  - **Status:** Pending migration to Vitest test suite

### Redundant Tests (Deprecated)

- **test-query-context.ts** - Tests the QueryContext implementation
  - Run with: `npx ts-node tests/manual_tests/test-query-context.ts`
  - **Status:** Deprecated in favor of `tests/repository/QueryContext.test.ts`

## Running Tests

Each test can be run directly with Node or ts-node as noted above.

## Migration Plan

1. Converting manual tests to Vitest tests should be prioritized in this order:

   - test_query_normalization.js → utils/shared/queryUtils.test.ts
   - test_compatibility_pipeline.js → tests/compatibility/pipeline.test.ts

2. New tests should be created using Vitest in the appropriate test directory.

_Last updated: Sat May 25 2025_
