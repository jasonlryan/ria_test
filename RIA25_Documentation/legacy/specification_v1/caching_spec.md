# RIA25 Caching System Specification

## Overview

The RIA25 caching system provides a unified interface for thread and file data caching using Vercel KV (Redis) in production and an in-memory fallback for local development. This document outlines the architecture, components, and implementation details of the caching system.

## Core Components

### 1. KV Client (`utils/shared/kvClient.ts`)

The KV Client serves as the primary interface for all cache operations, implementing two storage backends:

- **VercelKVClient**: Production Redis-based storage
- **InMemoryStore**: Local development fallback

#### Key Functions

| Function                         | Description             | Parameters                                      | Returns                      |
| -------------------------------- | ----------------------- | ----------------------------------------------- | ---------------------------- | ------ |
| `get<T>(key)`                    | Retrieve cached value   | `key: string`                                   | `Promise<T                   | null>` |
| `set<T>(key, value, options)`    | Store value with TTL    | `key: string, value: T, options?: KVOptions`    | `Promise<boolean>`           |
| `del(key)`                       | Delete cached value     | `key: string`                                   | `Promise<number>`            |
| `hget<T>(key, field)`            | Get hash field          | `key: string, field: string`                    | `Promise<T                   | null>` |
| `hset(key, obj)`                 | Set hash fields         | `key: string, obj: Record<string, any>`         | `Promise<number>`            |
| `hgetall<T>(key)`                | Get all hash fields     | `key: string`                                   | `Promise<Record<string, T>>` |
| `hkeys(key)`                     | Get all hash keys       | `key: string`                                   | `Promise<string[]>`          |
| `hincrby(key, field, increment)` | Increment hash field    | `key: string, field: string, increment: number` | `Promise<number>`            |
| `expire(key, seconds)`           | Set key expiration      | `key: string, seconds: number`                  | `Promise<number>`            |
| `ttl(key)`                       | Get time to live        | `key: string`                                   | `Promise<number>`            |
| `exists(key)`                    | Check if key exists     | `key: string`                                   | `Promise<number>`            |
| `ping()`                         | Check connection status | None                                            | `Promise<boolean>`           |

### 2. Key Schema (`utils/shared/key-schema.ts`)

Defines standardized key formats and TTL values for consistent cache key generation.

#### Key Functions

| Function                          | Description                  | Parameters                         | Returns                           |
| --------------------------------- | ---------------------------- | ---------------------------------- | --------------------------------- |
| `threadFileKey(threadId, fileId)` | Generate thread file key     | `threadId: string, fileId: string` | `thread:{threadId}:file:{fileId}` |
| `threadMetaKey(threadId)`         | Generate thread metadata key | `threadId: string`                 | `thread:{threadId}:meta`          |
| `tempDataKey(type, id)`           | Generate temporary data key  | `type: string, id: string`         | `temp:{type}:{id}`                |

#### TTL Constants

| Constant       | Value    | Description               |
| -------------- | -------- | ------------------------- |
| `THREAD_DATA`  | 90 days  | Thread metadata and files |
| `USER_SESSION` | 24 hours | User session data         |
| `CACHE_DATA`   | 1 hour   | General cache data        |
| `ANALYTICS`    | 30 days  | Analytics data            |

### 3. Unified Cache Interface (`utils/cache-utils.ts`)

Provides high-level cache operations for thread data management.

#### Key Interfaces

```typescript
interface CachedFile {
  id: string;
  data: Record<string, any>;
  loadedSegments: Set<string>;
  availableSegments: Set<string>;
}

interface ThreadCache {
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
```

#### Main Functions

| Function                                                            | Description                  | Parameters                                                                                | Returns                 |
| ------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- | ------ |
| `getThreadCache(threadId)`                                          | Get thread metadata          | `threadId: string`                                                                        | `Promise<ThreadCache    | null>` |
| `updateThreadCache(threadId, data)`                                 | Update thread metadata       | `threadId: string, data: ThreadCache`                                                     | `Promise<boolean>`      |
| `getCachedFilesForThread(threadId, fileId?)`                        | Get cached files             | `threadId: string, fileId?: string`                                                       | `Promise<CachedFile[]>` |
| `updateThreadWithFiles(threadId, newFiles, compatibilityMetadata?)` | Update thread with new files | `threadId: string, newFiles: CachedFile[], compatibilityMetadata?: CompatibilityMetadata` | `Promise<boolean>`      |
| `isCompatibilityMetadataValid(threadId, currentMappingVersion)`     | Check compatibility metadata | `threadId: string, currentMappingVersion: string`                                         | `Promise<boolean>`      |

## Service Integration

### 1. Thread Service (`app/api/services/threadService.js`)

- Uses `UnifiedCache` for thread operations
- Handles thread creation and management
- Integrates with OpenAI thread API

### 2. Data Retrieval Service (`app/api/services/dataRetrievalService.js`)

- Uses `UnifiedCache` for file operations
- Manages file loading and segment caching
- Handles data compatibility checks

## Testing and Diagnostics

### 1. Cache Tests (`tests/cache-utils.test.ts`)

- Unit tests for cache operations
- Tests for thread cache management
- Tests for file caching and merging

### 2. Diagnostic Endpoint (`app/api/redis-test/diagnostic.ts`)

- Tests KV storage functionality
- Verifies cache operations
- Provides diagnostic information

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

## File Function Reference

| File                      | Functions                                                                                                                 | Location                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `kvClient.ts`             | `get`, `set`, `del`, `hget`, `hset`, `hgetall`, `hkeys`, `hincrby`, `expire`, `ttl`, `exists`, `ping`                     | `utils/shared/kvClient.ts`                 |
| `key-schema.ts`           | `threadFileKey`, `threadMetaKey`, `tempDataKey`                                                                           | `utils/shared/key-schema.ts`               |
| `cache-utils.ts`          | `getThreadCache`, `updateThreadCache`, `getCachedFilesForThread`, `updateThreadWithFiles`, `isCompatibilityMetadataValid` | `utils/cache-utils.ts`                     |
| `threadService.js`        | Thread management functions                                                                                               | `app/api/services/threadService.js`        |
| `dataRetrievalService.js` | Data retrieval and caching functions                                                                                      | `app/api/services/dataRetrievalService.js` |
| `cache-utils.test.ts`     | Cache operation tests                                                                                                     | `tests/cache-utils.test.ts`                |
| `diagnostic.ts`           | KV storage tests                                                                                                          | `app/api/redis-test/diagnostic.ts`         |
