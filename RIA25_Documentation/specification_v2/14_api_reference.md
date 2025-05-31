# RIA25 API Reference Guide

**Last Updated:** Sat May 31 2025

> **Target Audience:** Developers, API Users  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 03_data_processing_workflow.md
> - 15_thread_data_management.md

## Overview

This document provides a comprehensive reference for the API endpoints available in the RIA25 system. It includes details about endpoints, request/response formats, authentication, error handling, and best practices for API usage. The v2.0 implementation follows a standardized controller-service architecture and incorporates the repository pattern for improved separation of concerns.

## API Architecture

RIA25 follows the controller-service architecture with repository pattern integration:

```
Client Request → API Routes → Controllers → Services → Repository Pattern → Data Sources
```

### Components

1. **API Routes**

   - Located in `app/api/*/route.ts` directory
   - Handle HTTP protocol (request/response)
   - Delegate business logic to controllers
   - Example: `app/api/chat-assistant/route.ts`

2. **Controllers**

   - Located in `app/api/controllers/` directory
   - Orchestrate business logic
   - Delegate to appropriate services
   - Follow standardized controller pattern
   - Example: `app/api/controllers/chatController.ts`

3. **Services**

   - Located in `app/api/services/` directory
   - Provide reusable business logic
   - Use repository pattern for data access
   - Example: `app/api/services/unifiedOpenAIService.ts`

4. **Repository Pattern**
   - Located in `utils/data/repository/` directory
   - Provides interfaces for data access
   - Implementations abstract data sources
   - Example: `utils/data/repository/implementations/FileSystemRepository.ts`

This layered approach provides several benefits:

- Clear separation of concerns
- Improved testability through interfaces
- Enhanced maintainability with TypeScript
- Standardized error handling

## Controller-Service Architecture Standards

The API follows a standardized controller-service architecture pattern:

### Controller Standards

1. **Naming Convention**: All controllers are named `{name}Controller.ts`
2. **Location**: Controllers are placed in `/app/api/controllers/`
3. **Handler Functions**: Controllers export handler functions (`getHandler`, `postHandler`, `putHandler`)
4. **Error Handling**: All controllers use `formatErrorResponse` and `formatBadRequestResponse` from `utils/shared/errorHandler`
5. **Logging**: All controllers use `logger` from `utils/logger`
6. **Service Delegation**: Controllers delegate business logic to service modules

```typescript
/**
 * Controller for example API endpoints.
 * Handles request validation, delegates to example service,
 * manages response formatting and error handling.
 */

import { NextResponse } from "next/server";
import {
  formatBadRequestResponse,
  formatErrorResponse,
} from "../../../utils/shared/errorHandler";
import ExampleService from "../services/exampleService";
import logger from "../../../utils/logger";

const exampleService = new ExampleService();

export async function postHandler(request) {
  try {
    const body = await request.json();
    // Validate request parameters

    logger.info(`[EXAMPLE] Processing request`);

    // Delegate to service
    const result = await exampleService.processData();

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[ERROR] Example controller error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
```

### Service Standards

1. **Naming Convention**: All services are named `{name}Service.ts`
2. **Location**: Services are placed in `/app/api/services/`
3. **Class-Based**: Services are implemented as classes with clear methods
4. **Documentation**: All service methods have JSDoc comments
5. **Single Responsibility**: Services have a clear, focused responsibility

```typescript
/**
 * Service for example functionality.
 * Provides reusable business logic for example operations.
 */

import logger from "../../../utils/logger";
import { FileRepository } from "../../../utils/data/repository/interfaces/FileRepository";
import { FileSystemRepository } from "../../../utils/data/repository/implementations/FileSystemRepository";

export class ExampleService {
  private fileRepository: FileRepository;

  constructor() {
    this.fileRepository = new FileSystemRepository();
  }

  /**
   * Process data for example functionality
   * @param {string} data - Input data to process
   * @returns {Promise<object>} Processed result
   */
  async processData(data) {
    logger.info(`[EXAMPLE] Processing data`);

    // Use repository pattern for data access
    const files = await this.fileRepository.retrieveDataFiles(["2025_1"]);

    // Process data
    return { result: "processed", files };
  }
}

export default ExampleService;
```

## Authentication

RIA25 uses API key authentication for secure access to all endpoints. The API key must be included in the request headers.

