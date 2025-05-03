/**
 * Generate Test Data for Repository Pattern Monitoring
 *
 * This script generates sample metrics for the repository monitoring dashboard
 * to facilitate testing and development without requiring real usage data.
 *
 * Last Updated: Sat May 3 2025
 */

const monitoring = require("./index").default;

// Operations to generate data for
const operations = [
  "identifyRelevantFiles",
  "retrieveDataFiles",
  "processQueryWithData",
  "getThreadContext",
  "loadFileSegments",
  "determineQueryType",
];

// Generate random timing
function randomTime(base, variance) {
  return base + (Math.random() * variance * 2 - variance);
}

// Generate test data for operations
function generateTestData(count = 10) {
  console.log(`Generating ${count} test metrics for each operation...`);

  for (let i = 0; i < count; i++) {
    operations.forEach((operation) => {
      // Generate original implementation metrics
      const originalMetrics = monitoring.startTimer("original", operation, {
        threadId: `test-thread-${Math.floor(Math.random() * 10)}`,
        queryLength: Math.floor(Math.random() * 200) + 20,
      });

      // Original implementation usually a bit slower
      setTimeout(() => {
        monitoring.endTimer(originalMetrics, true, {
          filesProcessed: Math.floor(Math.random() * 5) + 1,
        });
      }, randomTime(30, 10));

      // Generate repository implementation metrics
      const repoMetrics = monitoring.startTimer("repository", operation, {
        threadId: `test-thread-${Math.floor(Math.random() * 10)}`,
        queryLength: Math.floor(Math.random() * 200) + 20,
      });

      // Repository implementation slightly faster on average
      setTimeout(() => {
        monitoring.endTimer(repoMetrics, true, {
          filesProcessed: Math.floor(Math.random() * 5) + 1,
        });
      }, randomTime(25, 12));
    });

    // Random errors
    if (Math.random() < 0.1) {
      const errorOp = operations[Math.floor(Math.random() * operations.length)];
      monitoring.recordError(
        Math.random() < 0.5 ? "original" : "repository",
        errorOp
      );
    }
  }

  console.log("Test data generation complete");
}

// Generate immediate test data
generateTestData(20);

// Generate ongoing test data
const interval = setInterval(() => {
  generateTestData(2);
}, 5000);

// Stop after 5 minutes
setTimeout(() => {
  clearInterval(interval);
  console.log("Test data generation stopped");
}, 5 * 60 * 1000);

module.exports = { generateTestData };
