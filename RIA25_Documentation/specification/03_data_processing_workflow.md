# RIA25 Data Processing Workflow

> **Last Updated:** April 30, 2024  
> **Target Audience:** Developers, System Architects, Technical Stakeholders  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 15_thread_data_management.md
> - 07_prompt_evolution.md

## Overview

This document describes the data processing workflow implemented for RIA25, detailing the transformation of raw survey data into structured JSON files optimized for vector database ingestion, and the subsequent query processing and data retrieval systems.

## Workflow Diagram

```
Raw CSV Data → Data Validation → Column Mapping → JSON Transformation → Split by Question → Vector Store Ingestion
```

## Data Processing Steps

### 1. Input Data Format

- **Source**: Raw CSV files from the 2025 and 2024 Global Workforce Surveys
- **Format**: CSV with headers
- **Location**: `/scripts/data/2025/2025_global_data.csv`, `/scripts/data/2024/2024_global_data.csv`
- **Structure**:
  - Rows represent individual survey responses
  - Columns include question responses and demographic information

### 2. Data Validation & Harmonization

- **Purpose**: Ensure data integrity and harmonize structure across years before processing
- **Implementation**:
  - Initial data validation in `process_survey_data.js`
  - Advanced harmonization and validation in `process_2025_data.js`
  - Canonical topic mapping and normalization logic
- **Checks**:
  - CSV format verification
  - Required columns presence
  - Data type validation
  - Consistency and mapping to canonical topics
  - Harmonization of 2024/2025 data for valid comparison

### 3. Column Mapping

- **Purpose**: Create flexible mapping between CSV columns and structured JSON
- **Implementation**: Dynamic column mapping in `process_survey_data.js` and harmonization in `process_2025_data.js`
- **Benefits**:
  - Resilience to column order changes
  - Adaptation to CSV format variations
  - Simplified maintenance

### 4. JSON Transformation

- **Purpose**: Convert raw CSV data into structured JSON
- **Implementation**: Transformation logic in `process_survey_data.js` and `process_2025_data.js`
- **Structure**:
  - Consistent metadata format
  - Demographic information categorization
  - Response data formatting
  - Year information
  - Canonical topic mapping

### 5. Split by Question

- **Purpose**: Create individual JSON files per question for optimized retrieval
- **Implementation**: File creation in `process_survey_data.js` and `process_2025_data.js`
- **Output**:
  - Individual files named `2025_[question_number].json`, `2024_[question_number].json`
  - Located in `scripts/output/split_data/`
  - Harmonized and global files in `scripts/output/`

### 6. Vector Store Integration

- **Purpose**: Prepare and upload data to vector database for semantic retrieval
- **Implementation**:
  - Data retrieval and embedding logic implemented in `utils/openai/retrieval.js` and API endpoints
  - Controllers orchestrate interaction with the vector store via services
  - Services provide reusable functionality for data access
- **Process**:
  - Read processed JSON files
  - Format for vector embedding
  - Upload and retrieve via OpenAI Assistants API and utility modules
  - Verify successful ingestion and retrieval

## Example Data Transformation

### Input CSV Format

```csv
question_1,question_2,region,age_group,gender,org_size
"Agree","Strongly Agree","North America","25-34","Male","1000-4999"
```

### Output JSON Format

```json
{
  "metadata": {
    "survey_year": 2025,
    "question_number": 1,
    "question_text": "I feel empowered to make decisions in my role."
  },
  "responses": {
    "by_region": {
      "North America": {
        "response_count": 1500,
        "response_data": {
          "Agree": 45,
          "Strongly Agree": 30,
          "Neutral": 15,
          "Disagree": 7,
          "Strongly Disagree": 3
        }
      }
      // Additional regions...
    },
    "by_age": {
      // Age group breakdowns...
    }
    // Additional demographic breakdowns...
  }
}
```

## Key Scripts

### process_survey_data.js

- **Purpose**: Core data processing script for both 2024 and 2025 data
- **Location**: `/scripts/process_survey_data.js`
- **Functionality**:
  - CSV parsing
  - Data validation
  - Column mapping
  - JSON transformation
  - File generation

### process_2025_data.js

- **Purpose**: Advanced harmonization and canonical topic mapping for 2025 data
- **Location**: `/scripts/process_2025_data.js`
- **Functionality**:
  - Data harmonization across years
  - Canonical topic mapping
  - Output of harmonized and split files

## API Architecture

The RIA25 system follows a layered architecture for data processing and retrieval:

### Architecture Diagram

```
Client → API Routes → Controllers → Services → Utilities → Data
```

### Components

1. **API Routes**

   - Located in `app/api/` directory
   - Handle HTTP protocol (request/response)
   - Delegate business logic to controllers
   - Examples: `app/api/chat-assistant/route.ts`, `app/api/query/route.js`

