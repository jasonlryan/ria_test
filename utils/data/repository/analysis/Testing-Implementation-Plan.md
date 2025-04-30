# TypeScript Testing Implementation Plan

**Last Updated:** Wed Apr 30 2025

## Overview

This document defines the implementation plan for resolving TypeScript testing infrastructure issues identified in [TypeScript-Testing-Analysis.md](./TypeScript-Testing-Analysis.md). The plan focuses on enabling proper testing for the repository pattern components, particularly the adapter layer required by the [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Context and Dependencies

This implementation plan addresses backlog item #2 "Resolve TypeScript Testing Infrastructure" from [BACKLOG.md](./BACKLOG.md#2-resolve-typescript-testing-infrastructure), which is identified as a high-priority blocker for adapter implementation work.

### Related Documents

- [TypeScript-Testing-Analysis.md](./TypeScript-Testing-Analysis.md) - Analysis of testing infrastructure issues
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Main repository pattern implementation plan
- [BACKLOG.md](./BACKLOG.md) - Prioritized implementation backlog
- [.cursor/rules/adapter-implementation-standard.mdc](../../../.cursor/rules/adapter-implementation-standard.mdc) - Standards for adapter implementation

## Technical Approach

Based on the detailed analysis, we will migrate from Jest to Vitest to resolve TypeScript ESM compatibility issues. Vitest provides native ESM support and better TypeScript integration, addressing the core issues identified.

### 1. Core Infrastructure Implementation

#### 1.1 Package Dependencies

```bash
npm install -D vitest @vitest/coverage-c8 @testing-library/react happy-dom
```

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

#### 1.4 TypeScript Configuration Updates

**Target File:** `tsconfig.json` (updates)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@utils/*": ["utils/*"]
    },
    "types": ["vitest/globals"]
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Target File:** `tsconfig.test.json` (new)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "node"]
  },
  "include": ["**/*.ts", "**/*.tsx", "tests/**/*.ts"]
}
```

#### 1.5 Package Scripts

**Target File:** `package.json` (scripts section)

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

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
      dataFormat: "standard",
      queryType: "general",
      dataVersions: ["1.0"],
    },
    ...overrides,
  };
}

export function createMockDataFile(overrides = {}): DataFile {
  return {
    id: "test-file-1",
    path: "data/test.csv",
    type: "csv",
    metadata: {
      format: "standard",
      version: "1.0",
    },
    segments: {},
    ...overrides,
  };
}
```

#### 2.2 Mock Components

**Target File:** `tests/repository/mocks.ts`

```typescript
import { FileRepository } from "../../utils/data/repository/interfaces/FileRepository";
import { vi } from "vitest";
import { createMockDataFile } from "./test-factory";

export function createMockFileRepository(): FileRepository {
  return {
    getFileById: vi.fn().mockResolvedValue(createMockDataFile()),
    getFilesByIds: vi.fn().mockResolvedValue([createMockDataFile()]),
    getFilesByQuery: vi.fn().mockResolvedValue([createMockDataFile()]),
    loadSegments: vi.fn().mockResolvedValue(createMockDataFile()),
  };
}
```

### 3. Core Component Tests

#### 3.1 QueryContext Tests

**Target File:** `tests/repository/implementations/QueryContext.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { QueryContext } from "../../../utils/data/repository/implementations/QueryContext";

describe("QueryContext", () => {
  describe("createBasicContext", () => {
    it("should create a context with default values", () => {
      const context = QueryContext.createBasicContext("test query");

      expect(context.query).toBe("test query");
      expect(context.isFollowUp).toBe(false);
      expect(context.compatibility).toBeDefined();
    });
  });

  describe("clone", () => {
    it("should create a deep copy of the context", () => {
      const original = QueryContext.createBasicContext("test query");
      const cloned = original.clone();

      // Modify cloned context
      cloned.query = "modified query";

      // Original should be unchanged
      expect(original.query).toBe("test query");
      expect(cloned.query).toBe("modified query");
    });
  });
});
```

#### 3.2 QueryProcessor Tests

