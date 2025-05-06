# Canonical Topic Mapping Reference

## Overview

The canonical topic mapping system is a fundamental component of RIA25's data architecture. This reference document details the structure, usage, and implementation of the canonical topic approach, which enables intuitive querying and accurate cross-year survey data comparisons.

## canonical_topic_mapping.json

Location: `scripts/reference files/canonical_topic_mapping.json`

### File Purpose

This configuration file serves as the master reference for mapping between:

- Human-friendly canonical topics (e.g., "AI_Attitudes")
- Raw question identifiers in each survey year (e.g., "Q4_9" in 2024)
- Actual data files that contain the relevant information

The file also defines rules for data comparison, market availability, and appropriate messaging when presenting data with limitations.

### Top-Level Structure

```json
{
    "metadata": {...},
    "dataAccess": {...},
    "retrievalRules": {...},
    "allValidFiles": {...},
    "themes": [...]
}
```

#### metadata

Contains version information and last update timestamp:

```json
"metadata": {
    "version": "1.0",
    "description": "Canonical topic mapping for survey data organized by themes and topics",
    "lastUpdated": "2025-03-15"
}
```

#### dataAccess

Defines paths and market information:

```json
"dataAccess": {
    "basePath": "scripts/output/split_data/",
    "comparableMarkets": [
        "United Kingdom",
        "United States",
        "Australia",
        "India",
        "Brazil"
    ],
    "allMarkets2025": [
        "United Kingdom",
        "United States",
        "Australia",
        "India",
        "Brazil",
        "France",
        "Germany",
        "Japan",
        "United Arab Emirates",
        "Saudi Arabia"
    ]
}
```

#### retrievalRules

Documents the rules for data retrieval:

```json
"retrievalRules": {
    "comparable": "For topics marked as comparable, retrieve data from both 2024 and 2025 surveys, but only include data from the five comparable markets.",
    "nonComparable": "For topics marked as non-comparable, retrieve data from only the available survey year(s) and include the appropriate user message explaining why year-on-year comparison is not available.",
    "singleYear": "For topics available in only one year, retrieve that data and include the user message noting the limitation."
}
```

#### allValidFiles

Lists all valid JSON data files for each survey year:

```json
"allValidFiles": {
    "2024": [
        "2024_1.json",
        "2024_2.json",
        // etc.
    ],
    "2025": [
        "2025_1.json",
        "2025_2.json",
        // etc.
    ]
}
```

#### themes

Organizes topics into thematic categories:

```json
"themes": [
    {
        "name": "Talent Attraction & Retention",
        "topics": [...]
    },
    {
        "name": "Employee Experience & Work‑Life",
        "topics": [...]
    },
    // etc.
]
```

### Topic Structure

Each topic within a theme follows this structure:

```json
{
  "id": "Attraction_Factors",
  "canonicalQuestion": "What are the most important factors when looking for a new job?",
  "rationale": "Identify factors that drive candidates to consider a new job; essential for talent acquisition.",
  "mapping": {
    "2024": [
      {
        "id": "Q1",
        "file": "2024_1.json"
      }
    ],
    "2025": [
      {
        "id": "Q1",
        "file": "2025_1.json"
      }
    ]
  },
  "comparable": false,
  "availableMarkets": [],
  "userMessage": "Year‑on‑year comparisons not available due to methodology changes.",
  "alternatePhrasings": [
    "job attraction factors",
    "what attracts new hires",
    "important job factors"
  ]
}
```

## Key Theme Categories

The canonical topic mapping organizes topics into the following themes:

1. **Talent Attraction & Retention**

   - Topics related to job attraction factors, retention factors, attrition drivers, and intentions to leave

2. **Employee Experience & Work‑Life**

   - Topics covering work-life flexibility, culture and values, wellbeing, communication, and fulfillment

3. **Skills & Development**

   - Topics on learning and development, skills utilization, and attitudes toward AI

4. **Leadership & Management**

   - Topics addressing leadership confidence, organizational adaptation, and manager capability

5. **Workplace Dynamics**

   - Topics concerning intergenerational collaboration, diversity and inclusion, and sustainability

6. **Compensation & Benefits**

   - Topics on pay fairness and reward adequacy

7. **Workplace**

   - Topics about current and preferred work locations

8. **Perceived Barriers**
   - Topics such as imposter syndrome

## Comparable vs. Non-Comparable Topics

### Comparable Topics

Topics marked as `"comparable": true` can be directly compared between 2024 and 2025 survey years. These include:

- Intention_to_Leave
- Ideal_Role
- Skills_Utilization
- AI_Attitudes
- Leadership_Confidence
- Organizational_Adaptation
- DEI
- Sustainability
- Pay_and_Reward
- Imposter_Syndrome

For these topics, data from both years can be presented together, but only for the five comparable markets: United Kingdom, United States, Australia, India, and Brazil.

### Non-Comparable Topics

Topics marked as `"comparable": false` should not be directly compared between years. These include:

- Attraction_Factors
- Retention_Factors
- Attrition_Factors
- Work_Life_Flexibility
- Culture_and_Values
- Employee_Wellbeing
- Communication_and_Connection
- Motivation_and_Fulfillment
- Learning_and_Development
- AI_Readiness
- Manager_Capability
- Intergenerational_Collaboration
- Current_and_Preferred

