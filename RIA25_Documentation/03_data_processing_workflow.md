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

## Future Enhancements

- Automated validation reporting
- Incremental processing capabilities
- Enhanced error recovery
- Performance optimization for larger datasets
- Vector database integration tooling

---

_Last updated: April 13, 2025_
