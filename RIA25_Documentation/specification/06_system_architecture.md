# RIA25 System Architecture

> **Last Updated:** Sat Apr 19 2025  
> **Target Audience:** Developers, System Architects, Technical Stakeholders  
> **Related Documents:**
>
> - 03_data_processing_workflow.md
> - 15_thread_data_management.md
> - 14_api_reference.md

## 1. System Overview

RIA25 (Research Insights Assistant 2025) is an AI-powered analytics assistant designed to provide insights from workforce survey data. The system maintains conversation context across interactions, efficiently caches relevant data, and intelligently handles both follow-up and new queries within ongoing conversations.

## 2. Architecture Diagram

> **Note:** The following diagram is written in [Mermaid](https://mermaid-js.github.io/mermaid/#/) syntax.
>
> - On GitHub, GitLab, Obsidian, Notion, and many documentation tools, this will render as a visual diagram.
> - In VSCode, install the "Markdown Preview Mermaid Support" extension to see the diagram in the Markdown preview.
> - If you need a static image (PNG/SVG) version of this diagram embedded in the .md, let the development team know and it can be generated and inserted.

```mermaid
graph TD
  UI[Web Interface<br/>(Next.js, app/, components/)]
  ROUTES[API Routes<br/>(app/api/*route.ts)]
  CONTROLLERS[Controllers<br/>(app/api/controllers/)]
  SERVICES[Services<br/>(app/api/services/)]
  UTILS[Utility Modules<br/>(utils/openai, utils/data, utils/shared)]
  SCRIPTS[Data Processing<br/>(scripts/process_survey_data, process_2025_data)]
  DATA[Data Files<br/>(scripts/output/, split_data/)]
  PROMPTS[Prompts<br/>(prompts/, config/)]
  KV[Vercel KV Cache<br/>(Redis)]

  UI --> ROUTES
  ROUTES --> CONTROLLERS
  CONTROLLERS --> SERVICES
  CONTROLLERS --> UTILS
  SERVICES --> UTILS
  SERVICES --> DATA
  UTILS --> DATA
  SCRIPTS --> DATA
  CONTROLLERS --> PROMPTS
  SERVICES --> KV
  UTILS --> KV
```

## 3. Core Components

### 3.1 Next.js Web Interface

- **Purpose**: Provides user-facing application for querying and displaying survey insights
- **Key Features**:
  - User query input
  - Response rendering with Markdown support
  - Thread and session management
  - Error handling and loading states
  - Persistent thread tracking via localStorage
- **Key Files**:
  - `app/layout.tsx` - Root layout
  - `app/page.tsx` - Main landing page
  - `components/MainComponent.js` - Central UI component
  - `components/PromptInput.tsx` - User prompt input component

### 3.2 API Layer

The API layer follows a controller-service architecture pattern:

#### 3.2.1 API Routes

- **Purpose**: Handle HTTP requests, delegate processing to controllers, and format responses
- **Key Endpoints**:
  - `app/api/chat-assistant/route.ts`: Main endpoint for handling user queries
  - `app/api/query/route.js`: Endpoint for direct data retrieval and analysis
  - `app/api/retrieve-data/route.js`: Endpoint for retrieving specific data files
  - `app/api/openai/route.ts`: Alternative OpenAI assistant integration
  - Additional utility endpoints for testing and diagnostics

#### 3.2.2 Controllers

- **Purpose**: Orchestrate business logic and delegate to appropriate services
- **Key Controllers**:
  - `app/api/controllers/chatAssistantController.ts`: Handles chat assistant logic
  - `app/api/controllers/queryController.js`: Handles direct query processing
  - `app/api/controllers/retrieveDataController.js`: Handles data file retrieval
  - Additional controllers for auxiliary functionalities
- **Responsibilities**:
  - Request validation and error handling
  - Service orchestration
  - Response formatting and status code management
  - Logging and performance tracking

#### 3.2.3 Services

- **Purpose**: Provide reusable business logic for controllers
- **Key Services**:
  - `app/api/services/threadService.js`: Thread management operations
  - `app/api/services/dataRetrievalService.js`: Data retrieval and processing
  - `app/api/services/openaiService.js`: OpenAI API interactions
- **Responsibilities**:
  - Encapsulate core business logic
  - Abstract data access operations
  - Handle domain-specific functionality
  - Maintain stateless operation when possible

### 3.3 Utility Modules

- **Purpose**: Provide core logic for data retrieval, validation, caching, and prompt handling
- **Key Modules**:

  #### 3.3.1 OpenAI Integration

  - `utils/openai/retrieval.js`: File identification, analysis generation, prompt handling
  - `utils/openai/promptUtils.js`: Prompt construction and formatting

  #### 3.3.2 Data Processing

  - `utils/data/smart_filtering.js`: Filtering loaded data based on segments
  - `utils/data/segment_keys.js`: Segment configuration and defaults
  - `utils/data/incremental_cache.js`: Incremental data loading

  #### 3.3.3 Shared Utilities

  - `utils/shared/cors.js`: CORS and preflight handling
  - `utils/shared/errorHandler.js`: Standardized error responses
  - `utils/shared/loggerHelpers.js`: Performance logging
  - `utils/shared/polling.js`: OpenAI polling mechanisms
  - `utils/shared/utils.js`: Common utility functions
  - `utils/shared/kvClient.ts`: Vercel KV client with local fallback

  #### 3.3.4 Caching

  - `utils/cache-utils.ts`: Thread cache management with Vercel KV integration

### 3.4 File Access Modes

RIA25 supports two different file access modes:

#### 3.4.1 Standard Mode (Default)

- **Process**:
  1. System identifies relevant files with `identifyRelevantFiles`
  2. System retrieves and processes the actual data files
  3. System generates analysis of the data
  4. Pre-processed analysis is sent to the assistant
  5. Assistant responds based on the analysis
- **Advantages**:
  - Full control over data processing
  - Consistent data presentation to the assistant
  - Optimized for specific data formats

#### 3.4.2 Direct Access Mode

- **Process**:
  1. System identifies relevant file IDs using `identifyRelevantFiles`
  2. System sends only the prompt and file IDs to the assistant
  3. Assistant retrieves and processes data directly
  4. Assistant generates its own analysis and response
- **Advantages**:
  - Simplified backend processing
  - More flexibility for the assistant
  - Reduced processing overhead

#### 3.4.3 Mode Selection

- **Configuration Options**:
  - Environment variable: `FILE_ACCESS_MODE=direct|standard`
  - Query parameter support: `?accessMode=direct|standard`
  - Assistant-specific configuration in mapping file

### 3.5 Data Processing Pipeline

- **Purpose**: Transforms raw survey data into structured format for analysis
- **Key Features**:
  - CSV parsing and validation
  - Data normalization and harmonization (2024/2025)
  - Canonical topic mapping
  - JSON transformation
  - File generation (split, harmonized, global)
- **Implementation**:
  - Node.js scripts: `process_survey_data.js`, `process_2025_data.js`
  - Output to `scripts/output/` and `scripts/output/split_data/`

### 3.6 Prompt System

- **Purpose**: Provides instructions and context for various system operations
- **Prompt Types**:
  - **Data Identification Prompt**: Maps user query to relevant data files
  - **Analysis Prompt**: Analyzes retrieved data for insights
  - **Response Generation Prompt**: Creates final user-facing response
- **Implementation**:
  - External files in `prompts/` and `utils/openai/`
  - Version-controlled templates
  - Configurable instructions

## 4. Thread Management System

### 4.1 Thread Persistence

- **Thread Creation**:

  - New thread created for first interaction
  - Thread ID persisted in localStorage
  - Thread state retrievable after page refresh/session end

- **Thread State**:
  - Maintains full conversation history
  - Tracks which data files have been accessed
  - Records user queries and system responses

### 4.2 Thread-Specific Caching

- **Cache System**: Vercel KV (Redis) for production, in-memory Map for local development

- **Cache Structure**:

  - Thread metadata: `thread:{threadId}:meta`
  - File data: `thread:{threadId}:file:{fileId}`
  - Redis Hash (HSET) for segment-level data storage
  - 90-day automatic TTL with refresh on access

- **Cache Operations**:
  - Thread-specific caching for context continuity
  - De-duplication of file IDs
  - Progressive enhancement as conversation evolves
  - Segment-aware caching to minimize data loading

### 4.3 Thread Intelligence

- **Context Awareness**:

  - System understands relationships between queries in same thread
  - Detects topic shifts requiring new data vs. follow-ups
  - Maintains conceptual links between related questions

- **Query Classification**:
  - New topic queries - Full data retrieval with cache initialization
  - Follow-up queries - Re-use cached data, focus on continuity
  - Topic shift queries - Partial cache use, add new files as needed
  - Content transformation queries - Re-use cached data with transformation instructions

## 5. Data Flow

### 5.1 Query Processing Pipeline

1. **Query Reception**

   - User submits query through web interface
   - Request routed to appropriate API endpoint
   - Controller receives and validates the request

2. **Controller Orchestration**

   - Controller delegates to appropriate services
   - ThreadService manages thread creation/retrieval
   - DataRetrievalService handles data identification and loading

3. **Service Processing**

   - Services implement core business logic
   - Services interact with external APIs and data sources
   - Services manage caching and data transformation

4. **Data Relevance Analysis**

   - Query is analyzed to identify relevant data files and topics
   - Analysis uses pre-defined canonical mapping of topics to files
   - Out-of-scope detection prevents responses to irrelevant queries

5. **Efficient Data Retrieval**

   - System retrieves only necessary data files
   - Segment-aware retrieval minimizes data loading
   - Cached data reused when appropriate

6. **Context-Aware Response Generation**

   - System crafts prompt with relevant data and context
   - OpenAI Assistant generates response
   - Response is formatted and streamed to user

### 5.2 Optimized Follow-up Handling

The follow-up handling process leverages both thread persistence in OpenAI and Vercel KV caching:

1. **Thread Context Retrieval**

   - System retrieves existing thread using thread ID
   - Thread history provides conversational context
   - Previous data scope retrieved from Vercel KV

2. **Follow-up Detection**

   - System analyzes query for follow-up indicators
   - Previous context compared to current query
   - Classification determines if this is a follow-up

3. **Incremental Data Loading**

   - System identifies additional data needs
   - Only missing data segments are loaded
   - Cached data reused to minimize processing

4. **Context-Enhanced Response**

   - Follow-up prompt incorporates thread history
   - OpenAI Assistant maintains conversation flow
   - Response addresses follow-up context appropriately

## 6. Controller-Service Pattern Implementation

The system implements a controller-service pattern for clear separation of concerns and maintainable code structure:

### 6.1 Pattern Overview

```
API Routes → Controllers → Services → Data Access & Utilities
```

### 6.2 Controller Standards

- **Naming Convention**: Controllers use `{Name}Controller.ts` naming format
- **File Location**: Controllers reside in `app/api/controllers/` directory
- **Handler Functions**: Controllers export HTTP method-specific handlers
- **Error Handling**: All controllers implement standardized error responses
- **Logging**: Controllers perform request/response logging
- **Responsibility**: Request validation, orchestration, response formatting

### 6.3 Service Standards

- **Naming Convention**: Services use `{Name}Service.js` or `.ts` naming format
- **File Location**: Services reside in `app/api/services/` directory
- **Implementation**: Services are typically class-based with clear methods
- **Documentation**: All service methods include JSDoc comments
- **Responsibility**: Business logic, data processing, external API interactions

### 6.4 Benefits of the Pattern

- **Testability**: Controllers and services can be tested in isolation
- **Maintainability**: Clear separation of HTTP concerns and business logic
- **Reusability**: Services can be used by multiple controllers
- **Extensibility**: New features can be added with minimal coupling
- **Consistency**: Standardized pattern across the codebase

## 7. Vercel KV Integration

### 7.1 Overview

The system has been migrated from file-based caching to Vercel KV (Redis) for improved reliability and performance in serverless environments.

### 7.2 Key Components

- **KV Client**: `utils/shared/kvClient.ts` implements a singleton client with local fallback
- **Interface**: Type-safe interface defines standard Redis operations
- **Cache Utilities**: `utils/cache-utils.ts` provides high-level caching operations
- **Local Fallback**: In-memory Map implementation for local development

### 7.3 Data Structures

- **String Keys**: Used for simple key-value storage
- **Hash Keys**: Used for segment-level data storage
- **TTL Management**: All keys have 90-day TTL with automatic refresh

### 7.4 Benefits

- **Persistence**: Durable storage across function invocations
- **Performance**: Low-latency operations (typical p95 < 50ms)
- **Scalability**: Scales across regions and instances
- **Monitoring**: Built-in metrics and alerting

## 8. Security Considerations

The system implements several security measures:

- **API Key Protection**: All OpenAI API keys stored in environment variables
- **Input Validation**: Request validation to prevent injection attacks
- **CORS Protection**: Configured CORS policies for API endpoints
- **Error Handling**: Sanitized error responses to prevent information leakage
- **Authentication**: Vercel authentication for production deployments

## 9. Performance Optimizations

Several performance optimizations have been implemented:

- **Segment-Aware Caching**: Only retrieve necessary data segments
- **Thread-Level Caching**: Cache data at thread level for context continuity
- **Adaptive Polling**: Exponential backoff for OpenAI completions
- **Streaming Responses**: Stream responses for improved perceived performance
- **Optimized Data Loading**: Load only necessary data files and segments

---

_Last updated: Sat Apr 19 2025_