```javascript
// Example header
{
  "Authorization": "Bearer YOUR_API_KEY"
}
```

In development environments, the API key can be set in the `.env.local` file:

```
OPENAI_API_KEY=your_openai_api_key
```

## Base URL

The base URL for all API endpoints is determined by the deployment environment:

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-production-domain.com/api`

## Common Headers

All API requests should include the following headers:

```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

## API Endpoints

### 1. Chat Assistant API

#### Endpoint: `/api/chat-assistant`

**HTTP Method**: POST

**Purpose**: Process user queries using the OpenAI Assistant and provide responses with relevant data.

**Controller**: `chatController.ts`

**Services**:

- `unifiedOpenAIService.ts` - Centralized OpenAI API interactions
- `threadService.ts` - Manages thread creation, retrieval, and caching
- `dataRetrievalService.ts` - Handles data file identification and retrieval

**Repository Pattern Components**:

- `QueryProcessor` - Processes queries and identifies relevant files
- `FileRepository` - Retrieves data files
- `FilterProcessor` - Filters data by segments
- `CacheManager` - Manages thread data caching

**Request Parameters**:

```json
{
  "threadId": "thread_abc123", // Optional: Existing thread ID for follow-up questions
  "message": "How does work-life balance vary by region?",
  "assistantId": "asst_abc123" // Optional: Specific assistant to use
}
```

**Response Format**:

```json
{
  "threadId": "thread_abc123",
  "messageId": "msg_abc123",
  "runId": "run_abc123",
  "response": "Based on the data, work-life balance satisfaction varies significantly by region...",
  "status": "completed"
}
```

**Usage Example**:

```typescript
// Client-side code
async function queryChatAssistant(message: string, threadId?: string) {
  const response = await fetch("/api/chat-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      message,
      threadId,
    }),
  });

  const data = await response.json();
  return data;
}
```

**Implementation Details**:

The chat assistant API uses the repository pattern for data retrieval:

```typescript
// Simplified implementation in chatController.ts
export async function postHandler(request) {
  try {
    const { message, threadId } = await request.json();

    // Use unifiedOpenAIService
    const openAIService = new UnifiedOpenAIService();

    // Create thread if needed
    const finalThreadId = threadId || (await openAIService.createThread());

    // Use repository pattern for data retrieval
    const queryProcessor = new QueryProcessorImpl(
      new OpenAIPromptRepository(),
      new VercelKVCacheManager()
    );

    // Process query to identify relevant files
    const processedQuery = await queryProcessor.processQuery(message, {
      threadId: finalThreadId,
    });

    // Check compatibility
    if (processedQuery.incompatible) {
      return NextResponse.json({
        threadId: finalThreadId,
        response: processedQuery.incompatibleMessage,
        status: "completed",
      });
    }

    // Retrieve and process data files
    const fileRepository = new FileSystemRepository();
    const files = await fileRepository.retrieveDataFiles(
      processedQuery.fileIds
    );

    // Filter data
    const filterProcessor = new SmartFilteringProcessor();
    const filteredData = filterProcessor.filterDataBySegments(files, {
      query: message,
      segments: ["region", "age", "gender"],
    });

    // Send data to OpenAI
    const response = await openAIService.getAssistantResponse(
      finalThreadId,
      message,
      filteredData
    );

    return NextResponse.json({
      threadId: finalThreadId,
      messageId: response.messageId,
      runId: response.runId,
      response: response.content,
      status: "completed",
    });
  } catch (error) {
    logger.error(`[ERROR] Chat assistant error: ${error.message}`);
    return formatErrorResponse(error);
  }
}
```

### 2. Query API

#### Endpoint: `/api/query`

**HTTP Method**: POST

**Purpose**: Process queries, identify relevant data files, and return filtered data.

**Controller**: `queryController.ts`

**Services**:

- `dataRetrievalService.ts` - Handles data file identification and retrieval using repository pattern

**Repository Pattern Components**:

- `QueryProcessor` - Processes queries and identifies relevant files
- `FileRepository` - Retrieves data files
- `FilterProcessor` - Filters data by segments

**Request Parameters**:

```json
{
  "query": "How does work satisfaction vary by region?",
  "threadId": "thread_abc123", // Optional: Existing thread ID
  "includeFiles": true, // Optional: Include file paths in response
  "segmentFilter": ["region", "age"] // Optional: Specific segments to include
}
```

