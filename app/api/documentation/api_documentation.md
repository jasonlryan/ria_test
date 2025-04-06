# RIA System API Documentation

This document outlines the API endpoints for the Research Insights Assistant (RIA) system, their functionality, parameters, and response formats.

## Core Endpoints

### 1. `/api/query` - Data-Informed Query Processing

**Purpose**: Main endpoint for processing user queries, retrieving relevant data, and generating responses.

**Method**: POST

**Request Body**:

```json
{
  "query": "string",          // The user's question or prompt
  "threadId": "string",       // Optional: Thread ID for maintaining conversation context
  "assistantId": "string",    // ID of the assistant configuration to use
  "isFollowUpQuery": boolean  // Optional: Flag indicating if this is a follow-up question
}
```

**Response**: Stream of JSON objects containing chunks of the response.

**Process Flow**:

1. Receives and validates the query
2. Determines if it's a follow-up question
3. For new queries: identifies and retrieves relevant data files
4. For follow-ups: uses cached data from previous queries
5. Constructs a context-aware prompt with the query and data
6. Streams the AI-generated response back to the client

**Example**:

```json
POST /api/query
{
  "query": "What factors influence employee retention?",
  "assistantId": "default",
  "threadId": "thread_BBhvKD53FotlQnpxg2zQuh3c"
}
```

### 2. `/api/assistant/[assistantId]/route` - Assistant Configuration

**Purpose**: Retrieves configuration for a specific assistant profile.

**Method**: GET

**Parameters**:

- `assistantId`: ID of the assistant to retrieve configuration for

**Response**:

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "instructions": "string",
  "promptTemplate": "string",
  "dataMapping": {
    "fileIdToPath": { "fileId": "filePath" },
    "topicToFileIds": { "topicName": ["fileId1", "fileId2"] }
  }
}
```

### 3. `/api/chat-assistant/route` - Chat Interaction Processing

**Purpose**: Processes chat interactions and maintains conversation history.

**Method**: POST

**Request Body**:

```json
{
  "message": "string", // User's message
  "threadId": "string", // Optional: Thread ID for conversation context
  "assistantId": "string" // ID of the assistant to use
}
```

**Response**: Stream of response chunks.

### 4. `/api/openai/route` - OpenAI API Access

**Purpose**: Provides direct access to OpenAI API functionality.

**Method**: POST

**Request Body**:

```json
{
  "action": "string", // The action to perform (createThread, createMessage, etc.)
  "threadId": "string", // Optional: Thread ID for operations that require it
  "content": "string" // Optional: Content for message creation
  // Other parameters depending on the action
}
```

**Response**: Varies based on the action.

**Note**: This endpoint contains significant code duplication with `/api/chat-assistant/route` and is a candidate for refactoring.

## Data Retrieval Endpoints

### 1. `/api/retrieval` - File Content Retrieval

**Purpose**: Fetches content from data files based on file IDs.

**Method**: POST

**Request Body**:

```json
{
  "fileIds": ["string"] // Array of file IDs to retrieve
}
```

**Response**:

```json
{
  "data": {
    "fileId1": {
      /* file content */
    },
    "fileId2": {
      /* file content */
    }
  }
}
```

### 2. `/api/file-identification` - Relevant File Identification

**Purpose**: Identifies relevant data files for a given query.

**Method**: POST

**Request Body**:

```json
{
  "query": "string", // The user's question
  "assistantId": "string" // ID of the assistant configuration to use
}
```

**Response**:

```json
{
  "fileIds": ["string"] // Array of identified relevant file IDs
}
```

## Thread Management Endpoints

### 1. `/api/thread/create` - Thread Creation

**Purpose**: Creates a new conversation thread.

**Method**: POST

**Request Body**:

```json
{
  "assistantId": "string" // ID of the assistant to associate with the thread
}
```

**Response**:

```json
{
  "threadId": "string" // New thread ID
}
```

### 2. `/api/thread/[threadId]/messages` - Thread Message History

**Purpose**: Retrieves message history for a thread.

**Method**: GET

**Parameters**:

- `threadId`: ID of the thread to retrieve messages for

**Response**:

```json
{
  "messages": [
    {
      "id": "string",
      "role": "user" | "assistant",
      "content": "string",
      "timestamp": "string"
    }
  ]
}
```

### 3. `/api/thread/[threadId]/cache` - Thread Cache Management

**Purpose**: Manages the data file cache for a specific thread.

**Method**: GET

**Parameters**:

- `threadId`: ID of the thread to retrieve cache for

**Response**:

```json
{
  "fileIds": ["string"] // Array of file IDs cached for this thread
}
```

**Method**: POST (Update Cache)

**Request Body**:

```json
{
  "fileIds": ["string"] // Array of file IDs to add to the cache
}
```

**Response**:

```json
{
  "success": boolean,
  "fileIds": ["string"]      // Updated array of cached file IDs
}
```

## Client-Side API Integration

The client application (typically within the `app/embed/[assistantId]/page.tsx` file) integrates with these APIs using the following pattern:

1. Thread initialization on conversation start
2. Query submission via `/api/query`
3. Local storage of thread ID and cached file IDs
4. Cache utilization for follow-up queries
5. Thread state management for conversation continuity

## Code Duplication and Refactoring

There is significant code duplication between `api/chat-assistant/route.ts` and `api/openai/route.ts`:

1. **Duplicated Logic**:

   - OpenAI client initialization
   - Thread management
   - Message creation and handling
   - Error handling patterns

2. **Current Differences**:

   - `chat-assistant/route.ts` includes streaming support
   - `chat-assistant/route.ts` integrates with thread data caching
   - `openai/route.ts` uses a switch-case approach for different actions

3. **Refactoring Plan**:
   - Consolidate to a single implementation
   - Extract common functionality into shared utility functions
   - Keep `chat-assistant/route.ts` as the primary implementation
   - Either deprecate `openai/route.ts` or refactor it to serve only non-assistant specific OpenAI API calls

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "error": {
    "message": "string", // Human-readable error message
    "code": "string", // Error code for programmatic handling
    "details": {} // Optional additional error details
  }
}
```

Common error codes include:

- `invalid_request`: Missing or invalid parameters
- `not_found`: Requested resource not found
- `processing_error`: Error occurred during query processing
- `data_retrieval_error`: Error retrieving data files

## Authentication and Authorization

API endpoints are currently designed for internal use within the application. Future versions may implement:

- API key authentication for external integrations
- Role-based access control for administrative endpoints
- Rate limiting to prevent abuse

## Implementation Status

Refer to the [Current Status](./current_status.md) document for details on implementation status of various API components.
