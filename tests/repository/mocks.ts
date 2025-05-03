/**
 * Mock implementations for repository interfaces
 * Used for testing repository components in isolation
 */

import { vi } from "vitest";
import { FileRepository } from "../../utils/data/repository/interfaces/FileRepository";
import { QueryProcessor } from "../../utils/data/repository/interfaces/QueryProcessor";
import { createMockDataFile } from "./test-factory";

/**
 * Create a mock FileRepository implementation with vitest spies
 */
export function createMockFileRepository(): FileRepository {
  return {
    getFileById: vi.fn().mockResolvedValue(createMockDataFile()),
    getFilesByIds: vi.fn().mockResolvedValue([createMockDataFile()]),
    getFilesByQuery: vi.fn().mockResolvedValue([createMockDataFile()]),
    loadSegments: vi.fn().mockResolvedValue(createMockDataFile())
  };
}

/**
 * Create a mock QueryProcessor implementation with vitest spies
 */
export function createMockQueryProcessor(): QueryProcessor {
  return {
    processQueryWithData: vi.fn().mockResolvedValue({
      relevantFiles: [createMockDataFile()],
      processedData: [{ source: "test", content: "test data" }],
      queryType: "general",
      metrics: {
        duration: 100,
        filesProcessed: 1
      }
    }),
    isComparisonQuery: vi.fn().mockReturnValue(false),
    isStarterQuestion: vi.fn().mockReturnValue(false),
    extractSegmentsFromQuery: vi.fn().mockReturnValue([])
  };
} 