For these topics, data from each year should be presented separately with the appropriate `userMessage` explaining why year-over-year comparison is not possible or valid.

## Single-Year Topics

Some topics are available only in one survey year (typically 2025), such as:

- AI_Readiness
- Manager_Capability
- Intergenerational_Collaboration
- Current_and_Preferred

For these topics, the system provides data only from the available year, along with the appropriate `userMessage` explaining the limitation.

## Alternate Phrasings

Each topic includes a list of `alternatePhrasings` that represent different ways users might refer to the same concept. For example:

```json
"alternatePhrasings": [
    "AI attitudes",
    "AI perception",
    "excitement about AI",
    "role impact of AI",
    "emerging technology sentiment",
    "optimism regarding AI",
    "AI value",
    "AI influence"
]
```

These alternate phrasings improve the system's ability to match user queries to the appropriate canonical topics, enhancing the natural language understanding capabilities.

## Usage in the System

### Query Processing

When processing a user query:

1. The system analyzes the query to identify relevant canonical topics, using both exact matches and semantic similarity against topic IDs, canonical questions, and alternate phrasings.

2. For each identified topic, the system retrieves the corresponding data file(s) based on the mapping.

3. The `comparable` flag determines whether data from both years should be retrieved and compared.

4. The appropriate `userMessage` is incorporated into the response to provide context about any limitations.

### Data Retrieval

The system follows these rules for data retrieval:

- For comparable topics, only data from the five comparable markets is included in year-over-year comparisons.

- For non-comparable topics, data from each year is presented separately with disclaimers.

- For single-year topics, only data from the available year is presented with a note about the limitation.

## Integration with Other Components

The canonical topic mapping integrates with several other RIA25 components:

- **Data Processing**: The ETL pipeline uses the mapping to organize and normalize survey data.

- **Vector Store**: Documents in the vector store are tagged with their corresponding canonical topics.

- **Prompt System**: The system prompt includes instructions for handling comparable and non-comparable topics.

- **Response Templates**: Response templates leverage canonical questions and user messages to provide consistent formatting.

## Maintenance and Updates

### Adding New Survey Years

To incorporate data from a new survey year:

1. Add the new year's files to the `allValidFiles` section.

2. For each topic, update the `mapping` section to include the new year's question IDs and files.

3. Determine which topics are comparable between years and update the `comparable` and `availableMarkets` properties accordingly.

4. Update the `userMessage` to reflect any new limitations or considerations.

### Adding New Topics

To add a new canonical topic:

1. Create a new topic entry in the appropriate theme section.

2. Define the `id`, `canonicalQuestion`, and `rationale`.

3. Set up the `mapping` to the relevant question files.

4. Determine if the topic is comparable between years and set the `comparable` flag accordingly.

5. Define `availableMarkets` and `userMessage` as appropriate.

6. Add relevant `alternatePhrasings` to improve query matching.

## Examples

### Example 1: Comparable Topic

```json
{
  "id": "AI_Attitudes",
  "canonicalQuestion": "What are your attitudes toward AI in the workplace?",
  "rationale": "Capture employee attitudes toward AI—including excitement, perceived value, and fears of replacement—to gauge AI readiness.",
  "mapping": {
    "2024": [
      { "id": "Q4_9", "file": "2024_4_9.json" },
      { "id": "Q4_10", "file": "2024_4_10.json" },
      { "id": "Q4_11", "file": "2024_4_11.json" }
    ],
    "2025": [
      { "id": "Q5_2", "file": "2025_5_2.json" },
      { "id": "Q5_3", "file": "2025_5_3.json" },
      { "id": "Q5_8", "file": "2025_5_8.json" }
    ]
  },
  "comparable": true,
  "availableMarkets": [
    "United Kingdom",
    "United States",
    "Australia",
    "India",
    "Brazil"
  ],
  "userMessage": "Data based on comparable markets only.",
  "alternatePhrasings": [
    "AI attitudes",
    "AI perception",
    "excitement about AI",
    "role impact of AI"
  ]
}
```

### Example 2: Non-Comparable Topic

```json
{
  "id": "Attraction_Factors",
  "canonicalQuestion": "What are the most important factors when looking for a new job?",
  "rationale": "Identify factors that drive candidates to consider a new job; essential for talent acquisition.",
  "mapping": {
    "2024": [{ "id": "Q1", "file": "2024_1.json" }],
    "2025": [{ "id": "Q1", "file": "2025_1.json" }]
  },
  "comparable": false,
  "availableMarkets": [],
  "userMessage": "Year‑on‑year comparisons not available due to methodology changes.",
  "alternatePhrasings": [
    "job attraction factors",
    "what attracts new hires",
    "important job factors"
  ]
}
```

## Conclusion

The canonical topic mapping system represents a cornerstone of RIA25's data architecture, enabling intuitive querying and accurate cross-year comparisons. By organizing data around meaningful topics rather than raw question numbers, the system provides a more user-friendly experience while maintaining data integrity.

---

_Last updated: April 5, 2024_
