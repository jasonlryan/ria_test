# Thread and Data Cache Management

> **Last Updated:** April 30, 2024  
> **Target Audience:** Developers, System Architects  
> **Related Documents:**
>
> - 03_data_processing_workflow.md
> - 06_system_architecture.md

## 1. Overview

This document explains how the RIA25 system manages conversation threads and implements intelligent caching to provide efficient follow-up query handling. The system uses a combination of client-side thread persistence and server-side data caching to maintain conversation context while optimizing performance.

## 2. Thread Management System

### 2.1 Thread Lifecycle

1. **Thread Creation**

   - When a user first starts a conversation, the system creates a new thread through the OpenAI API
   - A unique `threadId` is generated and returned to the client
   - The thread ID is stored in localStorage for persistence across sessions

2. **Thread Persistence**

   - Thread IDs are saved to client-side localStorage
   - Upon page reload, the system retrieves the thread ID from localStorage
   - This ensures conversation continuity even if the browser is closed and reopened

3. **Thread Usage**

   - All subsequent queries include the thread ID
   - API endpoints associate queries with existing threads
   - Thread state (message history) is maintained on OpenAI's servers

4. **Thread Termination**
   - Users can manually reset conversations
   - When reset, thread ID is removed from localStorage
   - Associated thread cache is also cleared

### 2.2 Implementation Details

```javascript
// Thread creation in app/api/controllers/chatAssistantController.ts
// Utilizing threadService
const thread = await threadService.createThread();
finalThreadId = thread.id;

// Thread persistence in client-side code
useEffect(() => {
  if (threadId) {
    localStorage.setItem("chatThreadId", threadId);
  }
}, [threadId]);

// Thread retrieval on page load
const [threadId, setThreadId] = useState(() => {
  if (typeof window !== "undefined") {
    const savedThreadId = localStorage.getItem("chatThreadId");
    return savedThreadId || null;
  }
  return null;
});

// Thread reset functionality
const refreshChat = () => {
  setThreadId(null);
  localStorage.removeItem("chatThreadId");
  // Clear thread cache...
};
```

## 3. Data File Caching System

### 3.1 Cache Architecture

The system implements two separate but complementary caching mechanisms:

1. **Client-Side Cache**

   - Implemented in localStorage
   - Tracks file IDs and data per thread
   - Managed in React state with localStorage persistence
   - Used to optimize client-server communication

2. **Server-Side Cache**
   - Implemented as JSON files in the `cache/` directory
   - One cache file per thread (e.g., `thread_ABC123.json`)
   - Tracks loaded file IDs, segments, and data
   - Managed by `utils/cache-utils.ts` and `utils/data/incremental_cache.js`
   - Used to optimize data retrieval and processing

### 3.2 Cache Data Structure

#### Server-Side Cache Structure

Each thread cache file contains:

```javascript
{
  "files": [
    {
      "id": "2025_1_2",
      "data": {
        "region": { /* segment data */ },
        "age": { /* segment data */ }
      },
      "loadedSegments": ["region", "age"],
      "availableSegments": ["region", "age", "gender", "overall", "sector", "job_level"]
    },
    // More files...
  ],
  "scope": {
    // Additional metadata about the thread's data scope
  }
}
```

Key concepts in this structure:

- **id**: The unique identifier for the data file
- **data**: Contains the actual segment data, organized by segment key
- **loadedSegments**: Tracks which segments have been loaded for this file
- **availableSegments**: Lists all segments available in this file (even if not yet loaded)

#### Client-Side Cache Structure

```javascript
{
  "thread_123ABC": {
    fileIds: ["2025_1_2", "2025_3_4"],
    data: { /* raw data from these files */ }
  },
  "thread_456XYZ": {
    fileIds: ["2025_6_7"],
    data: { /* raw data from these files */ }
  }
}
```

### 3.3 Segment-Aware Caching

The RIA25 system implements segment-aware caching to optimize data loading and minimize memory usage:

1. **Segment Tracking**

   - Each cached file tracks which segments have been loaded
   - System detects available segments in data files
   - Segments are stored as Sets for efficient lookup

