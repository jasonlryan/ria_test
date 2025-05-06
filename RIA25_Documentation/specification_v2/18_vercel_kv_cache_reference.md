# RIA25 Vercel KV Caching System Specification

**Last Updated:** Tue May 13 12:15:37 BST 2025

> **Target Audience:** Developers, System Architects  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 15_thread_data_management.md
> - 11_vercel_deployment_guide.md
> - 14_api_reference.md

## Overview

The RIA25 caching system provides a unified interface for thread and file data caching using Vercel KV (Redis) in production and an in-memory fallback for local development. This document outlines the architecture, components, and implementation details of the caching system based on the repository pattern implementation.

## Core Components

### 1. KV Client (`lib/kvClient.ts`)

The KV Client serves as the primary interface for all cache operations, implementing two storage backends:

- **VercelKVClient**: Production Redis-based storage
- **InMemoryStore**: Local development fallback

#### Key Functions

| Function                         | Description             | Parameters                                      | Returns                      |
| -------------------------------- | ----------------------- | ----------------------------------------------- | ---------------------------- |
| `get<T>(key)`                    | Retrieve cached value   | `key: string`                                   | `Promise<T \| null>`         |
| `set<T>(key, value, options)`    | Store value with TTL    | `key: string, value: T, options?: KVOptions`    | `Promise<boolean>`           |
| `del(key)`                       | Delete cached value     | `key: string`                                   | `Promise<number>`            |
| `hget<T>(key, field)`            | Get hash field          | `key: string, field: string`                    | `Promise<T \| null>`         |
| `hset(key, obj)`                 | Set hash fields         | `key: string, obj: Record<string, any>`         | `Promise<number>`            |
| `hgetall<T>(key)`                | Get all hash fields     | `key: string`                                   | `Promise<Record<string, T>>` |
| `hkeys(key)`                     | Get all hash keys       | `key: string`                                   | `Promise<string[]>`          |
| `hincrby(key, field, increment)` | Increment hash field    | `key: string, field: string, increment: number` | `Promise<number>`            |
| `expire(key, seconds)`           | Set key expiration      | `key: string, seconds: number`                  | `Promise<number>`            |
| `ttl(key)`                       | Get time to live        | `key: string`                                   | `Promise<number>`            |
| `exists(key)`                    | Check if key exists     | `key: string`                                   | `Promise<number>`            |
| `ping()`                         | Check connection status | None                                            | `Promise<boolean>`           |

#### Implementation Details

```typescript
// lib/kvClient.ts
import { kv } from "@vercel/kv";
import logger from "../utils/logger";

// Simple in-memory fallback for local development
const memoryStore = new Map();
const localKv = {
  get: async (key) => memoryStore.get(key),
  set: async (key, value, opts) => {
    memoryStore.set(key, value);
    return true;
  },
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
    return Object.keys(hash).length;
  },
  expire: async (key, seconds) => true,
  // Additional methods implemented similarly
};

// Use real KV in production, fallback locally
const isKvConfigured =
  !!process.env.KV_REST_API_URL || !!process.env.KV_REST_API_TOKEN;
const kvClient = process.env.VERCEL && isKvConfigured ? kv : localKv;

// Log startup state
logger.info(
  `KV client initialized in ${
    isKvConfigured ? "PRODUCTION" : "DEVELOPMENT"
  } mode`
);

export default kvClient;
```

### 2. Key Schema (`utils/shared/key-schema.ts`)

Defines standardized key formats and TTL values for consistent cache key generation.

#### Key Functions

| Function                          | Description                  | Parameters                         | Returns                           |
| --------------------------------- | ---------------------------- | ---------------------------------- | --------------------------------- |
| `threadFileKey(threadId, fileId)` | Generate thread file key     | `threadId: string, fileId: string` | `thread:{threadId}:file:{fileId}` |
| `threadMetaKey(threadId)`         | Generate thread metadata key | `threadId: string`                 | `thread:{threadId}:meta`          |
| `tempDataKey(type, id)`           | Generate temporary data key  | `type: string, id: string`         | `temp:{type}:{id}`                |
| `analyticsKey(metric, date)`      | Generate analytics key       | `metric: string, date: string`     | `analytics:{metric}:{date}`       |
| `cacheKey(category, id)`          | Generate general cache key   | `category: string, id: string`     | `cache:{category}:{id}`           |

