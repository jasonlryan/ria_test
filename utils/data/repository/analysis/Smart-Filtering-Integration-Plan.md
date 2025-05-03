# Smart Filtering Integration Plan

**Last Updated:** Sat May 25 2025

## Overview

This document outlines the plan for integrating the existing smart filtering functionality (`utils/data/smart_filtering.js`) with the repository pattern implementation. The plan addresses the non-functional placeholder in `dataRetrievalService.js` and ensures proper type safety and consistent behavior across the application.

## Context and Dependencies

### Current Status

The repository pattern has been successfully implemented with the following components:

1. Core interfaces (`QueryContext`, `FileRepository`, `QueryProcessor`)
2. Implementations (`QueryContextImpl`, `FileSystemRepository`, `QueryProcessorImpl`)
3. Adapters (`retrieval-adapter.ts`, `service-adapter.ts`)
4. Testing infrastructure (Vitest setup, unit tests, adapter tests)
5. Rollout infrastructure (feature flags, repository toggle script)

However, the smart filtering functionality remains as a standalone JavaScript module that is not properly integrated with the repository pattern. The `filterDataBySegments()` method in `dataRetrievalService.js` is a non-functional placeholder:

```javascript
filterDataBySegments(loadedData, segments) {
  // This function can call getSpecificData or similar filtering logic
  // For now, delegate to processQueryWithData or implement filtering here
  // Placeholder: return loadedData as-is
  return loadedData;
}
```

### Related Documents

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Main repository pattern implementation plan
- [Consolidated-Analysis.md](./Consolidated-Analysis.md) - Analysis of consolidated repository pattern
- [QueryProcessor-Analysis.md](./QueryProcessor-Analysis.md) - Analysis of query processor
- [Testing-Implementation-Plan.md](./Testing-Implementation-Plan.md) - Testing infrastructure plan

## Technical Approach

The integration of smart filtering with the repository pattern requires:

1. Creating TypeScript interfaces for `QueryIntent`, `DataScope`, and filter results
2. Converting the JavaScript filtering functions to TypeScript
3. Extending existing repository interfaces to incorporate filtering concepts
4. Implementing the filtering in `QueryProcessorImpl`
5. Updating adapters to properly handle segment filtering
6. Adding comprehensive tests to verify behavior

### 1. TypeScript Interface Definitions

**Target File:** `utils/data/repository/interfaces/SmartFiltering.ts`

```typescript
/**
 * Smart Filtering Interfaces
 *
 * TypeScript interfaces for the smart filtering functionality,
 * adapted from the original JavaScript JSDoc types.
 */

export interface QueryIntent {
  topics: string[];
  demographics: string[];
  years: number[];
  specificity: "general" | "specific";
  isFollowUp: boolean;
}

export interface DataScope {
  topics: Set<string>;
  demographics: Set<string>;
  years: Set<number>;
  fileIds: Set<string>;
}

export interface FilteredDataItem {
  fileId: string;
  question: string;
  response: string;
  segment: string;
  category: string;
  value: string | number;
  stat: number;
  percentage: number;
  formatted: string;
}

export interface FilteredDataResult {
  filteredData: FilteredDataItem[];
  stats: FilteredDataItem[];
}
```

### 2. Interface Extensions

**Target File:** `utils/data/repository/interfaces/QueryContext.ts`

Add to the existing interface:

```typescript
import { QueryIntent } from "./SmartFiltering";

export interface QueryContext {
  // ... existing properties

  /**
   * Parsed intent from the query
   */
  queryIntent?: QueryIntent;

  /**
   * Segment tracking for filtering data
   */
  segmentTracking: SegmentTrackingData;
}

export interface SegmentTrackingData {
  /**
   * Segments requested in the current query
   */
  requestedSegments: string[];

  /**
   * Segments already loaded by fileId
   */
  loadedSegments: Record<string, string[]>;

  /**
   * Segments currently in use
   */
  currentSegments: string[];

  /**
   * Segments that need to be loaded by fileId
   */
  missingSegments: Record<string, string[]>;
}
```

**Target File:** `utils/data/repository/interfaces/QueryProcessor.ts`

Add to the existing interface:

```typescript
import { FilteredDataResult, QueryIntent } from "./SmartFiltering";

export interface QueryProcessor {
  // ... existing methods

  /**
   * Parse query intent from a user query and conversation history
   */
  parseQueryIntent(query: string, conversationHistory?: any[]): QueryIntent;

  /**
   * Filter data by specified segments
   */
  filterDataBySegments(data: any, segments: string[]): FilteredDataResult;
}

export interface QueryResult {
  // ... existing properties

  /**
   * Processed and filtered data
   */
  processedData: FilteredDataItem[];
}
```

### 3. Smart Filtering Implementation

**Target File:** `utils/data/repository/implementations/SmartFiltering.ts`

