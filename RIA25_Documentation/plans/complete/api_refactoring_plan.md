# API Refactoring Plan

## 1. Current Issues

The RIA system currently has two route files that handle OpenAI Assistant functionality with significant code duplication:

1. `/api/chat-assistant/route.ts` - The more complete implementation with:

   - Streaming response support
   - Integration with thread data caching
   - Tool call handling for data retrieval

2. `/api/openai/route.ts` - A simpler implementation with:
   - Switch-case approach for different actions
   - No streaming support
   - Limited integration with other system components

This duplication creates several problems:

- Maintenance burden when updating functionality
- Inconsistent behavior between endpoints
- Confusion for developers about which endpoint to use
- Risk of bugs when fixes are applied to one endpoint but not the other

Additionally, the current API flow involves multiple back-and-forth calls:

- Frontend → `/api/query` → OpenAI (file ID) → `/api/retrieve-data` → Frontend → `/api/chat-assistant` → OpenAI (Assistant)
- This creates unnecessary network latency and complexity in the frontend code

## 2. Refactoring Goals

1. **Consolidate Functionality**: Move to a single primary implementation for assistant-related operations
2. **Improve Modularity**: Extract common functionality into shared utility functions
3. **Clarify API Structure**: Create a clear hierarchy of endpoints with well-defined responsibilities
4. **Maintain Compatibility**: Ensure existing client code continues to work during transition
5. **Streamline API Call Flow**: Reduce network hops by consolidating logic into a single endpoint

## 3. Implementation Approach

### 3.1 Phase 1: Initial Cleanup and Preparation

1. **Add Deprecation Notices**:

   - Add clear deprecation warnings to `openai/route.ts`
   - Update documentation to indicate preferred endpoints
   - Add console warnings when the deprecated endpoint is used

2. **Extract Shared Utilities**:

   - Create `utils/openai/client.ts` for OpenAI client initialization
   - Create `utils/openai/threads.ts` for thread management functions
   - Create `utils/openai/messages.ts` for message handling

3. **Update Primary Implementation**:
   - Refactor `chat-assistant/route.ts` to use the new utilities
   - Ensure all functionality is maintained

### 3.2 Phase 2: Transition Period

1. **Create Compatibility Layer**:

   - Update `openai/route.ts` to use the same underlying utilities as `chat-assistant/route.ts`
   - Log usage metrics to understand which clients are still using the deprecated endpoint

2. **Client Migration Support**:

   - Provide clear migration guides for any custom client code
   - Add automatic forwarding of requests when feasible

3. **Streamline API Call Flow**:
   - Consolidate the logic within a single API endpoint, likely `/api/chat-assistant`
   - Modify the endpoint to accept direct queries from frontend
   - Implement server-side orchestration:
     - Check server-side cache based on threadId
     - Call identifyRelevantFiles directly as a utility function
     - Call retrieveDataFiles directly as a utility function
     - Add the user message to the thread
     - Create the run
     - Handle tool calls
     - Stream the response
   - Update frontend code to use the simplified flow

### 3.3 Phase 3: Final Consolidation

1. **Complete Refactoring**:

   - Either:
     - Completely remove `openai/route.ts` if no longer needed, or
     - Refactor it to handle only non-assistant OpenAI operations (embeddings, completions, etc.)

2. **Finalize API Documentation**:
   - Update all documentation to reflect the finalized API structure
   - Remove references to deprecated endpoints

## 4. Detailed Tasks

### 4.1 Create Shared Utilities

```typescript
// utils/openai/client.ts
import OpenAI from "openai";

export function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// utils/openai/threads.ts
import { createOpenAIClient } from "./client";

export async function createThread() {
  const openai = createOpenAIClient();
  return await openai.beta.threads.create();
}

export async function retrieveThread(threadId) {
  const openai = createOpenAIClient();
  return await openai.beta.threads.retrieve(threadId);
}

// Additional thread-related functions...

// utils/openai/messages.ts
import { createOpenAIClient } from "./client";

export async function createMessage(threadId, role, content) {
  const openai = createOpenAIClient();
  return await openai.beta.threads.messages.create(threadId, {
    role,
    content,
  });
}

export async function listMessages(threadId) {
  const openai = createOpenAIClient();
  return await openai.beta.threads.messages.list(threadId);
}

// Additional message-related functions...
```

### 4.2 Refactor Primary Implementation

Update `chat-assistant/route.ts` to use the new utilities:

```typescript
import { createThread } from "../../../utils/openai/threads";
import { createMessage, listMessages } from "../../../utils/openai/messages";
import { createOpenAIClient } from "../../../utils/openai/client";

// Rest of implementation using these utilities...
```

### 4.3 Update Deprecated Route