#### TTL Constants

| Constant       | Value    | Description               |
| -------------- | -------- | ------------------------- |
| `THREAD_DATA`  | 90 days  | Thread metadata and files |
| `USER_SESSION` | 24 hours | User session data         |
| `CACHE_DATA`   | 1 hour   | General cache data        |
| `ANALYTICS`    | 30 days  | Analytics data            |

#### Implementation Details

```typescript
// utils/shared/key-schema.ts
export const TTL = {
  THREAD_DATA: 60 * 60 * 24 * 90, // 90 days
  USER_SESSION: 60 * 60 * 24, // 24 hours
  CACHE_DATA: 60 * 60, // 1 hour
  ANALYTICS: 60 * 60 * 24 * 30, // 30 days
};

// Key generators
export const threadFileKey = (threadId: string, fileId: string): string =>
  `thread:${threadId}:file:${fileId}`;

export const threadMetaKey = (threadId: string): string =>
  `thread:${threadId}:meta`;

export const analyticsKey = (metric: string, date: string): string =>
  `analytics:${metric}:${date}`;

export const cacheKey = (category: string, id: string): string =>
  `cache:${category}:${id}`;

export const tempDataKey = (type: string, id: string): string =>
  `temp:${type}:${id}`;
```

### 3. Cache Repository Interface (`utils/data/repository/interfaces/cache.ts`)

Defines the interface for cache operations in the repository pattern implementation.

#### Key Interfaces

```typescript
// Core data structures
export interface CachedFile {
  id: string;
  data: Record<string, any>;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
  compatibility?: {
    year: string;
    isComparable: boolean;
  };
}

export interface ThreadCache {
  files: CachedFile[];
  compatibilityMetadata?: CompatibilityMetadata;
  lastUpdated: number;
  metadata?: {
    cacheErrors?: Array<{
      timestamp: string;
      error: string;
    }>;
    [key: string]: any;
  };
}

// Repository interface
export interface ICacheRepository {
  // Thread cache operations
  getThreadCache(threadId: string): Promise<ThreadCache | null>;
  updateThreadCache(threadId: string, data: ThreadCache): Promise<boolean>;

  // Thread metadata operations
  getThreadMetadata(threadId: string): Promise<Record<string, any> | null>;
  updateThreadMetadata(
    threadId: string,
    metadata: Record<string, any>
  ): Promise<boolean>;

  // File operations
  getCachedFilesForThread(
    threadId: string,
    fileId?: string
  ): Promise<CachedFile[]>;
  updateThreadWithFiles(
    threadId: string,
    newFiles: CachedFile[],
    compatibilityMetadata?: CompatibilityMetadata
  ): Promise<boolean>;

  // General cache operations
  getOrLoad<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T>;
  clearCache(threadId: string): Promise<boolean>;
  isCompatibilityMetadataValid(
    threadId: string,
    mappingVersion: string
  ): Promise<boolean>;
}
```

### 4. Cache Repository Implementation (`utils/data/repository/implementations/cacheRepository.ts`)

The concrete implementation of the ICacheRepository interface using Vercel KV.

#### Main Functions

| Function                                                            | Description                  | Parameters                                                                                | Returns                                |
| ------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| `getThreadCache(threadId)`                                          | Get thread metadata          | `threadId: string`                                                                        | `Promise<ThreadCache \| null>`         |
| `updateThreadCache(threadId, data)`                                 | Update thread metadata       | `threadId: string, data: ThreadCache`                                                     | `Promise<boolean>`                     |
| `getThreadMetadata(threadId)`                                       | Get thread metadata          | `threadId: string`                                                                        | `Promise<Record<string, any> \| null>` |
| `updateThreadMetadata(threadId, metadata)`                          | Update thread metadata       | `threadId: string, metadata: Record<string, any>`                                         | `Promise<boolean>`                     |
| `getCachedFilesForThread(threadId, fileId?)`                        | Get cached files             | `threadId: string, fileId?: string`                                                       | `Promise<CachedFile[]>`                |
| `updateThreadWithFiles(threadId, newFiles, compatibilityMetadata?)` | Update thread with new files | `threadId: string, newFiles: CachedFile[], compatibilityMetadata?: CompatibilityMetadata` | `Promise<boolean>`                     |
| `getOrLoad<T>(key, loader, ttl)`                                    | Load from cache or source    | `key: string, loader: () => Promise<T>, ttl?: number`                                     | `Promise<T>`                           |
| `clearCache(threadId)`                                              | Clear thread cache           | `threadId: string`                                                                        | `Promise<boolean>`                     |
| `isCompatibilityMetadataValid(threadId, mappingVersion)`            | Check compatibility metadata | `threadId: string, mappingVersion: string`                                                | `Promise<boolean>`                     |

