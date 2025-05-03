# Legacy Scripts

This directory contains scripts that have been deprecated or superseded by newer implementations. These scripts are kept for reference purposes but should not be used in production environments.

## Contents

### Deprecated Test Scripts

- **test_compatibility_assessment.js** - Superseded by more comprehensive testing in the main test suite
- **test_compatibility_assessment.mjs** - ES module version that has been consolidated
- **test_compatibility_integration.js** - Replaced by test_compatibility_pipeline.js in tests/integration
- **test_comparison_detection.js** - Simple test for comparison query detection logic
- **test_identifyRelevantFiles.js** - Minimal test for the file identification function
- **test-query-context.js** - CommonJS version replaced by TypeScript implementation

### One-Time Utility Scripts

- **remove_adapters.sh** - One-time script used for removing adapter files after migration

## Why These Files Were Deprecated

These scripts were created during the transition to the repository pattern and the implementation of the compatibility system. They served as interim testing tools but have been replaced by:

1. More comprehensive test suites in the tests/ directory
2. Integration tests in tests/integration/
3. Automated tests in the CI pipeline

## Using Legacy Scripts

While not recommended, if you need to run any of these scripts for reference:

```bash
# For JavaScript files
node legacy/test_compatibility_assessment.js

# For shell scripts
chmod +x legacy/remove_adapters.sh
./legacy/remove_adapters.sh
```

Note: These scripts may have dependencies on older code structures and might not work with the current codebase.
