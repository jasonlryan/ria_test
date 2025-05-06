# QueryProcessor Interface Analysis

**Last Updated:** Tue Apr 29 2025

<!--
LLM-GUIDANCE
This document provides detailed analysis of the QueryProcessor interface requirements.
When implementing the QueryProcessor interface:
1. Create a comprehensive TypeScript interface that includes ALL methods mentioned in this analysis
2. Follow the implementation order in IMPLEMENTATION_PLAN.md
3. Implement concrete classes that satisfy this interface
4. Ensure compatibility with QueryContext and FileRepository interfaces

This component should be implemented last, after both QueryContext and FileRepository.
-->

This document analyzes the requirements for a QueryProcessor interface to standardize handling of query processing operations.

## Related Documents

- [IMPLEMENTATION_PLAN.md § 1.3](./IMPLEMENTATION_PLAN.md#queryprocessor-interface) - Implementation plan for QueryProcessor
- [Consolidated-Analysis.md](./Consolidated-Analysis.md) - Overall consolidation strategy
- [QueryContext-Analysis.md](./QueryContext-Analysis.md) - Context model used by QueryProcessor
- [FileRepository-Analysis.md](./FileRepository-Analysis.md) - Repository utilized by QueryProcessor

## Query Processing Functions Analysis {#query-processing-functions-analysis}

### Processing in retrieval.js {#processing-retrieval}

Query processing in `retrieval.js` focuses on file identification and data extraction:

```javascript
// Main query processing function
async function processQueryWithData(query, options = {}) {
  // Normalize query first
  const normalizedQuery = normalizeQuery(query);

  // Handle special cases for starter questions
  if (isStarterQuestion(normalizedQuery)) {
    return processStarterQuestion(normalizedQuery, options);
  }

  // Identify relevant files
  const fileIds = await identifyRelevantFiles(normalizedQuery, options);

  // Load file data
  const fileData = await loadFileData(fileIds);

  // Process and format response
  const processedData = processRawData(fileData, normalizedQuery);
  const response = formatResponse(processedData, normalizedQuery);

  return response;
}
```

### Processing in dataRetrievalService.js {#processing-dataretrieval}

The service implements more comprehensive processing with caching and compatibility:

```javascript
// Service-level query processing
async function processQueryWithData(query, options) {
  // Get cached files if available
  let fileIds = [];
  if (options.threadId && options.useCache) {
    fileIds = await getCachedFilesForThread(options.threadId);
  }

  // Fall back to identification if needed
  if (fileIds.length === 0) {
    fileIds = await identifyRelevantFiles(query, options);

    // Cache results
    if (options.threadId && options.useCache) {
      await cacheFilesForThread(options.threadId, fileIds);
    }
  }

  // Determine segments to include
  const segments = options.segments || [];

  // Check compatibility metadata
  const compatibilityInfo = await assessCompatibility(fileIds, options);

  // Load data with segment filtering
  const fileData = await loadFileDataWithSegments(fileIds, segments);

  // Enhanced processing with compatibility
  const enhancedContext = {
    query,
    fileData,
    compatibility: compatibilityInfo,
    options,
  };

  // Process with enhanced context
  const response = processDataWithContext(enhancedContext);

  return response;
}
```

## Query Classification Functions Analysis {#query-classification-functions-analysis}

Both implementations include functions to classify query types:

```javascript
// Query classification in retrieval.js
function isStarterQuestion(query) {
  const starterPatterns = [
    /^what (data|information).+available/i,
    /^what.+show me/i,
  ];
  return starterPatterns.some((pattern) => pattern.test(query));
}

function isDirectQuestion(query) {
  // Implementation logic...
}

// Query classification in dataRetrievalService.js
function isComparisonQuery(query) {
  const comparisonPatterns = [
    /compare.*(\d{4}).*(\d{4})/i,
    /difference between.*(\d{4}).*and.*(\d{4})/i,
  ];
  return comparisonPatterns.some((pattern) => pattern.test(query));
}

function isSegmentSpecificQuery(query) {
  // Implementation logic...
}
```

## Data Processing Functions Analysis {#data-processing-functions-analysis}

Both implementations have specific data handling functions:

```javascript
// Data processing in retrieval.js
function processRawData(fileData, query) {
  // Extract relevant portions based on query
  // Transform and filter as needed
  return processedData;
}

// Data processing in dataRetrievalService.js
function processDataWithContext(context) {
  const { query, fileData, compatibility } = context;

  // Apply compatibility transformations
  const compatibleData = applyCompatibilityTransforms(fileData, compatibility);

  // Extract insights based on query intent
  const insights = extractInsights(compatibleData, query);

  return {
    data: compatibleData,
    insights,
  };
}
```

## Response Formatting Functions Analysis {#response-formatting-functions-analysis}

Both implementations have response formatting:

```javascript
// Formatting in retrieval.js
function formatResponse(processedData, query) {
  return {
    data: processedData,
    query,
    timestamp: new Date().toISOString(),
  };
}

// Formatting in dataRetrievalService.js
function formatResponseWithMetadata(result, context) {
  return {
    data: result.data,
    insights: result.insights,
    metadata: {
      query: context.query,
      compatibility: context.compatibility,
      timestamp: new Date().toISOString(),
      processingTime: context.processingTime,
    },
  };
}
```

## Processor Interface Requirements {#processor-interface-requirements}

The QueryProcessor interface must handle:

1. Query Processing

   - Processing full query lifecycle
   - Supporting context-aware processing
   - Handling thread state

2. Query Classification

   - Detecting starter questions
   - Detecting comparison queries
   - Determining query intent

3. Data Processing

   - Filtering data by relevance to query
   - Applying compatibility transformations
   - Extracting insights

4. Response Formatting
   - Formatting consistent responses
   - Including processing metadata
   - Supporting different result types

## Consolidated Interface Design {#consolidated-interface-design}

Proposed interface structure:

```typescript
/**
 * Processor for handling user queries and generating responses
 */
interface QueryProcessor {
  /**
   * Process a query and generate a response
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Processed response
   */
  processQuery(query: string, context: QueryContext): Promise<QueryResponse>;

  /**
   * Classify the type of query
   *
   * @param query User query text
   * @param context QueryContext with processing context
   * @returns Classification result
   */
  classifyQuery(query: string, context?: QueryContext): QueryClassification;

  /**
   * Process data based on the query and context
   *
   * @param data File data to process
   * @param query User query
   * @param context QueryContext with processing context
   * @returns Processed data result
   */
  processData(
    data: FileData[],
    query: string,
    context: QueryContext
  ): Promise<ProcessedResult>;

  /**
   * Format the final response
   *
   * @param result Processed result
   * @param context QueryContext with processing context
   * @returns Formatted query response
   */
  formatResponse(result: ProcessedResult, context: QueryContext): QueryResponse;
}

/**
 * Classification of query type
 */
interface QueryClassification {
  isStarterQuestion: boolean;
  isComparisonQuery: boolean;
  isSegmentSpecific: boolean;
  targetSegments?: string[];
  targetYears?: string[];
  queryIntent?: string;
}

/**
 * Result of data processing
 */
interface ProcessedResult {
  data: any;
  insights?: any[];
  metrics?: Record<string, any>;
}

/**
 * Final response format
 */
interface QueryResponse {
  data: any;
  insights?: any[];
  metadata: {
    query: string;
    timestamp: string;
    processingTime?: number;
    compatibility?: Record<string, any>;
    [key: string]: any;
  };
}
```

## Implementation Strategy {#implementation-strategy}

Follow this approach to implement the QueryProcessor:

1. Define the interfaces exactly as above
2. Create an abstract base class with common functionality
3. Implement concrete classes for different processing strategies
4. Ensure integration with FileRepository and QueryContext components

## Usage Examples

### Basic Query Processing

```typescript
// Using the processor for query handling
async function handleUserQuery(query: string, threadId: string) {
  const repository = new FileSystemRepository();
  const processor = new StandardQueryProcessor(repository);

  // Create context for processing
  const context = new QueryContext({
    threadId,
    useCache: true,
  });

  // Process query
  const response = await processor.processQuery(query, context);

  return response;
}
```

### Advanced Processing with Custom Classification

```typescript
// Using the processor with custom classification
async function handleSpecializedQuery(query: string, context: QueryContext) {
  const repository = new FileSystemRepository();
  const processor = new SpecializedQueryProcessor(repository);

  // Classify the query first
  const classification = processor.classifyQuery(query, context);

  // Update context with classification info
  context.queryClassification = classification;

  // Customize processing based on classification
  if (classification.isComparisonQuery) {
    context.processingMode = "comparison";
    context.requestedSegments = ["summary", "comparison"];
  }

  // Process with updated context
  const response = await processor.processQuery(query, context);

  return response;
}
```

## Implementation Checklist

- [ ] Define `QueryClassification` interface
- [ ] Define `ProcessedResult` interface
- [ ] Define `QueryResponse` interface
- [ ] Define `QueryProcessor` interface with all methods
- [ ] Create abstract `BaseQueryProcessor` class
- [ ] Implement `StandardQueryProcessor` concrete class
- [ ] Add query classification functionality
- [ ] Add data processing functionality
- [ ] Add response formatting functionality
- [ ] Create unit tests for processor implementation
- [ ] Implement adapters for existing code

_Last updated: Tue Apr 29 2025_
