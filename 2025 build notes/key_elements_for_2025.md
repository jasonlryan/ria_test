# Key Elements for WORKFORCE 25 Implementation

This document extracts the essential components from existing files that need to be preserved and adapted for the 2025 survey assistant.

## Key Elements from `comparable_data_index.json`

### Question Comparability Structure

```json
{
  "id": "Q4_9",
  "text": "AI - I feel excited and positive about how emerging technologies like AI will change the way I work",
  "comparable": true,
  "availableSurveys": ["2024", "2025"],
  "notes": "",
  "userMessage": "Year‑on‑year comparisons for this question are based only on data from the comparable markets..."
}
```

### Comparable Markets

The only markets that support year-over-year comparison between 2024 and 2025:

- United Kingdom
- United States
- Australia
- India
- Brazil
- Saudi Arabia (with special handling for Saudi Arabia/UAE combined in 2024)

### Data Sources Structure

```json
"dataSources": {
  "2024": {
    "global": "data/2024/global.json",
    "countries": {
      "United Kingdom": "data/2024/UnitedKingdom.json",
      "United States": "data/2024/UnitedStates.json",
      ...
    }
  },
  "2025": {
    "global": "data/2025/global.json",
    "countries": {
      "United States": "data/2025/UnitedStates.json",
      "United Kingdom": "data/2025/UnitedKingdom.json",
      ...
    }
  }
}
```

### Comparison Rules

- Comparison allowed only if `comparable` flag is true AND data exists in both years
- Clear fallback instructions when comparison is not possible
- User messages prepared for non-comparable questions

## Key Elements from `system_prompt_2024.json`

### Role and Purpose

```json
"role_and_purpose": {
  "description": "You are an expert on Korn Ferry's Global Workforce Survey 2024. Your primary role is to communicate the findings, insights, and implications of this survey to decision-makers."
}
```

### Query Handling Process

1. Check for segment restriction violations (e.g., combining Age + Job Level)
2. Assess query relevance against supported topics
3. Categorize query type (directly addressed or inferred)
4. Determine query scope (narrow or broad)

### Data Usage Rules

- **Golden Rule**: Combine COUNTRY + one additional segment only
- **Prohibition**: Do not combine Age and Job Level
- Present data in decreasing percentage value
- Limit to top five factors for concise responses

### Data Presentation Guidelines

- Present results as percentages
- Provide context for all data points
- Focus on insights rather than raw data
- Never fabricate or infer data points not in the survey

### Response Style

- Professional yet approachable tone
- Clear, jargon-free language
- Narrative structure with compelling introduction
- No direct mentions of source files or data

## Implementation Requirements for 2025

### 1. Update System Prompt

- Replace all "2024" references with "2025"
- Add section on handling year-over-year comparisons
- Include rules for new countries in 2025 (China, Canada, Germany, Japan)
- Add default behavior for year-specific queries
- Update any response templates to include comparison formatting

### 2. Data Structure Changes

- Implement consistent year labeling in filenames or metadata
- Create directory structure matching `dataSource` paths
- Process 2025 data in compatible format with 2024
- Ensure question IDs are consistent between years

### 3. New Vector Documents for 2025

- Create documents specifically for year-over-year comparisons
- Add metadata documents about question comparability
- Update topic management files (supported_topics, inferred_topics, topics_to_avoid)
- Develop new survey information document for 2025

### 4. Assistant Configuration

- Configure retrieval settings to prioritize year-relevant data
- Add metadata about year-over-year comparison capability
- Update usage examples to include comparison queries
- Define clear prohibited topics and allowed topics

This document serves as a guide for developing the 2025 implementation, ensuring all key elements from the 2024 system are properly adapted and enhanced.
