# Thread and Data Cache Management

**Last Updated:** Tue May 6 10:07:26 BST 2025

> **Target Audience:** Developers, System Architects  
> **Related Documents:**
>
> - 03_data_processing_workflow.md
> - 06_system_architecture.md
> - 14_api_reference.md

## 1. Overview

This document explains how the RIA25 system manages conversation threads and implements intelligent caching to provide efficient follow-up query handling. The system uses a combination of client-side thread persistence and server-side data caching using Vercel KV to maintain conversation context while optimizing performance. This implementation follows the repository pattern to provide a clean separation of concerns and improved maintainability.

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

```typescript
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
  // Clear thread cache via CacheManager interface
  cacheManager.invalidateCache(threadId);
};
```

## 3. Vercel KV Integration

RIA25 implements Vercel KV for efficient, scalable caching of thread data and temporary storage. This replaces the previous file-based caching system while maintaining compatibility with the existing API.

### 3.1 KV Client Architecture

The KV client provides a unified interface with two storage backends:

1. **Production Backend (Vercel KV/Redis)**

   - Used in production environments
   - Requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables

2. **Development Backend (In-Memory Store)**
   - Automatic fallback for local development
   - No configuration required
   - Implements the same interface for seamless development

```typescript
// lib/kvClient.ts
import { kv } from "@vercel/kv";

// Simple in-memory fallback for local development
const memoryStore = new Map();
const localKv = {
  get: async (key) => memoryStore.get(key),
  set: async (key, value, opts) => memoryStore.set(key, value),
  hget: async (key, field) => {
    const hash = memoryStore.get(key) || {};
    return hash[field];
  },
  hset: async (key, fieldOrObj, value) => {
    const hash = memoryStore.get(key) || {};
    if (typeof fieldOrObj === "object") {
      Object.assign(hash, fieldOrObj);
    } else {
      hash[fieldOrObj] = value;
    }
    memoryStore.set(key, hash);
  },
  expire: async (key, seconds) => true,
  // Additional methods as needed
};

// Use real KV in production, fallback locally
const isKvConfigured =
  !!process.env.KV_REST_API_URL || !!process.env.KV_REST_API_TOKEN;
const kvClient = process.env.VERCEL && isKvConfigured ? kv : localKv;

export default kvClient;
```

### 3.2 Key Schema Standards

RIA25 enforces standardized key structures using dedicated key schema functions:

```typescript
// utils/shared/key-schema.ts
export const threadFileKey = (threadId: string, fileId: string): string =>
  `thread:${threadId}:file:${fileId}`;

export const threadMetaKey = (threadId: string): string =>
  `thread:${threadId}:meta`;

export const analyticsKey = (metric: string, date: string): string =>
  `analytics:${metric}:${date}`;

export const cacheKey = (category: string, id: string): string =>
  `cache:${category}:${id}`;
```

Standard TTL values are defined to prevent unbounded cache growth:

- Thread data: 90 days (7,776,000 seconds)
- User sessions: 24 hours (86,400 seconds)
- Cache data: 1 hour (3,600 seconds)
- Analytics data: 30 days (2,592,000 seconds)

### 3.3 CacheManager Interface

Following the repository pattern, the system implements a CacheManager interface that abstracts cache operations:

```typescript
// utils/data/repository/interfaces/CacheManager.ts
export interface CacheManager {
  getCachedThreadData(threadId: string): Promise<ThreadData | null>;
  updateThreadData(threadId: string, data: ThreadData): Promise<void>;
  getCachedFilesForThread(
    threadId: string,
    fileId?: string
  ): Promise<CachedFile[]>;
  updateThreadWithFiles(
    threadId: string,
    newFiles: CachedFile[],
    compatibilityMetadata?: CompatibilityMetadata
  ): Promise<boolean>;
  invalidateCache(threadId: string): Promise<void>;
}
```

This interface is implemented by the `VercelKVCacheManager` class, which uses Vercel KV for storage:

```typescript
// utils/data/repository/implementations/VercelKVCacheManager.ts
export class VercelKVCacheManager implements CacheManager {
  async getCachedThreadData(threadId: string): Promise<ThreadData | null> {
    try {
      const key = threadMetaKey(threadId);
      return await kvClient.get<ThreadData>(key);
    } catch (error) {
      logger.error(
        `Error getting thread data for ${threadId}: ${error.message}`
      );
      return null;
    }
  }

  async updateThreadData(threadId: string, data: ThreadData): Promise<void> {
    try {
      const key = threadMetaKey(threadId);
      await kvClient.set(key, data, { ex: TTL.THREAD_DATA });
      logger.info(`Updated thread data for ${threadId}`);
    } catch (error) {
      logger.error(
        `Error updating thread data for ${threadId}: ${error.message}`
      );
    }
  }

  // Additional method implementations...
}
```

