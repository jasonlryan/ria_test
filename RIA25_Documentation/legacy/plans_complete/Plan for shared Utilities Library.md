# Plan for Shared Utilities Library and Modularization

## Completed ✅

- Created shared utilities directory at /utils/shared
- Extracted CORS and preflight handling into utils/shared/cors.js
- Created shared logger helpers in utils/shared/loggerHelpers.js
- Refactored app/api/chat-assistant/route.ts to use shared logger helpers
- Refactored utils/openai/retrieval.js to use shared logger helpers
- Extracted error handling and response formatting into utils/shared/errorHandler.js
- Refactored app/api/chat-assistant/route.ts to use shared error handler
- Extracted helper utilities (e.g., sanitizeOutput, isJsonContent) into utils/shared/utils.js
- Refactored app/api/chat-assistant/route.ts to use shared helper utilities
- Extracted polling logic (e.g., waitForNoActiveRuns) into utils/shared/polling.js
- Refactored app/api/chat-assistant/route.ts to use shared polling module
- Created service layer modules:
  - threadService.js for thread/reuse logic and polling
  - dataRetrievalService.js for data retrieval, smart filtering, caching, and query processing
  - openaiService.js for OpenAI API interactions (run creation, message submission, tool call processing)
- Refactored chatAssistantController.ts to delegate core logic to service modules

## Remaining 🛠️

- Refactor other route handlers to use shared errorHandler, utils, and polling modules
- Consolidate similar route handlers (e.g., POST and PUT) to share common controller logic
- Add or update unit and integration tests for shared modules and refactored routes
- Validate logging, error handling, and polling behavior after refactoring
- Test each route incrementally to ensure integration with controllers and services
- Gradually refactor existing routes to the new routing pattern

## Routing Completed ✅

- app/api/chat-assistant/route.ts
  - Delegates to chatAssistantController with POST, PUT, OPTIONS handlers.
- app/api/query/route.js
  - Delegates to queryController with POST, OPTIONS handlers.
- app/api/openai/route.ts
  - Delegates to openaiController with POST, OPTIONS handlers.
- app/api/retrieve-data/route.js
  - Delegates to retrieveDataController with POST, OPTIONS handlers.
- app/api/create-logs-dir/route.js
  - Delegates to createLogsDirController with POST, OPTIONS handlers.
- app/api/save-to-logs/route.js
  - Delegates to saveToLogsController with POST, OPTIONS handlers.
- app/api/test-assistant/route.ts
  - Delegates to testAssistantController with GET, OPTIONS handlers.
- app/api/test-key/route.ts
  - Delegates to testKeyController with GET, OPTIONS handlers.
- app/api/test-openai/route.ts
  - Delegates to testOpenAIController with GET, OPTIONS handlers.

## New Workstream: Refactor HTTP Routes into Clean Controllers 🧩

## Priority: Medium

## New Workstream: Testing and Validation 🧪

## Priority: High

### Tasks:

- Develop unit tests for shared utilities, service modules, and controllers.
- Create integration tests for API routes to verify end-to-end functionality.
- Implement automated testing workflows (e.g., using Jest, Testing Library).
- Validate logging, error handling, and polling behavior under various scenarios.
- Perform load and performance testing to ensure scalability.
- Continuously monitor and update tests as the codebase evolves.

## Benefits:

- Ensures code quality and reliability.
- Facilitates safe refactoring and future enhancements.
- Provides confidence in system stability and performance.
- Reduces manual testing effort and human error.

### New Workstream: Lazy-Loading Additional Segments for Cached Files 🚀

## Priority: High

### Tasks:

- Extend Cache Structure:

  - Add metadata fields to cached files: loadedSegments and availableSegments.
  - Parse files to extract available segments during initial load.

- Implement Lazy-Loading Mechanism:

  - Detect missing segments in cached files based on follow-up query requests.
  - Load only the missing segments from disk on demand.
  - Merge newly loaded segments into cached file data and update metadata.

- Update Incremental Fetch Logic:

  - Modify incremental data fetch to check for missing segments in cached files.
  - Trigger targeted segment loading for partially cached files.
  - Update cache with merged segment data.

