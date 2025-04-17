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

## New Workstream: Refactor HTTP Routes into Clean Controllers 🧩

## Priority: Medium

### Tasks:

- Separate Routing from Business Logic:
  - Create controllers for POST and PUT endpoints (e.g., postController.js and putController.js).
  - Remove heavy logic from the routes file and delegate to the service layer.
- Standardize Request Validation and Error Handling:
  - Use a shared error-handling mechanism that wraps asynchronous calls and uniformly returns formatted error responses.
- Actions:
  - In your routes directory, create a consolidated index (or per-method files) that import and invoke the dedicated controller functions.
  - Ensure that each controller only handles the HTTP-specific elements (like parsing the JSON, setting CORS headers, and streaming responses) and hands off the core logic to services.

### Detailed Routing Plan

- Define route files for each API endpoint group (e.g., chat-assistant, query, openai).
- For each route file:
  - Import the corresponding controller(s) (e.g., chatAssistantController).
  - Define HTTP method handlers (e.g., POST, PUT, OPTIONS).
  - In each handler, invoke the appropriate controller method (e.g., postHandler, putHandler).
  - Use shared utilities for CORS, error handling, and response formatting.
- Consolidate common route logic where possible to avoid duplication.
- Ensure routes only handle HTTP-specific concerns and delegate business logic to controllers and services.
- Implement middleware or utilities for request validation and authentication if needed.
- Maintain consistent error handling and logging across all routes.
- Gradually refactor existing routes to follow this pattern.

- Benefits:
  - Enhances readability and maintainability.
  - Avoids duplication of request validation and common response handling.

## Benefits 🌟

- Improved maintainability and consistency
- Centralized performance-sensitive code for easier optimization
- Reduced code duplication and improved readability
- Simplified testing and future enhancements

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
