# Issue Log

**Last Updated:** Mon May 12 13:28:49 BST 2025

## Issue: OpenAI Assistant Data Formatting Issue

**Date/Time:** `Mon May 5 21:21:40 BST 2025`

**Status:** RESOLVED (May 5, 2025)

### Description

The OpenAI Assistant is not properly using the exact statistics provided in the data. Instead, it's generating its own statistics and appending a "【current data】" marker at the end of responses. This happens despite the data being correctly retrieved, processed, and included in the prompt.

### Impact

- Users receive potentially inaccurate statistics that don't match the actual data
- The "【current data】" marker appears in responses, which is confusing and unprofessional
- The system appears to be functioning incorrectly despite the data pipeline working as expected

### Affected Files and Functions

1. **chatAssistantController.ts**

   - `formatGroupedStats()` (~line 780): Formats the statistics data for inclusion in the prompt
   - `groupStats()` (~line 722): Groups the statistics by file, question, and response

2. **SmartFiltering.ts**

   - `filterDataBySegments()`: Processes and filters data files correctly

3. **retrieval-adapter.ts**

   - Successfully migrated from legacy JS implementation
   - Properly handles data retrieval and processing

4. **unifiedOpenAIService.ts**
   - Handles communication with OpenAI Assistant API

### Resolution

This issue was resolved by:

1. Replacing custom formatting code in `chatAssistantController.ts` with direct calls to `buildPromptWithFilteredData()`
2. Adding explicit instructions in the prompt to use only the exact statistics provided
3. Creating a clear section header for the survey data in the prompt
4. Updating `promptUtils.js` to TypeScript with proper typing support
5. Adding stronger directive language in the prompt template

The fix ensures the OpenAI Assistant uses the exact statistics provided without adding markers or making up its own data.

### Fixed Files

- app/api/controllers/chatAssistantController.ts
- utils/openai/promptUtils.js (converted to TypeScript)
- utils/openai/promptUtils.ts (new TypeScript implementation)

### Evidence

Log shows successful data extraction and formatting:

```
[INFO] [FILTER] Called with files: { count: 7, segments: [ 'region', 'age', 'gender' ] }
[INFO] [FILTER] Files with valid responses: 7/7
[INFO] [FILTER] segmentsToUse: [ 'overall', 'region', 'age', 'gender' ]
[INFO] [FILTER] overall stats count: 7
[INFO] [FILTER] region stats count: 70
[INFO] [FILTER] age stats count: 42
[INFO] [FILTER] gender stats count: 14
[INFO] [FILTER] FINAL: Generated 133 stats items across 4 segments
[INFO] [ADAPTER] SmartFiltering produced 133 stats (segments used: region, age, gender)
```

But the Assistant response shows incorrect statistics with a "【current data】" marker:

```
67% overall feel their organization encourages and reinforces learning and development...
63% feel their company is focusing their development on long-term company goals...
58% believe using AI in their role will bolster their value in the next three years...
...
【current data】
```

### Root Cause Analysis

The issue appears to be in how the statistical data is presented to the OpenAI Assistant. While the data is correctly retrieved and formatted in the application code, the assistant is:

1. Not properly instructed to use the exact statistics provided
2. Potentially confused by the format of the statistics in the prompt
3. Generating its own summary statistics instead of using what's provided
4. Adding the marker "【current data】" to indicate it's using current data

This is not a regression from the migration from retrieval.legacy.js to TypeScript, as the data pipeline is functioning correctly. The issue is in how the OpenAI Assistant interprets or uses the data provided.

### Potential Solutions

1. **Modify the prompt format** - Make the statistics section more explicit and structured for the assistant
2. **Add explicit instructions** - Include specific instructions to use only the exact numbers provided
3. **System message update** - Update the system message for the assistant to emphasize data accuracy
4. **Response validation** - Add validation to detect when the assistant generates data instead of using provided stats

### Next Steps

1. Review the prompt construction in `chatAssistantController.ts`
2. Experiment with different formats for presenting the statistics
3. Update the assistant's system message to be more explicit about using provided data
4. Consider adding a post-processing step to verify statistics in responses

### Additional Notes

This issue appears to be with how OpenAI Assistant interprets the data rather than with the data pipeline itself. The recent migration from retrieval.legacy.js to TypeScript implementations did not cause this issue, as the data is being correctly retrieved and formatted.

## Issue: Duplicate CompatibilityService Implementation

**Date/Time:** `Sat Jun 1 16:45:30 BST 2025`

**Status:** IN PROGRESS

### Description

The project previously included a JavaScript service (`app/api/services/compatibilityService.js`) alongside the TypeScript implementation (`utils/compatibility/compatibility.ts`). The JavaScript version has now been removed and only the TypeScript service remains in use.

### Impact

- Code duplication makes maintenance difficult
- Potential confusion for developers about which implementation to use
- Inconsistent implementation of the repository pattern
- JavaScript implementation lacks type safety

### Affected Files and Functions

1. **utils/compatibility/compatibility.ts**

   - Current TypeScript implementation used throughout the application
   - Provides direct functions for compatibility checking
   - Well-designed, fully typed, and maintained

2. **app/api/controllers/compatibilityController.js**
   - Uses the TypeScript compatibility service
   - Not connected to any active routes

### Resolution

