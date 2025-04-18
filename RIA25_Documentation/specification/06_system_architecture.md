# RIA25 System Architecture

> **Last Updated:** April 30, 2024  
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
  CACHE[Thread Cache<br/>(cache/)]

  UI --> ROUTES
  ROUTES --> CONTROLLERS
  CONTROLLERS --> SERVICES
  CONTROLLERS --> UTILS
  SERVICES --> UTILS
  SERVICES --> DATA
  UTILS --> DATA
  SCRIPTS --> DATA
  CONTROLLERS --> PROMPTS
  SERVICES --> CACHE
  UTILS --> CACHE
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

The API layer follows a three-tier architecture:

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

#### 3.2.3 Services

- **Purpose**: Provide reusable functionality for controllers
- **Key Services**:
  - `app/api/services/threadService.js`: Thread management operations
  - `app/api/services/dataRetrievalService.js`: Data retrieval and processing
  - `app/api/services/openaiService.js`: OpenAI API interactions

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

  #### 3.3.4 Caching

  - `utils/cache-utils.ts`: Thread cache management

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

- **Cache Structure**:

  - Thread-specific file system cache in `cache/` directory
  - JSON files named by thread ID
  - Tracks loaded files and segments

- **Cache Operations**:
  - File-based caching for thread continuity
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

2. **Service Delegation**

   - Controller delegates to appropriate services
   - ThreadService manages thread creation/retrieval
   - DataRetrievalService handles data identification and loading

3. **Data Relevance Analysis**

   - Query is analyzed to identify relevant data files and topics
   - Analysis uses pre-defined canonical mapping of topics to files
   - Out-of-scope detection prevents responses to irrelevant queries

4. **Efficient Data Retrieval**

   - System loads only data files relevant to the current query
   - Caches data by thread ID to enable efficient follow-up handling
   - Incremental data loading adds new files as conversation expands in scope

5. **Response Generation**
   - Raw data and analysis are injected into assistant prompt
   - Response is generated using conversation history and data context
   - Response is streamed back to user for immediate feedback

### 5.2 Core Functionality Flow

1. **Request Handling**

   - API route receives HTTP request
   - Delegates to controller for business logic
   - Controller coordinates appropriate services

2. **Query Parsing**

   - Extracts user intent, keywords, and context markers
   - Checks for out-of-scope conditions
   - Identifies follow-up queries

3. **File Retrieval Based on Query**

   - Determines needed data files using canonical mapping
   - Accesses files from local storage or via API
   - Returns relevant file IDs and data

4. **Prompt Construction and Data Injection**

   - Combines user query, data, and instructions
   - Creates prompt for assistant processing
   - Injects relevant context from thread history

5. **Response Processing**
   - Assistant generates response from prompt and data
   - Response is validated and formatted
   - Result is streamed to user interface

## 6. Deployment Architecture

### 6.1 Production Environment

- **Web Hosting**: Vercel platform
- **API Access**: Direct connection to OpenAI services
- **Environment Variables**: Securely stored in Vercel
- **Domain**: Custom domain with SSL
- **Cache Strategy**: Local file-based cache with future Vercel KV integration

### 6.2 Development Environment

- **Local Development**: Next.js development server
- **API Integration**: Same OpenAI services with development keys
- **Environment Variables**: Local `.env` file
- **Cache Strategy**: Local file-based cache

## 7. Performance Optimization

### 7.1 OpenAI API Optimization

- Reduced polling interval from 1000ms to 250ms
- Improved error handling and timeout management
- Enhanced performance tracking and timing metrics
- Optimized prompt structure and token usage

### 7.2 Thread and Data Caching

- Thread-specific caching for efficient follow-up handling
- Segment-aware data retrieval to minimize data loading
- Incremental retrieval of only missing data for follow-ups
- In-memory caching with file system persistence

### 7.3 Starter Question Optimization

- Pre-compiled starter question data in JSON format
- Fast-path processing for recognized starter questions
- Direct prompt construction from pre-compiled data
- Segment-specific data loading

## 8. Security Considerations

- **API Keys**: Secure storage in environment variables
- **User Data**: No user data persistence beyond session requirements
- **Rate Limiting**: Implementation for stability and cost management
- **Error Handling**: Secure error messaging without system details exposure

## 9. Monitoring and Logging

- **API Interactions**: Logging of API requests and responses
- **Error Tracking**: Error logging in API endpoints and utility modules
- **Performance Metrics**: Performance timing and logging
- **Usage Statistics**: Query volume and patterns

## 10. Future Enhancements

### 10.1 Cache Storage Enhancement

- Planned migration from file-based caching to Vercel KV for production
- Redis-compatible key-value store integration
- Environment-aware cache implementation
- Improved cache persistence and thread continuity

### 10.2 Advanced Query Classification

- ML-based classification of query types
- Enhanced follow-up detection
- Better topic shift handling
- Multi-topic query optimization

---

_Last updated: April 30, 2024_