**Response Format**:

```json
{
  "relevantData": [
    {
      "metadata": {
        "survey_year": 2025,
        "question_number": 5,
        "question_text": "I am satisfied with my work-life balance."
      },
      "responses": {
        "by_region": {
          "North America": {
            "response_count": 1500,
            "response_data": {
              "Agree": 45,
              "Strongly Agree": 30
              // Additional data...
            }
          }
          // Additional regions...
        }
        // Additional segments if requested...
      }
    }
    // Additional relevant data...
  ],
  "fileIds": ["2025_5", "2024_5"], // If includeFiles is true
  "segments": ["region", "age"], // Segments included in response
  "cachingInfo": {
    "cacheHit": true,
    "cachedSegments": ["region"],
    "newlyLoadedSegments": ["age"]
  }
}
```

**Usage Example**:

```typescript
// Client-side code
async function queryData(query: string, threadId?: string) {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      query,
      threadId,
      includeFiles: true,
    }),
  });

  const data = await response.json();
  return data;
}
```

### 3. Thread Management API

#### Endpoint: `/api/thread`

**HTTP Method**: GET, POST, DELETE

**Purpose**: Manage conversation threads for the assistant.

**Controller**: `threadController.ts`

**Services**:

- `threadService.ts` - Comprehensive thread management
- `unifiedOpenAIService.ts` - OpenAI integration

**Repository Pattern Components**:

- `CacheManager` - Thread data caching with Vercel KV

**Create Thread (POST):**

Request:

```json
{
  "metadata": {
    "user_id": "user123",
    "session_start": "2025-05-01T10:30:00Z"
  }
}
```

Response:

```json
{
  "threadId": "thread_abc123",
  "metadata": {
    "user_id": "user123",
    "session_start": "2025-05-01T10:30:00Z"
  },
  "created_at": "2025-05-01T10:30:00Z"
}
```

**Get Thread (GET):**

Request:

```
GET /api/thread/thread_abc123
```

Response:

```json
{
  "threadId": "thread_abc123",
  "metadata": {
    "user_id": "user123",
    "session_start": "2025-05-01T10:30:00Z"
  },
  "messages": [
    {
      "id": "msg_abc123",
      "role": "user",
      "content": "How does work satisfaction vary by region?",
      "created_at": "2025-05-01T10:30:05Z"
    },
    {
      "id": "msg_def456",
      "role": "assistant",
      "content": "Based on the data...",
      "created_at": "2025-05-01T10:30:10Z"
    }
  ],
  "cached_file_ids": ["2025_1", "2025_5"],
  "created_at": "2025-05-01T10:30:00Z"
}
```

**Delete Thread (DELETE):**

Request:

```
DELETE /api/thread/thread_abc123
```

Response:

```json
{
  "threadId": "thread_abc123",
  "deleted": true,
  "cache_cleared": true
}
```

### 4. Data Files API

#### Endpoint: `/api/data-files`

**HTTP Method**: GET

**Purpose**: List and access available data files.

**Controller**: `dataFilesController.ts`

**Repository Pattern Components**:

- `FileRepository` - Provides access to data files and metadata

**Request Parameters**:

```
GET /api/data-files?year=2025&question=5
```

**Response Format**:

```json
{
  "dataFiles": [
    {
      "id": "2025_5",
      "metadata": {
        "survey_year": 2025,
        "question_number": 5,
        "question_text": "I am satisfied with my work-life balance."
      },
      "availableSegments": ["region", "age", "gender", "job_level", "sector"],
      "filePath": "scripts/output/split_data/2025_5.json",
      "fileSize": 24580,
      "lastModified": "2025-05-01T14:22:30Z",
      "compatibility": {
        "year": "2025",
        "topics": ["work_life_balance", "satisfaction"],
        "comparable_years": ["2024"]
      }
    }
    // Additional files...
  ],
  "totalFiles": 1,
  "filter": {
    "year": 2025,
    "question": 5
  }
}
```

### 5. Starter Questions API

#### Endpoint: `/api/starter-questions`

**HTTP Method**: GET

**Purpose**: Retrieve predefined starter questions for the assistant.

**Controller**: `starterQuestionsController.ts`