2. **Controllers**

   - Located in `app/api/controllers/` directory
   - Orchestrate business logic
   - Delegate to appropriate services
   - Examples: `app/api/controllers/chatAssistantController.ts`, `app/api/controllers/queryController.js`

3. **Services**

   - Located in `app/api/services/` directory
   - Provide reusable functionality
   - Examples: `app/api/services/dataRetrievalService.js`, `app/api/services/threadService.js`

4. **Utilities**
   - Located in `utils/` directory
   - Provide core functionality for data processing and integration
   - Examples: `utils/openai/retrieval.js`, `utils/data/smart_filtering.js`

### Shared Utilities

The system includes a set of shared utilities that provide common functionality:

- **CORS Handling**: `utils/shared/cors.js`
- **Error Handling**: `utils/shared/errorHandler.js`
- **Logging**: `utils/shared/loggerHelpers.js`
- **OpenAI Polling**: `utils/shared/polling.js`
- **Common Utilities**: `utils/shared/utils.js`

## Query Processing System

The query processing system is designed to efficiently handle user queries, identify relevant data files, and retrieve only the necessary data segments. This system has been optimized to reduce latency and improve user experience.

### Query Flow Diagram

```
User Query → API Route → Controller → DataRetrievalService → Smart Filtering → Response Generation
```

### Query Processing Flow

1. **Request Reception**

   - User submits a query through the client interface
   - Request is routed to appropriate API endpoint (e.g., `app/api/chat-assistant/route.ts`)
   - API route delegates to controller (e.g., `chatAssistantController.ts`)

2. **Controller Orchestration**

   - Controller validates request parameters
   - Controller delegates to appropriate services
   - Controller manages response streaming and error handling

3. **Service Processing**

   - `dataRetrievalService` identifies relevant files
   - `threadService` manages thread context and caching
   - Services use utility modules for core functionality

4. **Data Identification and Retrieval**
   - Identify relevant files using semantic matching
   - Load data files using file system or API
   - Filter data based on query segments
   - Return structured data for response generation

### Query Intent Parsing

- **Purpose**: Extract meaningful intent from natural language queries
- **Implementation**: `utils/data/smart_filtering.js`
- **Components**:
  - `parseQueryIntent(query, conversationHistory)`: Extracts topics, demographics, years, and specificity from the query
  - `mapIntentToDataScope(queryIntent)`: Maps the parsed intent to a data scope (topics, demographics, years, file IDs)
- **Features**:
  - Detection of follow-up questions through heuristics
  - Identification of demographic segments mentioned in the query
  - Topic extraction and mapping to canonical topics
  - Year detection for historical comparisons

### Enhanced Follow-up Detection

The system implements multi-level heuristics to identify follow-up queries:

1. **Short Query Check**: Brief queries (< 15 characters) are likely follow-ups
2. **Pronoun Check**: Queries starting with pronouns (it, this, they) indicate follow-ups
3. **Reference Check**: Terms like "previous," "above," or "mentioned" suggest follow-ups
4. **Comparative Check**: Words like "more," "less," or "better" often indicate follow-ups

For ambiguous cases, an optional lightweight model classification can be used:

```javascript
async function classifyQueryWithModel(query, previousQuery) {
  // Use a lightweight model to classify if this is a follow-up
  // Returns boolean: true if this is a follow-up question
}
```

### Data Scope Mapping

The system maps query intent to data scope:

```javascript
function mapQueryToDataScope(queryIntent) {
  // Convert parsed query intent to a formal data scope
  return {
    fileIds: [], // File IDs to load
    topics: [], // Topics of interest
    segments: [], // Demographic segments to include
  };
}
```

### Smart Filtering and Segment-Based Caching

The system implements smart filtering and segment-based caching to optimize data access:

1. **Smart Filtering Implementation**

   - Located in `utils/data/smart_filtering.js`
   - Filters data based on query intent and segments
   - Extracts only relevant statistics for the response

2. **Segment-Based Caching**

   - Tracks which segments have been loaded for each file
   - Only loads missing segments for follow-up queries
   - Reduces redundant data loading and processing

3. **Implementation Structure**
   - Services coordinate caching strategy
   - Controllers handle request-specific caching logic
   - Utilities provide core caching functionality

## Data Retrieval Optimizations

### 1. Route-Controller-Service Pattern

- **Implementation**:

  - API Routes: `app/api/chat-assistant/route.ts`, `app/api/query/route.js`
  - Controllers: `app/api/controllers/chatAssistantController.ts`, `app/api/controllers/queryController.js`
  - Services: `app/api/services/dataRetrievalService.js`, `app/api/services/threadService.js`

- **Benefits**:
  - Clear separation of concerns
  - Modular and maintainable code structure
  - Easier testing and debugging
  - Shared functionality across routes

### 2. Thread-Specific Caching

- **Implementation**:

  - Cache files in `cache/` directory
  - Thread-specific file naming (e.g., `thread_ABC123.json`)
  - Managed by `utils/cache-utils.ts` and service layer

