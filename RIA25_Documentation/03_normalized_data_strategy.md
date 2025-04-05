# Normalized Data Strategy and Canonical Topic Mapping

## Overview

The normalized data strategy represents a significant evolution from the 2024 approach, allowing for more intuitive querying and accurate cross-year comparisons. This document outlines how RIA25 organizes survey data around canonical topics rather than raw question numbers, enabling more effective data retrieval and analysis.

## Data Strategy Evolution

### 2024 Approach Limitations

In the 2024 implementation, several challenges were identified:

- **Inconsistent Structures**: The 2024 data used different keys and structures (e.g., "question", "response", "data" with subkeys like "region"), making direct year-over-year comparisons difficult.

- **Raw Question Mapping**: The system relied on raw question IDs (e.g., Q4_9, Q4_10), requiring constant reconciliation when questions were modified or reordered.

- **Formatting Inconsistencies**: Data was represented inconsistently across years (e.g., percentages as 0.64 vs "64%").

- **User Experience Limitations**: End users had to understand internal question numbering rather than focusing on the actual survey topics.

### 2025 Normalized Approach

The 2025 implementation fundamentally changes the data organization:

- **Topic-Centric Structure**: Data is organized around canonical topics (e.g., "AI_Attitudes", "Work_Life_Flexibility") rather than raw question numbers.

- **Standardized Schema**: A consistent data structure is used across years, with normalized market names, demographic keys, and percentage formats.

- **Human-Friendly Questions**: Each canonical topic is associated with a human-friendly "canonicalQuestion" that describes the essence of what's being measured.

- **Comparable Markets**: The system explicitly defines which markets can be compared across years, preventing invalid comparisons.

## Canonical Topic Mapping Implementation

### canonical_topic_mapping.json

The core of this approach is the `canonical_topic_mapping.json` file located in `scripts/reference files/`. This file:

1. Defines metadata about the canonical topic structure
2. Establishes data access paths and rules
3. Lists all valid JSON files for each survey year
4. Organizes topics by themes (e.g., "Talent Attraction & Retention")
5. Maps canonical topics to specific question files across years

### Structure of the Mapping File

```json
{
    "metadata": {
        "version": "1.0",
        "description": "Canonical topic mapping for survey data organized by themes and topics",
        "lastUpdated": "2025-03-15"
    },
    "dataAccess": {
        "basePath": "scripts/output/split_data/",
        "comparableMarkets": [
            "United Kingdom",
            "United States",
            "Australia",
            "India",
            "Brazil"
        ],
        "allMarkets2025": [...]
    },
    "retrievalRules": {
        "comparable": "...",
        "nonComparable": "...",
        "singleYear": "..."
    },
    "allValidFiles": {
        "2024": [...],
        "2025": [...]
    },
    "themes": [
        {
            "name": "Theme Name",
            "topics": [
                {
                    "id": "Canonical_Topic_ID",
                    "canonicalQuestion": "Human-readable question?",
                    "rationale": "Explanation of why this topic matters",
                    "mapping": {
                        "2024": [{"id": "Q1", "file": "2024_1.json"}],
                        "2025": [{"id": "Q1", "file": "2025_1.json"}]
                    },
                    "comparable": true/false,
                    "availableMarkets": [...],
                    "userMessage": "Message explaining comparison limitations",
                    "alternatePhrasings": [...]
                }
            ]
        }
    ]
}
```

### Key Components

1. **Canonical Topics**: Each topic (e.g., "AI_Attitudes") represents a key area of inquiry that may span multiple raw questions and years.

2. **Theme Organization**: Topics are grouped into thematic categories (e.g., "Skills & Development") for logical organization.

3. **Mapping to Raw Data**: Each canonical topic maps to specific question files in each survey year, making connections explicit.

4. **Comparability Flags**: The `comparable` property indicates whether direct year-over-year comparisons are valid.

5. **User Messages**: Each topic includes custom messages to explain any limitations in data comparability.

6. **Alternate Phrasings**: To improve retrieval, topics include alternative ways users might refer to the same concept.

## How RIA25 Uses Canonical Topic Mapping

### Query Processing

1. When a user submits a question, the system identifies relevant canonical topics by matching keywords and concepts.

2. The system uses the mapping file to locate the appropriate data files for each topic.

3. Based on the `comparable` flag, the system retrieves data from one or both years.

4. If limitations exist, the appropriate `userMessage` is included in the response.

### Data Retrieval Rules

The system follows specific rules based on the mapping:

- **Comparable Topics**: For topics marked as comparable, data from both 2024 and 2025 is retrieved, but only for the designated comparable markets.

- **Non-Comparable Topics**: For non-comparable topics, data from each year is presented separately with appropriate disclaimers.

- **Single-Year Topics**: For topics available in only one year, the system clearly indicates the limitation.

### Market Comparability

Only five markets are designated as comparable across years:

- United Kingdom
- United States
- Australia
- India
- Brazil

The 2025 survey includes additional markets that have no counterpart in 2024.

## Benefits of the Approach

1. **Intuitive Querying**: Users can focus on topics rather than question numbers.

2. **Cross-Year Integrity**: The system prevents invalid comparisons between years.

3. **Semantic Understanding**: The `alternatePhrasings` support better natural language understanding.

4. **Maintenance Efficiency**: New survey years can be added by updating the mapping file rather than modifying core code.

5. **Standardized Formats**: Consistent data representation improves reliability.

## Implementation Details

The canonical topic mapping is used throughout the RIA25 system:

1. **Data Processing**: The ETL pipeline normalizes raw CSV data into the structured format.

2. **Vector Store Organization**: Vector embeddings are organized to align with canonical topics.

3. **Query Response**: The assistant uses the mapping to retrieve and present data appropriately.

4. **Response Templates**: Standard response formats leverage the canonical questions and user messages.

## Conclusion

The normalized data strategy and canonical topic mapping represent a significant advancement in how RIA25 organizes and accesses survey data. By focusing on the meaning of questions rather than their numerical identifiers, the system delivers more intuitive, accurate, and maintainable insights.

---

_Last updated: April 5, 2024_