2. **Incremental Loading**

   - Only loads segments that are needed for the current query
   - Avoids redundant loading of already cached segments
   - Gradually builds up the cache as users request different segments

3. **Lazy Loading Mechanism**

   - When a follow-up query requests new segments for already cached files:
     - System identifies which segments are missing
     - Only retrieves the missing segments from disk
     - Merges newly loaded segments with existing cached data

4. **Segment Metadata Management**
   - The cache stores both loaded and available segments
   - This allows the system to make intelligent decisions about what to load
   - Prevents unnecessary file scans to determine available segments

#### Implementation in Code

```typescript
/**
 * Calculate which segments need to be loaded
 * @param existingFile The cached file with current segments
 * @param requestedSegments The segments needed for current query
 * @returns Array of segments that need to be loaded
 */
function calculateMissingSegments(existingFile, requestedSegments) {
  const missingSegments = [];

  for (const segment of requestedSegments) {
    if (!existingFile.loadedSegments.has(segment)) {
      missingSegments.push(segment);
    }
  }

  return missingSegments;
}

/**
 * Merge newly loaded segments into existing cache
 * @param existingFile The cached file to update
 * @param newSegmentData The newly loaded segment data
 * @param loadedSegments The segments that were loaded
 * @returns Updated file with merged data
 */
function mergeSegmentData(existingFile, newSegmentData, loadedSegments) {
  // Create a copy of the existing file
  const updatedFile = {
    ...existingFile,
    data: { ...existingFile.data },
    loadedSegments: new Set([...existingFile.loadedSegments]),
  };

  // Merge in the new segment data
  for (const segment of loadedSegments) {
    updatedFile.data[segment] = newSegmentData[segment];
    updatedFile.loadedSegments.add(segment);
  }

  return updatedFile;
}
```

### 3.4 Server-Side Cache Implementation

The server-side cache is implemented in `utils/cache-utils.ts` with two main functions:

#### Loading Thread Cache

```typescript
/**
 * Loads the cache for a given thread.
 * @param threadId - The thread identifier.
 * @returns The cache entry containing cached files and metadata.
 */
export async function getCachedFilesForThread(
  threadId: string
): Promise<CachedFile[]> {
  const cacheFilePath = path.join(CACHE_DIR, `${threadId}.json`);
  try {
    if (!fs.existsSync(cacheFilePath)) {
      return [];
    }
    const content = await fs.promises.readFile(cacheFilePath, "utf8");
    const cacheEntry = JSON.parse(content);
    // Convert loadedSegments and availableSegments to Set
    const files = cacheEntry.files.map((file: any) => ({
      ...file,
      loadedSegments: new Set(file.loadedSegments),
      availableSegments: new Set(file.availableSegments),
    }));
    return files;
  } catch (error) {
    logger.error(`Error reading cache for thread ${threadId}:`, error);
    return [];
  }
}
```

#### Updating Thread Cache

```typescript
/**
 * Updates the cache for a given thread.
 * Merges new files or updates existing files with new segment data.
 * @param threadId - The thread identifier.
 * @param newFiles - Array of new or updated cached files.
 * @returns void
 */
export async function updateThreadCache(
  threadId: string,
  newFiles: CachedFile[]
): Promise<void> {
  const cacheFilePath = path.join(CACHE_DIR, `${threadId}.json`);
  let cacheEntry = { files: [], scope: {} };
  try {
    if (fs.existsSync(cacheFilePath)) {
      const content = await fs.promises.readFile(cacheFilePath, "utf8");
      cacheEntry = JSON.parse(content);
      // Convert loadedSegments and availableSegments to Set
      cacheEntry.files = cacheEntry.files.map((file: any) => ({
        ...file,
        loadedSegments: new Set(file.loadedSegments),
        availableSegments: new Set(file.availableSegments),
      }));
    }
  } catch (error) {
    logger.error(`Error reading cache for thread ${threadId}:`, error);
  }

  // Merge newFiles into cacheEntry.files
  for (const newFile of newFiles) {
    const existingIndex = cacheEntry.files.findIndex(
      (f: any) => f.id === newFile.id
    );
    if (existingIndex === -1) {
      // Add new file
      cacheEntry.files.push(newFile);
    } else {
      // Merge segments and data
      const existingFile = cacheEntry.files[existingIndex];
      // Merge loadedSegments
      newFile.loadedSegments.forEach((seg: string) =>
        existingFile.loadedSegments.add(seg)
      );
      // Merge availableSegments
      newFile.availableSegments.forEach((seg: string) =>
        existingFile.availableSegments.add(seg)
      );
      // Merge data (assuming data is an object with segment keys)
      Array.from(newFile.loadedSegments).forEach((seg: string) => {
        existingFile.data[seg] = newFile.data[seg];
      });
      cacheEntry.files[existingIndex] = existingFile;
    }
  }

  // Convert Sets back to arrays for JSON serialization
  cacheEntry.files = cacheEntry.files.map((file: any) => ({
    ...file,
    loadedSegments: Array.from(file.loadedSegments),
    availableSegments: Array.from(file.availableSegments),
  }));

  try {
    await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(
      cacheFilePath,
      JSON.stringify(cacheEntry, null, 2),
      "utf8"
    );
  } catch (error) {
    logger.error(`Error writing cache for thread ${threadId}:`, error);
  }
}
```

