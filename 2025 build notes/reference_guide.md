# Global Workforce Survey 2025 - AI Assistant Reference Guide

This reference guide provides technical information about the Global Workforce Survey 2025 data structure, comparison rules, and response formats for the AI assistant. This document should be uploaded to the OpenAI assistant's knowledge base to provide context for handling user queries.

## Data Structure Overview

### 2025 Survey Data

The 2025 Global Workforce Survey data is stored in JSON format with the following structure:

```json
{
  "Q1 - Question text here?": {
    "Response option 1": 45.7,
    "Response option 2": 32.1,
    "Response option 3": 22.2
  },
  "Q2 - Another question text?": {
    // Response data
  }
}
```

Each question is represented by its full text (including the question number prefix), and the values for each response option are percentages indicating the proportion of respondents who selected that option.

### Vector Store Documents

For efficient retrieval, the data has been processed into vector-optimized documents with the following types:

1. **Survey Data Documents**: Individual question data from the 2025 survey
2. **Comparison Data Documents**: Year-over-year comparison data for comparable questions
3. **Comparability Info Documents**: Metadata about which questions can be compared between years
4. **Reference Documents**: General information about the survey and comparison rules

## Question ID Mapping

Questions are mapped between survey years using a standardized ID system. The mapping follows these conventions:

- **Base Questions**: Simple question IDs like "Q1", "Q2", etc.
- **Sub-Questions**: Questions with multiple parts use underscore notation, e.g., "Q4_1", "Q4_2"

The `question_mapping.json` file provides a mapping between these standardized IDs and the full question text used in the survey data files.

## Year-over-Year Comparison Rules

### Determining Comparability

A question is comparable between 2024 and 2025 if:

1. The question exists in both survey years
2. The question wording and response options are sufficiently similar
3. The question is marked as comparable in the `comparable_data_index.json` file

### Supported Markets for Comparison

Only the following markets are available for comparison between 2024 and 2025:

- Global (aggregate data)
- United States
- United Kingdom
- Australia
- Brazil
- India
- Saudi Arabia

_Note: The 2025 survey includes additional markets (China, Canada, Germany, Japan) that were not included in the 2024 survey and therefore cannot be compared._

### Non-Comparable Questions

For questions that cannot be compared, the assistant should:

1. Explicitly state that year-over-year comparison is not available
2. Explain the specific reason (e.g., "this question was new in 2025")
3. Provide the 2025 data
4. When relevant, suggest alternative questions that might provide contextually similar information

## Response Format for Comparisons

When presenting year-over-year comparisons, the following format is recommended:

1. **State the comparison**: "Looking at [question] in [market], we can see changes from 2024 to 2025."
2. **Present the data**: "In 2025, [X%] of respondents indicated [response], compared to [Y%] in 2024."
3. **Highlight significant changes**: "This represents a [increase/decrease] of [Z] percentage points."
4. **Provide context**: "This change may be attributed to [relevant factor] based on other survey findings."

## Special Cases

### New Markets in 2025

For queries about markets that are new in 2025 (China, Canada, Germany, Japan), explicitly mention that these are new additions to the survey and cannot be compared with 2024 data.

### Questions with Changed Wording

Some questions may have slight wording changes between years but are still fundamentally comparable. The comparability index indicates these cases, and the assistant should acknowledge the wording difference when making comparisons.

### Demographic Segmentation

When comparing demographic segments across years, be aware that:

1. Some demographic categories may have changed between surveys
2. Sample sizes for specific demographic segments may vary between years
3. Only compare demographic segments that are marked as comparable in the index

## Technical Implementation Notes

### Handling Ambiguous Queries

For queries that do not specify a year, the default is to provide 2025 data, but mention that 2024 comparison is available (if applicable).

Example:

- User: "What percentage of workers prefer remote work?"
- Response: "According to the 2025 Global Workforce Survey, [X%] of workers prefer remote work. This represents a [increase/decrease] from 2024, when [Y%] reported this preference."

### Handling Multiple Questions

For queries that touch on multiple survey questions, prioritize the most relevant questions and indicate when additional related data is available.

## Data Limitations

The assistant should be aware of and communicate these limitations when relevant:

1. Survey data represents respondent perceptions and self-reported behaviors
2. Regional variation exists beyond country-level data
3. Demographic intersectionality may yield insights not captured in single-dimension analysis
4. Sample sizes for specific segments may limit statistical significance

## Usage Guidelines

The primary purpose of this AI assistant is to:

1. Provide accurate information from the Global Workforce Survey 2025
2. Compare 2025 data with 2024 data where available and appropriate
3. Interpret trends and changes in workforce preferences and behaviors
4. Support data-driven decision making for organizational leaders

The assistant should NOT:

1. Provide specific recommendations for individual company strategies
2. Make predictions beyond what is supported by the survey data
3. Offer personal career or HR advice
4. Share raw data files or detailed methodology information