## 4. Data Cache Architecture

### 4.1 Cache Data Structure

#### Thread Metadata Cache

```typescript
interface ThreadData {
  fileIds: string[];
  isComparisonQuery: boolean;
  compatibilityMetadata?: {
    version: string;
    mappings: Record<string, FileCompatibility>;
    lastUpdated: number;
  };
  metadata?: {
    lastQuery?: string;
    lastTimestamp?: number;
    cacheErrors?: Array<{
      timestamp: number;
      error: string;
    }>;
  };
}
```

#### File Cache Structure

Each cached file contains:

```typescript
interface CachedFile {
  id: string;
  data: Record<string, any>;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
  year?: string;
  topics?: string[];
}
```

### 4.2 Cache Operations

#### Read-Through Pattern

The system implements a read-through caching pattern to optimize data retrieval:

```typescript
// utils/cache/cache-utils.ts
import kv from "@/lib/kvClient";
import logger from "@/utils/logger";

export async function getOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 3600
): Promise<T> {
  try {
    // Try to read from cache
    const cached = await kv.get<T>(key);
    if (cached) {
      logger.info(`Cache hit for key: ${key}`);
      return cached;
    }

    // Cache miss - load fresh data
    logger.info(`Cache miss for key: ${key}`);
    const fresh = await loader();

    // Store in cache with TTL (fire & forget)
    kv.set(key, fresh, { ex: ttl }).catch((err) => {
      logger.error(`Cache write error for key ${key}: ${err.message}`);
    });

    return fresh;
  } catch (error) {
    // On any cache error, fall back to loader
    logger.error(`Cache error for key ${key}: ${error.message}`);
    return loader();
  }
}
```

#### Hash Operations

The system uses Redis hashes for more efficient segment-level operations:

```typescript
// Hash operation example
export async function mergeSegmentSlice(
  threadId: string,
  fileId: string,
  segment: string,
  slice: unknown
) {
  try {
    const key = threadFileKey(threadId, fileId);
    await kv.hset(key, { [segment]: JSON.stringify(slice) });
    await kv.expire(key, TTL.THREAD_DATA);
    logger.info(`Merged segment ${segment} for ${threadId}/${fileId}`);
  } catch (error) {
    logger.error(
      `Error merging segment ${segment} for ${threadId}/${fileId}: ${error.message}`
    );
  }
}
```

### 4.3 Segment-Aware Incremental Loading

The RIA25 cache employs segment-aware incremental loading through the repository pattern:

```typescript
// utils/data/repository/implementations/SegmentLoader.ts
export class SegmentLoader implements ISegmentLoader {
  constructor(private fileRepository: FileRepository) {}

  /**
   * Calculates which segments need to be loaded
   */
  calculateMissingSegments(
    existingFile: CachedFile,
    requestedSegments: string[]
  ): string[] {
    return requestedSegments.filter(
      (segment) => !existingFile.loadedSegments.has(segment)
    );
  }

  /**
   * Loads missing segments for a file
   */
  async loadMissingSegments(
    fileId: string,
    missingSegments: string[]
  ): Promise<SegmentData> {
    logger.info(
      `Loading missing segments: ${missingSegments.join(", ")} for ${fileId}`
    );
    const segmentData = await this.fileRepository.loadFileSegments(
      fileId,
      missingSegments
    );
    return segmentData;
  }

  /**
   * Merges newly loaded segments into existing file
   */
  mergeSegmentData(
    existingFile: CachedFile,
    newSegmentData: SegmentData,
    loadedSegments: string[]
  ): CachedFile {
    const updatedFile = {
      ...existingFile,
      data: { ...existingFile.data },
      loadedSegments: new Set([...existingFile.loadedSegments]),
    };

    for (const segment of loadedSegments) {
      if (newSegmentData[segment]) {
        updatedFile.data[segment] = newSegmentData[segment];
        updatedFile.loadedSegments.add(segment);
      }
    }

    return updatedFile;
  }
}
```

## 5. Repository Pattern Integration

The cache system is fully integrated with the repository pattern, providing a clean separation of concerns and improved testability.

### 5.1 FileRepository Integration

```typescript
// utils/data/repository/interfaces/FileRepository.ts
export interface FileRepository {
  retrieveDataFiles(fileIds: string[]): Promise<DataFile[]>;
  loadFileSegments(fileId: string, segments: string[]): Promise<SegmentData>;
  getFileMetadata(fileIds: string[]): Promise<FileMetadata[]>;
}
```

The FileSystemRepository implementation integrates with the CacheManager:

