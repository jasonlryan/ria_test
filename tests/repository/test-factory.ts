/**
 * Test factory functions for repository tests
 * Provides consistent test objects for use across test cases
 */

import { QueryContext, CompatibilityData } from "../../utils/data/repository/interfaces/QueryContext";
import { DataFile } from "../../utils/data/repository/interfaces/FileRepository";

/**
 * Create a mock QueryContext object with default values
 * @param overrides - Optional properties to override defaults
 */
export function createMockQueryContext(overrides = {}): QueryContext {
  return {
    query: "test query",
    threadId: "test-thread",
    isFollowUp: false,
    compatibility: {
      compatibleYears: ["2023", "2024"],
      compatibleSegments: ["demographics", "economics"],
      compatibilityScore: 0.8,
      incompatibleReasons: [],
      metadataCompatibility: { format: true, version: true }
    },
    cachedFileIds: [],
    clone: function() { return createMockQueryContext(this) },
    ...overrides,
  };
}

/**
 * Create a mock DataFile object with default values
 * @param overrides - Optional properties to override defaults
 */
export function createMockDataFile(overrides = {}): DataFile {
  return {
    id: "test-file-1",
    filepath: "data/test.csv",
    contentType: "csv",
    metadata: {
      format: "standard",
      version: "1.0",
    },
    segments: {},
    ...overrides,
  };
} 