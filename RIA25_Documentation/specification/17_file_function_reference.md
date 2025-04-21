# RIA25 File and Function Reference

> **Last Updated:** April 30, 2024  
> **Target Audience:** Developers, System Architects  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 03_data_processing_workflow.md
> - 14_api_reference.md

## Overview

This document provides a comprehensive mapping of all major files and functions in the RIA25 codebase, organized by directory. Use this as a reference for understanding the system architecture and for documentation auditing purposes.

## API Routes and Controllers

### API Routes

- `app/api/chat-assistant/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Processes new chat requests via controller
  - `PUT(request)`: Processes tool output submissions via controller

- `app/api/query/route.js`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Processes direct query requests

- `app/api/openai/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Alternative assistant API endpoint

- `app/api/retrieve-data/route.js`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Endpoint for retrieving data files

- `app/api/create-logs-dir/route.js`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Creates logging directory

- `app/api/save-to-logs/route.js`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Saves log data to files

- `app/api/test-assistant/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `GET(request)`: Tests assistant functionality

- `app/api/test-key/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `GET(request)`: Tests API key validity

- `app/api/test-openai/route.ts`
  - `OPTIONS(request)`: Handles CORS preflight requests
  - `GET(request)`: Tests OpenAI API connectivity

### Controllers

- `app/api/controllers/chatAssistantController.ts`

  - `postHandler(request)`: Handles chat assistant POST requests
  - `putHandler(request)`: Handles chat assistant PUT requests
  - `logStarterQuestionInvocation(details)`: Logs starter question usage

- `app/api/controllers/queryController.js`

  - `postHandler(request)`: Handles query processing

- `app/api/controllers/openaiController.ts`

  - `postHandler(request)`: Handles OpenAI assistant interactions

- `app/api/controllers/retrieveDataController.js`

  - `postHandler(request)`: Handles data file retrieval

- `app/api/controllers/createLogsDirController.js`

  - `postHandler(request)`: Handles log directory creation

- `app/api/controllers/saveToLogsController.js`

  - `postHandler(request)`: Handles saving log data to files

- `app/api/controllers/testAssistantController.ts`

  - `getHandler(request)`: Handles assistant testing

- `app/api/controllers/testKeyController.ts`

  - `getHandler(request)`: Handles API key testing

- `app/api/controllers/testOpenAIController.ts`
  - `getHandler(request)`: Handles OpenAI API testing

## Services

- `app/api/services/threadService.js`

  - `createThread()`: Creates a new OpenAI thread
  - `reuseThread(threadId)`: Validates and reuses an existing thread
  - `waitForNoActiveRuns(threadId, pollInterval, timeoutMs)`: Waits for thread run completion
  - `createRun(threadId, assistantId, instructions)`: Creates a new run on a thread
  - `pollRunStatus(threadId, runId, pollInterval)`: Polls run status
  - `submitToolOutputs(threadId, runId, toolOutputs)`: Submits tool call outputs
  - `updateThreadCache(threadId, fileIds)`: Updates cached file IDs
  - `getCachedFiles(threadId)`: Retrieves cached file IDs

- `app/api/services/dataRetrievalService.js`

  - `identifyRelevantFiles(query, context, isFollowUp, previousQuery, previousResponse)`: Identifies relevant data files
  - `loadDataFiles(fileIds)`: Loads data files
  - `filterDataBySegments(loadedData, segments)`: Filters data by segments
  - `processQueryWithData(query, context, cachedFileIds, threadId, isFollowUp, previousQuery, previousResponse)`: Orchestrates data processing
  - `getPrecompiledStarterData(code)`: Retrieves starter question data
  - `isStarterQuestion(prompt)`: Detects starter question codes
  - `getCachedFiles(threadId)`: Gets cached files
  - `updateThreadCache(threadId, fileIds)`: Updates cached files

- `app/api/services/openaiService.js`
  - `sendMessage(threadId, message)`: Sends a message to a thread
  - `createRun(threadId, assistantId, instructions)`: Creates a thread run
  - `pollRunStatus(threadId, runId, pollInterval)`: Polls run status
  - `submitToolOutputs(threadId, runId, toolOutputs)`: Submits tool outputs
  - `waitForNoActiveRuns(threadId, pollInterval, timeoutMs)`: Waits for thread availability

## Utilities

### OpenAI Integration