**Target File:** `tests/repository/implementations/QueryProcessorImpl.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { QueryProcessorImpl } from "../../../utils/data/repository/implementations/QueryProcessorImpl";
import { createMockFileRepository } from "../mocks";
import { createMockQueryContext } from "../test-factory";

describe("QueryProcessorImpl", () => {
  let queryProcessor;
  let mockFileRepository;

  beforeEach(() => {
    mockFileRepository = createMockFileRepository();
    queryProcessor = new QueryProcessorImpl(mockFileRepository);
  });

  describe("processQueryWithData", () => {
    it("should process a standard query correctly", async () => {
      // Arrange
      const query = "What is the population of France?";
      const context = createMockQueryContext();

      // Act
      const result = await queryProcessor.processQueryWithData(query, context);

      // Assert
      expect(mockFileRepository.getFilesByQuery).toHaveBeenCalledWith(context);
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("context");
    });

    it("should handle comparison queries", async () => {
      // Arrange
      const query = "Compare the population of France and Germany";
      const context = createMockQueryContext({ query });

      // Act
      const result = await queryProcessor.processQueryWithData(query, context);

      // Assert
      expect(result.context.compatibility.queryType).toBe("comparison");
    });
  });

  describe("isComparisonQuery", () => {
    it("should identify comparison queries correctly", () => {
      expect(queryProcessor.isComparisonQuery("Compare A and B")).toBe(true);
      expect(queryProcessor.isComparisonQuery("Show me A")).toBe(false);
    });
  });

  describe("isStarterQuestion", () => {
    it("should identify starter questions correctly", () => {
      expect(
        queryProcessor.isStarterQuestion("Show me data about France")
      ).toBe(true);
      expect(queryProcessor.isStarterQuestion("What about Germany?")).toBe(
        false
      );
    });
  });
});
```

### 4. Adapter Testing Template

