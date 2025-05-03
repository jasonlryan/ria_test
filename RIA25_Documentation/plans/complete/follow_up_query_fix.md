# Follow-Up Query Handling Fix

**Last Updated:** Sat Oct 19 2023

## Problem Overview

Our follow-up query handling has broken after the recent refactor. The system can no longer accurately identify when a query is a follow-up to a previous question or maintain context between related queries. This results in empty data retrieval, incorrect topic identification, and poor user experience.

The logs reveal several critical issues:

```
[IS FOLLOW-UP FLAG: true]
[CACHED FILE IDS: []]
[HAS PREVIOUS QUERY: YES]
[QUERY: "Query: how does this compare to 2024 data?..."]
[PREV QUERY: "Query: What factors related to job choice, stayin..."]
```

## Root Causes

1. **Query Format Corruption**

   - Follow-up queries are being sent as formatted strings (`"Query: {actual query}\n\nAnalysis Summary: ..."`) rather than clean text
   - The LLM interprets this incorrectly, treating analysis sections as part of the query

2. **Context Loss Between Message Retrievals**

   - In `chatAssistantController.ts`, previous messages are retrieved twice:
     - Once for compatibility checks
     - Again for main identification logic
   - The second retrieval overwrites important context from the first

3. **Inconsistent Follow-Up Flag Usage**

   - `isFollowUp` is set based on `threadId` existence, but not consistently passed to all functions
   - In the tool output handling, follow-up flags aren't properly passed to `processQueryWithData`

4. **Missing Metadata in Tool Calls**

   - When the assistant makes data retrieval tool calls, we don't pass critical context from previous queries

5. **Thread State Inconsistency**
   - Thread metadata and file information isn't reliably maintained between requests

## Implementation Plan

### Phase 1: Query Normalization (Critical Fix)

1. **Create Query Normalization Utility**
   - Add a utility function in `utils/shared/queryUtils.ts`:

```typescript
/**
 * Normalizes query text by removing prefixes and analysis sections
 * @param text Raw query text that may contain formatting
 * @returns Clean query text
 */
export function normalizeQueryText(text: string): string {
  if (!text) return "";

  // Remove "Query:" prefix and analysis sections
  if (text.toLowerCase().startsWith("query:")) {
    const queryParts = text.split(/\n\n(?:Analysis|Summary)/i);
    return queryParts[0].replace(/^Query:\s*/i, "").trim();
  }

  // Handle other potential formats
  return text.trim();
}
```

2. **Apply Normalization at Input Points**
   - In `chatAssistantController.ts`:
     - Normalize both current and previous queries
     - Ensure clean queries are used for topic detection

### Phase 2: Context Preservation

1. **Refactor Message Retrieval**
   - Consolidate message retrieval to once per request
   - Store normalized queries and responses

```typescript
// In chatAssistantController.ts
let context = {
  normalizedCurrentQuery: "",
  normalizedPreviousQuery: "",
  previousResponse: "",
  isFollowUp: false,
};

// Retrieve messages once
if (isFollowUp) {
  try {
    const messagesResponse = await unifiedOpenAIService.listMessages(
      finalThreadId,
      { limit: 4 }
    );
    const messages = messagesResponse.data.data;

    // Extract previous query and response
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "assistant" && messages[i + 1].role === "user") {
        const assistantContent = messages[i].content?.[0];
        const userContent = messages[i + 1].content?.[0];

        if (assistantContent?.type === "text" && userContent?.type === "text") {
          context.previousResponse = assistantContent.text.value;
          const rawPreviousQuery = userContent.text.value;
          context.normalizedPreviousQuery =
            normalizeQueryText(rawPreviousQuery);
          break;
        }
      }
    }

    // Normalize current query
    context.normalizedCurrentQuery = normalizeQueryText(content);
    context.isFollowUp = isFollowUp;

    logger.info(
      `[CONTEXT] Normalized current query: "${context.normalizedCurrentQuery.substring(
        0,
        50
      )}..."`
    );
    logger.info(
      `[CONTEXT] Normalized previous query: "${context.normalizedPreviousQuery.substring(
        0,
        50
      )}..."`
    );
  } catch (error) {
    logger.error("Error retrieving and normalizing context:", error);
  }
}
```

### Phase 3: Fix Follow-Up Flag and Tool Call Context

1. **Consistent isFollowUp Flag Usage**
   - Ensure all calls include proper follow-up context:

```typescript
// In tool call handlers:
const result = await processQueryWithData(
  normalizeQueryText(query),
  "all-sector",
  cachedFileIds,
  finalThreadId,
  context.isFollowUp, // Add isFollowUp flag
  context.normalizedPreviousQuery, // Add normalized previous query
  context.previousResponse // Add previous response
);
```

2. **Direct Mode Tool Call Fix**
   - Apply same context principles in direct mode:

```typescript
const relevantFilesResult = await identifyRelevantFiles(
  normalizeQueryText(query),
  "all-sector",
  context.isFollowUp,
  context.normalizedPreviousQuery,
  context.previousResponse
);
```

### Phase 4: Thread State Management

1. **Enhanced Thread Metadata**
   - Update the thread metadata to include query context:

```typescript
await UnifiedCache.updateThreadWithContext(finalThreadId, {
  previousQueries: [context.normalizedCurrentQuery, ...existingQueries].slice(
    0,
    5
  ),
  isFollowUp: true,
  lastQueryTime: Date.now(),
});
```

2. **Context Retrieval Enhancement**
   - Improve thread context retrieval for follow-ups:

```typescript
// Add to dataRetrievalService.js
async getThreadContext(threadId) {
  const cacheEntry = await UnifiedCache.getThreadMetadata(threadId);
  return {
    previousQueries: cacheEntry?.previousQueries || [],
    isFollowUp: !!cacheEntry?.previousQueries?.length,
    lastQueryTime: cacheEntry?.lastQueryTime
  };
}
```

## Specific File Changes

### 1. Create `utils/shared/queryUtils.ts`

```typescript
/**
 * Query utilities for text normalization and context handling
 */

