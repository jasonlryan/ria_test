# Compatibility System Refactoring Plan

> **Last Updated:** Fri Apr 25 2025  
> **Author:** Claude/RIA25 Team  
> **Status:** Draft

## Overview

This document outlines the plan to refactor the current dual-track compatibility system into a unified solution that addresses identified efficiency issues. The goal is to simplify maintenance, reduce duplication, prevent potential data inconsistencies, and streamline the API.

## Current Problems

1. **Dual Sources of Truth**:

   - `utils/shared/compatibilityUtils.js` (CommonJS) - topic-level compatibility using `data/compatibility/compatibility_mapping.json`
   - `utils/shared/compatibility.js` (ES Module) - file-level compatibility using `scripts/reference files/file_compatibility.json`

2. **Implementation Gaps**:

   - Missing service methods lead to potential runtime errors
   - Inconsistent error handling between modules

3. **Technical Debt**:

   - Mixed module systems (CommonJS and ES modules)
   - Two different caching strategies
   - Duplicated memory usage
   - Potential for divergent compatibility answers

4. **Architecture Inefficiency**:
   - Scattered responsibility between retrieval and API layers
   - Multiple import paths for related functionality

## Implementation Plan

### Phase 1: Immediate Fixes (Already Completed)

1. ✅ Implement missing `filterIncomparableFiles()` method in `compatibilityService.js`
2. ✅ Add missing API methods for `getCompatibleTopics()` and `getNonComparableTopics()`
3. ✅ Update timestamp in affected files

### Phase 2: Data Unification

1. Create a unified compatibility schema supporting both file-level and topic-level compatibility
2. Merge data from:
   - `scripts/reference files/file_compatibility.json`
   - `data/compatibility/compatibility_mapping.json`
3. Place the new consolidated file at `data/compatibility/unified_compatibility.json`
4. Include version information for cache invalidation

Schema for the unified file:

```json
{
  "version": "2.0",
  "lastUpdated": "2025-04-25",
  "files": {
    "fileId1": {
      "fileId": "fileId1",
      "topicId": "topic1",
      "year": 2024,
      "comparable": false,
      "reason": "Explanation of incomparability",
      "userMessage": "User-facing message about incomparability"
    }
  },
  "topics": {
    "topic1": {
      "topicId": "topic1",
      "parentTheme": "theme1",
      "comparable": false,
      "userMessage": "User-facing message about topic incomparability",
      "canonicalQuestion": "What is the question?",
      "years": [2024, 2025]
    }
  },
  "compatibleTopics": ["topic2", "topic3"],
  "nonComparableTopics": ["topic1", "topic4"]
}
```

### Phase 3: Create Unified Compatibility Module

Create a new TypeScript-based module at `utils/compatibility.ts` that:

1. Uses a single caching mechanism with TTL
2. Provides a comprehensive, type-safe API
3. Handles both file and topic level compatibility
4. Includes detailed logging and error handling

```typescript
// Sample implementation outline
import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import logger from "../logger";

// Types
export interface CompatibilityFile {
  fileId: string;
  topicId: string;
  year: number;
  comparable: boolean;
  reason?: string;
  userMessage?: string;
}

export interface CompatibilityTopic {
  topicId: string;
  parentTheme: string;
  comparable: boolean;
  userMessage?: string;
  canonicalQuestion?: string;
  years: number[];
}

export interface CompatibilityMapping {
  version: string;
  lastUpdated: string;
  files: Record<string, CompatibilityFile>;
  topics: Record<string, CompatibilityTopic>;
  compatibleTopics: string[];
  nonComparableTopics: string[];
}

// Constants
const MAPPING_PATH = path.join(
  process.cwd(),
  "data",
  "compatibility",
  "unified_compatibility.json"
);
const CACHE_KEY = "cache:compatibility:mapping";
const CACHE_TTL = 60 * 60; // 1 hour in seconds

// Loading and caching functions
export async function getCompatibilityMapping(
  forceRefresh = false
): Promise<CompatibilityMapping> {
  // Implementation details...
}

// File compatibility functions
export async function isFileComparable(fileId: string): Promise<boolean> {
  // Implementation details...
}

// Topic compatibility functions
export async function isTopicComparable(topicId: string): Promise<boolean> {
  // Implementation details...
}

// Filter functions
export async function filterIncomparableFiles(
  fileIds: string[],
  isComparisonQuery: boolean
): Promise<{
  filteredFileIds: string[];
  incomparableTopicMessages: Record<string, string>;
}> {
  // Implementation details...
}

// Other helper functions...
```

### Phase 4: Service Layer Adaptation

1. Update `compatibilityService.js` to use the new unified module
2. Ensure backward compatibility for existing API endpoints
3. Add proper error handling and logging

### Phase 5: Retrieval Layer Integration

1. Update imports in `utils/openai/retrieval.js` to use the new unified module
2. Ensure thread context contains consistent compatibility information

### Phase 6: Testing and Validation

1. Create comprehensive tests for both API and retrieval paths
2. Validate all compatibility edge cases
3. Test performance and memory usage

### Phase 7: Deprecation and Cleanup

1. Add deprecation notices to old compatibility modules
2. Remove old modules after all dependencies are migrated
3. Update documentation to reflect the new unified architecture

## Timeline

| Phase   | Timeframe | Dependencies |
| ------- | --------- | ------------ |
| Phase 1 | Completed | None         |
| Phase 2 | 2 days    | None         |
| Phase 3 | 3 days    | Phase 2      |
| Phase 4 | 2 days    | Phase 3      |
| Phase 5 | 1 day     | Phase 3      |
| Phase 6 | 2 days    | Phases 4, 5  |
| Phase 7 | 1 day     | Phase 6      |

## Risks and Mitigations

| Risk                             | Impact | Mitigation                                      |
| -------------------------------- | ------ | ----------------------------------------------- |
| Data loss during merge           | High   | Create backups of original files before merging |
| API incompatibility              | Medium | Thorough testing and graceful fallbacks         |
| Performance regression           | Medium | Benchmark before and after changes              |
| Concurrent development conflicts | Low    | Coordinate with team on timeline                |

## Success Criteria

1. Single source of truth for compatibility data
2. Reduced memory footprint
3. Consistent behavior across API and retrieval layers
4. All tests passing
5. No runtime errors in compatibility checks
6. Improved maintainability scores
7. Simplified codebase for future updates

## Conclusion

This refactoring will consolidate two separate compatibility systems into a unified, efficient solution. It will reduce technical debt, eliminate potential inconsistencies, and provide a more robust foundation for future enhancements to the compatibility system.
