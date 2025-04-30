# Repository Pattern Implementation Plan

**Last Updated:** Wed Apr 30 2025

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

**Status:** ✅ Completed

**Implementation Notes:**

- Added `clone()` method to support non-destructive context manipulation
- Modified interface to ensure thread data is properly typed
- Implementation matches requirements from the analysis document

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

**Status:** ✅ Completed

**Implementation Notes:**

- Added `FileRetrievalOptions` interface to support advanced retrieval options
- Included cache strategy options to optimize performance
- Added segment compatibility checking for better query-file matching

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

**Status:** ✅ Completed

**Implementation Notes:**

- Added `QueryProcessingOptions` interface with comprehensive configuration options
- Implemented metrics tracking in the result type
- Added explicit handling for comparison queries and starter questions

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

**Status:** 🟡 Deferred - Deferred to future implementation

**Implementation Notes:**

- This interface may be refactored into FileRepository or implemented later
- Current implementation handles segments directly in QueryProcessor
- Will revisit if more complex segment handling is needed

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

**Status:** 🟡 Deferred - Deferred to future implementation

**Implementation Notes:**

- Caching currently handled within the FileRepository implementation
- Will implement as a separate concern if caching complexity increases
- Current approach provides simpler integration with fewer dependencies

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

**Status:** ✅ Completed

**Implementation Notes:**

- Implemented robust pattern matching for all helper functions
- Extended comparison detection with year-specific patterns
- Enhanced segment extraction with comprehensive segment types
- Tests deferred due to TypeScript module compatibility issues

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

**Status:** ✅ Completed

**Implementation Notes:**

- Added built-in caching for file operations
- Implemented compatibility scoring for better file matching
- Optimized segment loading to minimize unnecessary data retrieval
- Tests deferred due to TypeScript module compatibility issues

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

**Status:** ✅ Completed

**Implementation Notes:**

- Implemented comprehensive error handling with detailed error results
- Added performance metrics tracking for monitoring
- Created specialized processing paths for starter questions and comparisons
- Added support for context cloning to prevent unexpected side effects
- Tests deferred due to TypeScript module compatibility issues

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

**Status:** 🟠 Not Started - Blocked on testing infrastructure

**Implementation Notes:**

- Will implement after testing infrastructure is set up
- Needs careful verification to maintain backward compatibility
- Will include comprehensive logging for debugging during transition

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

**Status:** 🟠 Not Started - Blocked on testing infrastructure

**Implementation Notes:**

- Will implement after testing infrastructure is set up
- Will include comprehensive thread context compatibility
- Needs careful verification with existing controllers

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

**Status:** 🟠 Not Started - Blocked on adapter implementation

**Implementation Notes:**

- Will implement after adapters are in place and tested
- Will include feature flags for gradual rollout
- Needs comprehensive regression testing

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

**Status:** 🟠 Not Started - Blocked on dependency work

**Implementation Notes:**

- Deferred due to TypeScript module compatibility issues
- May use JavaScript tests with TypeScript types for compatibility
- Will implement after adapters and dependency resolution

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

**Status:** 🟠 Not Started - Blocked on adapter implementation

**Implementation Notes:**

- Will implement with feature flags for granular rollout
- Will include comprehensive logging during transition
- Plan to implement alongside service adapter migration for consistency

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

**Status:** 🟠 Not Started - Blocked on adapter implementation

**Implementation Notes:**

- Will implement with feature flags for granular rollout
- Will include comprehensive logging during transition
- Plan to implement alongside retrieval adapter migration for consistency

## Implementation Checklist