/**
 * Normalizes query text by removing prefixes and analysis sections
 */
export function normalizeQueryText(text: string): string {
  if (!text) return "";

  // Remove "Query:" prefix and analysis sections
  if (text.toLowerCase().startsWith("query:")) {
    const queryParts = text.split(/\n\n(?:Analysis|Summary)/i);
    return queryParts[0].replace(/^Query:\s*/i, "").trim();
  }

  // Handle other formats
  const cleanText = text.trim();

  // Remove common prefixes
  return cleanText;
}

/**
 * Extracts a clean query from an assistant tool call
 */
export function extractCleanQueryFromToolCall(toolCallArgs: any): string {
  try {
    if (!toolCallArgs || !toolCallArgs.query) return "";
    return normalizeQueryText(toolCallArgs.query);
  } catch (e) {
    return "";
  }
}

/**
 * Creates a thread context object with normalized queries
 */
export function createThreadContext(
  currentQuery: string,
  previousQuery: string,
  previousResponse: string,
  isFollowUp: boolean
) {
  return {
    normalizedCurrentQuery: normalizeQueryText(currentQuery),
    normalizedPreviousQuery: normalizeQueryText(previousQuery),
    previousResponse,
    isFollowUp,
  };
}
```

### 2. Modify `app/api/controllers/chatAssistantController.ts`

```typescript
// Add import
import {
  normalizeQueryText,
  createThreadContext,
} from "../../../utils/shared/queryUtils";

// Then in the postHandler function:
let context = {
  normalizedCurrentQuery: normalizeQueryText(content),
  normalizedPreviousQuery: "",
  previousResponse: "",
  isFollowUp: !!threadId,
};

// Consolidate message retrieval
if (context.isFollowUp) {
  try {
    const messagesResponse = await unifiedOpenAIService.listMessages(
      finalThreadId,
      { limit: 4 }
    );
    const messages = messagesResponse.data.data;

    // Extract previous query and response
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === "assistant" && messages[i + 1].role === "user") {
        const assistantContent = messages[i].content?.[0];
        const userContent = messages[i + 1].content?.[0];

        if (assistantContent?.type === "text" && userContent?.type === "text") {
          context.previousResponse = assistantContent.text.value;
          context.normalizedPreviousQuery = normalizeQueryText(
            userContent.text.value
          );
          break;
        }
      }
    }

    logger.info(
      `[CONTEXT] Normalized current query: "${context.normalizedCurrentQuery.substring(
        0,
        50
      )}..."`
    );
    logger.info(
      `[CONTEXT] Normalized previous query: "${context.normalizedPreviousQuery.substring(
        0,
        50
      )}..."`
    );
  } catch (error) {
    logger.error("Error retrieving and normalizing context:", error);
  }
}

// Use context consistently in all tool calls
// For example, in direct mode:
const relevantFilesResult = await identifyRelevantFiles(
  context.normalizedCurrentQuery,
  "all-sector",
  context.isFollowUp,
  context.normalizedPreviousQuery,
  context.previousResponse
);

// And in standard mode:
const result = await processQueryWithData(
  normalizeQueryText(query), // Normalize tool query
  "all-sector",
  cachedFileIds,
  finalThreadId,
  context.isFollowUp,
  context.normalizedPreviousQuery,
  context.previousResponse
);
```

### 3. Update `app/api/controllers/queryController.ts`

```typescript
// Add import
import { normalizeQueryText } from "../../../utils/shared/queryUtils";

// In postHandler function:
const normalizedQuery = normalizeQueryText(query);
const normalizedPreviousQuery = previousQuery
  ? normalizeQueryText(previousQuery)
  : "";

