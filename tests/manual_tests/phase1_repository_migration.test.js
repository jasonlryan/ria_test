/**
 * Phase 1 Migration Tests
 *
 * These tests verify that the Phase 1 migration to repository-only pattern
 * has been successfully implemented according to the retrieval system refactoring plan.
 *
 * Last Updated: Mon May 06 2025
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all required dependencies
vi.mock("../../utils/shared/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../utils/shared/queryUtils", () => ({
  normalizeQuery: (query) => query?.toLowerCase() || "",
  isComparisonQuery: vi.fn().mockReturnValue(false),
  isStarterQuestion: vi.fn().mockReturnValue(false),
}));

// Mock the adapter with a dynamic implementation
vi.mock("../../utils/data/repository/adapters/retrieval-adapter", () => ({
  processQueryWithData: vi.fn().mockImplementation(() => {
    return Promise.resolve({
      processedData: [{ id: "test-data" }],
      relevantFiles: [{ id: "file-1", segments: [{ label: "demographics" }] }],
      isComparison: false,
    });
  }),
  identifyRelevantFiles: vi.fn(),
  retrieveDataFiles: vi.fn(),
}));

// Mock the legacy implementation
vi.mock("../../utils/openai/retrieval", () => ({
  processQueryWithData: vi.fn(),
  identifyRelevantFiles: vi.fn(),
}));

// Import our test subject
import { processQueryDataCore } from "../../utils/openai/queryProcessing";
import * as adapter from "../../utils/data/repository/adapters/retrieval-adapter";
import * as legacy from "../../utils/openai/retrieval";

describe("Phase 1 - Repository Pattern Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock implementation for each test
    adapter.processQueryWithData.mockImplementation(() => {
      return Promise.resolve({
        processedData: [{ id: "test-data" }],
        relevantFiles: [
          { id: "file-1", segments: [{ label: "demographics" }] },
        ],
        isComparison: false,
      });
    });

    // Setup the legacy implementation to throw if called
    legacy.processQueryWithData.mockImplementation(() => {
      throw new Error("Legacy implementation should not be called!");
    });
  });

  describe("queryProcessing.ts", () => {
    it("should call adapter with individual parameters, not QueryContext object", async () => {
      // Arrange
      const query = "Test query";
      const params = {
        threadId: "test-thread",
        isFollowUp: true,
        cachedFileIds: ["file-1", "file-2"],
        cachedSegmentLabels: ["demographics"],
        userMetadata: { userId: "user-1" },
      };

      // Act
      await processQueryDataCore(query, params);

      // Assert - Check parameter structure
      expect(adapter.processQueryWithData).toHaveBeenCalledWith(
        expect.any(String), // normalizedQuery
        "all-sector", // Default context
        params.cachedFileIds, // cachedFileIds
        params.threadId, // threadId
        params.isFollowUp, // isFollowUp
        expect.any(String), // previousQuery
        expect.any(String) // previousResponse
      );
    });

    it("should use the repository pattern adapter, not legacy code", async () => {
      // Arrange
      const query = "Test query";
      const params = {
        threadId: "test-thread",
      };

      // Act
      await processQueryDataCore(query, params);

      // Assert
      expect(adapter.processQueryWithData).toHaveBeenCalled();
      expect(legacy.processQueryWithData).not.toHaveBeenCalled();
    });
  });
});
