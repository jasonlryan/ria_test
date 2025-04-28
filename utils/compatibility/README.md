# Compatibility Module

## Overview

The compatibility module provides functionality for assessing and enforcing data compatibility rules in the RIA25 application. This is particularly important for cross-year data comparisons, where methodological changes may impact the validity of direct comparisons.

## Directory Structure

```
utils/compatibility/
├── compatibility.ts       # Main TypeScript implementation for compatibility assessment
├── compatibility.js       # JavaScript implementation (legacy, prefer .ts version)
├── compatibilityUtils.js  # Utility functions for compatibility operations
├── compatibilityLogger.js # Specialized logging functions for compatibility
├── compatibilityTypes.js  # Type definitions for compatibility metadata
└── README.md             # This documentation file
```

## Core Functionality

- **Data Compatibility Detection**: Determine if datasets from different years can be directly compared
- **Compatibility Metadata**: Track compatibility information at topic and segment levels
- **Filtering**: Filter out incomparable data when necessary
- **User Messaging**: Provide clear, user-friendly messages about compatibility limitations

## Type Definitions

The `compatibilityTypes.js` file defines the structure of compatibility metadata:

- `CompatibilityMetadata`: Top-level metadata about compatibility assessment
- `TopicCompatibility`: Topic-specific compatibility information
- `SegmentCompatibility`: Segment-specific compatibility information
- `CompatibilityError`: Error information for compatibility assessment failures

## Key Functions

### From `compatibility.ts` (Preferred):

- `loadCompatibilityMapping()`: Load compatibility mapping from disk
- `getFileCompatibility()`: Check if a specific file is comparable
- `getTopicCompatibility()`: Check if a specific topic is comparable
- `areFilesComparable()`: Check if multiple files are compatible with each other
- `filterIncomparableFiles()`: Filter out incomparable files for comparison queries

### Logging (compatibilityLogger.js):

- `logCompatibilityAssessment()`: Log compatibility assessment results
- `logCompatibilityInPrompt()`: Log when compatibility information is included in prompts
- `logCompatibilityToFile()`: Log detailed compatibility information to a file

## Migration Notes

This directory structure is part of the system reorganization completed in April 2025. Adapter files at the original locations maintain backward compatibility but will emit deprecation warnings:

- `utils/compatibility.ts` → `utils/compatibility/compatibility.ts`
- `utils/shared/compatibilityUtils.js` → `utils/compatibility/compatibilityUtils.js`
- `utils/shared/compatibility.js` → `utils/compatibility/compatibility.js`
- `utils/shared/compatibilityLogger.js` → `utils/compatibility/compatibilityLogger.js`
- `utils/data/compatibilityTypes.js` → `utils/compatibility/compatibilityTypes.js`

New code should import directly from this directory structure.