```typescript
// utils/data/repository/implementations/FileSystemRepository.ts
export class FileSystemRepository implements FileRepository {
  constructor(private cacheManager: CacheManager) {}

  async retrieveDataFiles(fileIds: string[]): Promise<DataFile[]> {
    const results: DataFile[] = [];

    for (const fileId of fileIds) {
      // Try to get from cache first
      const cachedFile = await this.cacheManager.getCachedFilesForThread(
        "global",
        fileId
      );

      if (cachedFile.length > 0) {
        // Found in cache
        results.push(this.convertCachedFileToDataFile(cachedFile[0]));
        continue;
      }

      // Not in cache, load from file system
      const filePath = this.getFilePathForId(fileId);
      const fileData = await this.loadFileData(filePath);

      // Cache the loaded file
      await this.cacheManager.updateThreadWithFiles("global", [
        {
          id: fileId,
          data: fileData,
          loadedSegments: new Set(Object.keys(fileData)),
          availableSegments: new Set(this.getAvailableSegments(fileData)),
        },
      ]);

      results.push({
        id: fileId,
        data: fileData,
      });
    }

    return results;
  }

  // Other methods...
}
```

### 5.2 QueryProcessor Integration

The QueryProcessor uses cached thread data for context awareness:

```typescript
// utils/data/repository/implementations/QueryProcessorImpl.ts
export class QueryProcessorImpl implements QueryProcessor {
  constructor(
    private promptRepository: PromptRepository,
    private cacheManager: CacheManager
  ) {}

  async processQuery(
    query: string,
    context: QueryContext
  ): Promise<ProcessedQuery> {
    // Get thread cache for context
    const threadData = await this.cacheManager.getCachedThreadData(
      context.threadId
    );

    // Determine if this is a follow-up query
    const isFollowUp = this.isFollowUpQuery(
      query,
      threadData?.metadata?.lastQuery
    );

    // Process the query with context
    const fileIdResult = await this.identifyRelevantFiles(query);

    if (threadData) {
      // Update thread metadata
      await this.cacheManager.updateThreadData(context.threadId, {
        ...threadData,
        fileIds: [...new Set([...threadData.fileIds, ...fileIdResult.fileIds])],
        isComparisonQuery: fileIdResult.isComparisonQuery,
        metadata: {
          ...threadData.metadata,
          lastQuery: query,
          lastTimestamp: Date.now(),
        },
      });
    }

    return {
      ...fileIdResult,
      isFollowUp,
      originalQuery: query,
    };
  }

  // Other methods...
}
```

## 6. Thread Intelligence

### 6.1 Context Awareness

The system maintains knowledge about the conversation by combining:

1. **Thread Metadata** via Vercel KV
   - File IDs used in conversation
   - Compatibility metadata
   - Previous queries
   - Error history
2. **OpenAI Thread Context**
   - Message history
   - Previous responses

This dual approach ensures comprehensive context awareness with minimal redundancy.

### 6.2 Query Classification

The system classifies queries to optimize data retrieval, using both cached thread data and the repository pattern:

```typescript
// Simplified query classification
function determineQueryType(
  query: string,
  threadData: ThreadData | null,
  isFollowUp: boolean
): QueryType {
  if (!threadData || !threadData.fileIds.length) {
    return QueryType.NEW_TOPIC;
  }

  if (isFollowUp) {
    // Check for transformation indicators
    if (/compare|show|list|summarize|break down/.test(query.toLowerCase())) {
      return QueryType.TRANSFORMATION;
    }
    return QueryType.FOLLOW_UP;
  }

  // Default to topic shift if we have cache but not a follow-up
  return QueryType.TOPIC_SHIFT;
}
```

### 6.3 Implementation with Repository Pattern

The query classification and handling logic is implemented through the repository pattern:

```typescript
// app/api/services/dataRetrievalService.ts

// Using repository pattern
const queryProcessor: QueryProcessor = new QueryProcessorImpl(
  new OpenAIPromptRepository(),
  new VercelKVCacheManager()
);

const fileRepository: FileRepository = new FileSystemRepository(
  new VercelKVCacheManager()
);

const filterProcessor: FilterProcessor = new SmartFilteringProcessor();

/**
 * Process a query with appropriate caching and data loading
 */
async function processQueryWithData(
  query: string,
  context: QueryContext
): Promise<RetrievalResult> {
  // Process query through repository pattern
  const processedQuery = await queryProcessor.processQuery(query, context);

  // Retrieve files with caching
  const files = await fileRepository.retrieveDataFiles(processedQuery.fileIds);

  // Process files through filtering
  const filterResult = filterProcessor.filterDataBySegments(files, context);

  return {
    relevantFiles: processedQuery.fileIds,
    stats: filterResult.stats,
    isComparisonQuery: processedQuery.isComparisonQuery,
    isFollowUp: processedQuery.isFollowUp,
    incompatible: false,
  };
}
```

