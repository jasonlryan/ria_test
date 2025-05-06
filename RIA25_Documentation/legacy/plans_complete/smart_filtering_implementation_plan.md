# Smart Filtering and Incremental Caching Implementation Plan

## Overview

This document outlines a comprehensive plan for implementing smart query-driven filtering and incremental data caching in the RIA25 chat assistant. The goal is to significantly reduce response latency, optimize token usage, and improve the overall user experience by:

1. Filtering data based on query intent and parameters
2. Caching and reusing data across conversation turns
3. Only retrieving new data when needed for follow-up questions

## Current Performance Issues

Based on performance metrics, some queries take over 57 seconds to process:

```
How confident are employees that their current skills will remain relevant in an AI-driven work envi |  |  | 23 | 57222 | 0 | 2025-04-12T10:20:48.168Z
```

The main bottlenecks appear to be:

- Processing excessive data for simple queries
- Retrieving redundant data for follow-up questions
- Limited post-retrieval data reduction

## Specific File Modifications Required

This section details the exact changes needed for each key file in the codebase:

### 1. `utils/openai/retrieval.js`

**Current Implementation:**

- Handles data retrieval, file identification, and basic filtering
- Returns large payloads with all retrieved data
- Does not implement smart filtering based on query intent
- No caching mechanism for follow-up questions

**Required Changes:**

- Import new smart filtering and cache modules:
  ```javascript
  const {
    parseQueryIntent,
    mapIntentToDataScope,
    getBaseData,
    getSpecificData,
  } = require("../data/smart_filtering");
  const {
    getThreadCache,
    updateThreadCache,
    getDataScope,
  } = require("../data/incremental_cache");
  ```
- Replace direct data fetching with intent-driven logic:
  - Parse the query to extract intent
  - Check thread cache for existing data
  - Only fetch and process new data as needed
  - Filter data based on query specificity
  - Update cache with new data
- Modify the return object to include cache status and scope information for performance monitoring

### 2. `app/api/chat-assistant/route.ts`

**Current Implementation:**

- Orchestrates query processing, data retrieval, and LLM calls
- No mechanism for detecting follow-up questions
- Logs performance metrics but doesn't track cache efficiency

**Required Changes:**

- Add thread ID tracking for conversation context:
  ```javascript
  const threadId = req.headers["x-thread-id"] || generateThreadId();
  ```
- Implement intent parsing and cache checking:
  ```javascript
  const intent = parseQueryIntent(query, conversationHistory);
  const { data, cacheStatus } = await getIncrementalData(intent, threadId);
  ```
- Update performance logging to include cache information:
  ```javascript
  logPerformanceToFile(query, cacheStatus, dataScope, pollCount, totalTimeMs);
  ```
- Pass filtered data to LLM with intent context to improve response quality

### 3. New Files to Create

#### `utils/data/smart_filtering.js`

- Implement query parsing and intent detection:
  ```javascript
  export function parseQueryIntent(query, conversationHistory) {
    // Extract topics, demographics, years, and specificity
    // Determine if this is a follow-up question
    return { topics, demographics, years, specificity, isFollowUp };
  }
  ```
- Create data filtering based on intent:

  ```javascript
  export function getBaseData(retrievedData, queryIntent) {
    // Return only essential data for general queries
  }

  export function getSpecificData(retrievedData, queryIntent) {
    // Return detailed data filtered by demographics, years, etc.
  }
  ```

#### `utils/data/incremental_cache.js`

- Implement thread-based caching system:

  ```javascript
  // In-memory cache for development, could be upgraded to Redis later
  const threadCaches = new Map();

  export function getThreadCache(threadId) {
    return threadCaches.get(threadId) || { data: null, scope: {} };
  }

  export function updateThreadCache(threadId, data, scope) {
    threadCaches.set(threadId, { data, scope, timestamp: Date.now() });
  }
  ```

