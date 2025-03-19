# Data Strategy for Normalized Global Survey Data

## Introduction

The current survey data for 2024 and 2025 is stored in disparate formats, with differences in key naming, data structure, and even percentage representations (e.g., numeric values like 0.64 versus string values like "64%"). This inconsistency complicates direct, automated year‑on‑year comparisons and limits our ability to generate reliable insights.

This document outlines a new data strategy based on a normalized global data file approach. In this strategy, the data is organized around the content of the survey questions—defined as canonical topics—rather than their raw question numbers. This enables more intuitive querying and accurate comparisons across survey years.

## Rationale

1. **Inconsistent Structures:**

   - 2024 data uses keys like "question", "response", and "data" with subkeys such as "region", whereas 2025 data uses a different schema (e.g., "demographics").
   - Direct comparisons are hindered by these structural differences.

2. **Mapping Challenges:**

   - Existing mapping (in comparable_data_index.json) relates raw question IDs between years, but continuous reconciliation is required due to differing structures, market naming conventions, and numeric representations.

3. **Improved Comparison Accuracy:**

   - A normalized schema standardizes question texts, market names, demographic keys, and percentage formats, ensuring that only comparable markets (e.g., United Kingdom, United States, Australia, India, Brazil) are used and that the insight generation is accurate.

4. **User-Centric Structure:**
   - End users benefit from data organized by the question content or canonical topic, making insights more intuitive and the system less dependent on internal question numbering.

## Proposed Strategy

### Structure Around Canonical Topics

- **Canonical Topics:** Identify key question topics (e.g., "AI_Excitement", "Work_Flexibility") based on the survey content rather than raw question numbers. Each canonical topic includes a human-friendly question text.

- **Normalized Schema:** The normalized global data file will have a uniform structure for both years. For example:

```json
{
  "questions": {
    "AI_Excitement": {
      "canonicalQuestion": "How excited are you about how emerging technologies like AI will change the way you work?",
      "comparable": true,
      "data": {
         "2024": {
           "global": { "total": 64, "demographics": { ... } },
           "markets": {
             "United States": { ... },
             "United Kingdom": { ... }
             // Other comparable markets
           }
         },
         "2025": {
           // Similar structure
         }
      },
      "internalMapping": {
         "2024": "Q4_9",
         "2025": "Mapped from Q5 array index 2"
      }
    },
    "Work_Flexibility": { ... }
  }
}
```

### Handling Non-Comparable Data

- **Segregation:** For questions that are non‑comparable (e.g., Q1–Q3 in 2025 or those with methodology differences in 2024), include them in the normalized file with a "comparable" flag set to false.

- **Separate Presentation:** When queried, present non‑comparable data from each year side‑by‑side with a clear disclaimer that direct comparison is not valid due to methodological differences.

## Implementation Plan

### 1. Define the Standardized Schema

- Identify all key (comparable and non‑comparable) questions based on content.
- Create canonical topic identifiers (e.g., "AI_Excitement") with associated human-friendly question texts.
- Define consistent keys for demographic segments, percentage formatting (e.g., integers), and market names.

### 2. Map Raw Data to Canonical Topics

- Use the existing comparable_data_index.json as a reference to map raw question IDs (e.g., Q4_9, Q4_10, etc.) to the canonical topics.
- Include internal mapping metadata for future maintenance but present only the canonical topic in the normalized file.

### 3. Develop the ETL Pipeline

- **Extract:** Read raw survey data for 2024 and 2025 from their respective files.
- **Transform:**
  - Normalize keys (e.g., converting "region" and "demographics" to a unified structure).
  - Convert percentage values to a standard integer format.
  - Normalize market names to match the comparable markets list.
  - Map each raw question to its canonical topic, tagging it with its comparable flag.
- **Load:** Output a unified normalized data file (e.g., `data/normalized/normalized_global.json`) with separate sections for 2024 and 2025.

### 4. Validation and Testing

- Test the ETL process on sample data to ensure correct mapping and normalization.
- Manually verify that key fields (e.g., percentages, demographics) are transformed as expected.
- Run sample queries to confirm that comparable questions combine data correctly and that non‑comparable questions include appropriate disclaimers.

### 5. Update Downstream Processes

- Modify query handlers and reporting interfaces to use the normalized data file.
- Ensure that when a user requests insights by topic, the system uses the canonical topic identifier and does not expose internal question numbers.

### 6. Documentation and Maintenance

- Document the normalized schema, transformation rules, and the ETL pipeline in detail.
- Maintain a mapping document linking raw question identifiers to canonical topics.
- Provide guidelines for incorporating future survey data into the normalized framework.

## Conclusion

This data strategy provides a robust framework for handling both comparable and non‑comparable survey data by standardizing on a user-centric, canonical topic approach. The benefits include improved accuracy in year‑on‑year comparisons, simplified querying, and a cleaner end-user experience while preserving the necessary internal mappings for maintenance.

## Next Steps

- Develop a prototype of the ETL script to perform the normalization.
- Validate the output with sample queries.
- Integrate the normalized data into the downstream querying and reporting systems.
- Push all changes to Git once verified.