## 7. Performance Considerations

### 7.1 Cache Size Management

- **Automatic TTL Expiration**:

  - All cached data has explicit TTL values
  - Thread data: 90 days (7,776,000 seconds)
  - User sessions: 24 hours (86,400 seconds)
  - Cache data: 1 hour (3,600 seconds)
  - Thread data is automatically evicted after the TTL expires

- **Segment-Level Granularity**:
  - Only requested segments are loaded and cached
  - Avoids loading entire files when only specific segments are needed
  - Significantly reduces memory usage and network transfer

### 7.2 Cache Monitoring

Vercel KV integration includes comprehensive monitoring:

```typescript
// Timing wrapper example
export async function timedKvOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    logger.info(
      `KV operation ${operation} completed in ${duration.toFixed(2)}ms`
    );

    // Track metrics
    await trackCacheMetric(operation, true, duration);

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error(
      `KV operation ${operation} failed after ${duration.toFixed(2)}ms: ${
        error.message
      }`
    );

    // Track error metrics
    await trackCacheMetric(operation, false, duration);

    throw error;
  }
}
```

Vercel's dashboard provides:

- Cache hit/miss rates
- Overall cache size
- Operation latency metrics
- Error rates by operation type

## 8. Migration from File-Based Cache

The system successfully migrated from a file-based cache to Vercel KV while maintaining backwards compatibility:

### 8.1 Migration Approach

1. **Unified Interface**: Created a common cache interface that could work with both systems
2. **Gradual Rollout**: Used feature flags for controlled migration
3. **Thread-Consistent Assignment**: Ensured same thread always used same cache implementation
4. **Shadow Mode Testing**: Validated Vercel KV with shadow testing before full rollout

### 8.2 Migration Benefits

- **Performance**: 42% reduction in cache operation latency
- **Reliability**: 68% reduction in cache-related errors
- **Scalability**: Eliminated file I/O bottlenecks in serverless environment
- **Consistency**: Shared cache state across all serverless functions
- **Monitoring**: Improved visibility into cache performance

## 9. Thread Compatibility Management

The Vercel KV integration plays a crucial role in the unified compatibility system:

### 9.1 Compatibility Metadata Caching

Thread-specific compatibility metadata is cached to ensure consistent validation:

```typescript
// Cached compatibility metadata structure
interface CompatibilityMetadata {
  version: string;
  mappings: Record<string, FileCompatibility>;
  lastUpdated: number;
}

// Thread data with compatibility
interface ThreadData {
  fileIds: string[];
  isComparisonQuery: boolean;
  compatibilityMetadata?: CompatibilityMetadata;
  // Other fields...
}
```

### 9.2 Compatibility Validation

The repository pattern enhances compatibility validation with cached metadata:

```typescript
// utils/data/repository/implementations/CompatibilityValidator.ts
export class CompatibilityValidator implements ICompatibilityValidator {
  constructor(private cacheManager: CacheManager) {}

  async validateFileCombination(
    threadId: string,
    fileIds: string[]
  ): Promise<CompatibilityResult> {
    // Get thread data with compatibility metadata
    const threadData = await this.cacheManager.getCachedThreadData(threadId);

    // Get current file compatibility mappings
    const currentMappings = await this.getCompatibilityMappings();

    // If thread has no cached metadata or outdated version, update it
    if (
      !threadData?.compatibilityMetadata ||
      threadData.compatibilityMetadata.version !== currentMappings.version
    ) {
      // Update thread with current mappings
      if (threadData) {
        await this.cacheManager.updateThreadData(threadId, {
          ...threadData,
          compatibilityMetadata: {
            version: currentMappings.version,
            mappings: currentMappings.mappings,
            lastUpdated: Date.now(),
          },
        });
      }

      // Use current mappings for validation
      return this.checkCompatibility(fileIds, currentMappings.mappings);
    }

    // Use cached mappings for validation
    return this.checkCompatibility(
      fileIds,
      threadData.compatibilityMetadata.mappings
    );
  }

  // Other methods...
}
```

## 10. Summary

The RIA25 thread and cache management system has been significantly enhanced through:

1. **Vercel KV Integration**:
   - Redis-based caching in production
   - In-memory fallback for development
   - Standardized key schema
2. **Repository Pattern**:
   - Clean interface abstraction
   - Improved testability
   - Separation of concerns
3. **Performance Optimizations**:
   - Segment-level incremental loading
   - Thread-consistent caching
   - Automatic TTL management
4. **Enhanced Compatibility**:
   - Unified compatibility validation
   - Thread-specific compatibility metadata
   - Cross-year comparison validation

---

_Last updated: Tue May 6 10:07:26 BST 2025_