Adapter tests will follow the standards defined in [adapter-implementation-standard.mdc](../../../.cursor/rules/adapter-implementation-standard.mdc#testing-requirements), implementing shadow testing to ensure behavioral equivalence.

**Target File:** `tests/repository/adapters/retrieval-adapter.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { identifyRelevantFiles } from "../../../utils/data/repository/adapters/retrieval-adapter";
import * as originalImplementation from "../../../utils/openai/retrieval";

// Mock original implementation for comparison testing
vi.mock("../../../utils/openai/retrieval", () => ({
  identifyRelevantFiles: vi
    .fn()
    .mockResolvedValue([{ id: "test-file-1", path: "data/test.csv" }]),
}));

describe("retrieval-adapter", () => {
  describe("identifyRelevantFiles", () => {
    it("should call original implementation when feature flag is off", async () => {
      // Arrange
      process.env.USE_REPOSITORY_PATTERN = "false";
      const query = "Test query";

      // Act
      const result = await identifyRelevantFiles(query);

      // Assert
      expect(originalImplementation.identifyRelevantFiles).toHaveBeenCalledWith(
        query,
        {}
      );
      expect(result).toEqual([{ id: "test-file-1", path: "data/test.csv" }]);
    });

    it("should use repository implementation when feature flag is on", async () => {
      // Arrange
      process.env.USE_REPOSITORY_PATTERN = "true";
      const query = "Test query";

      // Act
      const result = await identifyRelevantFiles(query);

      // Assert
      expect(
        originalImplementation.identifyRelevantFiles
      ).not.toHaveBeenCalled();
      // Additional checks for repository implementation behavior
    });

    it("should fall back to original implementation on error", async () => {
      // Arrange
      process.env.USE_REPOSITORY_PATTERN = "true";
      const query = "Test query";
      // Force repository implementation to throw

      // Act
      const result = await identifyRelevantFiles(query);

      // Assert
      expect(originalImplementation.identifyRelevantFiles).toHaveBeenCalled();
      // Verify fallback behavior works
    });
  });
});
```

## Implementation Roadmap

### Phase 1: Setup Testing Infrastructure (2 days)

| Task                            | Priority | Dependencies  | Status         |
| ------------------------------- | -------- | ------------- | -------------- |
| Install Vitest and dependencies | High     | None          | 🟠 Not Started |
| Configure Vitest                | High     | Installation  | 🟠 Not Started |
| Update TypeScript configuration | High     | None          | 🟠 Not Started |
| Create test utilities           | High     | Configuration | 🟠 Not Started |
| Verify basic test runs          | High     | All above     | 🟠 Not Started |

### Phase 2: Core Component Tests (3 days)

| Task                           | Priority | Dependencies  | Status         |
| ------------------------------ | -------- | ------------- | -------------- |
| Implement QueryContext tests   | High     | Phase 1       | 🟠 Not Started |
| Implement FileRepository tests | High     | Phase 1       | 🟠 Not Started |
| Implement QueryProcessor tests | High     | Phase 1       | 🟠 Not Started |
| Create shared test utilities   | Medium   | Initial tests | 🟠 Not Started |

### Phase 3: Adapter Testing Setup (3 days)

| Task                             | Priority | Dependencies   | Status         |
| -------------------------------- | -------- | -------------- | -------------- |
| Create adapter testing utilities | High     | Phase 2        | 🟠 Not Started |
| Implement shadow test templates  | High     | Phase 2        | 🟠 Not Started |
| Add feature flag test helpers    | Medium   | Test utilities | 🟠 Not Started |
| Create error handling tests      | Medium   | Shadow tests   | 🟠 Not Started |

### Phase 4: Integration Tests (2 days)

| Task                                | Priority | Dependencies | Status         |
| ----------------------------------- | -------- | ------------ | -------------- |
| Create end-to-end test helpers      | Medium   | Phase 3      | 🟠 Not Started |
| Verify thread context preservation  | Medium   | E2E helpers  | 🟠 Not Started |
| Test adapter behavior with services | Medium   | Phase 3      | 🟠 Not Started |

### Phase 5: Documentation and CI Integration (1 day)

| Task                          | Priority | Dependencies   | Status         |
| ----------------------------- | -------- | -------------- | -------------- |
| Document testing approach     | Medium   | All tests      | 🟠 Not Started |
| Add tests to CI pipeline      | Medium   | Documentation  | 🟠 Not Started |
| Establish code coverage goals | Low      | CI integration | 🟠 Not Started |

## Risk Analysis and Mitigation

| Risk Area                    | Specific Risk                                   | Mitigation Strategy                                     | Status             |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------- | ------------------ |
| **Vitest Compatibility**     | Some libraries may not work with Vitest         | Test critical dependencies early, have fallback options | 🟠 Not assessed    |
| **TypeScript Configuration** | ESM compatibility issues with TypeScript        | Strict tsconfig settings, explicit module declarations  | 🟠 Not implemented |
| **Complex Dependencies**     | Difficult to mock complex dependency chains     | Create comprehensive factory functions for test objects | 🟠 Not implemented |
| **Adapter Testing**          | Hard to ensure identical behavior with original | Shadow testing with comprehensive test cases            | 🟠 Not implemented |
| **CI Integration**           | Tests might be slow in CI pipeline              | Optimize tests, use test filtering and parallelization  | 🟠 Not assessed    |

## Integration with Adapter Implementation

This testing infrastructure specifically supports the adapter implementation requirements from [adapter-implementation-standard.mdc](../../../.cursor/rules/adapter-implementation-standard.mdc), particularly:

1. **Shadow Testing**: The test structure enables direct comparison between original and adapter implementations
2. **Feature Flag Testing**: Tests verify behavior with different feature flag states
3. **Error Case Testing**: Comprehensive error handling verification is built into the test templates
4. **Performance Testing**: The framework allows for timing comparisons between implementations

## Success Criteria

The testing infrastructure implementation will be considered successful when:

1. **Core Tests**: All core repository components have comprehensive test suites
2. **Coverage**: Test coverage of repository pattern code exceeds 80%
3. **Adapter Testing**: Shadow tests can verify behavioral equivalence between original and adapted implementations
4. **CI Integration**: Tests run successfully in the CI pipeline
5. **Developer Experience**: Testing workflow is documented and easy for developers to use

## Next Steps

Once this plan is implemented, it will unblock [BACKLOG.md item #3: Implement Adapter Layer](./BACKLOG.md#3-implement-adapter-layer) and enable the continuation of the repository pattern implementation according to the main [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## References

- [TypeScript-Testing-Analysis.md](./TypeScript-Testing-Analysis.md) - Analysis of testing issues
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md#outstanding-issues-and-technical-debt) - Main implementation plan
- [BACKLOG.md](./BACKLOG.md#2-resolve-typescript-testing-infrastructure) - Issue in backlog
- [adapter-implementation-standard.mdc](../../../.cursor/rules/adapter-implementation-standard.mdc#testing-requirements) - Adapter testing standards

_Last updated: Wed Apr 30 2025_