logger.info(
  `[QUERY] Processing normalized query: "${normalizedQuery.substring(
    0,
    50
  )}..." | ThreadId: ${threadId || "none"} | IsFollowUp: ${isFollowUp}`
);

// Pass normalized queries
const result = await dataRetrievalService.processQueryWithData(
  normalizedQuery,
  "all-sector",
  [], // We don't have cached file IDs here, this should be fixed
  threadId || "default",
  isFollowUp,
  normalizedPreviousQuery,
  previousAssistantResponse || ""
);
```

### 4. Update `utils/cache-utils.ts`

```typescript
// Add thread context functions

/**
 * Updates thread with query context
 */
export async function updateThreadWithContext(
  threadId: string,
  contextData: {
    previousQueries?: string[];
    isFollowUp?: boolean;
    lastQueryTime?: number;
  }
): Promise<void> {
  try {
    const key = threadMetaKey(threadId);
    const existing = (await kvClient.get(key)) || {};

    // Merge with existing metadata
    const updated = {
      ...existing,
      previousQueries:
        contextData.previousQueries || existing.previousQueries || [],
      isFollowUp: contextData.isFollowUp ?? existing.isFollowUp,
      lastQueryTime: contextData.lastQueryTime || Date.now(),
    };

    await kvClient.set(key, updated, { ex: 60 * 60 * 24 * 7 }); // 7 days TTL
  } catch (error) {
    logger.error(
      `Error updating thread context for ${threadId}: ${error.message}`
    );
  }
}

/**
 * Gets thread context metadata
 */
export async function getThreadContext(threadId: string): Promise<{
  previousQueries: string[];
  isFollowUp: boolean;
  lastQueryTime?: number;
}> {
  try {
    const key = threadMetaKey(threadId);
    const data = (await kvClient.get(key)) || {};

    return {
      previousQueries: data.previousQueries || [],
      isFollowUp:
        Array.isArray(data.previousQueries) && data.previousQueries.length > 0,
      lastQueryTime: data.lastQueryTime,
    };
  } catch (error) {
    logger.error(
      `Error getting thread context for ${threadId}: ${error.message}`
    );
    return { previousQueries: [], isFollowUp: false };
  }
}
```

## Testing Strategy

1. **Unit Tests**

   - Test `normalizeQueryText` with various input formats
   - Test context creation and management functions

2. **Integration Tests**

   - Test end-to-end flow with normalized queries
   - Verify follow-up detection works with different query formats

3. **Manual QA Testing**
   - Test with real-world queries and follow-ups
   - Verify context is maintained across session

## Proof of Concept

Here's a minimal proof of concept you can implement with Cursor to validate the approach:

```typescript
// Add this to utils/shared/queryUtils.ts
export function normalizeQueryText(text: string): string {
  if (!text) return "";

  // Remove "Query:" prefix and analysis sections
  if (text.toLowerCase().startsWith("query:")) {
    const queryParts = text.split(/\n\n(?:Analysis|Summary)/i);
    return queryParts[0].replace(/^Query:\s*/i, "").trim();
  }
  return text.trim();
}

// Test with sample queries from logs
const queries = [
  "how does this compare with 2024?",
  "Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected",
  "Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification",
  "what is the level of trust employees have in their direct managers?",
];

// Log normalized results
queries.forEach((q) => {
  console.log(`Original: "${q.substring(0, 40)}..."`);
  console.log(`Normalized: "${normalizeQueryText(q)}"\n`);
});
```

To test this in production:

1. Add the `normalizeQueryText` function to `utils/shared/queryUtils.ts`
2. Add minimal logging in `chatAssistantController.ts`:

```typescript
// At the beginning of request handling
logger.info(`[DEBUG] Raw query: "${content.substring(0, 50)}..."`);
logger.info(
  `[DEBUG] Normalized: "${normalizeQueryText(content).substring(0, 50)}..."`
);

// In the message retrieval section
if (userContent?.type === "text") {
  const rawPreviousQuery = userContent.text.value;
  logger.info(
    `[DEBUG] Raw previous: "${rawPreviousQuery.substring(0, 50)}..."`
  );
  logger.info(
    `[DEBUG] Normalized previous: "${normalizeQueryText(
      rawPreviousQuery
    ).substring(0, 50)}..."`
  );
}
```

3. Test follow-up questions in the UI and check logs to verify normalization works correctly before implementing the full solution.

## Timeline

- **Day 1**: Implement query normalization and add logging
- **Day 2**: Update controllers to use normalized queries and proper context
- **Day 3**: Update cache functions and context management
- **Day 4**: Testing and validation
- **Day 5**: Deployment and monitoring

## Risk Mitigation

- Deploy changes incrementally with feature flags
- Add comprehensive logging for query normalization
- Create a rollback plan in case of unexpected issues
- Monitor follow-up query success rates before and after changes

_Last updated: Sat Oct 19 2023_
