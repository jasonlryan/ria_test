# Repository Pattern Implementation Plan

**Last Updated:** Sat May 3 2025

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

This implementation plan provides detailed steps for implementing the repository pattern to consolidate duplicated functionality between `utils/openai/retrieval.js` and `app/api/services/dataRetrievalService.js`. The plan is based on the analysis in [Consolidated-Analysis.md](../docs/Consolidated-Analysis.md) and follows the dependency order established there.

The repository pattern will:

1. Eliminate code duplication
2. Resolve circular dependencies
3. Improve testability and maintainability
4. Provide a clean separation of concerns
5. Enable service migration to new APIs

## Implementation Order

Based on the dependency analysis in [Consolidated-Analysis.md § Implementation Priorities](../docs/Consolidated-Analysis.md#implementation-priorities), implementation should proceed in this order:

1. Core interfaces (QueryContext, FileRepository, QueryProcessor)
2. Implementation classes (starting with lowest dependencies)
3. Adapter layer to bridge existing code
4. Resolution of circular dependencies
5. Migration of existing services
6. Documentation and cleanup

## Phase 1: Interface Design

### 1.1 QueryContext Model {#querycontext-model}

**Target File:** `utils/data/repository/interfaces/QueryContext.ts`

**Analysis Reference:** [QueryContext-Analysis.md § Context Object Analysis](../docs/QueryContext-Analysis.md#context-object-analysis)

**Purpose:** Define standard query context object

**Dependencies:** None

**Implementation Steps:**

1. Create the `QueryContext` interface with properties:

   - `query` - The raw query string
   - `threadId` - Optional thread ID for context
   - `isFollowUp` - Whether this is a follow-up question
   - `compatibility` - Compatibility information
   - `cachedFileIds` - Optional cached file IDs
   - `segmentTracking` - Information about segments

2. Create the `CompatibilityMetadata` interface as described in [QueryContext-Analysis.md § CompatibilityMetadata Analysis](../docs/QueryContext-Analysis.md#compatibilitymetadata-analysis)

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with all required properties
- Extended to include additional segment tracking information
- Used by both FileRepository and QueryProcessor interfaces

### 1.2 FileRepository Interface {#filerepository-interface}

**Target File:** `utils/data/repository/interfaces/FileRepository.ts`

**Analysis Reference:** [FileRepository-Analysis.md § identifyRelevantFiles()](../docs/FileRepository-Analysis.md#1-identifyrelevantfiles)

**Purpose:** Define file access operations

**Dependencies:**

- QueryContext interface

**Implementation Steps:**

1. Create the `FileRepository` interface with methods:

   - `getFilesByQuery()` - Retrieve files based on query
   - `getFileById()` - Get file by ID
   - `getFilesByIds()` - Get multiple files by IDs
   - `loadSegments()` - Load specific segments

2. Create the necessary type definitions:
   - `DataFile` - File structure with metadata
   - `FileMetadata` - File metadata type

**Status:** ✅ Completed

**Implementation Notes:**

- Full implementation completed with all methods
- Added additional type definitions for DataFile structure
- Used by QueryProcessor interface

### 1.3 QueryProcessor Interface {#queryprocessor-interface}

**Target File:** `utils/data/repository/interfaces/QueryProcessor.ts`

**Analysis Reference:** [QueryProcessor-Analysis.md § processQueryWithData()](../docs/QueryProcessor-Analysis.md#1-processquerywithdata)

**Purpose:** Define query processing operations

**Dependencies:**

- QueryContext interface
- FileRepository interface

**Implementation Steps:**

1. Create the `QueryProcessor` interface with methods:

   - `processQueryWithData()` - Process query with data files
   - `isComparisonQuery()` - Check if query is a comparison
   - `isStarterQuestion()` - Check if query is a starter
   - `extractSegmentsFromQuery()` - Extract segments from query

2. Create the necessary type definitions:
   - `ProcessedData` - Type for processed query results
   - `QueryType` - Enumeration of query types

**Status:** ✅ Completed

**Implementation Notes:**

- Complete with all required methods
- Added helper methods for query classification
- Includes comprehensive type definitions for processed data

### 1.4 FilterProcessor Interface {#filterprocessor-interface}

**Target File:** `utils/data/repository/interfaces/FilterProcessor.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)

**Purpose:** Define filter processing operations

**Dependencies:**

- QueryContext interface

**Implementation Steps:**

1. Create the `FilterProcessor` interface with methods:

   - `parseQueryIntent()` - Extract intent from query
   - `getFilteredData()` - Apply filters to dataset

2. Merge with SmartFiltering functionality for unified interface

**Status:** ✅ Completed

**Implementation Notes:**

- Successfully consolidated with SmartFiltering interface
- Updated imports across all dependent files
- All tests passing with consolidated interface

### 1.5 SegmentManager Interface {#segmentmanager-interface}

**Target File:** `utils/data/repository/interfaces/SegmentManager.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)

**Purpose:** Define segment management operations

**Dependencies:**

- FileRepository interface

**Implementation Steps:**

1. Create the `SegmentManager` interface with methods:
   - `extractSegmentsFromQuery()` - Parse query for segments
   - `loadSegmentsForFile()` - Load segments for a file
   - `trackSegmentUsage()` - Track segment usage metrics

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with core methods
- Extended to include cache interaction
- Used by both repository implementations

### 1.6 CacheManager Interface {#cachemanager-interface}

**Target File:** `utils/data/repository/interfaces/CacheManager.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)

**Purpose:** Define cache management operations

**Dependencies:**

- FileRepository interface

**Implementation Steps:**

1. Create the `CacheManager` interface with methods:
   - `cacheFile()` - Cache file data
   - `getCachedFile()` - Get file from cache
   - `invalidateCache()` - Invalidate cache entries

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with Vercel KV integration
- Added TTL management for cached entries
- Follows standards from [vercel-kv-standard](../../../.cursor/rules/vercel-kv-standard.mdc)

## Phase 2: Implementation Classes

### 2.1 SmartFiltering Implementation {#smartfiltering-implementation}

**Target File:** `utils/data/repository/implementations/SmartFilteringImpl.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Implementation Details](../docs/Consolidated-Analysis.md#filterprocessor-implementation)

**Purpose:** Implement smart filtering capabilities

**Dependencies:**

- FilterProcessor interface

**Implementation Steps:**

1. Implement `SmartFilteringImpl` class with methods:
   - `parseQueryIntent()` implementation
   - `getFilteredData()` implementation
   - Additional helper methods

**Status:** ✅ Completed

**Implementation Notes:**

- Successfully merged into FilterProcessorImpl
- Updated to work with QueryContext
- Added age detection to parseQueryIntent

### 2.2 FileRepositoryImpl Class {#filerepositoryimpl-class}

**Target File:** `utils/data/repository/implementations/FileSystemRepository.ts`

**Analysis Reference:** [FileRepository-Analysis.md § loadDataFiles()](../docs/FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles)

**Purpose:** Implement file repository operations

**Dependencies:**

- FileRepository interface
- QueryContext interface

**Implementation Steps:**

1. Implement the `FileSystemRepository` class with methods:
   - `getFilesByQuery()` implementation
   - `getFileById()` implementation
   - `getFilesByIds()` implementation
   - `loadSegments()` implementation

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with full test coverage
- Fixed to return empty arrays for empty queries
- Added compatibility with both CSV and JSON files

### 2.3 QueryProcessor Implementation {#queryprocessor-implementation}

**Target File:** `utils/data/repository/implementations/QueryProcessorImpl.ts`

**Analysis Reference:** [QueryProcessor-Analysis.md § isComparisonQuery()](../docs/QueryProcessor-Analysis.md#2-iscomparisonquery)

**Purpose:** Implement query processing operations

**Dependencies:**

- QueryProcessor interface
- FileRepository interface
- FilterProcessor interface

**Implementation Steps:**

1. Implement the `QueryProcessorImpl` class with methods:
   - `processQueryWithData()` implementation
   - `isComparisonQuery()` implementation
   - `isStarterQuestion()` implementation
   - `extractSegmentsFromQuery()` implementation

**Status:** ✅ Completed

**Implementation Notes:**

- Successfully integrated with SmartFiltering
- Added comprehensive test coverage
- Fixed integration with FilterProcessor interface

## Phase 3: Adapter Implementation

### 3.1 Retrieval Adapter {#retrieval-adapter}

**Target File:** `utils/data/repository/adapters/RetrievalAdapter.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Adapter Implementation](../docs/Consolidated-Analysis.md#3-adapter-implementation)

**Purpose:** Create adapter for retrieval.js methods

**Dependencies:**

- FileRepository implementation
- QueryProcessor implementation

**Implementation Steps:**

1. Create adapter methods matching retrieval functions:
   - `identifyRelevantFiles()` adapter
   - `retrieveDataFiles()` adapter
   - `loadCSVContent()` adapter
   - Additional utility methods

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with thread context handling
- Added feature flag integration for rollout control
- Comprehensive test coverage for all adapter methods

### 3.2 Service Adapter {#service-adapter}

**Target File:** `utils/data/repository/adapters/ServiceAdapter.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Adapter Implementation](../docs/Consolidated-Analysis.md#3-adapter-implementation)

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

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with thread context compatibility
- Added feature flag integration for rollout control
- Comprehensive test suite validates service compatibility

## Phase 4: Circular Dependency Resolution

### 4.1 Core Query Processing Function {#core-query-processing-function}

**Target File:** `utils/openai/queryProcessing.ts`

**Analysis Reference:** [Consolidated-Analysis.md § Circular Dependency](../docs/Consolidated-Analysis.md#circular-dependency-resolution)

**Purpose:** Extract shared logic to break circular dependency

**Dependencies:**

- Understanding of both original implementations

**Implementation Steps:**

1. Extract core processing logic into a standalone function:

   - `processQueryDataCore()` - Core query processing
   - Parameter standardization
   - Clear return type definition

2. Update original implementations to use this core function

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with adapter integration
- Added feature flags for gradual rollout
- Comprehensive regression testing passed

### 4.2 Dependency Resolution Testing {#dependency-resolution-testing}

**Target File:** `utils/data/tests/dependency-resolution.test.js`

**Analysis Reference:** [Consolidated-Analysis.md § Risk Analysis](../docs/Consolidated-Analysis.md#risk-analysis)

**Purpose:** Verify the circular dependency is resolved

**Dependencies:**

- Core query processing function implementation

**Implementation Steps:**

1. Create tests that verify:
   - No import cycles exist
   - Both services can operate independently
   - Functionality is preserved in both implementations

**Status:** ✅ Completed

**Implementation Notes:**

- Implemented with Vitest testing framework
- TypeScript compatibility issues resolved
- Confirmed no circular dependencies exist

## Phase 5: Service Migration

### 5.1 Retrieval.js Migration {#retrievaljs-migration}

**Target File:** `utils/openai/retrieval.js`

**Analysis Reference:** [Consolidated-Analysis.md § Service Migration](../docs/Consolidated-Analysis.md#7-service-migration)

**Purpose:** Migrate retrieval.js to use repository pattern

**Dependencies:**

- All adapters implemented and tested

**Implementation Steps:**

1. Update imports to use adapters
2. Add feature flags for gradual rollout
3. Maintain backward compatibility for APIs
4. Add deprecation notices for direct usage

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with feature flags
- Comprehensive logging during transition
- Shadow testing confirmed no regression issues

### 5.2 DataRetrievalService.js Migration {#dataretrievalservicejs-migration}

**Target File:** `app/api/services/dataRetrievalService.js`

**Analysis Reference:** [Consolidated-Analysis.md § Service Migration](../docs/Consolidated-Analysis.md#7-service-migration)

**Purpose:** Migrate dataRetrievalService.js to use repository pattern

**Dependencies:**

- All adapters implemented and tested

**Implementation Steps:**

1. Update imports to use service adapters
2. Add feature flags for gradual rollout
3. Ensure thread context and compatibility handling
4. Add deprecation notices for direct usage

**Status:** ✅ Completed

**Implementation Notes:**

- Implementation complete with feature flags
- Comprehensive thread context handling
- Production monitoring confirms stable performance

## Implementation Checklist

| Phase | Task                              | Status       | Dependencies  | Analysis Reference                                                                                                    |
| ----- | --------------------------------- | ------------ | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1.1   | QueryContext Interface            | ✅ Completed | None          | [QueryContext-Analysis.md § Context Object Analysis](../docs/QueryContext-Analysis.md#context-object-analysis)        |
| 1.2   | FileRepository Interface          | ✅ Completed | 1.1           | [FileRepository-Analysis.md § identifyRelevantFiles()](../docs/FileRepository-Analysis.md#1-identifyrelevantfiles)    |
| 1.3   | QueryProcessor Interface          | ✅ Completed | 1.1, 1.2      | [QueryProcessor-Analysis.md § processQueryWithData()](../docs/QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 1.4   | FilterProcessor Interface         | ✅ Completed | 1.1           | [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)              |
| 1.5   | SegmentManager Interface          | ✅ Completed | 1.2           | [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)              |
| 1.6   | CacheManager Interface            | ✅ Completed | 1.2           | [Consolidated-Analysis.md § Dependency Analysis](../docs/Consolidated-Analysis.md#dependencies-analysis)              |
| 2.1   | SmartFiltering Implementation     | ✅ Completed | 1.4           | [Consolidated-Analysis.md § Implementation Details](../docs/Consolidated-Analysis.md#filterprocessor-implementation)  |
| 2.2   | FileRepositoryImpl Class          | ✅ Completed | 1.2           | [FileRepository-Analysis.md § loadDataFiles()](../docs/FileRepository-Analysis.md#2-loaddatafiles--retrievedatafiles) |
| 2.3   | QueryProcessor Implementation     | ✅ Completed | 1.3, 2.1, 2.2 | [QueryProcessor-Analysis.md § processQueryWithData()](../docs/QueryProcessor-Analysis.md#1-processquerywithdata)      |
| 3.1   | Retrieval Adapter                 | ✅ Completed | 2.2, 2.3      | [Consolidated-Analysis.md § Adapter Implementation](../docs/Consolidated-Analysis.md#3-adapter-implementation)        |
| 3.2   | Service Adapter                   | ✅ Completed | 2.2, 2.3      | [Consolidated-Analysis.md § Adapter Implementation](../docs/Consolidated-Analysis.md#3-adapter-implementation)        |
| 4.1   | Core Query Processing Function    | ✅ Completed | 3.1, 3.2      | [Consolidated-Analysis.md § Circular Dependency](../docs/Consolidated-Analysis.md#circular-dependency-resolution)     |
| 4.2   | Dependency Resolution Testing     | ✅ Completed | 4.1           | [Consolidated-Analysis.md § Risk Analysis](../docs/Consolidated-Analysis.md#risk-analysis)                            |
| 5.1   | Retrieval.js Migration            | ✅ Completed | 3.1, 4.1      | [Consolidated-Analysis.md § Service Migration](../docs/Consolidated-Analysis.md#7-service-migration)                  |
| 5.2   | DataRetrievalService.js Migration | ✅ Completed | 3.2, 4.1      | [Consolidated-Analysis.md § Service Migration](../docs/Consolidated-Analysis.md#7-service-migration)                  |

## Outstanding Issues and Technical Debt

1. ~~**Testing Infrastructure**: Need to resolve TypeScript module compatibility issues affecting test creation~~ ✅ Resolved - see [Testing-Implementation-Plan.md](./Testing-Implementation-Plan.md)
2. ~~**Documentation**: Need to add comprehensive API documentation for all interfaces and implementations~~ ✅ Completed
3. ~~**Integration Testing**: Need end-to-end integration tests before phase 5 migrations~~ ✅ Completed
4. **Performance Monitoring**: Long-term monitoring dashboard needed for ongoing performance analysis - See [rollout-plan.md](./rollout-plan.md) for implementation

## Risk Analysis and Mitigation

| Risk Area         | Specific Risk                                | Mitigation Strategy                               | Status                                     |
| ----------------- | -------------------------------------------- | ------------------------------------------------- | ------------------------------------------ |
| **Compatibility** | Breaking changes in function signatures      | Comprehensive adapter testing with shadow testing | ✅ Mitigated through adapter testing       |
| **Performance**   | Slower operation with additional abstraction | Performance benchmarking at each stage            | ✅ Performance matches or exceeds original |
| **Functionality** | Loss of thread context handling              | Careful preservation of thread state              | ✅ Addressed in QueryContext interface     |
| **Circular Deps** | Breaking the dependency chain causes errors  | Implement adapters first, then gradually migrate  | ✅ Resolved with core function approach    |
| **Adoption**      | Resistance to new pattern                    | Gradual adoption with feature flags               | ✅ Successfully deployed with flags        |
| **Testing**       | Missing edge cases                           | Shadow testing with real-world queries            | ✅ Comprehensive testing complete          |

## Success Criteria

1. ✅ No functional regression in data retrieval capabilities
2. ✅ Simplified codebase with eliminated redundancies
3. ✅ Improved test coverage for data retrieval operations
4. ✅ No circular dependencies between services and utilities
5. ✅ Consistent error handling across all data operations
6. ✅ Performance equivalent to or better than the original implementation
7. ✅ Comprehensive documentation of the repository pattern

## Next Steps

1. ~~Resolve TypeScript testing infrastructure issues~~ ✅ Completed
2. ~~Implement adapter layer for both services~~ ✅ Completed
3. ~~Create validation tests with real-world queries~~ ✅ Completed
4. ~~Implement core query processing function~~ ✅ Completed
5. ~~Begin gradual migration of both services~~ ✅ Completed
6. **Monitor production performance**: Continue monitoring and optimizing performance in production - See [rollout-plan.md](./rollout-plan.md) for details

_Last updated: Sat May 3 2025_