- Create incremental data fetching functions:

  ```javascript
  export async function getIncrementalData(queryIntent, threadId) {
    const cache = getThreadCache(threadId);
    const missingScope = calculateMissingDataScope(queryIntent, cache.scope);

    if (missingScope.isEmpty()) {
      return { data: cache.data, cacheStatus: "HIT" };
    }

    // Fetch only missing data and merge with cache
    // ...
  }
  ```

#### `utils/data/types.js` (or .ts)

- Define interfaces for type consistency:

  ```typescript
  export interface QueryIntent {
    topics: string[];
    demographics: string[];
    years: number[];
    specificity: "general" | "specific";
    isFollowUp: boolean;
  }

  export interface DataScope {
    topics: Set<string>;
    demographics: Set<string>;
    years: Set<number>;
    fileIds: Set<string>;
  }

  export interface CacheEntry {
    data: any;
    scope: DataScope;
    timestamp: number;
  }
  ```

## Implementation Phases

### Phase 1: Module Architecture (Week 1)

1. **Create New Directory Structure**

   - `/utils/data/smart_filtering.js` - Query parsing and data filtering
   - `/utils/data/incremental_cache.js` - Thread-based caching
   - `/utils/data/types.js` - Type definitions and interfaces

2. **Define Core Interfaces**

   - `QueryIntent` interface with topic, demographics, year, specificity
   - `DataScope` interface to track what data is already cached
   - `CacheEntry` interface for thread cache items

3. **Build Unit Test Framework**
   - Test infrastructure for query parsing
   - Test cases for filtering logic
   - Cache simulation tests

### Phase 2: Query Intent Detection (Week 2)

1. **Implement Query Parser**

   ```javascript
   // Parse query to determine what data is needed
   function parseQueryIntent(query, conversationHistory) {
     return {
       topics: ["remote_work", "flexibility"],
       demographics: ["global", "us"],
       years: [2025],
       specificity: "general", // or 'specific'
       isFollowUp: true / false,
     };
   }
   ```

2. **Create Data Scope Mapper**

   ```javascript
   // Map query intent to required data scope
   function mapIntentToDataScope(queryIntent) {
     return {
       fileIds: ["2025_1", "2025_4"],
       includeRawData: queryIntent.specificity === "specific",
       filterDemographics: queryIntent.demographics,
       filterYears: queryIntent.years,
       // Additional filters
     };
   }
   ```

3. **Update API Route to Use Query Parser**
   - Modify `app/api/chat-assistant/route.ts` to call intent parser
   - Pass intent to data retrieval functions

### Phase 3: Smart Data Filtering (Week 3)

1. **Implement Base Data Filter**

   ```javascript
   // Return only essential data for general queries
   function getBaseData(retrievedData, queryIntent) {
     return {
       summary: generateSummary(retrievedData),
       topStats: extractTopStats(retrievedData),
       // Limited essential data
     };
   }
   ```

2. **Implement Specific Data Filter**

   ```javascript
   // Return detailed data for specific queries
   function getSpecificData(retrievedData, queryIntent) {
     return {
       // Filter raw data based on intent
       filteredData: filterByDemographic(
         retrievedData,
         queryIntent.demographics
       ),
     };
   }
   ```

3. **Add Follow-up Detection Logic**
   - Analyze conversation history to detect follow-ups
   - Determine what new data is needed vs. what can be reused

### Phase 4: Incremental Caching System (Week 4)

1. **Implement Thread Cache**

   ```javascript
   // Store and retrieve data for a conversation thread
   const threadCache = {
     set(threadId, dataScope, data) {
       /* ... */
     },
     get(threadId) {
       /* ... */
     },
     update(threadId, newData) {
       /* ... */
     },
     getDataScope(threadId) {
       /* ... */
     },
   };
   ```

