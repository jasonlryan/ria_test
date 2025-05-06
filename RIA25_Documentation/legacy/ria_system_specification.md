# RIA System Specification

## 1. System Overview

RIA (Research Insights Assistant) is an AI-powered analytics assistant designed to provide insights from workforce survey data. The system maintains conversation context across interactions, efficiently caches relevant data, and intelligently handles both follow-up and new queries within ongoing conversations.

## 2. Core System Components

### 2.1 Query Processing Pipeline

1. **Query Reception**

   - System receives natural language query from user interface
   - Query is associated with current thread ID (if exists) or creates new thread
   - System timestamp and logs query for audit/improvement

2. **Data Relevance Analysis**

   - Query is analyzed to identify relevant data files and topics
   - Analysis uses pre-defined canonical mapping of topics to files
   - Out-of-scope detection prevents responses to irrelevant queries

3. **Efficient Data Retrieval**

   - System loads only data files relevant to the current query
   - Caches data by thread ID to enable efficient follow-up handling
   - Incremental data loading adds new files as conversation expands in scope

4. **Response Generation**
   - Raw data and analysis are injected into assistant prompt
   - Response is generated using conversation history and data context
   - Response is streamed back to user for immediate feedback

## 3. Prompt Engineering Architecture

### 3.1 Prompt Hierarchy

1. **Data Identification Prompt**

   - Purpose: Map user query to relevant data files
   - Location: Centralized in utils/prompts
   - Structure: Clear instructions for file relevance scoring

2. **Analysis Prompt**

   - Purpose: Analyze retrieved data for insights
   - Structure: Instructions for extracting insights from percentage data

3. **Response Generation Prompt**
   - Purpose: Create final user-facing response
   - Structure: Template integrating query, data, analysis with instructions

### 3.2 Prompt Versioning

- All prompts should be externalized into template files
- Version control for prompt evolution
- A/B testing infrastructure for prompt optimization

## 4. Thread Management System

### 4.1 Thread Persistence

1. **Thread Creation**

   - New thread created for first interaction
   - Thread ID persisted in localStorage
   - Thread state retrievable after page refresh/session end

2. **Thread State**
   - Maintains full conversation history
   - Tracks which data files have been accessed
   - Records user queries and system responses

### 4.2 Thread Intelligence

1. **Context Awareness**

   - System understands relationships between queries in same thread
   - Detects topic shifts requiring new data vs. follow-ups
   - Maintains conceptual links between related questions

2. **Thread Lifecycle**
   - Threads can be explicitly ended by user
   - Automatic archiving of inactive threads
   - Thread data exportable for analytics

## 5. Data File Management

### 5.1 Data File Tracking

1. **File Registry**

   - Central registry maps file IDs to physical locations
   - Metadata for each file (topics, question counts, etc.)
   - Access patterns tracked for optimization

2. **File Identification Logic**
   - Maps user intent to canonical topics
   - Maps topics to relevant file IDs
   - Scoring mechanism for file relevance

### 5.2 Advanced Caching

1. **Thread-Specific Cache**

   - Structure: `{threadId → {fileIds, data}}`
   - Persisted in localStorage with size limits
   - Shared across sessions for same user

2. **Intelligent Cache Management**

   - De-duplication of file IDs
   - Cache invalidation for data updates
   - Progressive enhancement of cache as conversation evolves

3. **Cache Access Patterns**
   - Direct cache lookup for follow-up queries
   - Partial cache usage for topic-adjacent queries
   - Cache bypass for unrelated queries in same thread

## 6. Query Classification and Handling

### 6.1 Query Types

1. **New Topic Queries**

   - Characteristics: New concepts, no reference to previous conversation
   - Handling: Full data retrieval process with cache initialization

2. **Follow-up Queries**

   - Characteristics: Short, references previous content, uses pronouns
   - Handling: Re-use cached data, focus on conversation continuity

3. **Topic Shift Queries**

   - Characteristics: New topic connected to previous conversation
   - Handling: Partial cache use, add new data files as needed

4. **Content Transformation Queries**
   - Characteristics: Requests summary, article, etc., of previous data
   - Handling: Re-use cached data with transformation instructions

### 6.2 Classification Mechanism

1. **Heuristic Rules**

   - Query length and structure analysis
   - Keyword presence (more, about this, etc.)
   - Pronoun presence (it, they, these, etc.)

2. **Machine Learning Model**
   - Features: Query text, thread context, previous queries
   - Output: Query type classification with confidence score
   - Training: Based on logged conversations and outcomes

## 7. Benefits and Risks

### 7.1 System Benefits

1. **Enhanced User Experience**

   - Natural conversation flow with context awareness
   - Faster responses for follow-up questions
   - Consistent information across related queries

2. **Technical Efficiency**

   - Reduced data loading for follow-up queries
   - Lower API costs through optimized prompting
   - Reduced latency through intelligent caching

3. **Data Insights Quality**

   - More relevant data presented for queries
   - Context-aware analysis across conversation
   - Thread-based learning for personalization

4. **Operational Advantages**
   - Detailed logging for system improvement
   - Prompt iteration without code changes
   - Scalable architecture for additional data sources

### 7.2 Risks and Mitigations

1. **Technical Risks**

   - Risk: Cache size exceeds localStorage limits
   - Mitigation: Implement cache size limits and LRU eviction

   - Risk: Thread persistence fails across devices
   - Mitigation: Optional account-based thread storage

2. **User Experience Risks**

   - Risk: Incorrect follow-up detection
   - Mitigation: Clear feedback mechanism for misclassification

   - Risk: Confusing thread management for users
   - Mitigation: Explicit UI controls for thread operations

3. **Data Integrity Risks**

   - Risk: Using outdated cached data
   - Mitigation: Cache invalidation on data updates

   - Risk: Missing relevant files for a query
   - Mitigation: Continuous improvement of file identification prompt

4. **Performance Risks**

   - Risk: Thread state grows too large
   - Mitigation: Implement conversation summarization

   - Risk: Slow initial data retrieval
   - Mitigation: Implement parallel data loading and optimization

## 8. Implementation Requirements

1. **Core Systems**

   - Centralized prompt management
   - Thread persistence with localStorage
   - Data file registry and mapping
   - Intelligent query classification

2. **Monitoring and Improvement**

   - Comprehensive logging of query-response pairs
   - Thread analysis for optimization
   - Cache performance metrics
   - User feedback collection

3. **User Controls**
   - Thread creation/reset controls
   - Explicit follow-up indicators
   - Feedback mechanism for incorrect responses
   - Data transparency controls
