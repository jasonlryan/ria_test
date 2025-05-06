# RIA Core Functionality

This document provides a streamlined overview of the core functionality of the Research Insights Assistant (RIA) system and how each component is implemented in the design.

## 1. Query Parsing

**What It Does:**
Extracts the user's intent, keywords, and any context markers (e.g., follow-up indicators) from the query.

**Implementation Points:**

- Use a parsing function (or heuristic/ML model) to break down the query
- Check for "out-of-scope" conditions
- Identify if the query is a follow-up (e.g., short queries with "more," "detail," etc.)

## 2. File Retrieval Based on Query

**What It Does:**
Determines which data files are needed for the query using a pre-defined canonical mapping.

**Implementation Points:**

- **File Mapping:** The canonical mapping (e.g., stored in a JSON file) clearly maps topics to file IDs
- **File Storage:** Data files are stored locally (e.g., under scripts/output/split_data/)
- **Data Retrieval:** A function (e.g., identifyRelevantFiles) analyzes the query and returns the relevant file IDs

## 3. Prompt Construction and Data Injection

**What It Does:**
Combines the user query, analysis data from the retrieved files, and any necessary instructions into a single prompt.

**Implementation Points:**

- The constructed prompt includes the original query, an analysis summary, and the raw data (or a pointer to it)
- This prompt is then sent to the assistant for final processing

## 4. Thread ID Management

**What It Does:**
Maintains conversation context by storing a thread ID, ensuring that follow-up queries continue in the same context.

**Implementation Points:**

- Thread IDs are persisted in localStorage
- Every query sent to the backend includes the current thread ID (if available), allowing the assistant to append new messages to the existing conversation

## 5. Tracking Current Files Available (Thread-Specific Cache)

**What It Does:**
Keeps track of which data files have already been loaded for the current conversation, so that follow-up queries do not reload the same files unnecessarily.

**Implementation Points:**

- A thread-specific cache (e.g., a JavaScript object or Map keyed by thread ID) stores loaded file IDs and their data
- When a new query comes in, the system checks the cache and only loads any additional missing files

## 6. Response from the Assistant

**What It Does:**
The assistant receives the assembled prompt (query + data files) and generates a final response that is streamed back to the user.

**Implementation Points:**

- The final response is generated using OpenAI's API
- The system handles streaming the response back to the UI

## 7. Support for Follow-Up Queries

**What It Does:**
Ensures that follow-up queries in an ongoing thread use the previously cached data files, maintaining conversation continuity.

**Implementation Points:**

- The system assumes continuity in a persistent thread unless the query is out-of-scope or specifically requests new data
- If a follow-up query does not require additional data, the cached file data is reused and the prompt is adjusted to focus on the conversation context
- If new files are needed, only the missing files are retrieved and added to the cache

## Summary

The RIA system design focuses on the following core functionalities:

1. **Query Parsing:** To extract intent and detect follow-ups
2. **Data Retrieval:** To map queries to file IDs using a canonical mapping and load files from a known local storage location
3. **Prompt Construction:** To inject query context and data into a prompt sent to the assistant
4. **Thread Management:** To persist thread IDs across sessions and maintain conversation context
5. **Data File Tracking:** To cache data files on a per-thread basis, reducing redundant file loads
6. **Assistant Response:** To receive and display the final assistant output
7. **Follow-Up Handling:** To seamlessly support follow-up queries using existing cached data, while loading additional files only when necessary

This approach directly addresses the system's needs and provides a robust foundation for an efficient, context-aware AI analytics assistant.
