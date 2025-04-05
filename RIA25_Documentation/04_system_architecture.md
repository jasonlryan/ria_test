# RIA25 System Architecture

## Overview

This document outlines the system architecture of RIA25, detailing the components, data flow, and integration points that enable the intelligent analysis of Global Workforce Survey data.

## Architecture Diagram

```
┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│                │    │                 │    │                  │
│  Next.js       │    │  OpenAI         │    │  Vector          │
│  Web Interface │───▶│  Assistants API │───▶│  Store           │
│                │    │                 │    │                  │
└────────────────┘    └─────────────────┘    └──────────────────┘
        ▲                                           ▲
        │                                           │
        │                                           │
        │             ┌─────────────────┐          │
        │             │                 │          │
        └─────────────│  Data           │──────────┘
                      │  Processing     │
                      │  Pipeline       │
                      │                 │
                      └─────────────────┘
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

### 2. OpenAI Assistants API

- **Purpose**: Processes user queries and generates responses using AI capabilities
- **Key Features**:
  - Natural language understanding
  - Context tracking
  - Thread management
  - File attachment support
  - Vector retrieval capabilities
- **Implementation Details**:
  - System prompts for data accuracy
  - Anti-fabrication measures
  - Response formatting rules

### 3. Vector Store

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

### 4. Data Processing Pipeline

- **Purpose**: Transforms raw survey data into structured format for vector storage
- **Key Features**:
  - CSV parsing and validation
  - Data normalization
  - JSON transformation
  - File generation
- **Implementation**:
  - Node.js scripts
  - CSV parsing libraries
  - File system operations
  - OpenAI API integration

## Data Flow

### User Query Flow

1. User enters query in web interface
2. Next.js application sends query to OpenAI Assistants API
3. Assistants API uses vector search to retrieve relevant survey data
4. AI processes query with retrieved data and system prompts
5. Response is generated and returned to web interface
6. Web interface renders formatted response to user

### Data Processing Flow

1. Raw CSV survey data is validated and parsed
2. Data is transformed into structured JSON format
3. JSON files are split by question number
4. Files are processed for vector embedding
5. Embedded data is uploaded to OpenAI Vector Store
6. Assistants API is configured to access vector data

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

## Monitoring and Logging (Planned)

- **API Interactions**: Logging of API requests and responses
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking
- **Usage Statistics**: Query volume and patterns

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

_Last updated: April 5, 2024_