#### Implementation Example

```typescript
// utils/data/repository/implementations/cacheRepository.ts
import kvClient from "../../../../lib/kvClient";
import logger from "../../../../utils/logger";
import { threadFileKey, threadMetaKey, TTL } from "../../../shared/key-schema";
import { ICacheRepository, ThreadCache, CachedFile } from "../interfaces/cache";
import { CompatibilityMetadata } from "../interfaces/compat";

export class CacheRepository implements ICacheRepository {
  async getThreadCache(threadId: string): Promise<ThreadCache | null> {
    try {
      const key = threadMetaKey(threadId);
      return await kvClient.get<ThreadCache>(key);
    } catch (error) {
      logger.error(
        `Error retrieving thread cache for ${threadId}: ${error.message}`
      );
      return null;
    }
  }

  async updateThreadCache(
    threadId: string,
    data: ThreadCache
  ): Promise<boolean> {
    try {
      const key = threadMetaKey(threadId);
      // Always include lastUpdated timestamp
      const threadData = {
        ...data,
        lastUpdated: Date.now(),
      };
      await kvClient.set(key, threadData, { ex: TTL.THREAD_DATA });
      return true;
    } catch (error) {
      logger.error(
        `Error updating thread cache for ${threadId}: ${error.message}`
      );
      return false;
    }
  }

  async getThreadMetadata(
    threadId: string
  ): Promise<Record<string, any> | null> {
    try {
      const threadCache = await this.getThreadCache(threadId);
      return threadCache?.metadata || null;
    } catch (error) {
      logger.error(
        `Error retrieving thread metadata for ${threadId}: ${error.message}`
      );
      return null;
    }
  }

  async updateThreadMetadata(
    threadId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const threadCache = await this.getThreadCache(threadId);
      if (!threadCache) {
        const newCache: ThreadCache = {
          files: [],
          lastUpdated: Date.now(),
          metadata,
        };
        return this.updateThreadCache(threadId, newCache);
      }

      // Merge with existing metadata
      threadCache.metadata = {
        ...threadCache.metadata,
        ...metadata,
      };

      return this.updateThreadCache(threadId, threadCache);
    } catch (error) {
      logger.error(
        `Error updating thread metadata for ${threadId}: ${error.message}`
      );
      return false;
    }
  }

  async getCachedFilesForThread(
    threadId: string,
    fileId?: string
  ): Promise<CachedFile[]> {
    try {
      const threadCache = await this.getThreadCache(threadId);
      if (
        !threadCache ||
        !threadCache.files ||
        threadCache.files.length === 0
      ) {
        return [];
      }

      if (fileId) {
        // Return specific file if requested
        const file = threadCache.files.find((f) => f.id === fileId);
        return file ? [file] : [];
      }

      return threadCache.files;
    } catch (error) {
      logger.error(
        `Error retrieving cached files for ${threadId}: ${error.message}`
      );
      return [];
    }
  }

  async updateThreadWithFiles(
    threadId: string,
    newFiles: CachedFile[],
    compatibilityMetadata?: CompatibilityMetadata
  ): Promise<boolean> {
    try {
      const threadCache = await this.getThreadCache(threadId);

      if (!threadCache) {
        // Create new thread cache
        const newCache: ThreadCache = {
          files: newFiles,
          lastUpdated: Date.now(),
          compatibilityMetadata,
        };
        return this.updateThreadCache(threadId, newCache);
      }

      // Merge with existing files, replacing duplicates
      const existingFileIds = new Set(threadCache.files.map((f) => f.id));
      const filesToAdd = newFiles.filter((f) => !existingFileIds.has(f.id));

      threadCache.files = [...threadCache.files, ...filesToAdd];

      // Update compatibility if provided
      if (compatibilityMetadata) {
        threadCache.compatibilityMetadata = compatibilityMetadata;
      }

      return this.updateThreadCache(threadId, threadCache);
    } catch (error) {
      logger.error(
        `Error updating thread with files for ${threadId}: ${error.message}`
      );
      return false;
    }
  }

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    ttl = TTL.CACHE_DATA
  ): Promise<T> {
    try {
      // Try to read from cache
      const cached = await kvClient.get<T>(key);
      if (cached) {
        logger.debug(`Cache hit for key: ${key}`);
        return cached;
      }

      // Cache miss - load fresh data
      logger.debug(`Cache miss for key: ${key}`);
      const fresh = await loader();

      // Store in cache with TTL (fire & forget)
      kvClient.set(key, fresh, { ex: ttl }).catch((err) => {
        logger.error(`Cache write error for key ${key}: ${err.message}`);
      });

      return fresh;
    } catch (error) {
      // On any cache error, fall back to loader
      logger.error(`Cache error for key ${key}: ${error.message}`);
      return loader();
    }
  }

  async clearCache(threadId: string): Promise<boolean> {
    try {
      const key = threadMetaKey(threadId);
      await kvClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Error clearing cache for ${threadId}: ${error.message}`);
      return false;
    }
  }

  async isCompatibilityMetadataValid(
    threadId: string,
    mappingVersion: string
  ): Promise<boolean> {
    try {
      const threadCache = await this.getThreadCache(threadId);
      if (!threadCache || !threadCache.compatibilityMetadata) {
        return true; // No metadata means we can't invalidate
      }

      return threadCache.compatibilityMetadata.version === mappingVersion;
    } catch (error) {
      logger.error(
        `Error checking compatibility metadata for ${threadId}: ${error.message}`
      );
      return false;
    }
  }
}