| Phase | Task                              | Status                                      | Dependencies                          | Analysis Reference                                                                                              |
| ----- | --------------------------------- | ------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1.1   | QueryContext Interface            | ✅ Completed                                | None                                  | [QueryContext-Analysis.md § Context Object Analysis](./QueryContext-Analysis.md#context-object-analysis)        |
| 1.2   | FileRepository Interface          | ✅ Completed                                | 1.1                                   | [FileRepository-Analysis.md § identifyRelevantFiles()](./FileRepository-Analysis.md#1-identifyrelevantfiles)    |
| 1.3   | QueryProcessor Interface          | ✅ Completed                                | 1.1, 1.2                              | [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 1.4   | SegmentManager Interface          | 🟡 Deferred                                 | 1.2                                   | [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)              |
| 1.5   | CacheManager Interface            | 🟡 Deferred                                 | 1.2                                   | [Consolidated-Analysis.md § Dependency Analysis](./Consolidated-Analysis.md#dependencies-analysis)              |
| 2.1   | QueryProcessor Helper Functions   | ✅ Completed                                | 1.3                                   | [QueryProcessor-Analysis.md § isComparisonQuery()](./QueryProcessor-Analysis.md#2-iscomparisonquery)            |
| 2.2   | FileRepository Core Functions     | ✅ Completed                                | 1.2                                   | [FileRepository-Analysis.md § loadDataFiles()](./FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles) |
| 2.3   | QueryProcessor Core Function      | ✅ Completed                                | 2.1, 2.2                              | [QueryProcessor-Analysis.md § processQueryWithData()](./QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 3.1   | Retrieval Adapter                 | 🟠 Not Started - Blocked on testing         | 2.2, 2.3                              | [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)        |
| 3.2   | Service Adapter                   | 🟠 Not Started - Blocked on testing         | 2.2, 2.3                              | [Consolidated-Analysis.md § Adapter Implementation](./Consolidated-Analysis.md#3-adapter-implementation)        |
| 4.1   | Core Query Processing Function    | 🟠 Not Started - Blocked on adapters        | Understanding of both implementations | [Consolidated-Analysis.md § Circular Dependency](./Consolidated-Analysis.md#circular-dependency-resolution)     |
| 4.2   | Dependency Resolution Testing     | 🟠 Not Started - Blocked on dependency work | 4.1                                   | [Consolidated-Analysis.md § Risk Analysis](./Consolidated-Analysis.md#risk-analysis)                            |
| 5.1   | Retrieval.js Migration            | 🟠 Not Started - Blocked on adapters        | 3.1, 4.1                              | [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)                  |
| 5.2   | DataRetrievalService.js Migration | 🟠 Not Started - Blocked on adapters        | 3.2, 4.1                              | [Consolidated-Analysis.md § Service Migration](./Consolidated-Analysis.md#7-service-migration)                  |

## Outstanding Issues and Technical Debt

1. **Testing Infrastructure**: Need to resolve TypeScript module compatibility issues affecting test creation
2. **Documentation**: Need to add comprehensive API documentation for all interfaces and implementations
3. **Integration Testing**: Need end-to-end integration tests before phase 5 migrations
4. **Performance Monitoring**: Should implement performance benchmarking before/after migration

## Risk Analysis and Mitigation

| Risk Area         | Specific Risk                                | Mitigation Strategy                               | Status                                 |
| ----------------- | -------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| **Compatibility** | Breaking changes in function signatures      | Comprehensive adapter testing with shadow testing | 🟡 Pending adapter implementation      |
| **Performance**   | Slower operation with additional abstraction | Performance benchmarking at each stage            | 🟡 Pending benchmark implementation    |
| **Functionality** | Loss of thread context handling              | Careful preservation of thread state              | ✅ Addressed in QueryContext interface |
| **Circular Deps** | Breaking the dependency chain causes errors  | Implement adapters first, then gradually migrate  | 🟡 Pending adapter implementation      |
| **Adoption**      | Resistance to new pattern                    | Gradual adoption with feature flags               | 🟡 Pending service migration           |
| **Testing**       | Missing edge cases                           | Shadow testing with real-world queries            | 🟡 Pending testing infrastructure      |

## Success Criteria

1. No functional regression in data retrieval capabilities
2. Simplified codebase with eliminated redundancies
3. Improved test coverage for data retrieval operations
4. No circular dependencies between services and utilities
5. Consistent error handling across all data operations
6. Performance equivalent to or better than the original implementation
7. Comprehensive documentation of the repository pattern

## Next Steps

1. Resolve TypeScript testing infrastructure issues
2. Implement adapter layer for both services
3. Create validation tests with real-world queries
4. Implement core query processing function
5. Begin gradual migration of both services

_Last updated: Wed Apr 30 2025_
