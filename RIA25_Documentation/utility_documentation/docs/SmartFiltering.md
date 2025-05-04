# Smart Filtering Implementation

**Last Updated:** Sun May 4 13:40:21 BST 2025

## Overview

Smart Filtering provides capabilities for analyzing query intent and filtering data by segments based on user queries. The implementation follows the repository pattern and is fully integrated with the existing codebase through TypeScript interfaces.

## Key Components

### 1. Interfaces

The following interfaces define the Smart Filtering contract:

- **QueryIntent**: Represents the intent extracted from a user query

  - Topics, demographics, years, and specificity
  - Used for determining what data is relevant

- **DataScope**: Defines the scope of data to retrieve

  - Sets of topics, demographics, years, and file IDs
  - Used for efficient data retrieval

- **FilterResult**: Contains the results of filtering operations

  - Filtered data items, statistics, and segment information
  - Tracks both found and missing segments

- **FilterProcessor**: The main interface that defines filtering operations
  - `filterDataBySegments()`: Core filtering method
  - `parseQueryIntent()`: Extracts intent from queries
  - `getBaseData()`: Returns essential data for general queries

### 2. Implementation

The `SmartFilteringProcessor` class implements the `FilterProcessor` interface and provides:

- Segment detection and tracking
- Query intent parsing
- Multi-dimensional data filtering
- Comprehensive segment tracking (found and missing)

## Usage Examples

### Basic Usage

```typescript
import { SmartFilteringProcessor } from "utils/data/repository/implementations";
import { createBasicContext } from "utils/data/repository/interfaces";

// Create a processor instance
const filterProcessor = new SmartFilteringProcessor();

// Create a query context
const context = createBasicContext(
  "What do employees in the UK think about AI?"
);
context.segments = ["country", "age", "gender"];

// Parse query intent
const contextWithIntent = filterProcessor.parseQueryIntent(
  context.query,
  context
);

// Filter data by segments
const filterResult = filterProcessor.filterDataBySegments(
  dataFiles,
  contextWithIntent
);

// Use the filtered data
console.log(`Found ${filterResult.filteredData.length} data items`);
console.log(`Found segments: ${filterResult.foundSegments.join(", ")}`);
console.log(`Missing segments: ${filterResult.missingSegments.join(", ")}`);
```

### Integration with Repository Pattern

```typescript
import { QueryProcessorImpl } from "utils/data/repository/implementations";
import { SmartFilteringProcessor } from "utils/data/repository/implementations";
import { createThreadContext } from "utils/data/repository/interfaces";

// Create processor instances
const queryProcessor = new QueryProcessorImpl();
const filterProcessor = new SmartFilteringProcessor();

// Set up dependencies
queryProcessor.setFilterProcessor(filterProcessor);

// Process a query
const context = createThreadContext(
  "What is the average response on AI by age group?",
  "thread-123"
);
const result = await queryProcessor.processQuery(context);

// Access filtered data
const ageData = result.processedData.filteredData.filter(
  (item) => item.category === "age"
);
```

## Data Structure

Filtered data items follow this structure:

```typescript
{
  fileId: string; // Unique file identifier
  question: string; // Question text from the file
  response: string; // Response text from the file
  segment: string; // Full segment path (e.g., "region:united_kingdom")
  category: string; // Segment category (e.g., "region")
  value: string; // Segment value (e.g., "united_kingdom")
  stat: number; // Raw statistical value (0-1)
  percentage: number; // Percentage value (0-100)
  formatted: string; // Formatted percentage (e.g., "75%")
}
```

## Segment Mapping

The following segment mappings are supported:

- `country` → `region`
- `generation` → `age`

Standard canonical segments include:

- `overall`
- `region`
- `age`
- `gender`
- `org_size`
- `sector`
- `job_level`
- `relationship_status`
- `education`
- `generation`
- `employment_status`

## Edge Cases and Error Handling

The implementation provides robust error handling for:

- Missing or malformed data files
- Segments not present in the data
- Inconsistent data structures

## Future Enhancements

Planned enhancements include:

- Enhanced query intent classification using ML/NLP
- Additional segment types and mappings
- Performance optimizations for large datasets
- Improved caching of filtered results

_Last updated: Sun May 4 13:40:21 BST 2025_
