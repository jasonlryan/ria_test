# QueryContext Model Analysis

**Last Updated:** Tue Apr 29 2025

<!--
LLM-GUIDANCE
This document provides detailed analysis of the unified QueryContext model.
When implementing the QueryContext class:
1. Create a comprehensive TypeScript class that includes ALL fields mentioned in this analysis
2. Follow the implementation order in IMPLEMENTATION_PLAN.md
3. Include getters and setters for all properties
4. Implement serialization/deserialization methods for persistence

This component should be implemented first in the refactoring plan.
-->

This document analyzes the Query Context model required to unify the different context objects used across the codebase.

## Related Documents

- [IMPLEMENTATION_PLAN.md § 1.1](./IMPLEMENTATION_PLAN.md#querycontext-model) - Implementation plan for QueryContext
- [Consolidated-Analysis.md](./Consolidated-Analysis.md) - Overall consolidation strategy
- [FileRepository-Analysis.md](./FileRepository-Analysis.md) - Repository that uses QueryContext
- [QueryProcessor-Analysis.md](./QueryProcessor-Analysis.md) - Processor that uses QueryContext

## Context Model Analysis {#context-model-analysis}

### Context Structure in retrieval.js {#context-structure-retrieval}

In `retrieval.js`, context is a simple object used for tracking:

```javascript
// Base context passed to processQueryWithData
const context = {
  threadId: "thread_123",
  isFollowUp: false,
  previousQuery: "",
  previousResponse: ""
};

// Enhanced context returned from processing
const enhancedContext = {
  ...context,
  relevantFiles: ["file1.json", "file2.json"],
  processedData: { ... },
  dataVersion: "v2"
};
```

### Context Structure in dataRetrievalService.js {#context-structure-dataretrieval}

In `dataRetrievalService.js`, context is more complex:

```javascript
// Service context object
const serviceContext = {
  threadId: "thread_123",
  isFollowUp: false,
  previousQuery: "",
  previousResponse: "",
  cachedFileIds: ["file1.json", "file2.json"],
  compatibility: {
    compatibleYears: ["2023", "2024"],
    compatibleSegments: ["UK", "USA"],
  },
  segmentTracking: {
    loadedSegments: { "file1.json": ["UK", "USA"] },
  },
};
```

## Context Properties Comparison {#context-properties-comparison}

| Property         | retrieval.js | dataRetrievalService.js | Unified Model |
| ---------------- | ------------ | ----------------------- | ------------- |
| threadId         | ✓            | ✓                       | ✓             |
| isFollowUp       | ✓            | ✓                       | ✓             |
| previousQuery    | ✓            | ✓                       | ✓             |
| previousResponse | ✓            | ✓                       | ✓             |
| cachedFileIds    | (parameter)  | ✓                       | ✓             |
| relevantFiles    | ✓            | ✓                       | ✓             |
| processedData    | ✓            | ✓                       | ✓             |
| compatibility    | ✗            | ✓                       | ✓             |
| segmentTracking  | ✗            | ✓                       | ✓             |
| dataVersion      | ✓            | ✗                       | ✓             |

## Response Handling Properties {#response-handling-properties}

Additional properties in both implementations that enhance responses:

```javascript
// Example response-enhancing properties
const responseProperties = {
  summaryStats: { ... },
  aggregateData: { ... },
  formattedExamples: [ ... ],
  queryRelevance: 0.95
};
```

## Compatibility Data Model {#compatibility-data-model}

Structure of compatibility data from dataRetrievalService.js:

```javascript
const compatibilityData = {
  compatibleYears: ["2023", "2024"],
  compatibleSegments: ["UK", "USA"],
  compatibilityScore: 0.85,
  incompatibleReasons: ["Different question types", "Year mismatch"],
  metadataCompatibility: {
    questionTypes: true,
    demographics: false,
    metrics: true,
  },
};
```

## Segment Tracking Model {#segment-tracking-model}

Structure of segment tracking data from dataRetrievalService.js:

```javascript
const segmentTracking = {
  loadedSegments: {
    "file1.json": ["UK", "USA"],
    "file2.json": ["USA"],
  },
  currentSegments: ["UK", "USA"],
  requestedSegments: ["UK", "USA", "EU"],
  missingSegments: {
    "file2.json": ["EU"],
  },
};
```

## Consolidated QueryContext Model {#consolidated-querycontext-model}

Proposed unified model structure:

```typescript
// TypeScript class structure
class QueryContext {
  // Basic properties
  threadId: string;
  query: string;
  isFollowUp: boolean;
  previousQuery: string;
  previousResponse: string;

  // File tracking
  cachedFileIds: string[] = [];
  relevantFiles: string[] = [];

  // Data processing
  processedData: any = null;
  dataVersion: string = "v2";

  // Enhanced capabilities from service
  compatibility?: CompatibilityData;
  segmentTracking?: SegmentTrackingData;

  // Response enhancement
  responseProperties: any = {};

  // Type definitions for complex properties
  interface CompatibilityData {
    compatibleYears: string[];
    compatibleSegments: string[];
    compatibilityScore: number;
    incompatibleReasons: string[];
    metadataCompatibility: Record<string, boolean>;
  }

  interface SegmentTrackingData {
    loadedSegments: Record<string, string[]>;
    currentSegments: string[];
    requestedSegments: string[];
    missingSegments: Record<string, string[]>;
  }
}
```

## Persistence Methods {#persistence-methods}

Required methods for QueryContext management:

```typescript
// Required persistence methods
class QueryContext {
  // Constructor options
  constructor(
    threadId: string,
    query: string,
    options?: Partial<QueryContext>
  ) {
    // Initialize with defaults and options
  }

  // Serialization for storage
  toJSON(): Record<string, any> {
    // Convert to plain object for storage
  }

  // Deserialization from storage
  static fromJSON(json: Record<string, any>): QueryContext {
    // Recreate from stored JSON
  }

  // Deep clone for manipulations
  clone(): QueryContext {
    // Create independent copy
  }

  // Merge method for updates
  merge(updates: Partial<QueryContext>): QueryContext {
    // Apply updates to this context
  }
}
```

## Usage Examples

### Basic Query Processing

```typescript
// Creating a new context
const context = new QueryContext("thread_123", "What was the growth in 2024?");

// Using context in processing
async function processQuery(query: string, context: QueryContext) {
  // Add cache information
  context.cachedFileIds = ["file1.json", "file2.json"];

  // Process using the context
  const result = await someProcessor.process(query, context);

  // Return the enhanced context
  return result.context;
}
```

### Thread Context Persistence

```typescript
// Saving context to storage
async function saveThreadContext(context: QueryContext) {
  const serialized = context.toJSON();
  await kvStore.set(`thread:${context.threadId}:context`, serialized);
}

// Loading context from storage
async function loadThreadContext(
  threadId: string
): Promise<QueryContext | null> {
  const serialized = await kvStore.get(`thread:${threadId}:context`);
  if (!serialized) return null;

  return QueryContext.fromJSON(serialized);
}
```

## Implementation Checklist

- [ ] Define `CompatibilityData` interface
- [ ] Define `SegmentTrackingData` interface
- [ ] Implement `QueryContext` class with all properties
- [ ] Add constructor with reasonable defaults
- [ ] Implement serialization/deserialization methods
- [ ] Add utility methods (clone, merge)
- [ ] Create unit tests for all methods
- [ ] Document usage patterns for other components

_Last updated: Tue Apr 29 2025_
