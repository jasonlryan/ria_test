/**
 * Repository Pattern Test Script
 *
 * This script tests the repository pattern implementation by making
 * direct calls to the repository adapter functions and checking that
 * the results match the expected format.
 *
 * Last Updated: Sat May 3 2025
 */

const { identifyRelevantFiles, retrieveDataFiles, processQueryWithData } =
  require("./utils/data/repository/adapters/retrieval-adapter").default;

async function testRepositoryAdapter() {
  console.log("Testing repository pattern adapter...");

  try {
    // Test identifyRelevantFiles
    console.log("\n=== Testing identifyRelevantFiles ===");
    const query = "What are the top attraction factors in 2025?";
    const options = {
      threadId: "test-thread-" + Date.now(),
      isFollowUp: false,
    };

    console.log(`Query: ${query}`);
    const fileResult = await identifyRelevantFiles(query, options);
    console.log(`Result: ${fileResult.length} files identified`);
    if (fileResult && fileResult.length > 0) {
      console.log("First file:", fileResult[0]);
    }

    // Test retrieveDataFiles if we have file IDs
    if (fileResult && fileResult.length > 0) {
      console.log("\n=== Testing retrieveDataFiles ===");
      const fileIds = fileResult.map((file) => file.id || file);
      console.log(`File IDs: ${fileIds.join(", ")}`);

      const dataResult = await retrieveDataFiles(fileIds.slice(0, 2)); // Just test first 2 files
      console.log(`Retrieved ${dataResult.files.length} files`);
      console.log("Topics:", dataResult.topics);
      console.log("Total data points:", dataResult.totalDataPoints);
    }

    // Test processQueryWithData
    console.log("\n=== Testing processQueryWithData ===");
    const processResult = await processQueryWithData(query, {
      threadId: "test-thread-" + Date.now(),
    });

    console.log("Processing result:");
    console.log(
      "- Analysis length:",
      processResult.analysis ? processResult.analysis.length : 0
    );
    console.log("- Matched topics:", processResult.matchedTopics);
    console.log("- File IDs:", processResult.fileIds);
    console.log("- Data points:", processResult.data_points);
    console.log("- Processing time:", processResult.processing_time_ms, "ms");

    console.log("\n=== Test completed successfully ===");
  } catch (error) {
    console.error("Error testing repository adapter:", error);
  }
}

// Run the test
testRepositoryAdapter();
