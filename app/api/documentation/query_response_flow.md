# Query to Response Flow: Complete System Architecture

This document outlines the complete flow from a user query to the final response in the RIA25 application, detailing all files, functions, and prompts involved in the process.

## 1. Initial Query Entry Point

**File**: `app/embed/[assistantId]/page.tsx`  
**Function**: `sendPrompt()`

1. User types a question and submits
2. `sendPrompt()` function is called with:
   - `threadId` (if existing conversation)
   - `questionText` (the user's query)

## 2. Data Retrieval Flow

### Step 2.1: Call Query API

**File**: `page.tsx`  
**Action**: Makes fetch request to `/api/query`

```javascript
const dataRetrievalResponse = await fetch("/api/query", {
  method: "POST",
  body: JSON.stringify({
    query: questionText,
    context: "all-sector",
    cachedFileIds: cachedFiles.fileIds,
  }),
});
```

### Step 2.2: Query API Processing

**File**: `app/api/query/route.js`  
**Function**: `POST` handler

1. Receives request
2. Extracts `query`, `context`, and `cachedFileIds`
3. Calls `processQueryWithData()`

### Step 2.3: Core Data Processing

**File**: `utils/openai/retrieval.js`  
**Function**: `processQueryWithData(query, context, cachedFileIds)`

1. Checks if this is using cached data from a thread
2. If not cached or needs new data, proceeds with retrieval

### Step 2.4: File Identification

**File**: `utils/openai/retrieval.js`  
**Function**: `identifyRelevantFiles(query)`

1. Loads canonical topic mapping from file system
2. Prepares a prompt using `1_data_retrieval.md`
3. Makes API call to OpenAI

```javascript
const response = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ],
});
```

### Step 2.5: Prompt for File Identification

**File**: `utils/openai/1_data_retrieval.md`  
**Purpose**: Determines which files are relevant

```
You are a specialized workforce insights analyst. Your task is to determine
which data files from the canonical topic mapping are relevant for answering
a query about workforce trends...
```

### Step 2.6: Actual Data Retrieval

**File**: `utils/openai/retrieval.js`  
**Function**: `retrieveDataFiles(fileIds)`

1. Takes file IDs identified in previous step
2. Makes request to `/api/retrieve-data` to get actual file contents

```javascript
const response = await fetch(apiUrl, {
  method: "POST",
  body: JSON.stringify({ file_ids: fileIds }),
});
```

### Step 2.7: Physical File Retrieval

**File**: `app/api/retrieve-data/route.js`  
**Action**: Reads actual data files from disk

1. Receives file IDs
2. Locates and reads corresponding JSON files
3. Returns their contents

### Step 2.8: Data Validation

**File**: `utils/validation/data-validation.js`  
**Function**: `checkDataCoverage()`

1. Validates the data is sufficient for the query type
2. Checks for required data points based on query type
3. Special handling for content transformation requests

## 3. OpenAI Interaction

### Step 3.1: Prompt Construction

**File**: `page.tsx`  
**Action**: Creates enhanced prompt with retrieved data

```javascript
assistantPrompt = `
Query: ${questionText}
Analysis summary:
${dataResult.analysis}
Raw Survey Data:
\`\`\`json
${rawDataString}
\`\`\`
`;
```

### Step 3.2: Call Assistant API

**File**: `page.tsx`  
**Action**: Makes fetch request to `/api/chat-assistant`

```javascript
const assistantResponse = await fetch("/api/chat-assistant", {
  method: "POST",
  body: JSON.stringify({
    assistantId: assistantId,
    threadId: threadId,
    content: assistantPrompt,
  }),
});
```

### Step 3.3: Assistant Processing

**File**: `app/api/chat-assistant/route.ts`  
**Function**: `POST` handler

1. Receives enhanced prompt with all data already included
2. Creates/manages OpenAI thread
3. Makes API call to OpenAI Assistant API

```typescript
const run = await openai.beta.threads.runs.create(finalThreadId, {
  assistant_id: assistantId,
  instructions: `You are a workforce insights specialist analyzing survey data...`,
});
```

### Step 3.4: Tool Calling (if needed)

**File**: `app/api/chat-assistant/route.ts`  
**Action**: Handles tool calls from OpenAI

1. If OpenAI requests more data, handles tool calls
2. Calls back to `processQueryWithData()` to get additional data

```typescript
if (toolCall.function.name === "retrieve_workforce_data") {
  const args = JSON.parse(toolCall.function.arguments);
  const query = args.query;
  const result = await processQueryWithData(query);
  // Submit results back to OpenAI
}
```

## 4. Response Processing & UI Update

### Step 4.1: Stream Processing

**File**: `app/api/chat-assistant/route.ts`  
**Action**: Streams response back to client

1. Receives responses from OpenAI stream
2. Forwards them to client with event formatting

```typescript
controller.enqueue(
  encoder.encode(
    `event: textDelta\ndata: ${JSON.stringify({
      value: cleanText,
    })}\n\n`
  )
);
```

### Step 4.2: Client Response Handling

**File**: `page.tsx`  
**Action**: Processes streamed response

1. Sets up event listeners for stream events
2. Updates UI as chunks arrive
3. Handles completion and updates message history

### Step 4.3: Thread & Cache Management

**File**: `page.tsx`  
**Action**: Updates thread state

1. Saves `threadId` to localStorage
2. Updates cached files for this thread

```javascript
updateThreadCache(threadId, newFileIds, newData);
```

## 5. Subsequent Queries in Same Thread

For follow-up questions:

1. Retrieves cached file IDs from `threadDataCache`
2. Passes them to query API
3. If determined to be a follow-up, reuses cached data instead of retrieving new files
4. The entire process repeats but with thread context preserved

## 6. Route Structure & File Organization

### Core API Routes

- `/api/query/route.js` - Main data retrieval endpoint
- `/api/chat-assistant/route.ts` - Main assistant interface
- `/api/retrieve-data/route.js` - Retrieves specific data files

### Utility Routes

- `/api/save-to-logs/route.js` - Saves logs for debugging
- `/api/create-logs-dir/route.js` - Creates log directories

### Core Utility Files

- `utils/openai/retrieval.js` - Main data retrieval and processing system
- `utils/openai/1_data_retrieval.md` - Prompt template for file identification
- `utils/validation/data-validation.js` - Data validation utilities

### Key State Management

- `threadId` - Persisted in localStorage for conversation continuity
- `threadDataCache` - Cached file IDs and data for each thread

## 7. Error Handling and Edge Cases

1. **Out-of-Scope Queries**:

   - Detected in `1_data_retrieval.md` prompt processing
   - Returns proper error messages to user

2. **Insufficient Data**:

   - Validated by `checkDataCoverage()` in data-validation.js
   - Can provide graceful fallbacks for limited data

3. **Follow-up Detection**:

   - Handles thread continuity for contextual follow-ups
   - Uses cached data where appropriate
   - Detects topic changes that require new data

4. **Content Transformation**:
   - Special handling in validation for requests like "write an article"
   - Uses cached thread data for these transformations