// Export a singleton instance
export const cacheRepository = new CacheRepository();
```

### 5. Cache Utilities (`utils/cache-utils.ts`)

High-level utility functions that provide a simplified interface to the cache repository.

#### Main Functions

| Function                                                            | Description                     | Parameters                                                                                | Returns                 |
| ------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| `getCachedFilesForThread(threadId, fileId?)`                        | Get cached files for a thread   | `threadId: string, fileId?: string`                                                       | `Promise<CachedFile[]>` |
| `updateThreadWithFiles(threadId, newFiles, compatibilityMetadata?)` | Update thread with files        | `threadId: string, newFiles: CachedFile[], compatibilityMetadata?: CompatibilityMetadata` | `Promise<boolean>`      |
| `getOrLoad<T>(key, loader, ttl)`                                    | Read-through caching helper     | `key: string, loader: () => Promise<T>, ttl?: number`                                     | `Promise<T>`            |
| `mergeSegmentSlice(threadId, fileId, segment, slice)`               | Update a segment in thread data | `threadId: string, fileId: string, segment: string, slice: any`                           | `Promise<void>`         |

#### Implementation Example

```typescript
// utils/cache-utils.ts
import { cacheRepository } from "../utils/data/repository/implementations/cacheRepository";
import logger from "../utils/logger";
import { threadFileKey, TTL } from "./shared/key-schema";
import kvClient from "../lib/kvClient";
import { CachedFile } from "../utils/data/repository/interfaces/cache";
import { CompatibilityMetadata } from "../utils/data/repository/interfaces/compat";

// Re-export access functions that use the repository
export const getCachedFilesForThread =
  cacheRepository.getCachedFilesForThread.bind(cacheRepository);
export const updateThreadWithFiles =
  cacheRepository.updateThreadWithFiles.bind(cacheRepository);
export const getOrLoad = cacheRepository.getOrLoad.bind(cacheRepository);

/**
 * Merge a segment slice into thread file data
 * Uses hash operations for atomic updates
 */
export async function mergeSegmentSlice(
  threadId: string,
  fileId: string,
  segment: string,
  slice: unknown
): Promise<void> {
  try {
    // Use Redis HSET for efficient atomic updates
    const key = threadFileKey(threadId, fileId);
    await kvClient.hset(key, { [segment]: JSON.stringify(slice) });
    await kvClient.expire(key, TTL.THREAD_DATA);
    logger.debug(`Merged segment ${segment} for ${threadId}/${fileId}`);
  } catch (error) {
    logger.error(
      `Error merging segment ${segment} for ${threadId}/${fileId}: ${error.message}`
    );
    // Implementation-specific fallback if needed
  }
}
```

## Service Integration

### 1. Thread Service (`app/api/services/threadService.ts`)

- Uses the CacheRepository for thread operations
- Handles thread creation and management
- Integrates with OpenAI thread API

```typescript
// app/api/services/threadService.ts
import { unifiedOpenAIService } from "./unifiedOpenAIService";
import { cacheRepository } from "../../utils/data/repository/implementations/cacheRepository";
import logger from "../../utils/logger";

