# Data Repository System

**Last Updated:** Sat May 31 09:50:53 UTC 2025

## Overview

This directory contains the implementation of the Repository Pattern for data retrieval operations in RIA25. It addresses the consolidation of duplicated data retrieval functionality across the codebase, particularly between `utils/openai/retrieval.js` and `app/api/services/dataRetrievalService.js`.

## Directory Structure

```
/utils/data/repository/
  ├── interfaces/           # TypeScript interfaces
  │   ├── index.ts          # Export all interfaces
  │   ├── FileRepository.ts # Core repository interface
  │   ├── QueryContext.ts   # Interface for query context
  │   ├── QueryProcessor.ts # Interface for query processing
  │   └── FilterProcessor.ts # Interface for data filtering
  │
  ├── implementations/      # Concrete implementations
  │   ├── index.ts          # Export implementations
  │   ├── FileSystemRepository.ts  # File system implementation
  │   ├── QueryProcessorImpl.ts    # Query processor implementation
  │   └── SmartFiltering.ts        # Smart filtering implementation
  │
  ├── adapters/             # Backward compatibility adapters
  │   ├── index.ts          # Export adapters
  │   ├── retrieval-adapter.ts     # Adapter for retrieval.js
  │   └── service-adapter.ts       # Adapter for dataRetrievalService.js
  │
  ├── analysis/             # Code analysis documents
  │   ├── README.md         # Analysis documentation overview
  │   ├── Consolidated-Analysis.md # Complete analysis overview
  │   ├── FileRepository-Analysis.md # File operations analysis
  │   ├── QueryProcessor-Analysis.md # Query processing analysis
  │   ├── QueryContext-Analysis.md   # Context structure analysis
  │   └── Smart-Filtering-Integration-Plan.md # Filtering integration plan
  │
  ├── IMPLEMENTATION_PLAN.md # Detailed implementation plan
  └── index.ts              # Main exports and documentation
```

## Core Interfaces

The system is built around four primary interfaces:

1. **FileRepository**: Core interface for file identification and data loading operations
2. **QueryProcessor**: Interface for processing queries with retrieved data
3. **QueryContext**: Structure for query context and metadata
4. **FilterProcessor**: Interface for segment-based data filtering and query intent parsing

## Implementation Approach

This implementation follows the Repository Pattern to provide a clean abstraction over data access operations. The pattern allows for:

- Separation of data access logic from business logic
- Centralized data access code
- Simplified testing through mocking
- Consistency across the application

### Smart Filtering

The smart filtering functionality provides segment-based filtering of data by attributes like:

- Demographics (region, gender, age, job_level)
- Time periods
- Custom categories

This implementation consolidates filtering logic from the original `utils/data/smart_filtering.js` module into the repository pattern, with proper TypeScript interfaces and consistent usage across the codebase.

## Functions Being Consolidated

| Original Function                              | Location(s)                                 | Purpose                                    |
| ---------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| `identifyRelevantFiles()`                      | retrieval.js, dataRetrievalService.js       | Identifies relevant data files for a query |
| `loadDataFiles()` / `retrieveDataFiles()`      | retrieval.js, dataRetrievalService.js       | Loads data from files                      |
| `processQueryWithData()`                       | retrieval.js, dataRetrievalService.js       | Processes queries using retrieved data     |
| `assessCompatibility()`                        | compatibility.ts, dataRetrievalService.js   | Assesses data compatibility                |
| `getSpecificData()` / `filterDataBySegments()` | smart_filtering.js, dataRetrievalService.js | Filters data by segments                   |

## Code Analysis

Detailed code analysis has been performed for each function being consolidated. See the [analysis directory](./analysis) for comprehensive documentation on:

- Function signature comparison
- Core logic analysis
- Parameter usage patterns
- Return structure comparison
- Dependency mapping
- Consolidation strategies

This analysis informs the implementation approach and ensures no functionality is lost during consolidation.

## Usage Examples

```typescript
// Example usage in a service
import { FileRepository, QueryProcessor } from "../../../utils/data/repository";
import {
  fileSystemRepository,
  queryProcessor,
} from "../../../utils/data/repository/implementations";

// Use the repository to get files
const files = await fileSystemRepository.getFilesByQuery(query, context);

// Process a query with filtering by segments
const context = {
  query: "Show data by job level",
  segmentTracking: {
    requestedSegments: ["job_level"],
    loadedSegments: {},
    currentSegments: [],
    missingSegments: {},
  },
};

const result = await queryProcessor.processQueryWithData(context);
```

## Related Documentation

- See `RIA25_Documentation/active_plans/MASTER_IMPLEMENTATION_PLAN.md` for the overall implementation roadmap
- See `utils/compatibility/README.md` for compatibility system documentation
- See `utils/cache/README.md` for cache system documentation
- See `utils/data/repository/analysis/Smart-Filtering-Integration-Plan.md` for filtering details

_Last updated: Sat May 31 09:50:53 UTC 2025_
