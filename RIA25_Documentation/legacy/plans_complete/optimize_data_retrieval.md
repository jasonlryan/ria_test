# Data Retrieval Optimization Plan

## Current Implementation

The current data retrieval system works as follows:

1. **Frontend (`embed/[assistantId]/page.tsx`):**

   - User submits a query
   - Frontend sends a request to `/api/query` with:
     - Query text
     - Cached file IDs (if any)
   - Frontend receives data with file IDs and raw data
   - Frontend constructs a large prompt including all the raw data
   - Frontend sends this entire payload to `/api/chat-assistant`
   - Frontend streams response to user

2. **Backend (`utils/openai/retrieval.js`):**

   - **OpenAI Call #1:** `identifyRelevantFiles()` - Identifies which data files are relevant
   - Retrieves the actual data files from the file system
   - Returns file IDs, raw data, and analysis to the frontend

3. **Assistant API (`chat-assistant/route.ts`):**
   - Receives the large prompt with all raw data
   - Adds user message to thread
   - Creates an OpenAI Assistant run
   - **OpenAI Call #2:** When the Assistant requests data via tool calls
   - **OpenAI Call #3:** Assistant generates response

## Key Issues with Current Implementation

1. **Inefficient Data Transfer:** Sending all raw data through frontend to the Assistant
2. **Limited Follow-up Detection:** Basic heuristics for determining follow-up queries
3. **Redundant Data Retrieval:** Retrieving data even when it might not be needed
4. **All-or-Nothing Caching:** Not using partial caching for topic shifts
5. **Large Token Consumption:** Sending entire data files rather than relevant segments

## Optimization Goals

1. **Reduce OpenAI Calls to Two:**

   - One call for query analysis and file identification
   - One call to the Assistant for response generation

2. **Implement Smarter Follow-up Detection:**
   - Use lightweight heuristics + optional lightweight model
   - Skip file identification completely for clear follow-ups
3. **Enable Partial Data Retrieval:**

   - Identify only sections of files that are relevant
   - Dynamic granularity based on query specificity

4. **Streamline Data Flow:**
   - Consolidate API calls in the backend
   - Avoid sending raw data through the frontend

## Implementation Plan

### Phase 1: Enhanced Follow-up Detection

1. **Implement Multi-level Heuristics:**

   ```javascript
   function isFollowUpQuery(query, previousQuery) {
     // Level 1: Short query check (very fast)
     if (query.length < 15) return true;

     // Level 2: Pronoun check (fast)
     const pronouns = [
       "it",
       "this",
       "they",
       "that",
       "these",
       "those",
       "he",
       "she",
       "them",
     ];
     const hasLeadingPronoun = pronouns.some((p) =>
       new RegExp(`^${p}\\b`, "i").test(query.trim())
     );
     if (hasLeadingPronoun) return true;

     // Level 3: Reference check (fast)
     const referenceTerms = [
       "previous",
       "above",
       "mentioned",
       "said",
       "data",
       "results",
     ];
     const hasReference = referenceTerms.some((term) =>
       query.toLowerCase().includes(term)
     );
     if (hasReference) return true;

     // Level 4: Comparative check (fast)
     const comparatives = [
       "more",
       "less",
       "better",
       "worse",
       "instead",
       "rather",
     ];
     const hasComparative = comparatives.some((term) =>
       query.toLowerCase().includes(term)
     );
     if (hasComparative) return true;

     // If still ambiguous, return false (not a clear follow-up)
     return false;
   }
   ```

2. **Optional Model-Based Classification:**
   ```javascript
   async function classifyQueryWithModel(query, thread) {
     // Only use for ambiguous cases
     // Use a lightweight model like gpt-3.5-turbo with minimal context
     const response = await openai.chat.completions.create({
       model: "gpt-3.5-turbo",
       messages: [
         {
           role: "system",
           content:
             "Classify if this query requires new data retrieval or can use existing conversation context.",
         },
         {
           role: "user",
           content: `Previous query: "${thread.lastQuery}"
                    Current query: "${query}"
                    
                    Is this a follow-up question that can be answered using only the context from the previous question, without needing new data? Answer YES or NO.`,
         },
       ],
       temperature: 0.1,
       max_tokens: 5,
     });

     return response.choices[0].message.content
       .trim()
       .toLowerCase()
       .includes("yes");
   }
   ```

### Phase 2: Streamlined API Route

Modify `/api/chat-assistant/route.ts` to handle the entire data flow:

```typescript
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { assistantId, threadId, query, isFollowUpQueryOverride } = body;

    // Initialize OpenAI client
    const openai = createOpenAIClient();

    // Handle thread creation if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const thread = await createThread();
      finalThreadId = thread.id;
    }

    // Retrieve previous messages to check for follow-up context
    const previousMessages = await listMessages(finalThreadId);
    const lastUserMessage = previousMessages.data.find(
      (m) => m.role === "user"
    );
    const lastUserQuery = lastUserMessage?.content || "";

    // Get cached files for this thread
    const cachedFileIds = await getCachedFilesForThread(finalThreadId);

    // Determine if this is a follow-up query
    let isFollowUpQuery = isFollowUpQueryOverride;
    if (isFollowUpQuery === undefined) {
      isFollowUpQuery =
        cachedFileIds.length > 0 &&
        lastUserQuery &&
        isFollowUpQuery(query, lastUserQuery);

      // For ambiguous cases with sufficient context, optionally use model classification
      if (!isFollowUpQuery && cachedFileIds.length >= 3 && lastUserQuery) {
        isFollowUpQuery = await classifyQueryWithModel(query, {
          lastQuery: lastUserQuery,
        });
      }
    }

    console.log(
      `Query "${query.substring(0, 30)}..." classification: ${
        isFollowUpQuery ? "FOLLOW-UP" : "NEW TOPIC"
      }`
    );

    // For follow-up queries, skip data retrieval completely
    let dataContent = null;
    let fileIds = [];

    if (!isFollowUpQuery) {
      // OPENAI CALL #1: Identify relevant files
      const fileIdsResult = await identifyRelevantFiles(query, assistantId);
      fileIds = fileIdsResult.file_ids || [];

      // For new topic queries, retrieve data
      if (fileIds.length > 0) {
        dataContent = await retrieveDataFiles(fileIds);

        // Update cache with new files
        await updateThreadCache(finalThreadId, fileIds);
      }
    } else {
      console.log("Using existing thread context - skipping data retrieval");
      fileIds = cachedFileIds;
    }

    // Add user message to thread - keep it simple for follow-ups
    let userMessage;
    if (isFollowUpQuery) {
      // For follow-ups, just send the raw query
      userMessage = query;
    } else {
      // For new topics, we can optionally add minimal context
      // This is only if we're not using the Assistant's built-in retrieval
      userMessage = query;
    }

    // Add the user message to the thread
    await createMessage(finalThreadId, "user", userMessage);

    // OPENAI CALL #2: Create a run with the assistant
    const run = await createRun(finalThreadId, assistantId);

    // Set up streaming response
    // ... rest of the streaming implementation ...
  } catch (error) {
    // Error handling
  }
}
```

### Phase 3: Dynamic Data Granularity

Enhance `retrieveDataFiles()` to support partial file retrieval:

```javascript
async function retrieveDataFiles(fileIds, queryContext) {
  // If queryContext is provided, use it to filter data
  if (queryContext && queryContext.query) {
    // Extract key terms from the query
    const keyTerms = extractKeyTerms(queryContext.query);

    // For each file, only retrieve relevant sections
    const filteredData = [];

    for (const fileId of fileIds) {
      const fullData = await loadRawFileData(fileId);

      // If the file has sections/segments/responses
      if (fullData.responses && Array.isArray(fullData.responses)) {
        // Score each section by relevance to query
        const scoredSections = fullData.responses.map((section) => {
          const sectionText = JSON.stringify(section);
          const score = calculateRelevanceScore(sectionText, keyTerms);
          return { section, score };
        });

        // Sort by relevance score
        scoredSections.sort((a, b) => b.score - a.score);

        // Only keep top N sections based on score threshold
        const relevantSections = scoredSections
          .filter((item) => item.score > 0.4) // Threshold
          .slice(0, 5) // Max sections
          .map((item) => item.section);

        // Create filtered version of this file
        filteredData.push({
          ...fullData,
          responses: relevantSections,
        });
      } else {
        // No sections to filter, use whole file
        filteredData.push(fullData);
      }
    }

    return filteredData;
  }

  // Default: retrieve complete files
  return Promise.all(fileIds.map(loadRawFileData));
}
```

## Benefits of Optimized Implementation

1. **Reduced Latency:**

   - Fewer API calls means faster responses
   - No redundant data retrieval for follow-ups

2. **Lower API Costs:**

   - Fewer OpenAI calls
   - Smaller token usage with partial data retrieval

3. **Better User Experience:**

   - Faster responses, especially for follow-up questions
   - More natural conversation flow

4. **Improved Data Handling:**
   - Targeted, relevant data retrieval
   - Graceful scaling to handle complex queries

## Implementation Timeline

1. **Phase 1: Enhanced Follow-up Detection (1 week)**

   - Implement multi-level heuristics
   - Add optional model-based classification
   - Test with various query patterns

2. **Phase 2: Streamlined API Route (1-2 weeks)**

   - Consolidate data retrieval in chat-assistant endpoint
   - Modify frontend to use streamlined approach
   - Update caching logic

3. **Phase 3: Dynamic Data Granularity (1-2 weeks)**
   - Implement partial file retrieval
   - Add relevance scoring
   - Optimize threshold parameters

## Success Metrics

1. **Reduced API Call Count:**

   - Target: 33% reduction in OpenAI API calls

2. **Improved Response Times:**

   - Target: 50% faster responses for follow-up queries
   - Target: 20% faster responses for new topic queries

3. **Reduced Token Usage:**
   - Target: 40% reduction in tokens for follow-up queries
   - Target: 25% reduction in tokens for new topic queries
