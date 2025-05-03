# TypeScript Testing Implementation Plan

**Last Updated:** Sat May 3 2025

## Overview

This document defines the implementation plan for resolving TypeScript testing infrastructure issues identified in [TypeScript-Testing-Analysis.md](../docs/TypeScript-Testing-Analysis.md). The plan focuses on enabling proper testing for the repository pattern components, particularly the adapter layer required by the [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Context and Dependencies

This implementation plan addresses backlog item #2 "Resolve TypeScript Testing Infrastructure" from [BACKLOG.md](../BACKLOG.md#2-resolve-typescript-testing-infrastructure), which is identified as a high-priority blocker for adapter implementation work.

### Related Documents

- [TypeScript-Testing-Analysis.md](../docs/TypeScript-Testing-Analysis.md) - Analysis of testing infrastructure issues
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Main repository pattern implementation plan
- [BACKLOG.md](../BACKLOG.md) - Prioritized implementation backlog
- [.cursor/rules/adapter-implementation-standard.mdc](../../../.cursor/rules/adapter-implementation-standard.mdc) - Standards for adapter implementation

## Technical Approach

Based on the detailed analysis, we will migrate from Jest to Vitest to resolve TypeScript ESM compatibility issues. Vitest provides native ESM support and better TypeScript integration, addressing the core issues identified.

### 1. Core Infrastructure Implementation

#### 1.1 Package Dependencies

```bash
npm install -D vitest @vitest/coverage-c8 @testing-library/react happy-dom
```

**Status:** ✅ Completed

#### 1.2 Vitest Configuration

**Target File:** `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@utils": path.resolve(__dirname, "./utils"),
    },
  },
});
```

**Status:** ✅ Completed

#### 1.3 Test Setup

**Target File:** `tests/setup.ts`

```typescript
import { expect, afterEach } from "vitest";

// Any global test setup like mocks
global.console.error = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});
```

**Status:** ✅ Completed

#### 1.4 TypeScript Configuration Updates

**Target File:** `tsconfig.test.json` (new)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "node"],
    "esModuleInterop": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["**/*.ts", "**/*.tsx", "tests/**/*.ts"]
}
```

**Status:** ✅ Completed

#### 1.5 Package Scripts

**Target File:** `package.json` (scripts section)

```json
"scripts": {
  "test": "node tests/index.js",
  "test:unit": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Status:** ✅ Completed

### 2. Repository Testing Utilities

#### 2.1 Test Factories

**Target File:** `tests/repository/test-factory.ts`

```typescript
import { QueryContext } from "../../utils/data/repository/interfaces/QueryContext";
import { DataFile } from "../../utils/data/repository/interfaces/FileRepository";

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
      metadataCompatibility: { format: true, version: true },
    },
    cachedFileIds: [],
    ...overrides,
  };
}

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
```

**Status:** ✅ Completed

#### 2.2 Mock Components

**Target File:** `tests/repository/mocks.ts`

```typescript
import { FileRepository } from "../../utils/data/repository/interfaces/FileRepository";
import { QueryProcessor } from "../../utils/data/repository/interfaces/QueryProcessor";
import { vi } from "vitest";
import { createMockDataFile } from "./test-factory";

export function createMockFileRepository(): FileRepository {
  return {
    getFileById: vi.fn().mockResolvedValue(createMockDataFile()),
    getFilesByIds: vi.fn().mockResolvedValue([createMockDataFile()]),
    getFilesByQuery: vi
      .fn()
      .mockResolvedValue({ relevantFiles: ["test-file-1"] }),
    loadSegments: vi.fn().mockResolvedValue(createMockDataFile()),
  };
}

export function createMockQueryProcessor(): QueryProcessor {
  return {
    processQueryWithData: vi.fn().mockResolvedValue({
      relevantFiles: [createMockDataFile()],
      processedData: [{ source: "test", content: "test data" }],
      queryType: "general",
      metrics: {
        duration: 100,
        filesProcessed: 1,
      },
    }),
    isComparisonQuery: vi.fn().mockReturnValue(false),
    isStarterQuestion: vi.fn().mockReturnValue(false),
    extractSegmentsFromQuery: vi.fn().mockReturnValue([]),
  };
}
```

**Status:** ✅ Completed

### 3. Core Component Tests

#### 3.1 QueryContext Tests

**Target File:** `tests/repository/QueryContext.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { QueryContext } from "../../../utils/data/repository/implementations/QueryContext";

describe("QueryContext", () => {
  it("should create a basic context with default values", () => {
    const context = new QueryContext("test query");
    expect(context.query).toBe("test query");
    expect(context.isFollowUp).toBe(false);
  });

  it("should allow initializing with custom values", () => {
    const context = new QueryContext("test query", {
      threadId: "test-thread",
      isFollowUp: true,
    });
    expect(context.threadId).toBe("test-thread");
    expect(context.isFollowUp).toBe(true);
  });

  it("should clone context objects", () => {
    const original = new QueryContext("test query");
    const clone = original.clone();

    expect(clone).not.toBe(original);
    expect(clone.query).toBe(original.query);

    // Modify clone should not affect original
    clone.isFollowUp = true;
    expect(clone.isFollowUp).toBe(true);
    expect(original.isFollowUp).toBe(false);
  });
});
```

**Status:** ✅ Completed

#### 3.2 FileRepository Tests

**Target File:** `tests/repository/FileSystemRepository.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileSystemRepository } from "../../../utils/data/repository/implementations/FileSystemRepository";
import { createMockQueryContext } from "./test-factory";
import fs from "fs/promises";

// Mock fs module
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

describe("FileSystemRepository", () => {
  let repository: FileSystemRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new FileSystemRepository("./data");

    // Setup default mocks
    vi.mocked(fs.readdir).mockResolvedValue(["file1.csv", "file2.csv"] as any);
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
    vi.mocked(fs.readFile).mockResolvedValue("id,value\n1,test");
  });

  it("should get files by query", async () => {
    const context = createMockQueryContext();
    const result = await repository.getFilesByQuery(context);

    expect(result.relevantFiles.length).toBeGreaterThan(0);
    expect(fs.readdir).toHaveBeenCalled();
  });

  it("should handle empty directory", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const context = createMockQueryContext();
    const result = await repository.getFilesByQuery(context);

    expect(result.relevantFiles).toEqual([]);
  });
});
```

**Status:** ✅ Completed

### 4. Adapter Tests

#### 4.1 RetrievalAdapter Tests

**Target File:** `tests/repository/adapters/RetrievalAdapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetrievalAdapter } from "../../../../utils/data/repository/adapters/RetrievalAdapter";
import { createMockFileRepository, createMockQueryProcessor } from "../mocks";

describe("RetrievalAdapter", () => {
  let adapter: RetrievalAdapter;
  let mockFileRepository: ReturnType<typeof createMockFileRepository>;
  let mockQueryProcessor: ReturnType<typeof createMockQueryProcessor>;

  beforeEach(() => {
    mockFileRepository = createMockFileRepository();
    mockQueryProcessor = createMockQueryProcessor();
    adapter = new RetrievalAdapter(mockFileRepository, mockQueryProcessor);
  });

  it("should identify relevant files", async () => {
    const result = await adapter.identifyRelevantFiles("test query");

    expect(mockFileRepository.getFilesByQuery).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should handle thread context", async () => {
    const result = await adapter.identifyRelevantFiles(
      "test query",
      "thread-123"
    );

    const contextArg = mockFileRepository.getFilesByQuery.mock.calls[0][0];
    expect(contextArg.threadId).toBe("thread-123");
  });
});
```

**Status:** ✅ Completed

#### 4.2 ServiceAdapter Tests

**Target File:** `tests/repository/adapters/ServiceAdapter.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceAdapter } from "../../../../utils/data/repository/adapters/ServiceAdapter";
import { createMockFileRepository, createMockQueryProcessor } from "../mocks";

describe("ServiceAdapter", () => {
  let adapter: ServiceAdapter;
  let mockFileRepository: ReturnType<typeof createMockFileRepository>;
  let mockQueryProcessor: ReturnType<typeof createMockQueryProcessor>;

  beforeEach(() => {
    mockFileRepository = createMockFileRepository();
    mockQueryProcessor = createMockQueryProcessor();
    adapter = new ServiceAdapter(mockFileRepository, mockQueryProcessor);
  });

  it("should process query with data", async () => {
    const result = await adapter.processQueryWithData("test query", ["file-1"]);

    expect(mockQueryProcessor.processQueryWithData).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should maintain API compatibility", async () => {
    const result = await adapter.identifyRelevantFiles({
      query: "test query",
      threadId: "test-thread",
    });

    expect(mockFileRepository.getFilesByQuery).toHaveBeenCalled();
    expect(result).toHaveProperty("relevantFiles");
  });
});
```

**Status:** ✅ Completed

## Rollout Plan

### 1. Initial Setup (Day 1-2)

1. Add Vitest dependencies to package.json
2. Create initial configuration files
3. Add script commands to package.json

**Status:** ✅ Completed

### 2. Test Structure Implementation (Day 3-5)

1. Create test helpers and factory functions
2. Set up mocking utilities
3. Convert first simple test to validate infrastructure

**Status:** ✅ Completed

### 3. Core Component Tests (Day 6-10)

1. Implement tests for QueryContext implementation
2. Implement tests for FileRepository implementation
3. Implement tests for QueryProcessor implementation

**Status:** ✅ Completed

### 4. Adapter Tests (Day 11-15)

1. Implement tests for RetrievalAdapter
2. Implement tests for ServiceAdapter
3. Validate adapter compatibility with existing code

**Status:** ✅ Completed

### 5. Integration Tests (Day 16-20)

1. Implement end-to-end tests for repository pattern
2. Test circular dependency resolution
3. Validate with real-world queries and data

**Status:** ✅ Completed

## Implementation Checklist

| Item | Task                        | Status       | Dependencies  |
| ---- | --------------------------- | ------------ | ------------- |
| 1.1  | Vitest Package Installation | ✅ Completed | None          |
| 1.2  | Vitest Configuration        | ✅ Completed | 1.1           |
| 1.3  | Test Setup Files            | ✅ Completed | 1.2           |
| 1.4  | TypeScript Configuration    | ✅ Completed | 1.1           |
| 1.5  | Package Scripts             | ✅ Completed | 1.1, 1.2      |
| 2.1  | Mock Factory Functions      | ✅ Completed | 1.4           |
| 2.2  | Test Mocks Implementation   | ✅ Completed | 2.1           |
| 3.1  | QueryContext Tests          | ✅ Completed | 2.1, 2.2      |
| 3.2  | FileRepository Tests        | ✅ Completed | 2.1, 2.2      |
| 3.3  | QueryProcessor Tests        | ✅ Completed | 2.1, 2.2      |
| 4.1  | RetrievalAdapter Tests      | ✅ Completed | 3.1, 3.2, 3.3 |
| 4.2  | ServiceAdapter Tests        | ✅ Completed | 3.1, 3.2, 3.3 |
| 5.1  | Integration Tests           | ✅ Completed | 4.1, 4.2      |
| 5.2  | Circular Dependency Tests   | ✅ Completed | 5.1           |
| 5.3  | Real-world Query Tests      | ✅ Completed | 5.1           |

## Integration with Main Implementation Plan

This testing infrastructure work directly supports items 3.1 and 3.2 in the [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md), enabling adapter implementation. It also supports items 4.1 and 4.2 related to circular dependency resolution.

## Best Practices for Repository Tests

1. Use factory functions to create test objects
2. Test each interface implementation separately
3. Mock dependencies for unit tests
4. Test adapters with compatibility focus
5. Add integration tests for the complete flow

## Success Criteria

1. ✅ All core repository components have unit tests
2. ✅ All adapters have compatibility tests
3. ✅ TypeScript ESM compatibility issues resolved
4. ✅ Test coverage for critical functions > 80%
5. ✅ Vitest integrated with CI/CD pipeline

## Next Steps

1. ~~Set up Vitest configuration~~ ✅ Completed
2. ~~Implement factory functions and mocks~~ ✅ Completed
3. ~~Create component tests~~ ✅ Completed
4. ~~Implement adapter tests~~ ✅ Completed
5. ~~Add integration tests~~ ✅ Completed
6. Continue monitoring and optimizing test infrastructure as needed

_Last updated: Sat May 3 2025_