**Services**:

- `starterQuestionsService.ts` - Manages starter question configuration

**Response Format**:

```json
{
  "starterQuestions": [
    {
      "id": "SQ1",
      "text": "What are the key factors affecting employee satisfaction?",
      "relevantFiles": ["2025_1", "2025_5", "2025_10"],
      "segments": ["region", "job_level"],
      "order": 1
    },
    {
      "id": "SQ2",
      "text": "How does work-life balance vary across regions?",
      "relevantFiles": ["2025_5", "2024_5"],
      "segments": ["region", "age"],
      "order": 2
    }
    // Additional starter questions...
  ],
  "count": 2
}
```

## Diagnostic Endpoints

### 1. `/api/health` - Health Check

**Purpose**: Provides basic health check for the application.

**Method**: GET

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2025-05-01T00:00:00.000Z",
  "version": "2.0.0",
  "repositories": {
    "file_repository": "ok",
    "query_processor": "ok",
    "cache_manager": "ok"
  }
}
```

### 2. `/api/redis-test` - KV Connection Test

**Purpose**: Tests connectivity and functionality of the Vercel KV (Redis) integration.

**Method**: GET

**Response**:

```json
{
  "working": true,
  "testKey": "test-redis-1234567890",
  "original": { "timestamp": 1234567890, "test": "Redis connection test" },
  "retrieved": { "timestamp": 1234567890, "test": "Redis connection test" },
  "latency_ms": 42
}
```

**Error Response** (Status 500):

```json
{
  "working": false,
  "error": "KV connection failed: ...",
  "fallback_active": true
}
```

**Notes**:

- In production, this endpoint tests actual Redis connectivity
- With `USE_KV=false`, it tests the in-memory fallback store
- Useful for verifying that environment variables are correctly configured

## Error Handling

All API endpoints use a standardized error response format:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request is missing required parameters",
    "status": 400,
    "details": {
      "missing_parameters": ["message"]
    }
  }
}
```

### Common Error Codes

| Error Code                | HTTP Status | Description                |
| ------------------------- | ----------- | -------------------------- |
| `unauthorized`            | 401         | Invalid or missing API key |
| `not_found`               | 404         | Resource not found         |
| `invalid_request`         | 400         | Invalid request parameters |
| `rate_limit_exceeded`     | 429         | Too many requests          |
| `internal_error`          | 500         | Server error               |
| `compatibility_error`     | 422         | Data compatibility issue   |
| `repository_access_error` | 503         | Repository access failure  |

## Repository Pattern Integration

The API endpoints leverage the repository pattern through standard interfaces:

### Key Repository Interfaces

```typescript
// FileRepository - Handles file operations
interface FileRepository {
  retrieveDataFiles(fileIds: string[]): Promise<DataFile[]>;
  loadFileSegments(fileId: string, segments: string[]): Promise<SegmentData>;
  getFileMetadata(fileIds: string[]): Promise<FileMetadata[]>;
}

// QueryProcessor - Processes queries
interface QueryProcessor {
  processQuery(query: string, context: QueryContext): Promise<ProcessedQuery>;
  identifyRelevantFiles(query: string): Promise<FileIdentificationResult>;
}

// FilterProcessor - Filters data
interface FilterProcessor {
  filterDataBySegments(files: DataFile[], context: FilterContext): FilterResult;
  getBaseData(files: DataFile[]): BaseDataResult;
  parseQueryIntent(query: string): QueryIntent;
}

// CacheManager - Manages caching
interface CacheManager {
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

### Standard Implementation Pattern

Controllers and services follow a standard pattern for using repository components:

```typescript
// Standard controller pattern
export async function postHandler(request) {
  try {
    // 1. Extract request data
    const { query, threadId } = await request.json();

    // 2. Initialize repository components
    const queryProcessor = new QueryProcessorImpl();
    const fileRepository = new FileSystemRepository();
    const filterProcessor = new SmartFilteringProcessor();

    // 3. Process query
    const processedQuery = await queryProcessor.processQuery(query, {
      threadId,
    });

    // 4. Retrieve data
    const files = await fileRepository.retrieveDataFiles(
      processedQuery.fileIds
    );

    // 5. Process data
    const result = filterProcessor.filterDataBySegments(files, { query });

    // 6. Return response
    return NextResponse.json({
      result,
      fileIds: processedQuery.fileIds,
    });
  } catch (error) {
    // 7. Handle errors
    return formatErrorResponse(error);
  }
}
```

## Rate Limiting

API requests are subject to rate limiting:

- **Development**: 100 requests per minute
- **Production**: 1000 requests per minute per API key

When rate limits are exceeded, the API returns a 429 status code with a Retry-After header.

## Best Practices

### Optimization

1. **Use Thread IDs for Follow-up Queries**

   - Always include the threadId for follow-up queries to leverage cached data using Vercel KV

2. **Specify Required Segments**

   - Use the segmentFilter parameter to request only the segments you need
   - Reduces data transmission and improves response times

3. **Implement Client-Side Caching**
   - Cache responses on the client side when appropriate
   - Respect the Cache-Control headers

### TypeScript Integration

The API supports full TypeScript types for all request and response objects:

```typescript
// Example TypeScript definitions for API requests/responses
interface ChatAssistantRequest {
  message: string;
  threadId?: string;
  assistantId?: string;
}

