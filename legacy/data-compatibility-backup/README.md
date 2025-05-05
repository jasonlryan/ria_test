# Compatibility Data Files

**Last Updated:** Sat May 25 2025

## Overview

This directory contains the compatibility configuration files for the RIA25 application. These files define rules for comparing data across years and topics, ensuring that users don't make invalid comparisons between incomparable datasets.

## Files

- **unified_compatibility.json** (v2.0) - Current source of truth for compatibility rules
- **compatibility_mapping.json** (v1.0) - Legacy compatibility mapping (maintained for backward compatibility)

## Source Files

These files were consolidated from the original:

- **file_compatibility.json** - Original source file (located at `scripts/reference files/file_compatibility.json`)
  - Contains detailed mappings for all data files (2024_1, 2025_1, etc.)
  - Defines compatibility status, topic associations, and user messages
  - Used by the original compatibility utilities

## Purpose

These compatibility files serve three essential functions:

1. **Prevent Invalid Comparisons**: Block attempts to compare data collected with different methodologies across years
2. **Provide User Messages**: Supply informative explanations when users attempt invalid comparisons
3. **Filter Query Results**: Automatically exclude incompatible files from query results when cross-year comparisons are attempted

## File Structure

### unified_compatibility.json

```json
{
  "version": "2.0",
  "lastUpdated": "2025-04-25",
  "metadata": {
    "description": "Unified compatibility mapping",
    "generatedFrom": ["file_compatibility.json", "compatibility_mapping.json"]
  },
  "files": {
    "file_id": {
      "fileId": "file_id",
      "topicId": "topic_id",
      "year": 2025,
      "comparable": true|false,
      "reason": "Explanation for incomparability",
      "userMessage": "User-friendly explanation"
    }
    // Additional files...
  },
  "topics": {
    "topic_id": {
      "topicId": "topic_id",
      "parentTheme": "Theme name",
      "comparable": true|false,
      "userMessage": "User-friendly explanation",
      "canonicalQuestion": "What question does this topic answer?",
      "years": [2024, 2025]
    }
    // Additional topics...
  },
  "compatibleTopics": ["topic1", "topic2"],
  "nonComparableTopics": ["topic3", "topic4"]
}
```

## File Relationships and Evolution

The compatibility system has evolved through several stages:

1. **Original Implementation** (`file_compatibility.json` in scripts/reference files/):

   - Comprehensive mapping with ~120 file entries
   - Used directly by `utils/openai/retrieval.js`
   - Structure focused on fileCompatibility, compatibleTopics, and nonComparableTopics

2. **Intermediate Version** (`compatibility_mapping.json` in data/compatibility/):

   - Simplified structure with focus on files and topics
   - Used by `compatibilityUtils.js` (now deprecated)

3. **Current Version** (`unified_compatibility.json` in data/compatibility/):
   - Consolidated format that merges both previous sources
   - Enhanced with additional metadata
   - Used by the TypeScript-based `compatibility.ts` utility

## Usage in Code

The compatibility data is accessed through the TypeScript utility in `utils/compatibility/compatibility.ts`, which provides functions for:

- Loading and caching the compatibility mapping
- Checking if files and topics are comparable
- Filtering incompatible files from query results
- Providing user-friendly messages about compatibility issues

Example usage:

```typescript
import {
  getFileCompatibility,
  areFilesComparable,
} from "../utils/compatibility/compatibility";

// Check if a file is comparable
const compatibility = getFileCompatibility("talent_attraction_2025");
if (!compatibility.comparable) {
  console.log(compatibility.userMessage);
}

// Check if multiple files can be compared
const canCompare = areFilesComparable(["file1", "file2"]);
```

## Migration History

These files were migrated as part of the compatibility system reorganization:

1. **Original Location**: `scripts/reference files/file_compatibility.json`
2. **Intermediate**: `data/compatibility/compatibility_mapping.json`
3. **Current Location**: `data/compatibility/unified_compatibility.json`

This separation follows the principle of keeping configuration data separate from the code that uses it.

## Maintenance

When updating compatibility rules:

1. Update the `lastUpdated` timestamp
2. Increment the version number for significant changes
3. Ensure all required fields are present for new entries
4. Run `npm run test:compatibility` to verify changes
5. Document any structural changes in this README

## Related Files

- `utils/compatibility/compatibility.ts` - Main utility for accessing compatibility data
- `utils/compatibility/compatibilityUtils.js` - Legacy utility (deprecated)
- `scripts/tests/compatibility_smoke_test.js` - Tests for compatibility system
- `scripts/reference files/file_compatibility.json` - Original compatibility file

_Last updated: Sat May 25 2025_