- **Benefits**:
  - Optimized follow-up handling
  - Reduced data processing time
  - Lower API call volume

### 3. Staged Query Processing

The query processing pipeline is implemented in stages:

- \*\*Stage 1: Data retrieval and preprocessing (handled by `/api/query`)

  - Identification of relevant files
  - Segment-aware data loading
  - Smart filtering based on segments

- \*\*Stage 2: Response generation with OpenAI Assistant (handled by `/api/chat-assistant`)
  - Prompt construction with filtered data
  - Context-aware response generation
  - Response streaming

### 4. Dynamic Data Granularity

- **Implementation**:

  - Query intent parsing determines granularity needs
  - Smart filtering extracts appropriate level of detail
  - Segment-aware caching optimizes granularity handling

- **Benefits**:
  - Processing varies based on query specificity
  - General queries receive summarized data
  - Specific queries receive detailed, filtered data

## Smart Filtering and Segment-Aware Caching

After data is processed and ingested, the system applies a segment-aware smart filtering and caching pipeline to ensure that queries are answered with the most relevant demographic or categorical breakdowns.

**Segment Selection Logic:**

- **Starter Questions:** If the query is a recognized starter question (e.g., "SQ2"), the relevant segments are explicitly set in the corresponding starter JSON file (e.g., `"segments": ["sector"]`).
- **All Other Queries:** For general queries, the OpenAI model is prompted (see `utils/openai/1_data_retrieval.md`) to infer the most relevant segments (e.g., "sector", "age", "region", "gender") and return them in a `"segments"` array in its JSON response.
- **Default Fallback:** If neither the starter JSON nor OpenAI inference provides segments, the system defaults to `["region", "age", "gender"]` (see `utils/data/segment_keys.js`).

**Canonical Segment Keys and Centralized Config:**

- All valid segment keys are defined in a single config file: `utils/data/segment_keys.js`.
  - `DEFAULT_SEGMENTS` is the fallback: `["region", "age", "gender"]`
  - `CANONICAL_SEGMENTS` is the full set used for filtering: `["overall", "region", "age", "gender", "org_size", "sector", "job_level", "relationship_status", "education", "generation", "employment_status"]`
- All filtering, matching, and fallback logic references this config, ensuring consistency and maintainability.

**How Segments Are Used:**

- The selected segments are injected into the query intent and used throughout the filtering and caching pipeline (see `utils/openai/retrieval.js` and `utils/data/smart_filtering.js`).
- Only canonical segment keys are used for filtering, guaranteeing alignment with the data files.
- The cache tracks which segments have been retrieved for each file, enabling efficient follow-up queries and minimizing redundant data loading.

**Enhanced Logging and Traceability:**

- Every step logs the query, files, topics, and segments being retrieved.
- If no stats are found for the selected segments, the system logs both the requested segments and the available segments in the data file, making it easy to debug any mismatch or data hygiene issue.
- This provides full transparency and traceability from query to assistant response.

**Rationale:**

- This hybrid approach allows for per-question customization (for starters), dynamic adaptation (for general queries), and robust fallback behavior.
- Centralizing segment logic in a config file ensures that all code paths use the same canonical keys, eliminating inconsistencies.
- Enhanced logging guarantees that any segment alignment issues can be quickly diagnosed and resolved.

## Incremental Data Loading

To optimize performance, the system implements incremental data loading, which only retrieves segments that aren't already in the thread cache:

1. **Determine Required Segments**

   - Parse query intent to identify needed segments
   - Check thread cache for already loaded segments
   - Calculate missing segments to load

2. **Load Missing Data**

   - Retrieve only missing segments from files
   - Update cache with newly loaded segments
   - Track segment availability for future queries

3. **Optimize Response Generation**
   - Use complete set of segments (cached + newly loaded)
   - Generate response using all relevant data
   - Avoid redundant data processing

## Performance Optimization

### 1. Reduced API Calls

- Cache frequently accessed data
- Batch data requests where possible
- Use incremental loading to minimize redundant calls

### 2. Minimized Processing Time

- Filter data as early as possible in the pipeline
- Use efficient data structures for filtering and comparison
- Leverage segment-aware caching for incremental loading

### 3. Optimized Memory Usage

- Load only required segments
- Release memory when no longer needed
- Implement size limits and eviction policies

### 4. Enhanced User Experience

- Stream responses for immediate feedback
- Optimize follow-up query handling
- Provide accurate cache-based responses

## Future Enhancements

### 1. Advanced Cache Invalidation

- Add timestamp-based invalidation
- Implement content hash verification
- Support selective segment invalidation

### 2. ML-Based Query Classification

- Train models to better detect follow-up patterns
- Implement intent-based segment prediction
- Optimize caching based on predicted query patterns

### 3. Vercel KV Integration

- Replace file-based caching with Vercel KV
- Implement distributed caching across functions
- Add TTL and size management

---

_Last updated: April 30, 2024_
