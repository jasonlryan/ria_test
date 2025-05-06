/**
 * Phase 2 Data Transmission Test
 *
 * This test validates that actual data content from repository files
 * is being transmitted to OpenAI in prompts.
 *
 * Purpose: Address the "empty data" bug discovered in Phase 1 where
 * file IDs are correctly identified but no data is sent to OpenAI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataRetrievalService } from "../../app/api/services/dataRetrievalService";
import * as openaiService from "../../utils/openai/openaiService";
import * as retrievalAdapter from "../../utils/data/repository/adapters/retrieval-adapter";

// Test fixtures - Sample file data that would be returned by the repository
const TEST_FILES = {
  "2025_1": {
    id: "2025_1",
    name: "Job Satisfaction 2025",
    data: {
      stats: [
        {
          id: "stat1",
          category: "job_satisfaction",
          value: 75,
          year: "2025",
          region: "Global",
        },
        {
          id: "stat2",
          category: "work_life_balance",
          value: 68,
          year: "2025",
          region: "EMEA",
        },
      ],
    },
    segments: [{ label: "region" }, { label: "age" }],
  },
  "2025_2": {
    id: "2025_2",
    name: "Employee Retention 2025",
    data: {
      stats: [
        // Distinctive test content that we'll look for in the OpenAI prompt
        {
          id: "stat3",
          category: "retention_factors",
          value: 82,
          year: "2025",
          region: "Americas",
          label: "UNIQUE_TEST_TOKEN_RETENTION",
        },
        {
          id: "stat4",
          category: "attrition_reasons",
          value: 45,
          year: "2025",
          region: "APAC",
        },
      ],
    },
    segments: [{ label: "region" }, { label: "gender" }],
  },
};

describe("Data Transmission to OpenAI (Phase 2)", () => {
  // Captured OpenAI messages
  let capturedMessages = [];

  // Mocks setup
  beforeEach(() => {
    // Reset mocks and captured data
    vi.resetAllMocks();
    capturedMessages = [];

    // Mock retrieveDataFiles to return our test files
    vi.spyOn(retrievalAdapter, "retrieveDataFiles").mockImplementation(
      (fileIds) => {
        return Promise.resolve(
          fileIds.map(
            (id) =>
              TEST_FILES[id] || {
                id,
                name: "Unknown file",
                data: { stats: [] },
              }
          )
        );
      }
    );

    // Mock identifyRelevantFiles to return known file IDs
    vi.spyOn(retrievalAdapter, "identifyRelevantFiles").mockResolvedValue({
      file_ids: ["2025_1", "2025_2"],
      matched_topics: ["job_satisfaction", "retention"],
      explanation: "Test explanation",
      segments: ["region", "age", "gender"],
    });

    // Mock processQueryWithData to pass through file content
    vi.spyOn(retrievalAdapter, "processQueryWithData").mockImplementation(
      async (query, context, fileIds) => {
        // Process the actual files from our mocked retrieveDataFiles
        const files = await retrievalAdapter.retrieveDataFiles(fileIds);

        // Create processed data from the file stats
        const processedData = files.flatMap(
          (file) =>
            file.data?.stats?.map((stat) => ({
              ...stat,
              fileId: file.id,
              file_name: file.name,
            })) || []
        );

        return {
          processedData,
          stats: files,
          relevantFiles: files.map((file) => ({
            id: file.id,
            segments: file.segments,
          })),
          isComparison: false,
          enhancedContext: [],
          dataVersion: 2,
        };
      }
    );

    // Mock OpenAI service to capture messages
    vi.spyOn(openaiService, "createChatCompletion").mockImplementation(
      async (options) => {
        // Capture messages for later assertion
        capturedMessages = options.messages || [];

        return {
          choices: [
            {
              message: {
                content: "This is a mock OpenAI response",
                role: "assistant",
              },
            },
          ],
        };
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should include actual file data in OpenAI prompts", async () => {
    // Test query
    const query = "What are the main factors affecting employee retention?";

    // Call the service
    await DataRetrievalService.processQueryWithData(
      query,
      "all-sector",
      [], // Empty cached file IDs
      "test-thread-id",
      false, // Not a follow-up
      "", // No previous query
      "" // No previous response
    );

    // Verify OpenAI received messages with our data
    expect(capturedMessages.length).toBeGreaterThan(0);

    // Convert messages to string for easier testing
    const messagesContent = JSON.stringify(capturedMessages);

    // Check for presence of our unique test token
    expect(messagesContent).toContain("UNIQUE_TEST_TOKEN_RETENTION");

    // Check other assertions
    expect(retrievalAdapter.retrieveDataFiles).toHaveBeenCalled();
    expect(retrievalAdapter.processQueryWithData).toHaveBeenCalled();
    expect(openaiService.createChatCompletion).toHaveBeenCalled();

    // Verify data shape and content
    const systemOrUserMessages = capturedMessages.filter(
      (m) => m.role === "system" || m.role === "user"
    );

    // At least one message should contain our data
    const hasDataMessage = systemOrUserMessages.some(
      (message) =>
        message.content.includes("stats") ||
        message.content.includes("retention_factors")
    );

    expect(hasDataMessage).toBe(true);
  });

  it("should not have duplicate data in the prompt", async () => {
    // Test query
    const query = "Compare work-life balance across regions";

    // Call the service
    await DataRetrievalService.processQueryWithData(
      query,
      "all-sector",
      [], // Empty cached file IDs
      "test-thread-id",
      false, // Not a follow-up
      "", // No previous query
      "" // No previous response
    );

    // Convert messages to string for analysis
    const messagesContent = JSON.stringify(capturedMessages);

    // Count occurrences of specific data point
    const occurrences = (messagesContent.match(/work_life_balance/g) || [])
      .length;

    // Should only appear once or twice (depending on how data is structured),
    // but not many times which would indicate duplication
    expect(occurrences).toBeLessThanOrEqual(3);
  });

  it("should handle empty data gracefully", async () => {
    // Override mock for this test to return empty data
    vi.spyOn(retrievalAdapter, "retrieveDataFiles").mockResolvedValue([]);

    // Test query
    const query = "What are employee attitudes towards AI?";

    // Call service
    await DataRetrievalService.processQueryWithData(
      query,
      "all-sector",
      [],
      "test-thread-id",
      false,
      "",
      ""
    );

    // Should still create a valid prompt even with no data
    expect(capturedMessages.length).toBeGreaterThan(0);

    // Should include a message about no data available
    const messagesContent = JSON.stringify(capturedMessages);
    expect(messagesContent).toMatch(/no data|no files|empty|not found/i);
  });
});
