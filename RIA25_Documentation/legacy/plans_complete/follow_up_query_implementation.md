# Follow-Up Query Implementation Guide

This document provides specific implementation steps for adding query normalization and fixing follow-up detection. These changes can be applied incrementally, starting with the query normalization and then enhancing the context preservation.

## Step 1: Apply the Minimal Proof of Concept

First, add the minimal proof of concept to test query normalization in production:

1. Add logging to `chatAssistantController.ts`:

```typescript
// Near line ~210, after retrieving messages:
if (userContent?.type === "text") {
  const rawPreviousQuery = userContent.text.value;
  const normalizedPreviousQuery = normalizeQueryText(rawPreviousQuery);
  logger.info(
    `[DEBUG] Raw previous query: "${rawPreviousQuery.substring(0, 50)}..."`
  );
  logger.info(
    `[DEBUG] Normalized previous query: "${normalizedPreviousQuery.substring(
      0,
      50
    )}..."`
  );
  previousQuery = normalizedPreviousQuery; // Use normalized query
}

// Near line ~645, before creating a message:
logger.info(`[DEBUG] Raw query: "${content.substring(0, 50)}..."`);
const normalizedContent = normalizeQueryText(content);
logger.info(
  `[DEBUG] Normalized query: "${normalizedContent.substring(0, 50)}..."`
);
```

2. Test in development by sending follow-up questions and checking logs.

## Step 2: Integrate Context Management

After verifying normalization works, update the controller to manage context properly:

```typescript
// In chatAssistantController.ts, near the beginning of postHandler

// Initialize context object
let context = {
  normalizedCurrentQuery: normalizeQueryText(content),
  normalizedPreviousQuery: "",
  previousResponse: "",
  isFollowUp: !!threadId,
};

// Retrieve messages once for context
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
```

## Step 3: Fix Direct Mode Tool Calls

Update the direct mode tool call handler to use normalized queries and proper context:

```typescript
// In the tool call handler for direct mode
const relevantFilesResult = await identifyRelevantFiles(
  normalizeQueryText(query), // Normalize the query from tool call
  "all-sector",
  context.isFollowUp, // Pass isFollowUp flag
  context.normalizedPreviousQuery, // Pass normalized previous query
  context.previousResponse // Pass previous response
);
```

## Step 4: Fix Standard Mode Tool Calls

Update the standard mode tool call handler similarly:

```typescript
// In the tool call handler for standard mode
const result = await processQueryWithData(
  normalizeQueryText(query), // Normalize the query from tool call
  "all-sector",
  cachedFileIds,
  finalThreadId,
  context.isFollowUp, // Pass isFollowUp flag
  context.normalizedPreviousQuery, // Pass normalized previous query
  context.previousResponse // Pass previous response
);
```

## Step 5: Update Query Controller

Update the query controller to normalize queries:

```typescript
// In queryController.ts, in the postHandler function
const normalizedQuery = normalizeQueryText(query);
const normalizedPreviousQuery = previousQuery
  ? normalizeQueryText(previousQuery)
  : "";

logger.info(
  `[QUERY] Processing normalized query: "${normalizedQuery.substring(
    0,
    50
  )}..." | IsFollowUp: ${isFollowUp}`
);

// Pass normalized queries to service
const result = await dataRetrievalService.processQueryWithData(
  normalizedQuery,
  "all-sector",
  [],
  threadId || "default",
  isFollowUp,
  normalizedPreviousQuery,
  previousAssistantResponse || ""
);
```

## Complete Implementation Patch

For reference, here is what a minimal but complete patch would look like:

```diff
// app/api/controllers/chatAssistantController.ts
+ import { normalizeQueryText } from "../../../utils/shared/queryUtils";

// Near the beginning of postHandler
+ let context = {
+   normalizedCurrentQuery: normalizeQueryText(content),
+   normalizedPreviousQuery: '',
+   previousResponse: '',
+   isFollowUp: !!threadId
+ };

// Replace message retrieval section
  if (isFollowUp) {
    try {
      const messagesResponse = await unifiedOpenAIService.listMessages(finalThreadId, { limit: 4 });
      const messages = messagesResponse.data.data;

-     for (let i = 0; i < messages.length; i++) {
-       if (messages[i].role === "user") {
-         const userContent = messages[i].content?.[0];
-         if (userContent?.type === 'text') {
-           previousQuery = userContent.text.value;
-           logger.info(`[CONTEXT] Found previous query: "${previousQuery.substring(0, 50)}..."`);
-           break;
-         }
-       }
-     }
+     // Extract previous query and response
+     for (let i = 0; i < messages.length - 1; i++) {
+       if (messages[i].role === "assistant" && messages[i+1].role === "user") {
+         const assistantContent = messages[i].content?.[0];
+         const userContent = messages[i+1].content?.[0];
+
+         if (assistantContent?.type === 'text' && userContent?.type === 'text') {
+           context.previousResponse = assistantContent.text.value;
+           context.normalizedPreviousQuery = normalizeQueryText(userContent.text.value);
+           previousQuery = context.normalizedPreviousQuery; // For compatibility with existing code
+           break;
+         }
+       }
+     }
+
+     logger.info(`[CONTEXT] Normalized current query: "${context.normalizedCurrentQuery.substring(0, 50)}..."`);
+     logger.info(`[CONTEXT] Normalized previous query: "${context.normalizedPreviousQuery.substring(0, 50)}..."`);
    } catch (error) {
      logger.error("Error retrieving message history:", error);
    }
  }

// In direct mode tool handler
  const relevantFilesResult = await identifyRelevantFiles(
-   query,
+   normalizeQueryText(query),
    "all-sector",
+   context.isFollowUp,
+   context.normalizedPreviousQuery,
+   context.previousResponse
  );

// In standard mode tool handler
  const result = await processQueryWithData(
-   query,
+   normalizeQueryText(query),
    "all-sector",
    cachedFileIds,
    finalThreadId,
+   context.isFollowUp,
+   context.normalizedPreviousQuery,
+   context.previousResponse
  );
```

## Testing the Fix

After implementing the changes, run these tests to verify the fix:

1. Start a new conversation with a question about job factors
2. Follow-up with "how does this compare to 2024 data?"
3. Follow-up with a question about trust in leadership
4. Check logs to verify:
   - Queries are properly normalized
   - Follow-up flag is correctly set
   - Proper previous context is passed to retrieval functions

The logs should show something like:

```
[CONTEXT] Normalized current query: "how does this compare to 2024 data?"
[CONTEXT] Normalized previous query: "What factors related to job choice..."
[IS FOLLOW-UP FLAG IN IDENTIFY: true]
```

And you should see successful file retrieval and topic identification in the logs.