```typescript
/**
 * Smart Filtering Implementation
 *
 * TypeScript implementation of smart filtering functionality,
 * adapted from the original JavaScript module.
 *
 * References original: utils/data/smart_filtering.js
 */

import {
  QueryIntent,
  DataScope,
  FilteredDataResult,
  FilteredDataItem,
} from "../interfaces/SmartFiltering";
import { CANONICAL_SEGMENTS } from "../../../cache/segment_keys";

/**
 * Parse the user query and conversation history to extract intent.
 */
export function parseQueryIntent(
  query: string,
  conversationHistory: any[] = []
): QueryIntent {
  // TypeScript implementation of the parseQueryIntent function
  // (converted from the original JavaScript implementation)
  // Implementation details...
}

/**
 * Map query intent to required data scope.
 */
export function mapIntentToDataScope(queryIntent: QueryIntent): DataScope {
  // TypeScript implementation
}

/**
 * Filter data by specified segments
 */
export function filterDataBySegments(
  data: any,
  segments: string[]
): FilteredDataResult {
  // Implementation similar to getSpecificData from the original
  // but adapted for the repository pattern
  // Implementation details...
}

/**
 * Return detailed data filtered by demographics, years, etc.
 * @deprecated Use filterDataBySegments instead
 */
export function getSpecificData(
  retrievedData: any,
  options: { demographics?: string[] }
): FilteredDataResult {
  // For backward compatibility, delegate to filterDataBySegments
  return filterDataBySegments(retrievedData, options.demographics || []);
}
```

### 4. QueryProcessor Implementation

**Target File:** `utils/data/repository/implementations/QueryProcessorImpl.ts`

Update the implementation to include smart filtering:

```typescript
import {
  QueryProcessor,
  QueryContext,
  QueryResult,
  FileRepository,
} from "../interfaces";
import { parseQueryIntent, filterDataBySegments } from "./SmartFiltering";
import { FilteredDataItem } from "../interfaces/SmartFiltering";

export class QueryProcessorImpl implements QueryProcessor {
  constructor(private fileRepository: FileRepository) {}

  // Implement the smart filtering methods
  parseQueryIntent(query: string, conversationHistory?: any[]) {
    return parseQueryIntent(query, conversationHistory || []);
  }

  filterDataBySegments(data: any, segments: string[]) {
    return filterDataBySegments(data, segments);
  }

  async processQueryWithData(
    query: string,
    context: QueryContext
  ): Promise<QueryResult> {
    // Start timing
    const startTime = Date.now();

    // 1. Enhance context with query intent if not already present
    if (!context.queryIntent) {
      context.queryIntent = this.parseQueryIntent(query);

      // Extract segments from query if none provided
      if (!context.segmentTracking.requestedSegments.length) {
        context.segmentTracking.requestedSegments =
          this.extractSegmentsFromQuery(query);
      }
    }

    // 2. Get relevant files
    const fileResult = await this.fileRepository.getFilesByQuery(context);

    // 3. Load files with their data
    const fileData = await this.fileRepository.getFilesByIds(
      fileResult.relevantFiles
    );

    // 4. Apply smart filtering based on segments
    let processedData: FilteredDataItem[] = [];

    if (context.segmentTracking?.requestedSegments?.length > 0) {
      // Use the smart filtering to filter data by segments
      const filtered = this.filterDataBySegments(
        { files: fileData },
        context.segmentTracking.requestedSegments
      );
      processedData = filtered.stats;
    } else {
      // Process without filtering if no segments requested
      // Convert file data to standardized format
      processedData = this.convertToStandardFormat(fileData);
    }

    // 5. Return the formatted result
    return {
      relevantFiles: fileResult.relevantFiles,
      processedData,
      queryType: this.isComparisonQuery(query) ? "comparison" : "standard",
      metrics: {
        duration: Date.now() - startTime,
        filesProcessed: fileData.length,
      },
    };
  }

  // Implement other required methods...
}
```

### 5. Adapter Updates

**Target File:** `utils/data/repository/adapters/service-adapter.ts`

Update the adapter to handle segment filtering:

```typescript
// Process query with data method
export async function processQueryWithData(
  query: string,
  options: any = {},
  customProcessor?: QueryProcessor
) {
  // ...existing code...

  // Create context from options with segment support
  const context: QueryContext = {
    query,
    isFollowUp: options.isFollowUp || false,
    threadId: options.threadId || "default",
    // Add segment tracking information
    segmentTracking: {
      requestedSegments: options.segments || [],
      loadedSegments: {},
      currentSegments: [],
      missingSegments: {},
    },
  };

  // ...rest of the method...
}
```

**Target File:** `utils/data/repository/adapters/retrieval-adapter.ts`

Similar update for the retrieval adapter.

### 6. Service Implementation

**Target File:** `app/api/services/dataRetrievalService.js`

Fix the non-functional placeholder:

```javascript
/**
 * Filter data by segments
 * @param {object[]} loadedData - Loaded data files
 * @param {string[]} segments - Segments to filter by
 * @returns {object[]} Filtered data
 */
filterDataBySegments(loadedData, segments) {
  // Call the getSpecificData function from smart_filtering
  const { getSpecificData } = require("../../../utils/data/smart_filtering");

  return getSpecificData(
    { files: loadedData },
    { demographics: segments }
  ).stats;
}
```

