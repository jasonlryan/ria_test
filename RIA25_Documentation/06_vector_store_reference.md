# RIA25 Vector Store Reference

This document lists all files uploaded to the vector store for the Research Insights Assistant 2025.

## Vector Store Details

- **ID:** vs_lMoDck4HDODRImvJIz1jVJ2A
- **Expiration Policy:** Never

## Uploaded Files

The vector store contains two primary categories of files:

### 1. Split Data Files

All JSON files from the `scripts/output/split_data` directory are uploaded to the vector store. These include:

- Individual question files for 2024 (e.g., `2024_1.json`, `2024_2.json`, etc.)
- Individual question files for 2025 (e.g., `2025_1.json`, `2025_2.json`, etc.)
- File index information (`2024_file_index.json`, `2025_file_index.json`)
- Consolidated data file (`global_2025_data.json`)

In total, there are approximately:

- 40 files for 2024 data
- 65 files for 2025 data

### 2. Reference Files

All configuration files from the `scripts/reference files/2025` directory:

| File                               | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| canonical_topic_mapping.json       | Maps questions to canonical topics and themes |
| topics_to_avoid.json               | Topics outside the scope of the survey        |
| narrative_guidelines.json          | Guidelines for response structure             |
| DEI_Response_Guidelines.json       | Special handling for DEI-related topics       |
| supported_topics.json              | Topics directly addressed by the survey       |
| Radically_Human_Tone_of_Voice.json | Guidelines for response style and tone        |

## File Organization

### Split Data Structure

The split data files follow a consistent naming convention:

- `YYYY_N.json` for top-level questions
- `YYYY_N_M.json` for sub-questions

Each file contains:

- Question text
- Response options
- Data broken down by all demographic segments
- Percentage values

### Canonical Topic Structure

The `canonical_topic_mapping.json` file serves as the backbone of the system, mapping raw question files to meaningful topics organized by themes. It defines:

- Which topics exist in the survey data
- Which files contain data for each topic
- Which topics are comparable across years
- Which markets are valid for comparisons
- What user messages to display for limitations

## Vector Store Usage

When querying the vector store:

1. The assistant identifies relevant canonical topics based on the user query
2. It retrieves the corresponding split data files
3. For year-over-year comparisons, it follows the rules in the canonical mapping
4. Reference files provide guidelines for tone, structure, and boundaries

## Maintenance

When updating the vector store:

1. New split data files should be generated through the data processing pipeline
2. The canonical topic mapping should be updated to include new questions
3. All files should be uploaded maintaining the same structure
4. The vector store ID should be updated in the system configuration

_Last updated: April 5, 2024_