- Integrate with Query Intent Parser:

  - Ensure query intent includes requested segments.
  - Pass segment requests to caching layer for accurate incremental fetch decisions.

- Utilities and Services Involved:

  - dataRetrievalService.js: Extend to handle segment metadata and lazy-loading.
  - cache-utils.ts: Update to support merging segment data in cache.
  - queryProcessor.js (if applicable): Modify to include segment-level intent.
  - Controllers handling queries: Update to pass segment info.

- Routes Involved:
  - chat-assistant/route.ts
  - query/route.js

## Benefits:

- Efficient memory and data usage by loading only necessary segments.
- Improved responsiveness to follow-up queries with additional data needs.
- Scalable and maintainable cache management.

## Appendix: Shared Utilities and Services Implemented

### Shared Utilities

- utils/shared/cors.js

  - handleOptions(request): Handles CORS preflight OPTIONS requests with standard headers.

- utils/shared/loggerHelpers.js

  - logPerformanceMetrics(stage, metrics): Logs performance metrics in a consistent format.
  - logPerformanceToFile(query, cachedFileIds, fileIds, pollCount, totalTimeMs, status, message): Asynchronously logs performance metrics to a file.

- utils/shared/errorHandler.js

  - formatErrorResponse(error, status): Formats error responses uniformly.
  - formatBadRequestResponse(message, missingFields): Formats bad request responses with missing field details.

- utils/shared/utils.js

  - sanitizeOutput(text): Cleans OpenAI output by removing citation markers.
  - isJsonContent(content): Checks if a string is valid JSON.

- utils/shared/polling.js
  - waitForNoActiveRuns(openai, threadId, pollInterval, timeoutMs): Polls OpenAI thread runs until no active runs remain.

### Service Modules

- app/api/services/threadService.js

  - createThread(): Creates a new OpenAI thread.
  - reuseThread(threadId): Validates and reuses an existing thread.
  - waitForNoActiveRuns(threadId, pollInterval, timeoutMs): Waits for no active runs on a thread.
  - createRun(threadId, assistantId, instructions): Creates a new run on a thread.
  - pollRunStatus(threadId, runId, pollInterval): Polls run status until completion or failure.
  - submitToolOutputs(threadId, runId, toolOutputs): Submits tool call outputs to a run.
  - updateThreadCache(threadId, fileIds): Updates cached file IDs for a thread.
  - getCachedFiles(threadId): Retrieves cached file IDs for a thread.

- app/api/services/dataRetrievalService.js

  - identifyRelevantFiles(query, context, isFollowUp, previousQuery, previousResponse): Identifies relevant data files for a query.
  - loadDataFiles(fileIds): Loads data files from filesystem or API.
  - filterDataBySegments(loadedData, segments): Filters loaded data by demographic segments.
  - processQueryWithData(query, context, cachedFileIds, threadId, isFollowUp, previousQuery, previousResponse): Orchestrates full data retrieval and filtering workflow.
  - getPrecompiledStarterData(code): Retrieves precompiled starter question data.
  - isStarterQuestion(prompt): Checks if a prompt is a starter question code.
  - getCachedFiles(threadId): Gets cached file IDs for a thread.
  - updateThreadCache(threadId, fileIds): Updates cached file IDs for a thread.

- app/api/services/openaiService.js

  - sendMessage(threadId, message): Sends a message to an OpenAI thread.
  - createRun(threadId, assistantId, instructions): Creates a new run on a thread.
  - pollRunStatus(threadId, runId, pollInterval): Polls run status until completion or failure.
  - submitToolOutputs(threadId, runId, toolOutputs): Submits tool call outputs to a run.
  - waitForNoActiveRuns(threadId, pollInterval, timeoutMs): Waits for no active runs on a thread.

- app/api/controllers/chatAssistantController.ts
  - postHandler(request): Handles POST requests, validates input, delegates to services, manages streaming responses and logging.
  - putHandler(request): Handles PUT requests for tool call processing, validates input, delegates to services.
  - logStarterQuestionInvocation(details): Logs starter question invocations asynchronously.
