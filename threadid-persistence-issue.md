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

### Revised Approach: Thread-Based Data Caching

The current implementation's main flaw is that it treats every query as isolated and tries to retrieve fresh data each time. Instead, we should implement a thread-based data caching approach that:

1. **Assumes continuity** in a persistent thread
2. **Tracks data files** that have already been loaded for a thread
3. **Only loads new data** when explicitly required

This approach follows this principle: In a persistent thread, the code should ASSUME the query is a follow-up UNLESS:

1. The request is beyond scope
2. The request requires additional data than what's already tracked

#### Example Scenario:

- **Query 1**: Retrieves files a, b, and c (stored with thread as available data)
- **Query 2**: Doesn't require additional data files, is a continuation query (uses data in thread memory)
- **Query 3**: Requires file a and new file d (updates file tracking and retrieves additional data)

### Implementation: Thread Data Cache

```javascript
// Define a cache to track data files per thread
const threadDataCache = {};

// Function to get cached files for a thread
const getCachedFilesForThread = (threadId) => {
  return threadDataCache[threadId] || { fileIds: [], data: {} };
};

// Function to update thread cache with new files
const updateThreadCache = (threadId, newFileIds, newData) => {
  if (!threadDataCache[threadId]) {
    threadDataCache[threadId] = { fileIds: [], data: {} };
  }

  // Add new file IDs
  threadDataCache[threadId].fileIds = [
    ...new Set([...threadDataCache[threadId].fileIds, ...newFileIds]),
  ];

  // Update data
  threadDataCache[threadId].data = {
    ...threadDataCache[threadId].data,
    ...newData,
  };

  return threadDataCache[threadId];
};

// Modified query processing function
const processQueryWithThreadCache = async (threadId, queryText) => {
  // Step 1: Determine required files for the query
  const requiredFiles = await identifyRelevantFiles(queryText);

  // If this is a follow-up that doesn't match specific topics
  if (requiredFiles.file_ids.length === 0 && threadId) {
    console.log("Follow-up query detected, using cached thread data");
    // Use the existing thread without new data retrieval
    return {
      status: "follow_up",
      message: "Using existing thread context for follow-up query",
    };
  }

  // Step 2: If we have a thread ID, check what files we already have cached
  let cachedFiles = { fileIds: [], data: {} };
  if (threadId) {
    cachedFiles = getCachedFilesForThread(threadId);
  }

  // Step 3: Determine which files we need to newly retrieve
  const missingFileIds = requiredFiles.file_ids.filter(
    (id) => !cachedFiles.fileIds.includes(id)
  );

  // Step 4: Fetch only the missing files
  let newData = {};
  if (missingFileIds.length > 0) {
    console.log(`Fetching ${missingFileIds.length} new files for thread`);
    newData = await retrieveDataFiles(missingFileIds);
    // Update the thread cache
    updateThreadCache(threadId, missingFileIds, newData);
  }

  // Step 5: Return all the data needed for this query
  return {
    status: "success",
    data: {
      ...cachedFiles.data,
      ...newData,
    },
    files_used: threadDataCache[threadId].fileIds,
  };
};
```

### Fixing the Current Implementation

To implement this approach with minimal changes to the current system:

1. Store thread-associated file IDs in localStorage or in a server-side cache
2. Before data retrieval, check if this is a follow-up query in an existing thread
3. For follow-ups, skip data retrieval and use a simplified prompt that leverages thread context
4. For queries requiring new data, load only what's needed and update the cache

```javascript
// Modify the sendPrompt function
const sendPrompt = async (threadId, immediateQuestion) => {
  const questionText = immediateQuestion || prompt || "";
  if (!questionText.trim()) return;

  // Set loading state and add user message to chat
  setLoading(true);
  // ... existing loading animation code ...

  try {
    // Check if this is likely a follow-up question
    const isLikelyFollowUp =
      questionText.length < 30 &&
      (questionText.toLowerCase().includes("more") ||
        questionText.toLowerCase().includes("detail") ||
        questionText.toLowerCase().includes("why") ||
        questionText.toLowerCase().includes("how"));

    let assistantPrompt;

    if (threadId && isLikelyFollowUp) {
      // This is a follow-up in an existing thread - skip data retrieval
      console.log("Follow-up query detected, using thread context");
      assistantPrompt = `
Query: ${questionText}

This is a follow-up question to our previous conversation.
Please answer based on the workforce data and context from our previous messages.
`;
    } else {
      // This needs new data or is a new thread
      // ... existing data retrieval code ...
    }

    // Send to OpenAI as before
    const response = await fetch("/api/chat-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: assistantId,
        threadId: threadId,
        content: assistantPrompt,
      }),
    });

    // ... rest of the function processing the response ...
  } catch (error) {
    // ... error handling ...
  }
};
```

## Implementation Strategy

1. Add a thread-based data cache to track what files are associated with each thread
2. Implement "follow-up detection" to recognize questions that don't need new data
3. Skip data retrieval for follow-up queries in existing threads
4. For new threads or queries needing additional data, load only what's required
5. Update the thread cache as new data files are added

## Expected Outcomes

The revised approach will:

1. Dramatically reduce unnecessary data retrievals
2. Allow proper handling of contextual follow-up questions
3. Leverage OpenAI's thread context for continuity
4. Prevent errors during data processing for follow-up queries
5. Maintain a seamless user experience across all query types

## Alternative Approaches

If implementing a full caching system is too complex, a simpler approach could:

1. Simply skip data retrieval entirely for likely follow-up queries
2. Pass the query directly to OpenAI with the existing thread ID
3. Let OpenAI handle context management
4. Only engage data retrieval for specific topic-focused queries
