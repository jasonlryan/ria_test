# Data Retrieval System Architecture Overview

This document provides a detailed architectural overview of the RIA25 data retrieval system implementation. The architecture is designed to ensure that AI-generated responses are based on complete survey data instead of partial samples or fabricated information.

## System Goals

The primary goals of this architecture are:

1. **Force Actual Data Usage**: Ensure that responses use complete data files, not just sample points
2. **Prevent Fabrication**: Detect and flag any attempt to use made-up percentages
3. **Validate Country Coverage**: Ensure strategic analysis includes data from all available countries
4. **Scalability**: Allow for efficient processing of larger data files as more survey data becomes available
5. **Rapid Implementation**: Design for quick deployment with minimal infrastructure changes

## High-Level Architecture

The system follows a two-phase approach to data retrieval and analysis:

```
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│  User Query  │────▶│ File          │────▶│ Data Retrieval │
└──────────────┘     │ Identification │     │ API (Vercel)   │
                     └───────────────┘     └────────────────┘
                                                    │
                                                    ▼
┌──────────────┐     ┌───────────────┐     ┌────────────────┐
│  Response    │◀────│ Response      │◀────│ Complete Data  │
│  to User     │     │ Validation    │     │ Analysis       │
└──────────────┘     └───────────────┘     └────────────────┘
```

### Components

1. **File Identification**: Uses OpenAI to determine which data files are relevant to a query
2. **Data Retrieval API**: Serverless function to fetch complete file contents from storage
3. **Complete Data Analysis**: Uses OpenAI with the complete data files to generate analysis
4. **Response Validation**: Verifies that the response only uses percentages from the actual data
5. **User Interface**: Frontend components for submitting queries and displaying results

## Component Details

### 1. File Identification

This component uses OpenAI's function calling capability to identify which data files are needed to answer a query:

- **Input**: User's natural language query
- **Processing**: AI model analyzes the query to determine relevant data files
- **Output**: List of file IDs to retrieve
- **Technology**: OpenAI's GPT-4 with function calling

**Key Implementation Features**:

- System prompt restricts the model to only identify files, not answer the query
- Function schema enforces return of file IDs in a structured format
- Specific naming patterns ensure correct identification of files by topic and year

### 2. Data Retrieval API

This serverless function retrieves complete data files from storage:

- **Input**: List of file IDs
- **Processing**: Fetches each file and counts data points
- **Output**: Complete data file contents with metadata
- **Technology**: Vercel Serverless Functions (Next.js API routes)

**Key Implementation Features**:

- Input validation to prevent injection attacks
- Path sanitization for security
- Flexible storage options (GitHub, S3, Vercel KV)
- Metadata collection for validation purposes
- Error handling for missing or invalid files

### 3. Complete Data Analysis

This component uses OpenAI to analyze the query using the complete data:

- **Input**: User query and complete data files
- **Processing**: AI model analyzes data and generates a response
- **Output**: Comprehensive analysis based only on provided data
- **Technology**: OpenAI's GPT-4 with complete data context

**Key Implementation Features**:

- System prompt emphasizes using only values from the data
- Complete data files are provided in the context window
- Lower temperature setting for more factual responses
- Formatting instructions for consistent output

### 4. Response Validation

This component verifies that the analysis uses only actual percentages from the data:

- **Input**: Generated analysis and original data files
- **Processing**: Extracts and compares percentages
- **Output**: Validation report with detection of any fabricated data
- **Technology**: Custom JavaScript validation logic

**Key Implementation Features**:

- Regex pattern matching to extract percentage values
- Data traversal to identify all actual percentages
- Country coverage checking for strategic queries
- Reporting of fabricated values or insufficient coverage

### 5. User Interface

The frontend provides a simple interface for users to interact with the system:

- **Input**: User query submission
- **Processing**: API call handling and results formatting
- **Output**: Formatted analysis with metadata and validation results
- **Technology**: Next.js with React components

**Key Implementation Features**:

- Simple form for query submission
- Loading state handling
- Formatting of analysis with highlighted percentages
- Transparent display of data sources and validation results
- Warning display for any detected fabrication

## Data Flow

1. **User submits a query** through the frontend
2. **File identification** determines which data files are needed
3. **Data retrieval API** fetches the complete contents of those files
4. **Analysis generation** processes the query with the complete data
5. **Response validation** verifies the analysis uses only actual data
6. **Results presentation** displays the analysis with metadata to the user

## Storage Options

The architecture supports multiple storage options:

### 1. GitHub Repository (Default)

- **Pros**: Simple setup, no additional infrastructure, version control
- **Cons**: Rate limits for frequent access, public visibility

### 2. AWS S3 Bucket

- **Pros**: Scalable, private, higher request limits
- **Cons**: Additional setup, credentials management

### 3. Vercel KV (Key-Value Store)

- **Pros**: Integrated with Vercel deployment, low latency
- **Cons**: Storage limits, additional cost

## Error Handling

The architecture includes comprehensive error handling:

1. **File Identification Errors**: Fallback to general files if specific identification fails
2. **Data Retrieval Errors**: Clear reporting of which files were unavailable
3. **Analysis Generation Errors**: Graceful failure with error messages
4. **Validation Errors**: Flagging of fabricated data with specific details

## Performance Considerations

1. **Caching**: Results can be cached based on query similarity
2. **Concurrent Requests**: The serverless architecture handles multiple simultaneous users
3. **Data Size**: The system efficiently processes larger data sets by fetching only needed files
4. **API Rate Limits**: Implementation includes retry logic for rate limit handling

## Security Considerations

1. **Input Validation**: All user inputs are validated to prevent injection attacks
2. **Path Sanitization**: File paths are sanitized to prevent directory traversal
3. **API Authentication**: Optional authentication can be added for the API endpoints
4. **Environment Variables**: Sensitive credentials are stored as environment variables

## Extensibility

The architecture is designed for easy extension:

1. **Additional Storage Options**: New storage providers can be added with minimal changes
2. **Enhanced Validation**: More sophisticated validation rules can be added
3. **Improved UI**: The frontend can be enhanced with visualizations
4. **Multilingual Support**: The system can be extended to support multiple languages

## Implementation Timeline

| Phase | Component                | Estimated Time  |
| ----- | ------------------------ | --------------- |
| 1     | Data Storage Setup       | 1-2 hours       |
| 2     | API Endpoint Development | 2-3 hours       |
| 3     | OpenAI Integration       | 2-3 hours       |
| 4     | Validation Layer         | 1-2 hours       |
| 5     | Frontend Integration     | 2 hours         |
| 6     | Testing & Refinement     | 2 hours         |
|       | **Total**                | **12-16 hours** |

## Conclusion

This architecture provides a robust solution to the problem of AI systems claiming to retrieve data files but only using sample points. By physically retrieving complete files and validating all percentage values against the actual data, the system ensures accurate and trustworthy analysis.

The design prioritizes:

- Actual data usage over fabrication
- Comprehensive validation
- Rapid implementation
- Scalability and extensibility

This approach delivers a significant improvement in the quality and reliability of AI-generated analysis for RIA25.
