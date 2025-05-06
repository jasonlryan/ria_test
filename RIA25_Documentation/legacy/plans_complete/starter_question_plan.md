# Refactoring Plan: Starter Question Handling

**Goal:** Ensure queries starting with a `starterQuestion` URL parameter (e.g., `?starterQuestion=SQ2`) correctly use the data defined in the corresponding JSON file (`SQ2.json`), bypass the initial LLM file identification step, override default segments, and send the appropriate natural language question + filtered data context to the final assistant LLM.

**Architecture:**

- **Frontend (`page.tsx`):** Orchestrates two API calls.
- **Backend API 1 (`/api/query`):** Handles data retrieval and filtering, including special logic for starter questions.
- **Backend API 2 (`/api/chat-assistant`):** Handles interaction with the OpenAI Assistant using pre-processed data.
- **Backend Logic (`retrieval.js`):** Contains the core functions for processing queries, identifying/loading files, and filtering data.

---

**Refactoring Plan:**

**Phase 1: Backend Data Retrieval Logic**

1.  **Refactor `utils/openai/retrieval.js` (`processQueryWithData` function):**

    - **Starter Question Check:** Implement the check `isStarterQuestion(query)` at the _beginning_ of the function.
    - **Starter Data Loading:** If `isStarter` is true:
      - Call `getPrecompiledStarterData(query)`.
      - Validate the loaded `starterData` (ensure required fields like `data_files`, `segments`, `question` exist).
      - Extract `fileIds` (from `data_files`), `segments`, and `naturalLanguageQuery` (from `question`) directly from `starterData`.
      - Set `matchedTopics` if available in `starterData`.
      - **Bypass LLM:** Completely skip the call to `identifyRelevantFiles`.
    - **Normal Question Path:** If `isStarter` is false:
      - Call `identifyRelevantFiles(query, ...)` to get `fileIdResult`.
      - Handle `out_of_scope` from the LLM result.
      - Extract `fileIds`, `segments` (use LLM segments or default), `matchedTopics` from `fileIdResult`.
      - Set `naturalLanguageQuery` to the original `query`.
    - **File Loading:** Load files based on the determined `fileIds`.
    - **Filtering:** Call `getSpecificData` using the determined `segments`.
    - **Stats Formatting:** Move/implement the `groupStats` and `formatGroupedStats` helper functions within this file (or a shared utility). Call them to generate the `statsPreview` string from the filtered data.
    - **Return Value:** Ensure the function returns a consistent object containing at least: `{ naturalLanguageQuery, statsPreview, segments, fileIds, matchedTopics, out_of_scope, out_of_scope_message, error?, ... }`.

2.  **Create/Verify Backend API Endpoint `/api/query/route.js` (or similar):**
    - This route handler should receive the POST request from the frontend (Stage 1).
    - It needs to parse `{ query, threadId?, cachedFileIds? }` from the request body.
    - It should call the refactored `processQueryWithData` from `retrieval.js`.
    - It must return the resulting object `{ naturalLanguageQuery, statsPreview, ... }` as a JSON response to the frontend. Include appropriate error handling.

**Phase 2: Backend Assistant Interaction Logic**

3.  **Refactor `/api/chat-assistant/route.ts` (`POST` handler):**
    - **Modify Input Parsing:** Change `await request.json()` to expect `{ naturalLanguageQuery, statsPreview, assistantId, threadId }`. Add validation.
    - **Remove Redundant Logic:** Delete _all_ code blocks that currently perform `isStarterQuestion` checks, call `processQueryWithData` or `identifyRelevantFiles`, group/format stats, or build the prompt from `originalUserContent`. This endpoint should _trust_ the input it receives.
    - **Construct Assistant Message:** Create the final `content` string to send to the OpenAI Assistant thread. This will typically be the `naturalLanguageQuery` potentially combined with the `statsPreview` (if provided and not in direct mode).
    - **Maintain OpenAI Interaction:** Keep the existing logic for creating/managing threads, adding the constructed message, creating runs, and streaming the response.

**Phase 3: Frontend Orchestration**

4.  **Refactor `app/embed/[assistantId]/page.tsx` (`sendPrompt` function):**
    - **Implement Two-Stage Fetch:**
      - Modify the function to first `fetch('/api/query', ...)` with `{ query: queryToSend, ... }`.
      - Add robust error handling for this first fetch (network errors, non-200 status, out-of-scope response).
      - Parse the JSON response from `/api/query` to get `{ naturalLanguageQuery, statsPreview, threadId: newThreadId, ... }`.
      - Update the local `threadId` state if `newThreadId` is returned (for newly created threads).
      - Make the _second_ `fetch('/api/chat-assistant', ...)` call, sending `{ naturalLanguageQuery, statsPreview, assistantId, threadId }` in the body.
      - Handle the streaming response from `/api/chat-assistant` as it currently does (or refine if needed).
    - **Adjust Loading UI:** Update the `setStreamingMessage` calls to provide accurate feedback during the two stages (e.g., "Retrieving data..." during Stage 1, "Generating response..." during Stage 2). Remove the `setInterval` logic for cycling through intermediate messages if it no longer makes sense.

**Phase 4: Testing and Cleanup**

5.  **Test Thoroughly:**
    - Test `?starterQuestion=SQ2` flow end-to-end.
    - Test various normal natural language questions.
    - Test follow-up questions within the same thread.
    - Check browser console and backend logs for errors.
6.  **Remove Diagnostic Logs:** Once confirmed working, remove all the temporary `console.log('[DIAGNOSTIC]...')` statements added during debugging from all modified files.