- `utils/openai/retrieval.js`

  - `identifyRelevantFiles(query, context, isFollowUp, previousQuery, previousAssistantResponse)`: Uses OpenAI to identify relevant data files
  - `isStarterQuestion(query)`: Checks if query is a starter question
  - `getPrecompiledStarterData(starterCode)`: Gets precompiled starter question data
  - `processQueryWithData(query, context, cachedFileIds, threadId, isFollowUpContext, previousQueryContext, previousAssistantResponseContext)`: Core query processing pipeline
  - `handleQueryAPI(req, res)`: API handler for query processing
  - `retrieveDataFiles(fileIds)`: Retrieves data from files
  - `generateCacheKey(query)`: Generates keys for query caching
  - `formatStats(stats)`: Formats statistics for display

- `utils/openai/promptUtils.js`
  - `buildPromptWithFilteredData(query, filteredData, options)`: Constructs prompts with filtered data
  - `getPromptTemplate(templateName)`: Retrieves prompt templates
  - `formatFilteredDataForPrompt(filteredData)`: Formats data for prompts

### Data Processing

- `utils/data/smart_filtering.js`

  - `parseQueryIntent(query, conversationHistory)`: Extracts intent from queries
  - `mapIntentToDataScope(queryIntent)`: Maps intent to data scope
  - `getBaseData(retrievedData, queryIntent)`: Gets essential data for general queries
  - `getSpecificData(retrievedData, options)`: Gets filtered data based on segments

- `utils/data/segment_keys.js`

  - Defines `DEFAULT_SEGMENTS`: Standard segments to use
  - Defines `CANONICAL_SEGMENTS`: All valid segment keys

- `utils/data/types.js`

  - TypeScript/JSDoc type definitions for data structures

- `utils/data/incremental_cache.js`
  - `getThreadCache(threadId)`: Gets thread cache
  - `updateThreadCache(threadId, newData)`: Updates thread cache
  - `getDataScope(threadId)`: Gets data scope for a thread
  - `getIncrementalData(threadId, newDataScope)`: Gets incremental data needed
  - `calculateMissingDataScope(existingScope, newScope)`: Calculates missing data

### Caching

- `utils/cache-utils.ts`
  - `getCachedFilesForThread(threadId)`: Gets cached files for a thread
  - `updateThreadCache(threadId, newFiles)`: Updates thread cache
  - Interface `CachedFile`: Structure for cached file data

### Shared Utilities

- `utils/shared/cors.js`

  - `handleOptions(request)`: Handles CORS preflight requests

- `utils/shared/loggerHelpers.js`

  - `logPerformanceMetrics(stage, metrics)`: Logs performance metrics
  - `logPerformanceToFile(query, cachedFileIds, fileIds, pollCount, totalTimeMs, status, message)`: Logs to file

- `utils/shared/errorHandler.js`

  - `formatErrorResponse(error, status)`: Formats error responses
  - `formatBadRequestResponse(message, missingFields)`: Formats bad request responses

- `utils/shared/utils.js`

  - `sanitizeOutput(text)`: Cleans OpenAI output
  - `isJsonContent(content)`: Validates JSON content

- `utils/shared/polling.js`
  - `waitForNoActiveRuns(openai, threadId, pollInterval, timeoutMs)`: Polls for run completion

### Logging

- `utils/logger.js`
  - `error(message, meta)`: Logs errors
  - `warn(message, meta)`: Logs warnings
  - `info(message, meta)`: Logs information
  - `debug(message, meta)`: Logs debug information

## UI Components

- `app/layout.tsx`: Root layout component
- `app/page.tsx`: Main landing page

- `components/MainComponent.js`: Central UI component
- `components/DataRetrievalTester.js`: Data retrieval testing UI
- `components/Nav.tsx`: Navigation bar
- `components/PromptInput.tsx`: User prompt input interface
- `components/CollapsibleBlock.tsx`: Collapsible UI component
- `components/CollapsibleContent.tsx`: Content for collapsible blocks

## Data Processing Scripts

- `scripts/process_2025_data.js`: Processes 2025 data
- `scripts/process_survey_data.js`: Processes survey data

## Configuration Files

- `config/chat.config.json`: Chat assistant configuration
- `package.json`: Project dependencies
- `next.config.js`: Next.js configuration
- `tsconfig.json`: TypeScript configuration

## Prompt Files

- `utils/openai/1_data_retrieval.md`: Identification prompt
- `prompts/assistant_prompt.md`: Synthesis prompt
- `prompts/starter_prompt_template.md`: Starter question template

## Data Files

- `scripts/reference files/2025/canonical_topic_mapping.json`: Topic to file mapping
- `scripts/output/split_data/*.json`: Survey data files
- `utils/openai/precompiled_starters/*.json`: Precompiled starter question data

## Cache Files

- `cache/default.json`: Default cache structure
- `cache/thread_*.json`: Thread-specific caches

---

_Last updated: April 30, 2024_
