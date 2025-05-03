# FileRepository Interface Analysis

**Last Updated:** Tue Apr 29 2025

<!--
LLM-GUIDANCE
This document provides detailed analysis of the FileRepository interface requirements.
When implementing the FileRepository interface:
1. Create a comprehensive TypeScript interface that includes ALL methods mentioned in this analysis
2. Follow the implementation order in IMPLEMENTATION_PLAN.md
3. Implement concrete classes that satisfy this interface
4. Ensure compatibility with the QueryContext model

This component should be implemented after QueryContext but before QueryProcessor.
-->

This document analyzes the requirements for a unified FileRepository interface to manage file identification and data loading.

## Related Documents

- [IMPLEMENTATION_PLAN.md § 1.2](./IMPLEMENTATION_PLAN.md#filerepository-interface) - Implementation plan for FileRepository
- [Consolidated-Analysis.md](./Consolidated-Analysis.md) - Overall consolidation strategy
- [QueryContext-Analysis.md](./QueryContext-Analysis.md) - Context model used by FileRepository
- [QueryProcessor-Analysis.md](./QueryProcessor-Analysis.md) - Uses FileRepository for data processing

## File Management Functions Analysis {#file-management-functions-analysis}

### File Identification in retrieval.js {#file-identification-retrieval}

File identification in `retrieval.js` uses pattern matching and metadata assessment:

```javascript
// Function to identify relevant files
async function identifyRelevantFiles(query, options = {}) {
  // Pattern detection
  const patterns = extractPatterns(query);

  // File scanning from filesystem
  const files = await getAvailableFiles();

  // Matching based on patterns
  const relevantFiles = files.filter((file) => {
    return patterns.some((pattern) => fileMatchesPattern(file, pattern));
  });

  return relevantFiles;
}
```

### File Management in dataRetrievalService.js {#file-management-dataretrieval}

File management in the service includes caching and compatibility checks:

```javascript
// Service-level file management
async function getRelevantFiles(query, options) {
  // Check thread cache first
  if (options.threadId && options.useCache) {
    const cachedFiles = await getCachedFilesForThread(options.threadId);
    if (cachedFiles.length > 0) {
      return cachedFiles;
    }
  }

  // Fall back to identification
  const files = await identifyRelevantFiles(query, options);

  // Cache the result if needed
  if (options.threadId && options.useCache) {
    await cacheFilesForThread(options.threadId, files);
  }

  return files;
}
```

## Data Loading Functions Analysis {#data-loading-functions-analysis}

### Data Loading in retrieval.js {#data-loading-retrieval}

Data loading in `retrieval.js` handles file reading and basic processing:

```javascript
// Function to load file data
async function loadFileData(fileIds) {
  const fileData = [];

  for (const fileId of fileIds) {
    const data = await readJsonFile(fileId);
    fileData.push({
      fileId,
      content: data,
    });
  }

  return fileData;
}
```

### Data Loading in dataRetrievalService.js {#data-loading-dataretrieval}

Data loading in the service includes segment filtering and metadata extraction:

```javascript
// Service-level data loading with segments
async function loadFileDataWithSegments(fileIds, segments) {
  const fileData = [];

  for (const fileId of fileIds) {
    // Load full file
    const fullData = await readJsonFile(fileId);

    // Extract metadata
    const metadata = extractMetadata(fullData);

    // Filter by segments if specified
    const filteredData = segments
      ? filterDataBySegments(fullData, segments)
      : fullData;

    fileData.push({
      fileId,
      metadata,
      content: filteredData,
    });
  }

  return fileData;
}
```

## Segment Management Analysis {#segment-management-analysis}

The service has specialized segment handling not found in `retrieval.js`:

```javascript
// Segment management functions
function getAvailableSegments(fileData) {
  // Extract all available segments from files
  const segments = new Set();

  for (const file of fileData) {
    const fileSegments = extractSegmentsFromFile(file);
    fileSegments.forEach((segment) => segments.add(segment));
  }

  return Array.from(segments);
}

function filterDataBySegments(data, segments) {
  // Keep only requested segments
  if (!segments || segments.length === 0) {
    return data;
  }

  return filterObjectBySegments(data, segments);
}

function filterObjectBySegments(obj, segments) {
  // Implementation details...
}
```

## Repository Interface Requirements {#repository-interface-requirements}

The FileRepository interface must handle:

1. File Identification

   - Finding relevant files for a query
   - Supporting cached file lists
   - Handling pattern-based matching

2. Data Loading

   - Loading content from files
   - Supporting segment filtering
   - Extracting and providing metadata

3. Segment Management

   - Identifying available segments
   - Filtering data by segments
   - Tracking loaded segments

4. Thread State Management
   - Caching file associations
   - Persisting file selections
   - Loading prior file associations

## Consolidated Interface Design {#consolidated-interface-design}

Proposed interface structure:

```typescript
/**
 * Repository for managing data files and their contents
 */
interface FileRepository {
  /**
   * Find files relevant to the given query
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Array of file identifiers
   */
  identifyRelevantFiles(
    query: string,
    context: QueryContext
  ): Promise<string[]>;

  /**
   * Load data from the specified files
   *
   * @param fileIds Array of file identifiers to load
   * @param segments Optional segments to filter by
   * @param context QueryContext with processing context
   * @returns Array of file data objects
   */
  loadFileData(
    fileIds: string[],
    segments?: string[],
    context?: QueryContext
  ): Promise<FileData[]>;

  /**
   * Get all available segments across the given files
   *
   * @param fileIds Array of file identifiers to check
   * @returns Array of segment identifiers
   */
  getAvailableSegments(fileIds: string[]): Promise<string[]>;

  /**
   * Cache file associations for a thread
   *
   * @param threadId Thread identifier
   * @param fileIds File identifiers to cache
   * @returns Success indicator
   */
  cacheFilesForThread(threadId: string, fileIds: string[]): Promise<boolean>;

  /**
   * Get cached file associations for a thread
   *
   * @param threadId Thread identifier
   * @returns Array of cached file identifiers
   */
  getCachedFilesForThread(threadId: string): Promise<string[]>;
}

/**
 * File data structure returned by repository
 */
interface FileData {
  fileId: string;
  metadata: FileMetadata;
  content: any;
}

/**
 * File metadata structure
 */
interface FileMetadata {
  title?: string;
  description?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  segments?: string[];
  years?: string[];
  properties?: Record<string, any>;
}
```

## Implementation Strategy {#implementation-strategy}

Follow this approach to implement the FileRepository:

1. Define the interfaces exactly as above
2. Create an abstract base class that implements common functionality
3. Implement filesystem-based concrete class
4. Create adaptors for existing code to use the new interface

## Usage Examples

### Basic File Identification

```typescript
// Using the repository for file identification
async function processQuery(query: string, context: QueryContext) {
  const repository = new FileSystemRepository();

  // Identify relevant files
  const fileIds = await repository.identifyRelevantFiles(query, context);

  // Update context with identified files
  context.relevantFiles = fileIds;

  return context;
}
```

### Loading Data with Segment Filtering

```typescript
// Using the repository for data loading
async function loadDataForProcessing(context: QueryContext) {
  const repository = new FileSystemRepository();

  // Get requested segments (if any)
  const segments = context.segmentTracking?.requestedSegments;

  // Load data from relevant files with optional segment filtering
  const fileData = await repository.loadFileData(
    context.relevantFiles,
    segments,
    context
  );

  // Process the loaded data
  const processedData = processFileData(fileData);

  // Update context with processed data
  context.processedData = processedData;

  return context;
}
```

## Implementation Checklist

- [ ] Define `FileMetadata` interface
- [ ] Define `FileData` interface
- [ ] Define `FileRepository` interface with all methods
- [ ] Create abstract `BaseFileRepository` class with common logic
- [ ] Implement `FileSystemRepository` concrete class
- [ ] Add thread caching functionality
- [ ] Add segment management functionality
- [ ] Create unit tests for repository implementation
- [ ] Implement adapters for existing code

_Last updated: Tue Apr 29 2025_