### 3.5 Incremental Cache Module

The `utils/data/incremental_cache.js` module provides additional functionality for segment-aware caching:

```javascript
/**
 * Calculate missing data scope based on existing and new scopes
 * @param {Object} existingScope - Currently cached data scope
 * @param {Object} newScope - Data scope needed for current query
 * @returns {Object} Data scope that needs to be loaded
 */
function calculateMissingDataScope(existingScope, newScope) {
  const missingScope = {
    fileIds: new Set(),
    segments: new Set(),
  };

  // Add files that don't exist in the cache
  for (const fileId of newScope.fileIds) {
    if (!existingScope.fileIds.has(fileId)) {
      missingScope.fileIds.add(fileId);
    }
  }

  // Add segments that need to be retrieved for existing files
  // This allows incremental loading of just the new segments
  for (const segment of newScope.segments) {
    if (!existingScope.segments.has(segment)) {
      missingScope.segments.add(segment);
    }
  }

  return missingScope;
}

/**
 * Get incremental data needed based on thread cache
 * @param {string} threadId - Thread ID
 * @param {Object} newDataScope - Data scope needed for current query
 * @returns {Object} Data scope that needs to be loaded
 */
async function getIncrementalData(threadId, newDataScope) {
  // Get existing cache
  const existingScope = await getDataScope(threadId);

  // Calculate what's missing
  const missingScope = calculateMissingDataScope(existingScope, newDataScope);

  return {
    missingScope,
    existingScope,
  };
}
```

### 3.6 Client-Side Cache Implementation

The client-side cache is implemented using React state with localStorage persistence:

```javascript
// Initialize cache from localStorage
const [threadDataCache, setThreadDataCache] = useState(() => {
  if (typeof window !== "undefined") {
    const savedCache = localStorage.getItem("threadDataCache");
    return savedCache ? JSON.parse(savedCache) : {};
  }
  return {};
});

// Update cache with new data
const updateThreadCache = useCallback((threadId, fileIds, data) => {
  setThreadDataCache((prevCache) => {
    const newCache = {
      ...prevCache,
      [threadId]: {
        fileIds,
        data,
      },
    };

    // Persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("threadDataCache", JSON.stringify(newCache));
    }

    return newCache;
  });
}, []);

// Retrieve data from cache
const getCachedData = useCallback(
  (threadId) => {
    return threadDataCache[threadId] || null;
  },
  [threadDataCache]
);
```

## 4. Thread Intelligence

### 4.1 Context Awareness

- **Thread Continuity**:

  - System maintains knowledge about previous queries in a thread
  - Thread cache tracks which files and segments have been used
  - Follow-up queries reuse cached data when possible

- **Topic Detection**:
  - System detects when a query is about the same topic as previous queries
  - Identifies when a query shifts to a new topic
  - Optimizes data loading based on topic relevance

### 4.2 Query Classification

The system classifies queries into four types to optimize data retrieval:

1. **New Topic Queries**:

   - No previous context exists or query is on a completely new topic
   - System performs full identification and data retrieval
   - Initializes new cache entries