```typescript
import { NextResponse } from "next/server";
import { createThread } from "../../../utils/openai/threads";
import { createMessage, listMessages } from "../../../utils/openai/messages";
import { createRun } from "../../../utils/openai/runs";

// DEPRECATION NOTICE and warning logs...

export async function POST(req) {
  // Parse request...
  console.warn(
    "DEPRECATED: Using /api/openai route which is scheduled for refactoring or removal"
  );

  // Use shared utilities for implementation...
}
```

### 4.4 Streamline API Call Flow

Update the primary API endpoint (likely `chat-assistant/route.ts`) to handle the complete flow:

```typescript
// chat-assistant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createThread } from "../../../utils/openai/threads";
import { createMessage, listMessages } from "../../../utils/openai/messages";
import { createRun } from "../../../utils/openai/runs";
import { identifyRelevantFiles } from "../../../utils/openai/file-identification";
import { retrieveDataFiles } from "../../../utils/openai/data-retrieval";
import {
  getCachedFilesForThread,
  updateThreadCache,
} from "../../../utils/cache-utils";

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { assistantId, threadId, query, isFollowUpQuery } = body;

    // Initialize OpenAI client
    const openai = createOpenAIClient();

    // Handle thread creation if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const thread = await createThread();
      finalThreadId = thread.id;
    }

    // Get cached files for this thread if available
    const cachedFileIds = await getCachedFilesForThread(finalThreadId);

    // For new queries or when cache is empty, identify and retrieve relevant data
    let fileIds = [];
    let dataContent = null;

    if (!isFollowUpQuery && cachedFileIds.length === 0) {
      // Identify relevant files
      fileIds = await identifyRelevantFiles(query, assistantId);

      // Retrieve data from files
      dataContent = await retrieveDataFiles(fileIds);

      // Update thread cache
      await updateThreadCache(finalThreadId, fileIds);
    } else {
      // Use cached file IDs for follow-up queries
      fileIds = cachedFileIds;

      // Optionally retrieve data again if needed
      // dataContent = await retrieveDataFiles(fileIds);
    }

    // Create appropriate message content
    let messageContent = query;
    if (dataContent && !isFollowUpQuery) {
      // For new queries with data, we might want to add context
      // This depends on whether we're using OpenAI's built-in retrieval or not
    }

    // Add the user message to the thread
    await createMessage(finalThreadId, "user", messageContent);

    // Create a run with the assistant
    const run = await createRun(finalThreadId, assistantId);

    // Set up streaming response
    // ...streaming implementation...

    // Handle tool calls and process the response
    // ...tool call handling...

    // Return the response stream
  } catch (error) {
    // Error handling
  }
}
```

## 5. Testing Plan

1. **Unit Tests**:

   - Create tests for all shared utilities
   - Verify identical behavior between old and new implementations

2. **Integration Tests**:

   - Test complete API flows using both endpoints
   - Ensure response formats remain consistent
   - Verify streamlined call flow performs correctly with various query types

3. **Compatibility Testing**:

   - Test with the UI application to ensure no regression
   - Confirm that streamlining reduces network traffic as expected

4. **Performance Testing**:
   - Compare response times between old multi-hop approach and new streamlined approach
   - Verify reduced latency in end-to-end user experience

## 6. Timeline

1. **Phase 1 (1-2 weeks)**:

   - Add deprecation notices ✅
   - Create shared utilities
   - Update documentation

2. **Phase 2 (2-4 weeks)**:

   - Refactor primary implementation
   - Update deprecated route to use shared utilities
   - Implement streamlined API call flow
   - Begin tracking usage metrics

3. **Phase 3 (1-2 weeks)**:
   - Final consolidation based on usage metrics
   - Remove or repurpose deprecated endpoints
   - Update all documentation
   - Performance tuning of streamlined flow

## 7. Risks and Mitigations

1. **Risk**: Breaking changes for clients using the deprecated endpoint
   **Mitigation**: Maintain compatibility during transition, provide clear migration guides

2. **Risk**: Regression in functionality during refactoring
   **Mitigation**: Comprehensive testing, staged rollout

3. **Risk**: Unexpected dependencies on deprecated behavior
   **Mitigation**: Careful code analysis, monitoring during transition period

4. **Risk**: Increased complexity in a single endpoint with streamlined flow
   **Mitigation**: Good error handling, logging, and clear code organization

5. **Risk**: Longer processing time for single endpoint handling entire flow
   **Mitigation**: Implement efficient caching, optimize critical path, consider async processing for non-critical steps

## 8. Benefits of Streamlined API Flow

1. **Reduced Latency**:

   - Eliminates multiple HTTP requests and responses
   - Reduces overall time from query to response

2. **Simplified Frontend Code**:

   - Frontend only needs to make a single API call
   - Reduces state management complexity on client side

3. **Improved Error Handling**:

   - Centralized error handling in a single place
   - Better recovery options when failures occur

4. **Enhanced Monitoring**:
   - Single entry point for logging and telemetry
   - Clearer picture of end-to-end performance
