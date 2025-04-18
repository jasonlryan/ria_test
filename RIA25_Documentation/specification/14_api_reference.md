# RIA25 API Reference Guide

> **Last Updated:** April 30, 2024  
> **Target Audience:** Developers, API Users  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 03_data_processing_workflow.md
> - 15_thread_data_management.md

## Overview

This document provides a comprehensive reference for the API endpoints available in the RIA25 system. It includes details about endpoints, request/response formats, authentication, error handling, and best practices for API usage.

## API Architecture

RIA25 follows a modular architecture that separates concerns across multiple layers:

```
Client Request → API Routes → Controllers → Services → Utilities → Data Sources
```

### Components

1. **API Routes**

   - Located in `app/api/` directory
   - Handle HTTP protocol (request/response)
   - Delegate business logic to controllers
   - Example: `app/api/chat-assistant/route.ts`

2. **Controllers**

   - Located in `app/api/controllers/` directory
   - Orchestrate business logic
   - Delegate to appropriate services
   - Example: `app/api/controllers/chatAssistantController.ts`

3. **Services**

   - Located in `app/api/services/` directory
   - Provide reusable functionality
   - Example: `app/api/services/threadService.js`

4. **Utilities**
   - Located in `utils/` directory
   - Provide core functionality for data processing and integration
   - Example: `utils/openai/retrieval.js`

This layered approach provides several benefits:

- Clear separation of concerns
- Improved testability
- Easier maintenance
- Code reusability

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

**Controller**: `chatAssistantController.ts`

**Services**:

- `threadService.js` - Manages thread creation, retrieval, and caching
- `messageService.js` - Handles message creation and retrieval
- `assistantService.js` - Interacts with OpenAI Assistant API

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

```javascript
// Client-side code
async function queryChatAssistant(message, threadId = null) {
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

**Response Streaming**:

For streamed responses, the API returns a stream of events with partial responses:

```javascript
// Client-side code for streaming
const eventSource = new EventSource(
  "/api/chat-assistant/stream?threadId=thread_abc123&message=query"
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Append data.content to UI
};

eventSource.onerror = (error) => {
  console.error("EventSource error:", error);
  eventSource.close();
};
```

### 2. Query API

#### Endpoint: `/api/query`

**HTTP Method**: POST

**Purpose**: Process queries, identify relevant data files, and return filtered data.

**Controller**: `queryController.js`

**Services**:

- `dataRetrievalService.js` - Handles data file identification and retrieval
- `filteringService.js` - Applies smart filtering to data

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

```javascript
// Client-side code
async function queryData(query, threadId = null) {
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

**Controller**: `threadController.js`

**Services**:

- `threadService.js` - Comprehensive thread management

**Create Thread (POST):**

Request:

```json
{
  "metadata": {
    "user_id": "user123",
    "session_start": "2024-03-15T10:30:00Z"
  }
}
```

Response:

```json
{
  "threadId": "thread_abc123",
  "metadata": {
    "user_id": "user123",
    "session_start": "2024-03-15T10:30:00Z"
  },
  "created_at": "2024-03-15T10:30:00Z"
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
    "session_start": "2024-03-15T10:30:00Z"
  },
  "messages": [
    {
      "id": "msg_abc123",
      "role": "user",
      "content": "How does work satisfaction vary by region?",
      "created_at": "2024-03-15T10:30:05Z"
    },
    {
      "id": "msg_def456",
      "role": "assistant",
      "content": "Based on the data...",
      "created_at": "2024-03-15T10:30:10Z"
    }
  ],
  "created_at": "2024-03-15T10:30:00Z"
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
  "deleted": true
}
```

### 4. Data Files API

#### Endpoint: `/api/data-files`

**HTTP Method**: GET

**Purpose**: List and access available data files.

**Controller**: `dataFilesController.js`

**Services**:

- `dataFilesService.js` - Manages data file access and metadata

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
      "lastModified": "2024-03-10T14:22:30Z"
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

**Usage Example**:

```javascript
// Client-side code
async function getDataFiles(year, question) {
  const response = await fetch(
    `/api/data-files?year=${year}&question=${question}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    }
  );

  const data = await response.json();
  return data;
}
```

### 5. Starter Questions API

#### Endpoint: `/api/starter-questions`

**HTTP Method**: GET

**Purpose**: Retrieve predefined starter questions for the assistant.

**Controller**: `starterQuestionsController.js`

**Services**:

- `starterQuestionsService.js` - Manages starter question configuration

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

**Usage Example**:

```javascript
// Client-side code
async function getStarterQuestions() {
  const response = await fetch("/api/starter-questions", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  const data = await response.json();
  return data;
}
```

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

| Error Code            | HTTP Status | Description                |
| --------------------- | ----------- | -------------------------- |
| `unauthorized`        | 401         | Invalid or missing API key |
| `not_found`           | 404         | Resource not found         |
| `invalid_request`     | 400         | Invalid request parameters |
| `rate_limit_exceeded` | 429         | Too many requests          |
| `internal_error`      | 500         | Server error               |

## Rate Limiting

API requests are subject to rate limiting:

- **Development**: 100 requests per minute
- **Production**: 1000 requests per minute per API key

When rate limits are exceeded, the API returns a 429 status code with a Retry-After header.

## Best Practices

### Optimization

1. **Use Thread IDs for Follow-up Queries**

   - Always include the threadId for follow-up queries to leverage cached data

2. **Specify Required Segments**

   - Use the segmentFilter parameter to request only the segments you need

3. **Implement Caching**
   - Cache responses on the client side when appropriate
   - Respect the Cache-Control headers

### Security

1. **Protect API Keys**

   - Never expose API keys in client-side code
   - Use environment variables for API key storage

2. **Implement HTTPS**

   - Always use HTTPS for production environments

3. **Validate Input**
   - Sanitize and validate all user input before sending to the API

## Client Implementation Examples

### JavaScript (Browser)

```javascript
// Initialize client
const RIA25Client = {
  apiKey: "your_api_key",
  baseUrl: "https://your-domain.com/api",

  // Create a new thread
  async createThread() {
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
  async queryAssistant(message, threadId) {
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

### Node.js

```javascript
const axios = require("axios");

class RIA25ApiClient {
  constructor(apiKey, baseUrl) {
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

  async queryAssistant(message, threadId) {
    const response = await this.client.post("/chat-assistant", {
      message,
      threadId,
    });
    return response.data;
  }

  async getDataFiles(year, question) {
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

The current API version is v1. The version is included in the request URL:

```
https://your-domain.com/api/v1/chat-assistant
```

## Changelog

### v1.0.0 (April 2024)

- Initial release of the RIA25 API
- Implemented chat assistant, query, thread management, data files, and starter questions endpoints
- Added comprehensive error handling and rate limiting
- Modularized architecture with controllers and services

---

_Last updated: April 30, 2024_
