# RIA25 Data Processing Workflow

## Overview

This document describes the data processing workflow implemented for RIA25, detailing the transformation of raw survey data into structured JSON files optimized for vector database ingestion.

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
  - Data retrieval and embedding logic implemented in `utils/openai/retrieval.js` and API endpoints (e.g., `app/api/retrieve-data/route.js`)
  - Validation and coverage checks in `utils/validation/data-validation.js`
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

### Vector Store Integration

- **Purpose**: Vector store integration for semantic retrieval
- **Implementation**:
  - Data retrieval and embedding logic in `utils/openai/retrieval.js`
  - API endpoints in `app/api/retrieve-data/route.js`, `app/api/chat-assistant/route.ts`
  - Validation in `utils/validation/data-validation.js`
- **Process**:
  - Read and process JSON files
  - Embed and retrieve via OpenAI Assistants API and utility modules
  - Validate and log results

## Expected Performance

- **Processing**: The system is designed to efficiently process CSV data
- **Output**: Multiple JSON files split by question number
- **Organization**: Files organized for optimized retrieval

## Error Handling Strategy

- **CSV Format Validation**: Detection of format inconsistencies
- **Data Validation**: Verification of required fields and data types
- **Logging**: Capturing processing information for troubleshooting

## Maintenance Procedures

### Adding New Survey Data

1. Place new CSV file in the appropriate directory
2. Update column mappings if format has changed
3. Run `process_survey_data.js` with appropriate parameters
4. Verify output JSON files
5. Process files for vector database integration when available

### Modifying Data Structure

1. Update transformation logic in `process_survey_data.js`
2. Test with sample data
3. Regenerate all JSON files
4. Update vector database with new format

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

---

## Technical Details: Thread-Level Caching and Data Payload Minimization

The system implements a thread-level cache to optimize data retrieval and minimize payloads sent to the assistant. This cache tracks which datafiles and segment slices have already been sent for each thread, ensuring that only new or required data is transmitted for follow-on queries.

### Caching Workflow Scenarios

**1. Follow-on question (same thread), no additional data needed**

- The follow-on question can be answered using datafiles and segments already cached in the thread.
- The system recognizes that all required data is present in the cache.
- No new datafiles or segments are loaded or sent.
- The assistant uses the cached data to answer the question.

_Result: Zero additional data payload; response is generated from the existing in-memory cache._

**2. Follow-on question (same thread), additional data needed (e.g., user requests job_level breakdown)**

- The follow-on question requires a segment (e.g., job_level) or datafile not previously loaded.
- The system compares the required datafiles/segments for the new query against the thread's cache.
- Only the missing datafiles or segment slices are loaded and sent to the assistant.
- The cache is updated to include the new data/segments for future queries in the thread.

_Result: Only the incremental data (e.g., job_level segment) is sent, minimizing payload. Future queries can use the expanded cache._

**3. Follow-on, but a completely different question (same thread) requiring different datafiles**

- The new question requires datafiles and/or segments not present in the thread's cache.
- The system identifies which datafiles/segments are missing.
- Only the new, required datafiles/segments are loaded and sent.
- The cache is updated to include these new datafiles/segments.

_Result: Payload includes only the new data needed for the new question; previously cached data remains available for further follow-ons._

**4. New thread**

- A new thread starts with an empty cache.
- The system determines all datafiles and segments required for the initial question.
- All required datafiles/segments are loaded and sent to the assistant.
- A new cache is established for this thread.

_Result: Full payload for the initial question; subsequent follow-ons in this thread benefit from caching as described above._

### Summary Table

| Scenario                         | Data Sent to Assistant          | Cache Update          |
| -------------------------------- | ------------------------------- | --------------------- |
| 1. Follow-on, no new data        | None (all from cache)           | No change             |
| 2. Follow-on, new segment/data   | Only missing data/segments      | Add new data/segments |
| 3. Follow-on, different question | Only new required data/segments | Add new data/segments |
| 4. New thread                    | All required data/segments      | New cache created     |

**Key Point:**  
The system always checks the thread's cache before sending data, ensuring that only the minimum necessary payload is transmitted to the assistant, optimizing both performance and cost.

---

_Last updated: April 14, 2025_
