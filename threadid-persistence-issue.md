# Thread ID Persistence & Contextual Query Issues

## Problem Overview

The application has two critical issues:

1. **Thread ID Persistence**: While thread IDs are now correctly persisted between page reloads using localStorage, there are no visible logs confirming this functionality.

2. **Contextual Query Failure**: Follow-up queries like "give me more detail" consistently fail with "Sorry, an error occurred while sending your request" despite successful thread ID persistence.

## Current Implementation Analysis

### Chat Architecture

The chat application follows this flow:

1. User submits a query (e.g., "What factors related to job choice...")
2. App calls `/api/query` to retrieve workforce data relevant to the query
3. App processes this data to create an `assistantPrompt` with:
   - The original query
   - Analysis summary from retrieved data
   - Raw survey data in JSON format
4. App sends this to OpenAI via `/api/chat-assistant` with:
   - `assistantId`
   - `threadId` (from state, if it exists)
   - `content` (the assembled prompt)
5. OpenAI responds and the app updates the thread ID state

### Thread ID Management

```javascript
// Initialization from localStorage
const [threadId, setThreadId] = useState(() => {
  // Initialize from localStorage if available, but only in client side
  if (typeof window !== "undefined") {
    const savedThreadId = localStorage.getItem("chatThreadId");
    return savedThreadId || null;
  }
  return null;
});

// Save threadId to localStorage whenever it changes
useEffect(() => {
  if (threadId) {
    localStorage.setItem("chatThreadId", threadId);
  }
}, [threadId]);
```

### Data Retrieval Implementation

When a user submits a query:

```javascript
// Stage 1: Data Retrieval
const dataRetrievalResponse = await fetch("/api/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: questionText,
    context: "all-sector",
  }),
});

dataResult = await dataRetrievalResponse.json();
```

When processing the data:

```javascript
// Attempt to create raw data section
const rawDataString = JSON.stringify(dataResult.raw_data);
const rawDataSection = !hasDataRetrievalError
  ? `Raw Survey Data:
\`\`\`json
${rawDataString}
\`\`\`
`
  : "NO RAW DATA AVAILABLE";

// Save the raw data
fetch("/api/save-to-logs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    filename: `raw-data-only-${rawDataTimestamp}.json`,
    data: JSON.stringify(dataResult.raw_data, null, 2),
  }),
});
```

## Identified Issues

1. **Critical Bug - Handling Missing Data**: When a contextual follow-up question is asked (e.g., "give me more detail"), the data retrieval system correctly identifies it as out-of-scope, but then:

   - The code attempts to process `dataResult.raw_data` which is `undefined` for out-of-scope queries
   - This leads to errors when trying to stringify undefined values
   - The app crashes during the API request process

2. **Architectural Issue**: The application is designed to augment every query with fresh data instead of leveraging OpenAI's ability to use thread context for follow-ups:

   - Initial queries work fine because they match specific data topics
   - Follow-up queries fail because they don't directly match data topics
   - The system doesn't gracefully fall back to using just the thread context

3. **Debugging Challenge**: The console logs added for thread ID tracking are not visible, making it difficult to confirm thread persistence is working.

## Evidence from Logs

Server log shows thread ID being correctly used:

```
API Request: {
  threadId: 'thread_B0tL7HGXKemffsWTZ7A1Jmwj',
  assistantId: 'asst_D0BPAJjvg3UK6Lcb1lqIM1xS',
  contentLength: 100666
}
```

## Root Cause Analysis

1. The app correctly persists thread IDs using localStorage.
2. For initial topical queries, the system finds relevant data and works correctly.
3. For follow-up questions, the data retrieval system marks them as "out of scope."
4. The code does not properly handle the absence of raw data, causing crashes.
5. Instead of letting OpenAI use the thread context for follow-ups, the app tries to force fresh data augmentation for every query.

## Proposed Solutions

### 1. Robust Error Handling for Missing Data

```javascript
// Add proper null/undefined checking before processing raw data
if (dataResult.status === "out_of_scope" || !dataResult.raw_data) {
  console.log(
    "No specific data found for follow-up query. Using conversation context only."
  );

  // Create a contextual prompt without raw data
  const contextualPrompt = `
Query: ${questionText}

This is a follow-up question to our previous conversation. 
Please answer based on our conversation history and your knowledge of workforce trends.
`;

  // Use this as the assistant prompt
  assistantPrompt = contextualPrompt;
}
```

### 2. Safe Raw Data Handling

```javascript
// Safe raw data section creation
const rawDataSection = dataResult.raw_data
  ? `Raw Survey Data:
\`\`\`json
${JSON.stringify(dataResult.raw_data)}
\`\`\`
`
  : "NO RAW DATA AVAILABLE - USING CONVERSATION CONTEXT";

// Safe raw data saving
if (dataResult.raw_data) {
  fetch("/api/save-to-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: `raw-data-only-${rawDataTimestamp}.json`,
      data: JSON.stringify(dataResult.raw_data, null, 2),
    }),
  });
} else {
  console.log("No raw data to save - this is a contextual query");
  // Log a placeholder file
  fetch("/api/save-to-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: `contextual-query-${rawDataTimestamp}.txt`,
      data: questionText,
    }),
  });
}
```

### 3. Follow-up Question Detection

```javascript
// Detect likely follow-up questions
const isLikelyFollowUp =
  questionText.length < 30 &&
  (questionText.toLowerCase().includes("more") ||
    questionText.toLowerCase().includes("detail") ||
    questionText.toLowerCase().includes("explain") ||
    questionText.toLowerCase().includes("why") ||
    questionText.toLowerCase().includes("how"));

// Add special instructions for follow-ups
if (isLikelyFollowUp) {
  assistantPrompt += `
IMPORTANT: This appears to be a follow-up question. Use the conversation history in the thread 
to provide context and give a more detailed response based on our previous exchange.
`;
}
```

### 4. Enhanced Thread ID Logging

```javascript
// More visible thread ID logging
useEffect(() => {
  if (threadId) {
    localStorage.setItem("chatThreadId", threadId);
    console.log(
      `%c🧵 THREAD ID SAVED: ${threadId}`,
      "background: #4B0082; color: white; padding: 2px 5px; border-radius: 3px;"
    );
  }
}, [threadId]);

// Log on component mount
useEffect(() => {
  const savedThreadId = localStorage.getItem("chatThreadId");
  console.log(
    `%c🧵 INITIAL THREAD ID FROM STORAGE: ${savedThreadId || "NONE"}`,
    "background: #4B0082; color: white; padding: 2px 5px; border-radius: 3px;"
  );
}, []);
```

## Implementation Strategy

1. First, add proper error handling for missing data to prevent crashes
2. Implement safe handling of raw data sections with null/undefined checks
3. Add follow-up question detection to better handle contextual queries
4. Enhance thread ID logging for clearer debugging
5. Test with both initial and follow-up queries to verify fixes

## Expected Outcomes

After implementation:

1. Initial queries will continue to work as before
2. Follow-up questions like "give me more detail" will no longer crash
3. The application will gracefully fall back to using thread context for follow-ups
4. Thread ID persistence will be visibly logged for debugging
5. The user experience will be seamless for all types of queries

## Alternative Approaches

If the above solutions don't work, an alternative approach is to:

1. Skip the data retrieval step entirely for short follow-up queries
2. Simply pass the query directly to the OpenAI API with the existing thread ID
3. Let OpenAI handle the context management completely

This would be a more significant architectural change but would better leverage OpenAI's built-in context handling capabilities.