export class ThreadService {
  async createThread() {
    try {
      const thread = await unifiedOpenAIService.createThread();
      // Initialize thread cache
      await cacheRepository.updateThreadCache(thread.id, {
        files: [],
        lastUpdated: Date.now(),
      });
      return thread;
    } catch (error) {
      logger.error(`Error creating thread: ${error.message}`);
      throw error;
    }
  }

  async getThreadMetadata(threadId) {
    return cacheRepository.getThreadMetadata(threadId);
  }

  async updateThreadMetadata(threadId, metadata) {
    return cacheRepository.updateThreadMetadata(threadId, metadata);
  }

  // Additional methods...
}

// Export singleton instance
export const threadService = new ThreadService();
```

### 2. Data Retrieval Service (`app/api/services/dataRetrievalService.ts`)

- Uses the CacheRepository for file operations
- Manages file loading and segment caching
- Handles data compatibility checks

```typescript
// app/api/services/dataRetrievalService.ts
import { cacheRepository } from "../../utils/data/repository/implementations/cacheRepository";
import { fileRepository } from "../../utils/data/repository/implementations/fileRepository";
import { compatibilityRepository } from "../../utils/data/repository/implementations/compatibilityRepository";
import logger from "../../utils/logger";

export class DataRetrievalService {
  async getCachedFiles(threadId) {
    return cacheRepository.getCachedFilesForThread(threadId);
  }

  async updateThreadCache(threadId, fileIds) {
    const files = await fileRepository.retrieveDataFiles(fileIds);
    const compatibilityMeta = await compatibilityRepository.lookupFiles(
      fileIds
    );
    return cacheRepository.updateThreadWithFiles(
      threadId,
      files,
      compatibilityMeta
    );
  }

  // Additional methods...
}

// Export singleton instance
export const dataRetrievalService = new DataRetrievalService();
```

## Testing and Diagnostics

### 1. Cache Tests (`tests/repository/cacheRepository.test.ts`)

- Unit tests for cache repository operations
- Tests for thread cache management
- Tests for file caching and merging

```typescript
// tests/repository/cacheRepository.test.ts
import { CacheRepository } from "../../utils/data/repository/implementations/cacheRepository";
import kvClient from "../../lib/kvClient";

// Mock KV client
jest.mock("../../lib/kvClient");

describe("CacheRepository", () => {
  let cacheRepository: CacheRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    cacheRepository = new CacheRepository();
  });

  test("getThreadCache should retrieve thread cache", async () => {
    const mockCache = {
      files: [],
      lastUpdated: Date.now(),
    };

    (kvClient.get as jest.Mock).mockResolvedValue(mockCache);

    const result = await cacheRepository.getThreadCache("thread-123");

    expect(kvClient.get).toHaveBeenCalled();
    expect(result).toEqual(mockCache);
  });

  // Additional tests...
});
```

### 2. Diagnostic Endpoint (`app/api/redis-test/diagnostic/route.ts`)

- Tests KV storage functionality
- Verifies cache operations
- Provides diagnostic information

```typescript
// app/api/redis-test/diagnostic/route.ts
import { NextResponse } from "next/server";
import kvClient from "../../../lib/kvClient";
import logger from "../../../utils/logger";
import { cacheRepository } from "../../../utils/data/repository/implementations/cacheRepository";

