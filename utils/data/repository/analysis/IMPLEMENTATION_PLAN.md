# Repository Pattern Implementation Plan

**Last Updated:** Tue Apr 29 2025

<!--
LLM-GUIDANCE
This document defines the implementation plan for the repository pattern.
When implementing:
1. Follow phases in order of dependencies
2. Reference specific sections of analysis documents when implementing
3. Create interfaces before implementations
4. Use proper documentation in all created files
5. Maintain backward compatibility through adapters
6. Do not implement until plan is approved
7. Ensure all interface files have comprehensive header documentation
8. Maintain reciprocal cross-references in all documentation
-->

## Overview

This implementation plan provides detailed steps for implementing the repository pattern to consolidate duplicated functionality between `utils/openai/retrieval.js` and `app/api/services/dataRetrievalService.js`. The plan is based on the analysis in [Consolidated-Analysis.md](./Consolidated-Analysis.md) and follows the dependency order established there.

The repository pattern will:

1. Eliminate code duplication
2. Resolve circular dependencies
3. Improve testability and maintainability
4. Provide a clean separation of concerns
5. Enable service migration to new APIs

## Dependency-Based Implementation Order

Based on the dependency analysis in [Consolidated-Analysis.md § Implementation Priorities](./Consolidated-Analysis.md#implementation-priorities), implementation should proceed in this order:

1. **QueryContext Interface** - No dependencies on other components
2. **FileRepository Interface** - Depends on QueryContext
3. **QueryProcessor Helper Functions** - Depends on QueryContext
4. **QueryProcessor Core Function** - Depends on all above
5. **Adapter Implementation** - Depends on interfaces and implementations
6. **Service Migration** - Final step after adapters are in place

## Phase 1: Core Interface Implementation

### 1.1 QueryContext Interface {#querycontext-interface}

**Target File:** `utils/data/repository/interfaces/QueryContext.ts`

**Analysis Reference:** [QueryContext-Analysis.md § Context Object Analysis](./QueryContext-Analysis.md#context-object-analysis)

**Purpose:** Standardize context objects used across query processing components

**Dependencies:** None

**Implementation Steps:**

1. Define the `QueryContext` interface with properties from both implementations:

   - Common thread properties (threadId, isFollowUp)
   - Compatibility metadata fields
   - Optional format preferences
   - Type definitions for all properties

2. Create the `CompatibilityMetadata` interface as described in [QueryContext-Analysis.md § CompatibilityMetadata Analysis](./QueryContext-Analysis.md#compatibilitymetadata-analysis)

3. Add utility functions for context creation:
   - `createBasicContext()`
   - `createThreadContext()`
   - `createCompatibilityContext()`

**Documentation Template:**

```typescript
/**
 * QueryContext Interface
 *
 * Defines the standard context object passed between query processing components.
 * Standardizes context information needed for query processing across implementations.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#querycontext-interface
 * - Analysis: ../analysis/QueryContext-Analysis.md#context-object-analysis
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 1.2 FileRepository Interface {#filerepository-interface}

**Target File:** `utils/data/repository/interfaces/FileRepository.ts`

**Analysis Reference:** [FileRepository-Analysis.md § identifyRelevantFiles()](./FileRepository-Analysis.md#1-identifyrelevantfiles)

**Purpose:** Define the contract for data file access and identification

**Dependencies:**

- QueryContext interface

**Implementation Steps:**

1. Define the core data interfaces:

   - `DataFile` interface as described in [FileRepository-Analysis.md](./FileRepository-Analysis.md)
   - `FileIdentificationResult` interface
   - `SegmentData` interface

2. Implement the `FileRepository` interface with methods:
   - `getFileById()` - Get a single file by ID
   - `getFilesByIds()` - Get multiple files by IDs
   - `getFilesByQuery()` - Identify files based on a query
   - `loadSegments()` - Load specific segments for a file

**Documentation Template:**

```typescript
/**
 * FileRepository Interface
 *
 * Defines the contract for components that provide access to data files.
 * Consolidates the file identification and data loading operations from
 * multiple implementations into a unified interface.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#filerepository-interface
 * - Analysis: ../analysis/FileRepository-Analysis.md#1-identifyrelevantfiles
 * - Related Interface: ./QueryContext.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 1.3 QueryProcessor Interface {#queryprocessor-interface}

**Target File:** `utils/data/repository/interfaces/QueryProcessor.ts`

**Analysis Reference:** [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)

**Purpose:** Define the contract for processing queries against data files

**Dependencies:**

- QueryContext interface
- FileRepository interface (for result types)

**Implementation Steps:**

1. Define the `ProcessedQueryResult` interface for query results

2. Implement the `QueryProcessor` interface with methods:
   - `processQueryWithData()` - Core query processing
   - `isComparisonQuery()` - Detect comparison queries
   - `isStarterQuestion()` - Detect starter questions
   - `extractSegmentsFromQuery()` - Extract segments from queries

**Documentation Template:**

```typescript
/**
 * QueryProcessor Interface
 *
 * Defines the contract for processing queries against data files.
 * Handles the core logic of query analysis, data retrieval, and response formatting.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#queryprocessor-interface
 * - Analysis: ../analysis/QueryProcessor-Analysis.md#1-processquerywithdata
 * - Related Interface: ./QueryContext.ts
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 1.4 SegmentManager Interface {#segmentmanager-interface}

**Target File:** `utils/data/repository/interfaces/SegmentManager.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)

**Purpose:** Define the contract for managing data segmentation

**Dependencies:**

- DataFile interface from FileRepository

**Implementation Steps:**

1. Define the `SegmentFilterOptions` interface for filtering

2. Implement the `SegmentManager` interface with methods:
   - `extractSegmentsFromQuery()` - Parse segments from query
   - `calculateMissingSegments()` - Identify missing segments
   - `loadAdditionalSegments()` - Load segments on demand
   - `mergeFileSegments()` - Merge new segments into files
   - `filterDataBySegments()` - Filter data with segments
   - `filterRelevantSegments()` - Identify relevant segments

**Documentation Template:**

```typescript
/**
 * SegmentManager Interface
 *
 * Defines the contract for components that manage data segmentation.
 * Handles identification, loading, and filtering of segments within data files.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#segmentmanager-interface
 * - Analysis: ../analysis/Consolidated-Analysis.md#dependencies-analysis
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 1.5 CacheManager Interface {#cachemanager-interface}

**Target File:** `utils/data/repository/interfaces/CacheManager.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)

**Purpose:** Define the contract for cache operations

**Dependencies:**

- DataFile interface from FileRepository

**Implementation Steps:**

1. Define the `CacheManager` interface with methods:
   - `getCachedFiles()` - Retrieve files from cache
   - `updateCache()` - Update cache with new files
   - `getCacheMetadata()` - Get metadata about cached content
   - `invalidateCache()` - Clear specific cache entries

**Documentation Template:**

```typescript
/**
 * CacheManager Interface
 *
 * Defines the contract for components that handle caching operations.
 * Provides a unified approach to file caching across implementations.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#cachemanager-interface
 * - Analysis: ../analysis/Consolidated-Analysis.md#dependencies-analysis
 * - Related Interface: ./FileRepository.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

## Phase 2: Component Implementation

### 2.1 QueryProcessor Helper Functions {#queryprocessor-helper-functions}

**Target File:** `utils/data/repository/implementations/QueryProcessorImpl.ts`

**Analysis Reference:**

- [QueryProcessor-Analysis.md § isComparisonQuery()](./QueryProcessor-Analysis.md#2-iscomparisonquery)
- [QueryProcessor-Analysis.md § isStarterQuestion()](./QueryProcessor-Analysis.md#3-isstarterquestion)
- [QueryProcessor-Analysis.md § extractSegmentsFromQuery()](./QueryProcessor-Analysis.md#4-extractsegmentsfromquery)

**Purpose:** Implement utility functions for query analysis

**Dependencies:**

- QueryProcessor interface

**Implementation Steps:**

1. Implement pure utility functions first:

   - `isComparisonQuery()` from [QueryProcessor-Analysis.md § 2](./QueryProcessor-Analysis.md#2-iscomparisonquery)
   - `isStarterQuestion()` from [QueryProcessor-Analysis.md § 3](./QueryProcessor-Analysis.md#3-isstarterquestion)
   - `extractSegmentsFromQuery()` from [QueryProcessor-Analysis.md § 4](./QueryProcessor-Analysis.md#4-extractsegmentsfromquery)

2. Create unit tests for all helper functions

**Documentation Template:**

```typescript
/**
 * QueryProcessor Implementation
 *
 * Implements helper functions for the QueryProcessor interface.
 * Provides utility functions for query analysis and processing.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#queryprocessor-helper-functions
 * - Analysis: ../analysis/QueryProcessor-Analysis.md#2-iscomparisonquery
 * - Interface: ../interfaces/QueryProcessor.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 2.2 FileRepository Core Functions {#filerepository-core-functions}

**Target File:** `utils/data/repository/implementations/FileSystemRepository.ts`

**Analysis Reference:**

- [FileRepository-Analysis.md § loadDataFiles()](./FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles)
- [FileRepository-Analysis.md § getFilesByIds()](./FileRepository-Analysis.md#3-getfilesbyids-new-method)

**Purpose:** Implement core file access and identification functions

**Dependencies:**

- FileRepository interface
- QueryContext interface

**Implementation Steps:**

1. Implement core file access methods:

   - `getFileById()` - Single file retrieval
   - `getFilesByIds()` - Multiple file retrieval with caching
   - `loadSegments()` - Segment-specific loading

2. Implement file identification method:
   - `getFilesByQuery()` - Identify files based on query context

**Documentation Template:**

```typescript
/**
 * FileSystemRepository Implementation
 *
 * Concrete implementation of the FileRepository interface.
 * Provides file system access to data files with caching support.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#filerepository-core-functions
 * - Analysis: ../analysis/FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles
 * - Interface: ../interfaces/FileRepository.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 2.3 QueryProcessor Core Function {#queryprocessor-core-function}

**Target File:** `utils/data/repository/implementations/QueryProcessorImpl.ts` (continued)

**Analysis Reference:** [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)

**Purpose:** Implement the core query processing logic

**Dependencies:**

- QueryProcessor interface
- FileRepository implementation
- Helper functions from 2.1

**Implementation Steps:**

1. Implement `processQueryWithData()` method:

   - Query preprocessing
   - Special case handling (starter questions, comparisons)
   - File identification and retrieval
   - Data filtering and formatting
   - Context enhancement

2. Create comprehensive tests for the query processor

**Documentation Template:**

```typescript
/**
 * QueryProcessor Core Implementation
 *
 * Implements the core query processing logic.
 * Handles the complete flow from query analysis to data retrieval and formatting.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#queryprocessor-core-function
 * - Analysis: ../analysis/QueryProcessor-Analysis.md#1-processquerywithdata
 * - Interface: ../interfaces/QueryProcessor.ts
 * - Related: ./FileSystemRepository.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

## Phase 3: Adapter Implementation

### 3.1 Retrieval Adapter {#retrieval-adapter}

**Target File:** `utils/data/repository/adapters/retrieval-adapter.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)

**Purpose:** Create adapters for retrieval.js functions

**Dependencies:**

- FileRepository implementation
- QueryProcessor implementation

**Implementation Steps:**

1. Create adapter functions that match original signatures:

   - `identifyRelevantFiles()` adapter
   - `retrieveDataFiles()` adapter
   - `processQueryWithData()` adapter

2. Add deprecation warnings to indicate future migration

**Documentation Template:**

```typescript
/**
 * Retrieval Adapter
 *
 * Provides adapters for retrieval.js to use the repository pattern.
 * Maintains backward compatibility with existing function signatures.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#retrieval-adapter
 * - Analysis: ../analysis/Consolidated-Analysis.md#3-adapter-implementation
 * - Related: ../implementations/FileSystemRepository.ts
 * - Related: ../implementations/QueryProcessorImpl.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 3.2 Service Adapter {#service-adapter}

**Target File:** `utils/data/repository/adapters/service-adapter.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)

**Purpose:** Create adapters for dataRetrievalService.js methods

**Dependencies:**

- FileRepository implementation
- QueryProcessor implementation
- SegmentManager implementation (if created)

**Implementation Steps:**

1. Create adapter methods matching service methods:

   - `identifyRelevantFiles()` adapter
   - `loadDataFiles()` adapter
   - `processQueryWithData()` adapter
   - Additional service-specific methods

2. Maintain compatibility with thread context handling

**Documentation Template:**

```typescript
/**
 * Service Adapter
 *
 * Provides adapters for dataRetrievalService.js to use the repository pattern.
 * Maintains backward compatibility with existing service methods.
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#service-adapter
 * - Analysis: ../analysis/Consolidated-Analysis.md#3-adapter-implementation
 * - Related: ../implementations/FileSystemRepository.ts
 * - Related: ../implementations/QueryProcessorImpl.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

## Phase 4: Circular Dependency Resolution

### 4.1 Core Query Processing Function {#core-query-processing-function}

**Target File:** `utils/openai/queryProcessing.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Circular Dependency](./Consolidated-Analysis.md#circular-dependency-resolution)

**Purpose:** Extract shared logic to break circular dependency

**Dependencies:**

- Understanding of both original implementations

**Implementation Steps:**

1. Extract core processing logic into a standalone function:

   - `processQueryDataCore()` - Core query processing
   - Parameter standardization
   - Clear return type definition

2. Update original implementations to use this core function

**Documentation Template:**

```typescript
/**
 * Core Query Processing Logic
 *
 * Contains shared processing logic extracted from both retrieval.js
 * and dataRetrievalService.js to resolve circular dependencies.
 *
 * References:
 * - Implementation Plan: ../data/repository/analysis/IMPLEMENTATION_PLAN.md#core-query-processing-function
 * - Analysis: ../data/repository/analysis/Consolidated-Analysis.md#circular-dependency-resolution
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 4.2 Dependency Resolution Testing {#dependency-resolution-testing}

**Target File:** `utils/data/tests/dependency-resolution.test.js`

**Analysis Reference:** [Consolidated-Analysis.md § Risk Analysis](./Consolidated-Analysis.md#risk-analysis)

**Purpose:** Verify the circular dependency is resolved

**Dependencies:**

- Core query processing function implementation

**Implementation Steps:**

1. Create tests that verify:
   - No import cycles exist
   - Both services can operate independently
   - Functionality is preserved in both implementations

**Documentation Template:**

```typescript
/**
 * Dependency Resolution Tests
 *
 * Verifies that circular dependencies have been resolved.
 * Tests the independence of retrieval.js and dataRetrievalService.js.
 *
 * References:
 * - Implementation Plan: ../repository/analysis/IMPLEMENTATION_PLAN.md#dependency-resolution-testing
 * - Analysis: ../repository/analysis/Consolidated-Analysis.md#risk-analysis
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

## Phase 5: Service Migration

### 5.1 Retrieval.js Migration {#retrievaljs-migration}

**Target File:** `utils/openai/retrieval.js`

**Analysis Reference:** [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)

**Purpose:** Migrate retrieval.js to use repository pattern

**Dependencies:**

- All adapters implemented and tested

**Implementation Steps:**

1. Update imports to use adapters
2. Add feature flags for gradual rollout
3. Maintain backward compatibility for APIs
4. Add deprecation notices for direct usage

**Implementation Notes:**

```javascript
/**
 * Retrieval Service Migration
 *
 * Updates retrieval.js to use the repository pattern through adapters.
 * Maintains backward compatibility while enabling future migration.
 *
 * References:
 * - Implementation Plan: ../data/repository/analysis/IMPLEMENTATION_PLAN.md#retrievaljs-migration
 * - Analysis: ../data/repository/analysis/Consolidated-Analysis.md#7-service-migration
 * - Adapters: ../data/repository/adapters/retrieval-adapter.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 5.2 DataRetrievalService.js Migration {#dataretrievalservicejs-migration}

**Target File:** `app/api/services/dataRetrievalService.js`

**Analysis Reference:** [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)

**Purpose:** Migrate dataRetrievalService.js to use repository pattern

**Dependencies:**

- All adapters implemented and tested

**Implementation Steps:**

1. Update imports to use service adapters
2. Add feature flags for gradual rollout
3. Ensure thread context and compatibility handling
4. Add deprecation notices for direct usage

**Implementation Notes:**

```javascript
/**
 * Data Retrieval Service Migration
 *
 * Updates dataRetrievalService.js to use the repository pattern.
 * Maintains backward compatibility while enabling future migration.
 *
 * References:
 * - Implementation Plan: ../utils/data/repository/analysis/IMPLEMENTATION_PLAN.md#dataretrievalservicejs-migration
 * - Analysis: ../utils/data/repository/analysis/Consolidated-Analysis.md#7-service-migration
 * - Adapters: ../utils/data/repository/adapters/service-adapter.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

## Implementation Checklist

| Phase | Task                              | Status      | Dependencies                          | Analysis Reference                                                                                              |
| ----- | --------------------------------- | ----------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1.1   | QueryContext Interface            | Not Started | None                                  | [QueryContext-Analysis.md § Context Object Analysis](./QueryContext-Analysis.md#context-object-analysis)        |
| 1.2   | FileRepository Interface          | Not Started | 1.1                                   | [FileRepository-Analysis.md § identifyRelevantFiles()](./FileRepository-Analysis.md#1-identifyrelevantfiles)    |
| 1.3   | QueryProcessor Interface          | Not Started | 1.1, 1.2                              | [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 1.4   | SegmentManager Interface          | Not Started | 1.2                                   | [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)              |
| 1.5   | CacheManager Interface            | Not Started | 1.2                                   | [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)              |
| 2.1   | QueryProcessor Helper Functions   | Not Started | 1.3                                   | [QueryProcessor-Analysis.md § isComparisonQuery()](./QueryProcessor-Analysis.md#2-iscomparisonquery)            |
| 2.2   | FileRepository Core Functions     | Not Started | 1.2                                   | [FileRepository-Analysis.md § loadDataFiles()](./FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles) |
| 2.3   | QueryProcessor Core Function      | Not Started | 2.1, 2.2                              | [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 3.1   | Retrieval Adapter                 | Not Started | 2.2, 2.3                              | [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)        |
| 3.2   | Service Adapter                   | Not Started | 2.2, 2.3                              | [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)        |
| 4.1   | Core Query Processing Function    | Not Started | Understanding of both implementations | [Consolidated-Analysis.md § Circular Dependency](./Consolidated-Analysis.md#circular-dependency-resolution)     |
| 4.2   | Dependency Resolution Testing     | Not Started | 4.1                                   | [Consolidated-Analysis.md § Risk Analysis](./Consolidated-Analysis.md#risk-analysis)                            |
| 5.1   | Retrieval.js Migration            | Not Started | 3.1, 4.1                              | [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)                  |
| 5.2   | DataRetrievalService.js Migration | Not Started | 3.2, 4.1                              | [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)                  |

## Risk Analysis and Mitigation

| Risk Area         | Specific Risk                                | Mitigation Strategy                               |
| ----------------- | -------------------------------------------- | ------------------------------------------------- |
| **Compatibility** | Breaking changes in function signatures      | Comprehensive adapter testing with shadow testing |
| **Performance**   | Slower operation with additional abstraction | Performance benchmarking at each stage            |
| **Functionality** | Loss of thread context handling              | Careful preservation of thread state              |
| **Circular Deps** | Breaking the dependency chain causes errors  | Implement adapters first, then gradually migrate  |
| **Adoption**      | Resistance to new pattern                    | Gradual adoption with feature flags               |
| **Testing**       | Missing edge cases                           | Shadow testing with real-world queries            |

## Success Criteria

1. No functional regression in data retrieval capabilities
2. Simplified codebase with eliminated redundancies
3. Improved test coverage for data retrieval operations
4. No circular dependencies between services and utilities
5. Consistent error handling across all data operations
6. Performance equivalent to or better than the original implementation
7. Comprehensive documentation of the repository pattern

_Last updated: Tue Apr 29 2025_