## Testing Strategy

### 1. Unit Tests

**Target File:** `tests/repository/implementations/SmartFiltering.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  parseQueryIntent,
  mapIntentToDataScope,
  filterDataBySegments,
} from "../../../utils/data/repository/implementations/SmartFiltering";

describe("SmartFiltering", () => {
  describe("parseQueryIntent", () => {
    // Test cases for parseQueryIntent
  });

  describe("mapIntentToDataScope", () => {
    // Test cases for mapIntentToDataScope
  });

  describe("filterDataBySegments", () => {
    // Test cases for filterDataBySegments
  });
});
```

### 2. Integration Tests

**Target File:** `tests/repository/implementations/QueryProcessorImpl.test.ts`

Add tests for segment filtering:

```typescript
describe("processQueryWithData with segments", () => {
  it("should filter data by requested segments", async () => {
    // Test filtering by segments
  });

  it("should extract segments from query when not explicitly provided", async () => {
    // Test automatic segment detection
  });
});
```

### 3. Shadow Tests

**Target File:** `tests/repository/adapters/smart-filtering-adapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processQueryWithData } from "../../../utils/data/repository/adapters/retrieval-adapter";

describe("Smart Filtering through Adapters", () => {
  // Test shadow mode behavior
});
```

### 4. End-to-End Tests

**Target File:** `tests/repository/e2e/filtering-e2e.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { QueryProcessorImpl } from "../../../utils/data/repository/implementations/QueryProcessorImpl";
import { FileSystemRepository } from "../../../utils/data/repository/implementations/FileSystemRepository";

describe("Smart Filtering E2E", () => {
  // Test with real data
});
```

## Implementation Roadmap

### Phase 1: Interface and Implementation (2 days)

| Task                                    | Priority | Dependencies   | Status         |
| --------------------------------------- | -------- | -------------- | -------------- |
| Create SmartFiltering interfaces        | High     | None           | 🟠 Not Started |
| Extend existing interfaces              | High     | Interfaces     | 🟠 Not Started |
| Implement SmartFiltering.ts             | High     | Interfaces     | 🟠 Not Started |
| Update QueryProcessorImpl               | High     | Implementation | 🟠 Not Started |
| Update adapters                         | Medium   | Implementation | 🟠 Not Started |
| Fix dataRetrievalService.js placeholder | Medium   | None           | 🟠 Not Started |

### Phase 2: Testing (2 days)

| Task                   | Priority | Dependencies | Status         |
| ---------------------- | -------- | ------------ | -------------- |
| Create unit tests      | High     | Phase 1      | 🟠 Not Started |
| Add integration tests  | High     | Phase 1      | 🟠 Not Started |
| Implement shadow tests | Medium   | Phase 1      | 🟠 Not Started |
| Create E2E tests       | Medium   | Phase 1      | 🟠 Not Started |

### Phase 3: Integration and Verification (1 day)

| Task                                         | Priority | Dependencies | Status         |
| -------------------------------------------- | -------- | ------------ | -------------- |
| Verify behavior with original implementation | High     | Phase 2      | 🟠 Not Started |
| Test with real data                          | High     | Phase 2      | 🟠 Not Started |
| Fix any issues                               | High     | Testing      | 🟠 Not Started |
| Document integration                         | Medium   | Testing      | 🟠 Not Started |

## Risk Analysis and Mitigation

| Risk Area                  | Specific Risk                                             | Mitigation Strategy                                  |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| **Behavioral Consistency** | Repository implementation behaves differently             | Shadow testing with comparison to original           |
| **Performance Impact**     | Filtering could impact query processing performance       | Measure performance metrics before/after integration |
| **Type Safety Gaps**       | JavaScript to TypeScript conversion introduces bugs       | Comprehensive testing with edge cases                |
| **Integration Complexity** | Smart filtering integration is more complex than expected | Phased approach with incremental verification        |
| **Service Compatibility**  | Fixed service implementation breaks existing behavior     | Monitor and test with real service consumers         |

## Success Criteria

The smart filtering integration will be considered successful when:

1. **Type Safety**: Full TypeScript interfaces for all smart filtering components
2. **Functional Placeholder**: `filterDataBySegments()` method in dataRetrievalService.js properly implemented
3. **Repository Integration**: QueryProcessor properly incorporates smart filtering
4. **Test Coverage**: Comprehensive tests verify behavior
5. **Shadow Mode**: Shadow testing shows identical results between original and repository implementations
6. **Performance**: No regression in performance metrics

## Next Steps

After completing this integration plan:

1. Update rollout plan to include smart filtering in the monitoring metrics
2. Consider refactoring the original `utils/data/smart_filtering.js` to use the new TypeScript implementation
3. Add smart filtering metrics to the monitoring dashboard

_Last updated: Sat May 25 2025_
