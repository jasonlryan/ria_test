# RIA25 File and Function Reference

**Last Updated:** Tue May 13 11:30:22 BST 2025

> **Target Audience:** Developers, System Architects  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 03_data_processing_workflow.md
> - 14_api_reference.md
> - 15_thread_data_management.md

## Overview

This document provides a comprehensive mapping of all major files and functions in the RIA25 codebase, organized by directory. This updated version reflects the repository pattern implementation, TypeScript migration, and controller-service architecture.

## API Routes and Controllers

### API Routes

- `app/api/chat-assistant/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Processes new chat requests via controller
  - `PUT(request)`: Processes tool output submissions via controller

- `app/api/query/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Processes direct query requests

- `app/api/openai/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Alternative assistant API endpoint

- `app/api/retrieve-data/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Endpoint for retrieving data files

- `app/api/create-logs-dir/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Creates logging directory

- `app/api/save-to-logs/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `POST(request)`: Saves log data to files

- `app/api/test-assistant/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `GET(request)`: Tests assistant functionality

- `app/api/test-key/route.ts`

  - `OPTIONS(request)`: Handles CORS preflight requests
  - `GET(request)`: Tests API key validity

### Controllers

- `app/api/controllers/chatAssistantController.ts`

  - `postHandler(request)`: Handles chat assistant POST requests
  - `putHandler(request)`: Handles chat assistant PUT requests
  - `logStarterQuestionInvocation(details)`: Logs starter question usage

- `app/api/controllers/queryController.ts`

  - `postHandler(request)`: Handles query processing

- `openaiController.ts` (removed; logic consolidated into
  `chatAssistantController.ts` and `unifiedOpenAIService.ts`)

- `app/api/controllers/retrieveDataController.ts`

  - `postHandler(request)`: Handles data file retrieval

- `app/api/controllers/createLogsDirController.ts`

  - `postHandler(request)`: Handles log directory creation

- `app/api/controllers/saveToLogsController.ts`

  - `postHandler(request)`: Handles saving log data to files

- `app/api/controllers/testAssistantController.ts`

  - `getHandler(request)`: Handles assistant testing

- `app/api/controllers/testKeyController.ts`

  - `getHandler(request)`: Handles API key testing

- `app/api/controllers/testOpenAIController.ts`
  - `getHandler(request)`: Handles OpenAI API testing

## Services

- `app/api/services/unifiedOpenAIService.ts`

  - **Purpose**: Provides a centralized interface for all OpenAI API interactions with consistent error handling, monitoring, and retry mechanisms.

  - **Singleton Pattern**:

    - `getInstance()`: Get or create the singleton instance
    - `unifiedOpenAIService`: Exported singleton instance for easy imports

  - **OpenAI API Operations**:

    - `createChatCompletion(messages, options)`: Create chat completions with retry and streaming support
    - `createAsyncCompletion(messages, options)`: Create async completions with polling
    - `createEmbeddings(input, options)`: Create embeddings with retry support
    - `createImage(prompt, options)`: Create images with retry support

  - **Thread Management**:

    - `createThread()`: Creates a new OpenAI thread
    - `listMessages(threadId, options)`: Lists messages in a thread
    - `createMessage(threadId, message)`: Creates a message in a thread
    - `createRun(threadId, options)`: Creates a new run on a thread
    - `retrieveRun(threadId, runId)`: Retrieves a run's status
    - `submitToolOutputs(threadId, runId, toolOutputs)`: Submits tool call outputs
    - `waitForNoActiveRuns(threadId, pollInterval, timeoutMs)`: Waits for thread run completion

  - **Error Handling & Monitoring**:
    - `executeWithMonitoring(method, fn)`: Executes a method with performance tracking and error handling
    - Built-in retry mechanism
    - Consistent error formatting
    - Performance monitoring integration
    - Feature flag support for API version selection
    - Graceful degradation with automatic rollback

- `app/api/services/dataRetrievalService.ts`
  - `processQueryWithData(query, context, cachedFileIds, threadId, isFollowUp, previousQuery, previousResponse)`: Orchestrates data processing
  - `getPrecompiledStarterData(code)`: Retrieves starter question data
  - `isStarterQuestion(prompt)`: Detects starter question codes
  - `getCachedFiles(threadId)`: Gets cached files using the CacheRepository
  - `updateThreadCache(threadId, fileIds)`: Updates cached files using the CacheRepository
- `app/api/services/queryService.ts`

  - `processQuery(query, context, threadId, isFollowUp, previousQuery, previousResponse)`: Processes queries using repositories
  - `validateCompatibility(fileIds, isComparisonQuery)`: Validates file compatibility for comparisons
  - `enrichQueryWithTopicMetadata(query, fileIds)`: Enriches query with topic metadata
  - `trackQueryPerformance(metrics)`: Tracks query performance metrics

- `app/api/services/threadService.ts`
  - `createThread()`: Creates a new thread
  - `getThreadData(threadId)`: Retrieves thread data
  - `updateThreadData(threadId, data)`: Updates thread data
  - `addMessageToThread(threadId, message)`: Adds a message to a thread
  - `getMessagesForThread(threadId)`: Gets messages for a thread
  - `getThreadMetadata(threadId)`: Gets thread metadata

## Repository Layer

### Repository Interfaces

- `utils/data/repository/interfaces/file.ts`

  - `interface IFileRepository`: Defines file retrieval and filtering operations
  - `interface DataFile`: Core data structure for file data

- `utils/data/repository/interfaces/prompt.ts`

  - `interface IPromptRepository`: Defines prompt template operations
  - `interface PromptTemplate`: Structure for prompt templates

- `utils/data/repository/interfaces/cache.ts`

  - `interface ICacheRepository`: Defines caching operations
  - `interface ThreadCache`: Structure for thread cache data

- `utils/data/repository/interfaces/vector.ts`

  - `interface IVectorRepository`: Defines vector embedding operations
  - `interface VectorSearchResult`: Structure for vector search results

- `utils/data/repository/interfaces/compat.ts`

  - `interface ICompatibilityRepository`: Defines compatibility checking operations
  - `interface CompatibilityResult`: Structure for compatibility check results

- `utils/data/repository/interfaces/filter.ts`

  - `interface FilterProcessor`: Defines data filtering operations
  - `interface FilterResult`: Structure for filter results

- `utils/data/repository/interfaces/fileId.ts`

  - `interface FileIdentificationProcessor`: Defines file identification operations
  - `interface FileIdentificationResult`: Structure for file identification results

- `utils/data/repository/interfaces/segment.ts`

  - `interface SegmentDetector`: Defines segment detection operations
  - `interface SegmentDetectionResult`: Structure for segment detection results

- `utils/data/repository/interfaces/query.ts`
  - `interface QueryProcessor`: Defines query processing operations
  - `interface QueryProcessingResult`: Structure for query processing results

### Repository Implementations

- `utils/data/repository/implementations/fileRepository.ts`

  - `class FileRepository`: Implements IFileRepository
  - `retrieveDataFiles(fileIds)`: Retrieves data files by ID
  - `filterDataBySegments(files, segments)`: Filters data by segments
  - `loadFileData(fileId)`: Loads file data with caching
  - `loadCompatibilityData()`: Loads file compatibility data

- `utils/data/repository/implementations/promptRepository.ts`

  - `class PromptRepository`: Implements IPromptRepository
  - `getPromptTemplate(name)`: Gets a prompt template by name
  - `renderPrompt(template, data)`: Renders a prompt with data
  - `identifyRelevantFiles(query, context)`: Uses prompts to identify relevant files

- `utils/data/repository/implementations/cacheRepository.ts`

  - `class CacheRepository`: Implements ICacheRepository using Vercel KV
  - `getThreadCache(threadId)`: Gets thread cache
  - `updateThreadCache(threadId, data)`: Updates thread cache
  - `getThreadMetadata(threadId)`: Gets thread metadata
  - `updateThreadMetadata(threadId, metadata)`: Updates thread metadata

- `utils/data/repository/implementations/vectorRepository.ts`

  - `class VectorRepository`: Implements IVectorRepository
  - `createEmbedding(text)`: Creates a vector embedding
  - `searchVectors(query, topK)`: Searches vector store
  - `addToVectorStore(id, text, metadata)`: Adds entry to vector store

- `utils/data/repository/implementations/compatibilityRepository.ts`

  - `class CompatibilityRepository`: Implements ICompatibilityRepository
  - `checkCompatibility(fileIds)`: Checks compatibility between files
  - `getComparablePairs()`: Gets pairs of comparable files
  - `lookupFiles(fileIds)`: Enriches files with compatibility metadata

- `utils/data/repository/implementations/SmartFiltering.ts`

  - `class SmartFilteringProcessor`: Implements FilterProcessor
  - `parseQueryIntent(query, history)`: Parses query intent
  - `filterDataBySegments(files, context)`: Filters data by segments
  - `getBaseData(retrievedData, intent)`: Gets base data for general queries

- `utils/data/repository/implementations/fileIdentification.ts`

  - `class FileIdentificationProcessor`: Implements FileIdentificationProcessor
  - `identifyRelevantFiles(query, context)`: Identifies relevant files for a query
  - `enrichFilesWithCompatibility(fileIds)`: Enriches files with compatibility data

- `utils/data/repository/implementations/segmentDetection.ts`

  - `class SegmentDetector`: Implements SegmentDetector
  - `detectSegments(query)`: Detects segments in a query
  - `parseSegments(text)`: Parses segments from text

- `utils/data/repository/adapters/retrieval-adapter.ts`
  - **Purpose**: Adapter layer that provides compatibility between legacy code and repository pattern implementation
  - `identifyRelevantFiles(query, context)`: Adapts to repository implementation
  - `retrieveDataFiles(fileIds)`: Adapts to repository implementation
  - `filterDataBySegments(files, segments)`: Adapts to repository implementation
  - `processQueryWithData(query, context, fileIds)`: Adapts to repository implementation

### Domain-Specific Repositories

- `repositories/surveyQuestionRepository.ts`

  - `class SurveyQuestionRepository`: Implements ISurveyQuestionRepository
  - `getQuestionById(id, year)`: Gets a question by ID and year
  - `getQuestionsByTopic(topicId, year)`: Gets questions by topic and year
  - `getQuestionsByYear(year)`: Gets all questions for a year
  - `searchQuestions(query)`: Searches questions by keyword

- `repositories/canonicalTopicRepository.ts`
  - `class CanonicalTopicRepository`: Implements ICanonicalTopicRepository
  - `getTopicById(id)`: Gets a topic by ID
  - `getTopicsByTheme(theme)`: Gets topics by theme
  - `getAllTopics()`: Gets all topics
  - `getComparableTopics()`: Gets comparable topics
  - `searchTopics(query)`: Searches topics by keyword

## Utilities

### OpenAI Integration

- `utils/openai/retrieval.ts`

  - `identifyRelevantFiles(query, context, isFollowUp, previousQuery, previousAssistantResponse)`: Uses OpenAI to identify relevant data files via repository
  - `isStarterQuestion(query)`: Checks if query is a starter question
  - `getPrecompiledStarterData(starterCode)`: Gets precompiled starter question data
  - `processQueryWithData(query, context, cachedFileIds, threadId, isFollowUpContext, previousQueryContext, previousAssistantResponseContext)`: Core query processing pipeline using repository
  - `handleQueryAPI(req, res)`: API handler for query processing
  - `retrieveDataFiles(fileIds)`: Retrieves data from files using FileRepository
  - `generateCacheKey(query)`: Generates keys for query caching
  - `formatStats(stats)`: Formats statistics for display

- `utils/openai/promptUtils.ts`
  - `buildPromptWithFilteredData(query, filteredData, options)`: Constructs prompts with filtered data
  - `getPromptTemplate(templateName)`: Retrieves prompt templates using PromptRepository
  - `formatFilteredDataForPrompt(filteredData)`: Formats data for prompts

### Data Processing

- `utils/data/segment_keys.ts`

  - Defines `DEFAULT_SEGMENTS`: Standard segments to use
  - Defines `CANONICAL_SEGMENTS`: All valid segment keys

- `utils/data/types.ts`

  - TypeScript type definitions for data structures used across the application

### Caching with Vercel KV

- `lib/kvClient.ts`

  - `kvClient`: Singleton instance of KV client
  - Memory fallback implementation for local development
  - Integration with Vercel KV in production

- `utils/cache-utils.ts`

  - `getCachedFilesForThread(threadId)`: Gets cached files for a thread using CacheRepository
  - `updateThreadWithFiles(threadId, newFiles)`: Updates thread cache using CacheRepository
  - `getOrLoad<T>(key, loader, ttl)`: Implements the read-through caching pattern
  - `mergeSegmentSlice(threadId, fileId, segment, slice)`: Updates segment data with hash operations

- `utils/shared/key-schema.ts`
  - `threadFileKey(threadId, fileId)`: Generates thread file cache key
  - `threadMetaKey(threadId)`: Generates thread metadata cache key
  - `analyticsKey(metric, date)`: Generates analytics cache key
  - `cacheKey(category, id)`: Generates general cache key

### Feature Flag System

- `utils/shared/feature-flags.ts`

  - **Purpose**: Manages feature toggles for gradual rollout of new functionality and service migrations.

  - **Core Types**:

    - `FeatureFlagConfig`: Configuration for a feature flag
    - `FeatureFlags`: Type-safe feature flag definitions
    - `FeatureFlagName`: Union type of all valid feature flag names

  - **Flag Management**:
    - `featureFlags`: Default feature flag definitions with descriptions
    - `FeatureFlagService`: Singleton service for managing feature flags
      - `getInstance()`: Get the singleton instance
      - `isEnabled(flagName)`: Check if a feature flag is enabled
      - `getFeatureStates()`: Get current state of all feature flags
      - `logFeatureStates()`: Log the current state of all feature flags
  - **Helper Functions**:
    - `isFeatureEnabled(flagName)`: Convenience function to check flag status
    - `featureFlagService`: Exported singleton instance

### Polling System

- `utils/shared/polling-manager.ts`

  - **Purpose**: Provides a centralized, type-safe polling mechanism with configurable retry logic, timeouts, and backoff strategies.

  - **Core Types**:

    - `PollingConfig`: Configuration options for a polling operation
    - `PollingTimeoutError`: Error thrown when polling times out
    - `PollingRetryError`: Error thrown when polling fails after too many retries

  - **Polling Management**:
    - `PollingManager`: Singleton service for managing polling operations
      - `getInstance()`: Get the singleton instance
      - `poll<T>(pollingFn, config)`: Execute a polling operation with retries and backoff
      - `pollAll<T>(pollingOperations, config)`: Execute multiple polling operations in parallel
  - **Helper Functions**:
    - `pollOperation<T>(operation, config)`: Convenience function for polling
    - `pollingManager`: Exported singleton instance

### Monitoring System

- `utils/shared/monitoring.ts`

  - **Purpose**: Tracks usage patterns, performance, and issues during the OpenAI service migration.

  - **Core Types**:

    - `MigrationMetrics`: Structure for tracking service metrics

  - **Monitoring Operations**:
    - `MigrationMonitor`: Singleton service for monitoring service migrations
      - `getInstance()`: Get the singleton instance
      - `trackCall(service, method, startTime)`: Track a service call with performance metrics
      - `trackError(service, method, error)`: Track an error in a service
      - `hasIssues()`: Check if there are any issues that warrant rollback
      - `getMetrics()`: Get current migration metrics
      - `logStatus()`: Log current migration status
  - **Helper Functions**:
    - `migrationMonitor`: Exported singleton instance

### Rollback System

- `utils/shared/rollback.ts`

  - **Purpose**: Handles rollback procedures if issues are detected during migration.

  - **Rollback Management**:
    - `RollbackManager`: Singleton service for managing rollbacks
      - `getInstance()`: Get the singleton instance
      - `checkAndRollbackIfNeeded()`: Check if rollback is needed and execute if necessary
      - `isInRollback()`: Check if system is currently rolling back
  - **Helper Functions**:
    - `rollbackManager`: Exported singleton instance

### Shared Utilities

- `utils/shared/cors.ts`

  - `handleOptions(request)`: Handles CORS preflight requests
  - `allowCors(handler)`: Middleware to enable CORS for handlers

- `utils/shared/loggerHelpers.ts`

  - `logPerformanceMetrics(stage, metrics)`: Logs performance metrics
  - `logPerformanceToFile(query, cachedFileIds, fileIds, pollCount, totalTimeMs, status, message)`: Logs to file

- `utils/shared/errorHandler.ts`

  - `formatErrorResponse(error, status)`: Formats error responses
  - `formatBadRequestResponse(message, missingFields)`: Formats bad request responses

- `utils/shared/utils.ts`

  - `sanitizeOutput(text)`: Cleans OpenAI output
  - `isJsonContent(content)`: Validates JSON content

- `utils/shared/queryUtils.ts`
  - `normalizeQueryText(query)`: Normalizes query text for consistent processing
  - `createThreadContext(query, previousQuery, previousResponse)`: Creates a thread context object
  - `extractYearFromFileId(fileId)`: Extracts year from file ID

### Logging

- `utils/logger.ts`
  - `error(message, meta)`: Logs errors
  - `warn(message, meta)`: Logs warnings
  - `info(message, meta)`: Logs information
  - `debug(message, meta)`: Logs debug information
  - `trace(message, meta)`: Logs trace information

## UI Components

- `app/layout.tsx`: Root layout component
- `app/page.tsx`: Main landing page

- `components/MainComponent.tsx`: Central UI component
- `components/DataRetrievalTester.tsx`: Data retrieval testing UI
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

## Testing Files

- `tests/repository/*.test.ts`: Repository implementation tests
- `tests/services/*.test.ts`: Service implementation tests
- `tests/controllers/*.test.ts`: Controller implementation tests
- `tests/integration/*.test.ts`: Integration tests
- `tests/manual_tests/test_query_normalization.js`: Manual test for query normalization

---

_Last updated: Tue May 13 11:30:22 BST 2025_