The JavaScript service was removed and the controller updated to import `compatibilityService.ts`. No further action is required unless the endpoints need to be expanded.

### Root Cause Analysis

This duplicate implementation likely occurred during the migration from JavaScript to TypeScript. Phase 4 of the migration log indicates significant improvements to the compatibility system, including adding TypeScript-native compatibility functions, but the service layer wasn't fully migrated. This follows a pattern similar to what was seen with `dataRetrievalService.js`, which required migration to TypeScript.

### Next Steps

1. Assess whether the compatibility API endpoints are needed
2. If needed, implement proper TypeScript service and connect to routes
3. If not needed, move both service and controller to legacy directories
4. Update migration log to document this change

### Additional Notes

This should be handled as part of the ongoing repository pattern migration, following the same approach used for dataRetrievalService. The migration log shows a clear pattern of moving from JavaScript to TypeScript implementations while maintaining backward compatibility.

## 2025-05-11: Critical Chat/Follow-up Bugs (Responses API Migration)

**Status:** IN PROGRESS (June 6, 2025)

### 1. User message delay ✅ FIXED

- User messages are only added to the chat after the backend responds, causing a laggy/unresponsive UI. Should be added immediately on submit.
- **Solution**: Implemented optimistic UI updates to show messages immediately before backend confirmation.

### 2. Conversation thread disappears on follow-up ⚠️ IN PROGRESS

- When a follow-up question is asked, the entire chat thread disappears. Likely due to state reset (messages/threadId) or an error in async flow.
- **Current Status**: Root cause identified as SSE connection termination issue. Fix being implemented.

### 3. Education segment not loaded on follow-up ⚠️ IN PROGRESS

- Even with previousResponseId passed, backend does not load cached fileIds/segments for follow-up, so smart filtering for education fails.
- **Current Status**: Initial fix deployed to staging; implementing segment persistence in KV.

### 4. General context loss on follow-up ⚠️ IN PROGRESS

- If frontend or backend loses previousResponseId/threadId, follow-up queries are treated as new conversations, breaking continuity and segment filtering.
- **Current Status**: Implementing persistent thread metadata with fallback mechanism.

---

Each of these must be addressed for a robust, conversational survey assistant experience.

## 2025-05-11: UI/UX Bugs (Chat Experience)

**Status:** IN PROGRESS (June 5, 2025)

### 5. Duplicate user messages in chat ✅ FIXED

- User message appears twice for each submission. Likely due to being added both immediately and after backend response.
- **Solution**: Fixed optimistic UI update logic to prevent duplicate messages.

### 6. Responses disappear or are duplicated ⚠️ IN PROGRESS

- Assistant responses sometimes disappear or appear twice. Likely due to state reset or duplicate message addition.
- **Current Status**: Fix being tested in staging environment.

### 7. Chat resets or loses context after follow-up ⚠️ IN PROGRESS

- After a follow-up, the chat thread sometimes resets or loses all previous messages. State reset or context loss suspected.
- **Current Status**: Related to Issue #2; same fix addresses both issues.

### 8. Answers do not match the user's question (context loss) ⚠️ IN PROGRESS

- Sometimes the answer shown is for a different question, indicating context is not maintained between turns.
- **Current Status**: Implementing enhanced context persistence in the prompt system.

---

These UI/UX issues must be addressed for a robust, reliable chat experience.

### 2025-05-11 16:25: Streaming Completion & Segment Persistence Bugs

**Status:** IN PROGRESS (June 7, 2025)

### A. Disappearing First-Answer Bubble / Lost threadId ⚠️ IN PROGRESS

**Symptoms**

- First assistant answer streams OK but vanishes as soon as user submits follow-up.
- Backend logs for follow-up show `ThreadId: none | IsFollowUp: false` even though a response-id was created.

**Root Cause**

- Server occasionally ends SSE without emitting `messageDone`, so `loading` never flips to `false` and `threadId`/`lastResponseId` never reach React state.
- Client replaces the temp streaming bubble on next submit, effectively deleting the first answer.

**Fix Plan**

1. In `handleResponseStream` emit a fallback `messageDone` if stream ends and `fullText` contains data. ✅ IMPLEMENTED
2. Add 45-second watchdog on the client to finalise the message if `loading` never flips. ⚠️ IN PROGRESS
3. Re-enable guard so user cannot submit while `loading === true` (or queue the question). ⚠️ IN PROGRESS

### B. Segment Data Ignored on Follow-Ups ⚠️ IN PROGRESS

**Symptoms**

- SmartFiltering extracts sector / education stats (hundreds of items) but assistant replies "segment not available".
- Prompt builder logs show `Segments selected: country, age, gender` even when sector stats exist.

**Root Cause**

- Because `IsFollowUp` is false the LLM's file-discovery falls back to default segment list, so controller discards sector stats.

**Fix Plan**

1. Keyword-scan user query for explicit segment terms and union them into `segments` before prompt build. ✅ IMPLEMENTED
2. Persist `lastSegments` in thread meta and reuse when `isFollowUp === true`. ⚠️ IN PROGRESS
3. In prompt builder auto-add any segment that has stats even if not in `segments` array. ⚠️ IN PROGRESS

**Status:** IN PROGRESS – Implementing segment persistence in KV and auto-include logic.

---

_Last updated: Mon May 12 13:28:49 BST 2025_
