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

## Remaining 🛠️

- Refactor other route handlers to use shared errorHandler, utils, and polling modules
- Consolidate similar route handlers (e.g., POST and PUT) to share common controller logic
- Add or update unit and integration tests for shared modules and refactored routes
- Validate logging, error handling, and polling behavior after refactoring

# New Workstream: Service Layer Extraction 🚀

## Priority: High

### Tasks:

- Isolate Data Retrieval & Query Processing:
  - Move the logic that handles data retrieval, smart filtering, caching, and lazy-loading from the routes files into one or more service modules (e.g., queryProcessor.js, cacheController.js).
- Define Service Responsibilities:
  - Query Processing Service: Centralize query parsing, determining relevant topics/segments, and constructing prompts.
  - Cache Service: Manage thread-based caching, updating of file IDs, and lazy-loading of additional segments.
  - OpenAI Integration Service: Handle thread creation, message submission, run creation, and polling.
- Actions:
  - Create a /services directory with distinct modules:
    - threadService.js for thread/reuse logic and polling.
    - dataRetrievalService.js for invoking processQueryWithData, lazy-loading additional segments, and merging new data.
    - openaiService.js for all OpenAI interactions (run creation, message submission, tool call processing).
- Benefits:
  - Streamlines route files to focus solely on HTTP request/response handling.
  - Makes it easier to test and optimize core business logic independently from the API layer.

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
- Benefits:
  - Enhances readability and maintainability.
  - Avoids duplication of request validation and common response handling.

## Benefits 🌟

- Improved maintainability and consistency
- Centralized performance-sensitive code for easier optimization
- Reduced code duplication and improved readability
- Simplified testing and future enhancements