2. **Follow-up Queries**:

   - Query is a direct follow-up to previous query on same topic
   - System reuses cached file IDs and data
   - Minimizes data retrieval and processing

3. **Topic Shift Queries**:

   - Query relates to previous context but shifts to new aspects
   - System merges cached data with newly identified data
   - Performs partial data retrieval for just the new aspects

4. **Content Transformation Queries**:
   - Query asks for different view of same data (e.g., comparison)
   - System reuses all cached data
   - Focuses on transforming or reanalyzing existing data

### 4.3 Implementation

The query classification and handling logic is implemented in the data retrieval service:

```javascript
// In dataRetrievalService.js

/**
 * Process a query with appropriate caching and data loading
 */
async function processQueryWithData(
  query,
  context,
  cachedFileIds,
  threadId,
  isFollowUp,
  previousQuery,
  previousResponse
) {
  // Step 1: Determine query type
  const queryType = determineQueryType(
    query,
    previousQuery,
    cachedFileIds,
    isFollowUp
  );

  // Step 2: Handle based on query type
  switch (queryType) {
    case "new_topic":
      // Perform full identification and retrieval
      return await handleNewTopicQuery(query, context, threadId);

    case "follow_up":
      // Reuse cached data and context
      return await handleFollowUpQuery(
        query,
        context,
        cachedFileIds,
        threadId,
        previousQuery,
        previousResponse
      );

    case "topic_shift":
      // Blend cached data with new data
      return await handleTopicShiftQuery(
        query,
        context,
        cachedFileIds,
        threadId,
        previousQuery
      );

    case "transformation":
      // Reuse all data but transform analysis
      return await handleTransformationQuery(
        query,
        context,
        cachedFileIds,
        threadId,
        previousQuery
      );
  }
}

/**
 * Determine the type of query based on context
 */
function determineQueryType(query, previousQuery, cachedFileIds, isFollowUp) {
  // Use heuristics and/or ML to classify query
  if (!previousQuery || !isFollowUp) {
    return "new_topic";
  }

  // Check for transformation queries
  if (/compare|show|list|summarize|break down/.test(query.toLowerCase())) {
    return "transformation";
  }

  // Check for follow-up indicators
  if (
    query.length < 15 ||
    /^(what|how|why|when|where|who|is|are|can|could|would|which|tell me more|elaborate)/.test(
      query.toLowerCase()
    ) ||
    /\b(it|this|that|these|those|they|them)\b/.test(query.toLowerCase())
  ) {
    return "follow_up";
  }

  // Default to topic shift if we have cache but not clear follow-up
  if (cachedFileIds && cachedFileIds.length > 0) {
    return "topic_shift";
  }

  return "new_topic";
}
```

## 5. Performance Considerations

### 5.1 Cache Size Management

- **Potential Issue**: Thread caches could grow too large over time
- **Solution**: Implement cache size limits and eviction policies
- **Implementation**:
  - Track total cache size per thread
  - Implement an LRU (Least Recently Used) eviction policy
  - Set configurable maximum cache size

### 5.2 Cache Invalidation

- **Potential Issue**: Cached data could become outdated if source data changes
- **Solution**: Implement a cache invalidation strategy
- **Implementation**:
  - Add timestamp metadata to cached files
  - Check source file modification dates
  - Implement version-based invalidation

### 5.3 Cache Monitoring

- **Implementation**:
  - Add logging for cache hit/miss rates
  - Track cache size metrics
  - Monitor cache performance impact

## 6. Future Enhancements

### 6.1 Vercel KV Integration

- **Plan**: Replace file-based cache with Vercel KV for production environments
- **Benefits**:
  - Better scalability
  - Shared cache across serverless functions
  - Automatic persistence and replication

### 6.2 ML-Based Query Classification

- **Plan**: Implement machine learning for query classification
- **Benefits**:
  - More accurate detection of query types
  - Better handling of ambiguous queries
  - Improved cache efficiency

### 6.3 Predictive Data Loading

- **Plan**: Implement predictive loading of related segments
- **Benefits**:
  - Anticipate user needs in follow-up queries
  - Reduce latency for common follow-up patterns
  - Improve user experience

---

_Last updated: April 30, 2024_
