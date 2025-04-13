# RIA25 System Architecture

## Overview

This document outlines the system architecture of RIA25, detailing the components, data flow, and integration points that enable the intelligent analysis of Global Workforce Survey data.

## Architecture Diagram

> **Note:** The following diagram is written in [Mermaid](https://mermaid-js.github.io/mermaid/#/) syntax.
>
> - On GitHub, GitLab, Obsidian, Notion, and many documentation tools, this will render as a visual diagram.
> - In VSCode, install the "Markdown Preview Mermaid Support" extension to see the diagram in the Markdown preview.
> - If you need a static image (PNG/SVG) version of this diagram embedded in the .md, let the development team know and it can be generated and inserted.

```mermaid
graph TD
  UI[Web Interface<br/>(Next.js, app/, components/)]
  API[API Layer<br/>(app/api/chat-assistant, retrieve-data, etc.)]
  UTILS[Utility Modules<br/>(utils/openai/retrieval, validation, cache)]
  SCRIPTS[Data Processing<br/>(scripts/process_survey_data, process_2025_data)]
  DATA[Data Files<br/>(scripts/output/, split_data/)]
  PROMPTS[Prompts<br/>(prompts/, config/)]

  UI --> API
  API --> UTILS
  API --> DATA
  UTILS --> DATA
  SCRIPTS --> DATA
  API --> PROMPTS
  UI --> PROMPTS
```

## Core Components

### 1. Next.js Web Interface

- **Purpose**: Provides user-facing application for querying and displaying survey insights
- **Key Features**:
  - User query input
  - Response rendering with Markdown support
  - Session management
  - Error handling
  - Loading states
- **Technologies**:
  - Next.js framework
  - React
  - TailwindCSS for styling
  - API integration libraries

### 2. API Layer (app/api/)

- **Purpose**: Handles user queries, data retrieval, and orchestration of analysis and validation
- **Key Endpoints**:
  - `chat-assistant/route.ts`: Main endpoint for handling user queries, integrating with OpenAI, logging, and orchestrating retrieval/analysis.
  - `retrieve-data/route.js`: Endpoint for direct data retrieval and analysis.
  - Other endpoints: `save-assistant-data` (now archived in `scripts/legacy/`), etc. (`direct-save` now archived in `scripts/legacy/`)
- **Implementation Details**:
  - Integrates with utility modules for retrieval, validation, and caching.
  - Handles logging and performance metrics.

### 3. Utility Modules

- **Purpose**: Provide core logic for data retrieval, validation, caching, and prompt handling
- **Key Files**:
  - `utils/openai/retrieval.js`: File identification, analysis generation, prompt handling, vector store integration.
  - `utils/validation/data-validation.js`: Data validation and coverage checks.
  - `utils/cache-utils.ts`: Thread/file cache management.
  - `utils/helpers.tsx`: Performance metrics and helpers.

### 4. Vector Store

- **Purpose**: Stores embedded survey data for efficient retrieval
- **Key Features**:
  - Vector embeddings of survey data
  - Semantic search capabilities
  - Metadata filtering
  - Relevance ranking
- **Implementation**:
  - OpenAI vector storage system
  - Question-specific vector files
  - Metadata preservation
  - Accessed via utility modules and API endpoints

### 5. Data Processing Pipeline

- **Purpose**: Transforms raw survey data into structured format for vector storage and analysis
- **Key Features**:
  - CSV parsing and validation
  - Data normalization and harmonization (2024/2025)
  - Canonical topic mapping
  - JSON transformation
  - File generation (split, harmonized, global)
- **Implementation**:
  - Node.js scripts: `process_survey_data.js`, `process_2025_data.js`
  - CSV parsing libraries
  - File system operations
  - Output to `scripts/output/` and `scripts/output/split_data/`

## Data Flow

### User Query Flow

1. User enters query in web interface
2. Next.js application sends query to API endpoint (`chat-assistant`, `retrieve-data`, etc.)
3. API endpoint uses utility modules (`retrieval.js`, `data-validation.js`, `cache-utils.ts`) to:
   - Identify relevant data files
   - Validate and analyze data
   - Retrieve and process data for the query
4. Utility modules access processed JSON data files (2024/2025, split/harmonized)
5. API endpoint generates response (with OpenAI integration if needed)
6. Response is returned to web interface and rendered for the user

### Data Processing Flow

1. Raw CSV survey data (2024/2025) is validated and parsed
2. Data is harmonized and mapped to canonical topics (`process_2025_data.js`)
3. Data is transformed into structured JSON format (`process_survey_data.js`)
4. JSON files are split by question number and harmonized
5. Files are processed for vector embedding and retrieval
6. Utility modules and API endpoints access these files for analysis and response generation

## Integration Points

### Web Interface to Assistants API

- **Protocol**: HTTPS REST API
- **Authentication**: API key
- **Request Format**: JSON with thread management
- **Response Format**: Structured JSON with Markdown content

### Assistants API to Vector Store

- **Integration**: Built-in integration through OpenAI platform
- **Query Mechanism**: Semantic similarity search
- **Retrieval**: Contextual retrieval with metadata filtering

### Data Processing to Vector Store

- **Protocol**: HTTPS REST API
- **Authentication**: API key
- **Upload Mechanism**: File uploads via API
- **Configuration**: Assistants API configuration

## Deployment Architecture

### Production Environment

- **Web Hosting**: Vercel platform
- **API Access**: Direct connection to OpenAI services
- **Environment Variables**: Securely stored in Vercel
- **Domain**: Custom domain with SSL

### Development Environment

- **Local Development**: Next.js development server
- **API Integration**: Same OpenAI services with development keys
- **Environment Variables**: Local `.env` file

## Security Considerations (Planned)

- **API Keys**: Secure storage in environment variables
- **User Data**: No user data persistence beyond session requirements
- **Rate Limiting**: Implementation for stability and cost management
- **Error Handling**: Secure error messaging without system details exposure

## Performance Optimization

- **Caching Strategy**: Response caching for common queries
- **Asset Optimization**: Web interface assets optimization
- **API Efficiency**: Optimized prompt design for reduced token usage
- **Vector Retrieval**: Question-specific JSON files for improved retrieval accuracy

## Monitoring and Logging

- **API Interactions**: Logging of API requests and responses (partially implemented in `chat-assistant/route.ts`)
- **Error Tracking**: Error logging in API endpoints and utility modules
- **Performance Metrics**: Performance metrics and logging in helpers and API endpoints
- **Usage Statistics**: Query volume and patterns (planned)

## Scaling Considerations (Future)

- **Web Interface**: Vercel's automatic scaling
- **API Usage**: Potential for API request distribution
- **Data Volume**: Architecture supports growth in survey data volume

## Maintenance Approach

- **Updates**: Process for system updates
- **Backups**: Vector store backups
- **Monitoring**: System monitoring
- **Documentation**: System documentation maintenance

---

_Last updated: April 13, 2025_