2. **Add Incremental Data Fetching**

   ```javascript
   // Get only missing data not already in cache
   async function getIncrementalData(queryIntent, threadId) {
     const cachedData = threadCache.get(threadId);
     const cachedScope = threadCache.getDataScope(threadId);

     // Determine what new data is needed
     const missingScope = calculateMissingDataScope(queryIntent, cachedScope);

     if (missingScope.isEmpty()) {
       return cachedData; // Use cache only
     }

     // Fetch only the missing data
     const newData = await fetchDataForScope(missingScope);

     // Merge with cached data
     const mergedData = mergeData(cachedData, newData);

     // Update cache with merged data and expanded scope
     threadCache.update(threadId, mergedData);

     return mergedData;
   }
   ```

3. **Implement Data Merging Logic**
   - Functions to combine cached data with new data
   - Conflict resolution strategies
   - Scope expansion tracking

### Phase 5: Integration & Optimization (Week 5)

1. **Update Main API Handler**

   - Replace direct data fetching with smart filtering
   - Integrate caching into the request flow

   ```javascript
   export async function POST(req) {
     const { query, threadId } = await req.json();

     // Parse query intent
     const intent = parseQueryIntent(query, conversationHistory);

     // Get data using incremental caching
     const data = await getIncrementalData(intent, threadId);

     // Pass appropriately filtered data to LLM
     const result = await callLLM(query, data, intent);

     return NextResponse.json({ result });
   }
   ```

2. **Implement Cache Invalidation**

   - Add TTL (time-to-live) for cached data
   - Implement strategies for cache cleanup
   - Handle conversation context limits

3. **Performance Testing**
   - Measure improvement in response times
   - Analyze token usage reduction
   - Test with extended conversation scenarios

### Phase 6: Monitoring & Refinement (Week 6)

1. **Enhance Performance Logging**

   ```javascript
   // Enhanced logging format
   `${query.substring(0, 100)} | ${
     cacheHit ? "CACHE_HIT" : "CACHE_MISS"
   } | ${Object.keys(dataScope).join(
     ","
   )} | ${pollCount} | ${totalTimeMs} | ${status} | ${timestamp}\n`;
   ```

2. **Implement Analytics Dashboard**

   - Track cache hit rates
   - Visualize performance improvements
   - Identify common query patterns

3. **Refinement Based on Analytics**
   - Optimize frequent query patterns
   - Pre-cache common data combinations
   - Fine-tune filtering thresholds

## Migration Strategy

To minimize disruption, we'll implement this system alongside the existing one:

1. First, add the new modules without changing existing functionality
2. Enable the new system for a percentage of requests (A/B testing)
3. Gradually increase usage as stability is confirmed
4. Fully replace the old system once performance benefits are validated

## Success Metrics

We'll consider the implementation successful when:

1. Average query response time decreases by at least 70%
2. Follow-up questions resolve in under 5 seconds
3. Token usage is reduced by at least 50%
4. Cache hit rate exceeds 40% in normal conversation flows

## Technical Debt & Future Enhancements

After the initial implementation, consider:

1. **Persistent Cache Storage**

   - Implement Redis or similar for cross-instance caching
   - Add backup/recovery for cache data

2. **Enhanced Query Understanding**

   - Integrate more sophisticated NLP for intent detection
   - Support complex filtering requests

3. **Predictive Data Fetching**

   - Anticipate likely follow-up questions
   - Pre-fetch probable data needs

4. **Dynamic Cache Optimization**
   - Adjust caching strategy based on usage patterns
   - Implement machine learning for cache prediction

## Conclusion

This implementation plan provides a structured approach to significantly improving the performance of the RIA25 chat assistant through smart filtering and incremental caching. By processing only the data needed for each specific query and reusing data across conversation turns, we expect to dramatically reduce response times while maintaining or improving the quality of responses.

The specific file modifications detailed in this plan provide a clear roadmap for implementing these changes in the existing codebase, with minimal disruption to the current functionality while delivering substantial performance benefits.