export async function GET() {
  try {
    // Test basic KV operations
    const testKey = `test:diagnostic:${Date.now()}`;
    await kvClient.set(testKey, { test: true }, { ex: 60 });
    const testResult = await kvClient.get(testKey);

    // Test repository operations
    const testThreadId = `test-thread-${Date.now()}`;
    await cacheRepository.updateThreadCache(testThreadId, {
      files: [],
      lastUpdated: Date.now(),
    });
    const threadCache = await cacheRepository.getThreadCache(testThreadId);

    // Clean up test data
    await kvClient.del(testKey);
    await cacheRepository.clearCache(testThreadId);

    return NextResponse.json({
      status: "ok",
      kvAvailable: !!testResult,
      repositoryOperational: !!threadCache,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Redis diagnostic error: ${error.message}`);
    return NextResponse.json(
      {
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

## Environment Configuration

### Production Environment

- Uses Vercel KV (Redis)
- Required environment variables:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
  - `REDIS_URL`

### Development Environment

- Uses in-memory fallback
- Can be forced with `USE_KV=false`
- Automatic fallback when KV not configured

## Monitoring and Performance

### Cache Performance Monitoring

```typescript
// utils/shared/monitoring.ts
import logger from "../../utils/logger";

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  writeErrors: number;
  totalOperations: number;
  avgLatencyMs: number;
  operations: {
    [key: string]: {
      count: number;
      totalTimeMs: number;
    };
  };
}

export class CacheMonitor {
  private static instance: CacheMonitor;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    writeErrors: 0,
    totalOperations: 0,
    avgLatencyMs: 0,
    operations: {},
  };

  private constructor() {}

  static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }

  recordHit(operation: string, timeMs: number): void {
    this.metrics.hits++;
    this.recordOperation(operation, timeMs);
  }

  recordMiss(operation: string, timeMs: number): void {
    this.metrics.misses++;
    this.recordOperation(operation, timeMs);
  }

  recordError(operation: string): void {
    this.metrics.errors++;
    this.metrics.totalOperations++;
  }

  recordWriteError(operation: string): void {
    this.metrics.writeErrors++;
  }

  private recordOperation(operation: string, timeMs: number): void {
    this.metrics.totalOperations++;

    if (!this.metrics.operations[operation]) {
      this.metrics.operations[operation] = {
        count: 0,
        totalTimeMs: 0,
      };
    }

    this.metrics.operations[operation].count++;
    this.metrics.operations[operation].totalTimeMs += timeMs;

    // Update average latency
    const totalTimeMs = Object.values(this.metrics.operations).reduce(
      (sum, op) => sum + op.totalTimeMs,
      0
    );
    this.metrics.avgLatencyMs = totalTimeMs / this.metrics.totalOperations;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      writeErrors: 0,
      totalOperations: 0,
      avgLatencyMs: 0,
      operations: {},
    };
  }

  logMetrics(): void {
    const hitRatio = this.metrics.totalOperations
      ? ((this.metrics.hits / this.metrics.totalOperations) * 100).toFixed(2)
      : "0.00";

    logger.info(
      `Cache metrics: ${
        this.metrics.totalOperations
      } operations, ${hitRatio}% hit ratio, ${this.metrics.avgLatencyMs.toFixed(
        2
      )}ms avg latency`
    );

    // Log detailed operation metrics if needed
    if (Object.keys(this.metrics.operations).length > 0) {
      logger.debug(
        `Cache operation details: ${JSON.stringify(this.metrics.operations)}`
      );
    }
  }
}

export const cacheMonitor = CacheMonitor.getInstance();
```

## Performance Optimization

### Hash Operations

For thread data that needs to be updated incrementally, the system uses Redis hash operations instead of get-set operations to improve efficiency:

```typescript
// Example of hash operations for segment data
export async function updateSegmentData(
  threadId: string,
  fileId: string,
  segment: string,
  data: any
): Promise<void> {
  const key = threadFileKey(threadId, fileId);

  // Use HSET for atomic field update instead of getting the entire object
  await kvClient.hset(key, { [segment]: JSON.stringify(data) });

  // Always refresh TTL after modifications
  await kvClient.expire(key, TTL.THREAD_DATA);
}
```

## Benefits

The RIA25 Vercel KV caching implementation provides several key benefits:

1. **Consistent Interface**: Unified cache access through repository pattern
2. **Local Development**: In-memory fallback for development environments
3. **Type Safety**: TypeScript interfaces for all cache operations
4. **Performance**: Optimized Redis operations for high-performance caching
5. **Monitoring**: Integrated cache performance monitoring
6. **Resilience**: Graceful error handling and fallbacks
7. **Abstraction**: Clean separation between cache access and business logic

---

_Last updated: Tue May 13 12:15:37 BST 2025_
