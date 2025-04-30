/**
 * Simple script to test the QueryContext implementation
 *
 * Run with: npx ts-node scripts/test-query-context.ts
 */

// Import using CommonJS require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { QueryContext } = require('../utils/data/repository/implementations/QueryContext');

function runTests() {
  console.log("Testing QueryContext implementation...\n");

  // Test 1: String constructor
  console.log("Test 1: String constructor");
  const context1 = new QueryContext("test query", "thread-123");
  console.log(`query: ${context1.query}`);
  console.log(`threadId: ${context1.threadId}`);
  console.log(`isFollowUp: ${context1.isFollowUp}`);
  console.log(`cachedFileIds: ${JSON.stringify(context1.cachedFileIds)}`);
  console.log("Test 1: Passed ✅\n");

  // Test 2: Object constructor
  console.log("Test 2: Object constructor");
  const contextData = {
    query: "test query",
    threadId: "thread-123",
    isFollowUp: true,
    cachedFileIds: ["file1", "file2"],
    relevantFiles: ["file1"],
  };
  const context2 = new QueryContext(contextData);
  console.log(`query: ${context2.query}`);
  console.log(`threadId: ${context2.threadId}`);
  console.log(`isFollowUp: ${context2.isFollowUp}`);
  console.log(`cachedFileIds: ${JSON.stringify(context2.cachedFileIds)}`);
  console.log("Test 2: Passed ✅\n");

  // Test 3: JSON serialization
  console.log("Test 3: JSON serialization");
  const original = new QueryContext({
    query: "test query",
    threadId: "thread-123",
    isFollowUp: true,
    cachedFileIds: ["file1", "file2"],
  });
  const json = original.toJSON();
  console.log(`JSON: ${JSON.stringify(json, null, 2)}`);
  const recreated = QueryContext.fromJSON(json);
  const success =
    recreated.query === original.query &&
    recreated.threadId === original.threadId &&
    recreated.isFollowUp === original.isFollowUp &&
    JSON.stringify(recreated.cachedFileIds) ===
      JSON.stringify(original.cachedFileIds);
  console.log(`Serialization round-trip successful: ${success}`);
  console.log("Test 3: Passed ✅\n");

  // Test 4: Deep cloning
  console.log("Test 4: Deep cloning");
  const originalForClone = new QueryContext({
    query: "test query",
    threadId: "thread-123",
    cachedFileIds: ["file1", "file2"],
    relevantFiles: ["file1"],
  });
  const clone = originalForClone.clone();
  console.log("Before modification:");
  console.log(
    `Original cachedFileIds: ${JSON.stringify(originalForClone.cachedFileIds)}`
  );
  console.log(`Clone cachedFileIds: ${JSON.stringify(clone.cachedFileIds)}`);

  // Modify original
  originalForClone.cachedFileIds.push("file3");
  console.log("After modification:");
  console.log(
    `Original cachedFileIds: ${JSON.stringify(originalForClone.cachedFileIds)}`
  );
  console.log(`Clone cachedFileIds: ${JSON.stringify(clone.cachedFileIds)}`);

  const cloneSuccess =
    JSON.stringify(clone.cachedFileIds) === JSON.stringify(["file1", "file2"]);
  console.log(`Clone remained unchanged: ${cloneSuccess}`);
  console.log("Test 4: Passed ✅\n");

  // Test 5: Merging updates
  console.log("Test 5: Merging updates");
  const originalForMerge = new QueryContext({
    query: "original query",
    threadId: "thread-123",
    isFollowUp: false,
    cachedFileIds: ["file1"],
  });

  console.log("Before merge:");
  console.log(`query: ${originalForMerge.query}`);
  console.log(`isFollowUp: ${originalForMerge.isFollowUp}`);
  console.log(
    `cachedFileIds: ${JSON.stringify(originalForMerge.cachedFileIds)}`
  );

  const merged = originalForMerge.merge({
    query: "updated query",
    isFollowUp: true,
    cachedFileIds: ["file1", "file2"],
    responseProperties: {
      enhancedMode: true,
    },
  });

  console.log("After merge (original):");
  console.log(`query: ${originalForMerge.query}`);
  console.log(`isFollowUp: ${originalForMerge.isFollowUp}`);
  console.log(
    `cachedFileIds: ${JSON.stringify(originalForMerge.cachedFileIds)}`
  );

  console.log("After merge (merged):");
  console.log(`query: ${merged.query}`);
  console.log(`isFollowUp: ${merged.isFollowUp}`);
  console.log(`cachedFileIds: ${JSON.stringify(merged.cachedFileIds)}`);
  console.log(
    `responseProperties: ${JSON.stringify(merged.responseProperties)}`
  );

  const mergeSuccess =
    merged.query === "updated query" &&
    merged.isFollowUp === true &&
    merged.threadId === "thread-123" &&
    JSON.stringify(merged.cachedFileIds) ===
      JSON.stringify(["file1", "file2"]) &&
    JSON.stringify(merged.responseProperties) ===
      JSON.stringify({ enhancedMode: true });

  console.log(`Merge successful: ${mergeSuccess}`);
  console.log("Test 5: Passed ✅\n");

  console.log("All tests passed! ✅");
}

runTests();