interface ChatAssistantResponse {
  threadId: string;
  messageId: string;
  runId: string;
  response: string;
  status: "completed" | "processing" | "failed";
}

// Usage with TypeScript
async function queryChatAssistant(
  request: ChatAssistantRequest
): Promise<ChatAssistantResponse> {
  const response = await fetch("/api/chat-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(request),
  });

  return await response.json();
}
```

## Client Implementation Examples

### TypeScript (Browser)

```typescript
// Initialize client
const RIA25Client = {
  apiKey: "your_api_key",
  baseUrl: "https://your-domain.com/api",

  // Create a new thread
  async createThread(): Promise<{ threadId: string }> {
    const response = await fetch(`${this.baseUrl}/thread`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({}),
    });

    return await response.json();
  },

  // Send a query to the assistant
  async queryAssistant(
    message: string,
    threadId?: string
  ): Promise<ChatAssistantResponse> {
    const response = await fetch(`${this.baseUrl}/chat-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        message,
        threadId,
      }),
    });

    return await response.json();
  },
};

// Usage example
async function chatExample() {
  // Create a new thread
  const thread = await RIA25Client.createThread();

  // Send a query
  const response = await RIA25Client.queryAssistant(
    "How does work satisfaction vary by region?",
    thread.threadId
  );

  console.log(response);
}
```

### Node.js (TypeScript)

```typescript
import axios, { AxiosInstance } from "axios";

interface ChatAssistantResponse {
  threadId: string;
  messageId: string;
  runId: string;
  response: string;
  status: "completed" | "processing" | "failed";
}

class RIA25ApiClient {
  private apiKey: string;
  private baseUrl: string;
  private client: AxiosInstance;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async createThread() {
    const response = await this.client.post("/thread", {});
    return response.data;
  }

  async queryAssistant(
    message: string,
    threadId?: string
  ): Promise<ChatAssistantResponse> {
    const response = await this.client.post("/chat-assistant", {
      message,
      threadId,
    });
    return response.data;
  }

  async getDataFiles(year: number, question: number) {
    const response = await this.client.get("/data-files", {
      params: { year, question },
    });
    return response.data;
  }
}

// Usage
const apiClient = new RIA25ApiClient(
  "your_api_key",
  "https://your-domain.com/api"
);

async function example() {
  const thread = await apiClient.createThread();
  const response = await apiClient.queryAssistant(
    "How does work satisfaction vary by region?",
    thread.threadId
  );
  console.log(response);
}
```

## Versioning

The current API version is v2.0. The version is included in the request URL:

```
https://your-domain.com/api/v2/chat-assistant
```

## Changelog

### v2.0.0 (May 2025)

- Implemented repository pattern for data access
- Enhanced controller-service architecture with standardized patterns
- Added TypeScript support for all API endpoints
- Integrated Vercel KV for thread data caching
- Improved error handling with repository-specific error codes
- Enhanced compatibility validation with unified compatibility system
- Added health check endpoint with repository status

### v1.0.0 (April 2024)

- Initial release of the RIA25 API
- Implemented chat assistant, query, thread management, data files, and starter questions endpoints
- Added comprehensive error handling and rate limiting
- Modularized architecture with controllers and services

---

_Last updated: Sat May 31 2025_
