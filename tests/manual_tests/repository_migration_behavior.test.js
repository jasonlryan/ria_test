/**
 * Repository Migration Behavioral Tests
 *
 * These tests verify the actual functional behavior of the retrieval system
 * before and after the Phase 1 migration to repository-only pattern.
 * They focus on output correctness rather than implementation details.
 *
 * Last Updated: Mon May 06 2025
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies that are common to both implementations
vi.mock("../../utils/shared/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the OpenAI service
vi.mock("../../app/api/services/unifiedOpenAIService", () => ({
  unifiedOpenAIService: {
    createChatCompletion: vi.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: "Mock response from OpenAI",
            },
          },
        ],
      },
    }),
  },
}));

// Create a simple mock for data files
const mockFileData = {
  "file-1": {
    id: "file-1",
    name: "Test File 1",
    data: { statistics: [{ value: 42 }] },
  },
  "file-2": {
    id: "file-2",
    name: "Test File 2",
    data: { statistics: [{ value: 24 }] },
  },
};

// Mock file system to return mock data
vi.mock("fs", () => ({
  readFileSync: vi.fn((path) => {
    if (path.includes("canonical_topic_mapping.json")) {
      return JSON.stringify({
        metadata: { version: "1.0" },
        themes: [
          {
            topics: [
              {
                id: "topic-1",
                comparable: true,
                mapping: { 2024: true, 2025: true },
              },
              { id: "topic-2", comparable: false },
            ],
          },
        ],
      });
    }

    const fileId = path.split("/").pop().replace(".json", "");
    if (mockFileData[fileId]) {
      return JSON.stringify(mockFileData[fileId]);
    }
    throw new Error(`File not found: ${path}`);
  }),
  existsSync: vi.fn(() => true),
}));

// Mock monitoring
vi.mock("../../utils/shared/monitoring", () => ({
  migrationMonitor: {
    trackError: vi.fn(),
  },
}));

// Import the code we want to test
import { DataRetrievalService } from "../../app/api/services/dataRetrievalService";
import { processQueryDataCore } from "../../utils/openai/queryProcessing";

describe("Repository Migration Behavioral Tests", () => {
  let dataRetrievalService;

  beforeEach(() => {
    vi.clearAllMocks();
    dataRetrievalService = new DataRetrievalService();

    // Mock the identifyRelevantFiles function at service and adapter level
    vi.mock("../../utils/openai/retrieval", () => ({
      identifyRelevantFiles: vi.fn().mockResolvedValue({
        file_ids: ["file-1", "file-2"],
        matched_topics: ["topic-1"],
        explanation: "Test explanation",
        segments: ["demographics", "country"],
      }),
      processQueryWithData: vi.fn().mockResolvedValue({
        processedData: [{ id: "result-1", value: 42 }],
        relevantFiles: [
          { id: "file-1", segments: [{ label: "demographics" }] },
          { id: "file-2", segments: [{ label: "country" }] },
        ],
        isComparison: false,
      }),
      isStarterQuestion: vi.fn().mockReturnValue(false),
      getPrecompiledStarterData: vi.fn(),
      detectComparisonQuery: vi.fn().mockReturnValue(false),
    }));

    vi.mock("../../utils/data/repository/adapters/retrieval-adapter", () => ({
      identifyRelevantFiles: vi.fn().mockResolvedValue({
        file_ids: ["file-1", "file-2"],
        matched_topics: ["topic-1"],
        explanation: "Test explanation (repository)",
        segments: ["demographics", "country"],
      }),
      processQueryWithData: vi.fn().mockResolvedValue({
        processedData: [{ id: "result-1", value: 42 }],
        relevantFiles: [
          { id: "file-1", segments: [{ label: "demographics" }] },
          { id: "file-2", segments: [{ label: "country" }] },
        ],
        isComparison: false,
      }),
    }));

    // Mock QueryUtils
    vi.mock("../../utils/shared/queryUtils", () => ({
      normalizeQuery: (query) => query?.toLowerCase() || "",
      isComparisonQuery: vi.fn().mockReturnValue(false),
      isStarterQuestion: vi.fn().mockReturnValue(false),
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Service-level behavior", () => {
    it("should identify relevant files with expected result structure", async () => {
      // Act
      const result = await dataRetrievalService.identifyRelevantFiles(
        "test query",
        {},
        false,
        "",
        ""
      );

      // Assert - the structure should remain the same regardless of implementation
      expect(result).toHaveProperty("file_ids");
      expect(result).toHaveProperty("matched_topics");
      expect(result).toHaveProperty("explanation");
      expect(result).toHaveProperty("compatibilityMetadata");

      // Verify the data shape is correct
      expect(Array.isArray(result.file_ids)).toBe(true);
      expect(result.file_ids).toContain("file-1");
      expect(result.file_ids).toContain("file-2");

      // Check compatibility data is processed correctly
      expect(result.compatibilityMetadata).toHaveProperty("isFullyCompatible");
      expect(result.compatibilityMetadata).toHaveProperty("topicCompatibility");
    });

    it("should process a query with appropriate data structure", async () => {
      // Act
      const result = await dataRetrievalService.processQueryWithData(
        "test query",
        {},
        ["file-1", "file-2"],
        "test-thread",
        false,
        "",
        ""
      );

      // Assert - output format should be consistent regardless of implementation
      expect(result).toHaveProperty("processedData");
      expect(result).toHaveProperty("relevantFiles");

      // We expect at least some processed data to be returned
      expect(Array.isArray(result.processedData)).toBe(true);
      expect(result.processedData.length).toBeGreaterThan(0);

      // Each processedData item should have an id
      expect(result.processedData[0]).toHaveProperty("id");
    });
  });

  describe("Core query processing behavior", () => {
    it("should process a query and return correctly structured data", async () => {
      // Act
      const result = await processQueryDataCore("test query", {
        threadId: "test-thread",
        isFollowUp: false,
        cachedFileIds: [],
        cachedSegmentLabels: [],
      });

      // Assert
      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("normalizedQuery");
      expect(result).toHaveProperty("fileIds");
      expect(result).toHaveProperty("segmentLabels");
      expect(result).toHaveProperty("isComparisonQuery");

      // Verify data types
      expect(Array.isArray(result.context)).toBe(true);
      expect(Array.isArray(result.fileIds)).toBe(true);
      expect(Array.isArray(result.segmentLabels)).toBe(true);
      expect(typeof result.normalizedQuery).toBe("string");
      expect(typeof result.isComparisonQuery).toBe("boolean");
    });

    it("should handle empty queries gracefully", async () => {
      // Act
      const result = await processQueryDataCore("", {
        threadId: "test-thread",
      });

      // Assert
      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("earlyReturn");
      expect(result.earlyReturn).toBe(true);
    });
  });
});
