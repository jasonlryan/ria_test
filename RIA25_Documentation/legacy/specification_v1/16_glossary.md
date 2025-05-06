# RIA25 Glossary

## Overview

This glossary defines key terms and concepts used throughout the RIA25 project documentation to ensure consistent understanding across team members and stakeholders.

## Terms and Definitions

### A

#### Anti-Fabrication Measures

Systems and prompt engineering techniques implemented to prevent the AI from generating fictional or inaccurate data that is not supported by the survey results.

#### API (Application Programming Interface)

A set of protocols and tools for building software applications that specifies how components should interact. In RIA25, primarily refers to the OpenAI API.

#### Assistants API

OpenAI's API offering that provides capabilities for creating assistants with specific instructions, knowledge, and tools.

#### Alternate Phrasings

Different ways users might refer to the same canonical topic, included in the canonical topic mapping to improve query matching.

### C

#### Canonical Topic

A standardized, human-friendly topic identifier (e.g., "AI_Attitudes", "Work_Life_Flexibility") that organizes survey data conceptually rather than by question numbers, enabling intuitive querying and accurate cross-year comparisons.

#### Canonical Question

The human-readable question associated with each canonical topic in the mapping system, representing the essence of what that topic measures.

#### Canonical Topic Mapping

The system that maps between human-friendly topics, raw question identifiers, and data files across survey years, stored in `canonical_topic_mapping.json`.

#### Comparable Topic

A canonical topic marked as directly comparable between 2024 and 2025 survey years, allowing for valid year-over-year comparisons but only for the five comparable markets.

#### Column Mapping

The technique implemented in the data processing pipeline to dynamically map columns from the CSV file to the structured JSON format, providing resilience to format changes.

#### Comparable Markets

The five markets that can be validly compared between 2024 and 2025: United Kingdom, United States, Australia, India, and Brazil.

#### Cross-Segmentation

The analysis of survey data across multiple demographic dimensions (e.g., analyzing responses by both gender and region simultaneously).

### D

#### Demographic Segment

A specific group defined by shared characteristics such as age range, gender, geographic region, organization size, etc., used to categorize survey respondents.

#### Data Normalization

The process of standardizing data representation across different survey years, including consistent market names, demographic keys, and percentage formats.

### E

#### Edge Case

An unusual or extreme scenario that tests the limits of the system's design and handling capabilities.

#### ETL Pipeline

Extract, Transform, Load process that converts raw survey data into the normalized format used by RIA25.

### F

#### Fabrication

The generation of information or data that is not actually present in the underlying survey data.

### G

#### Global Workforce Survey

The annual survey that collects data about workforce trends, attitudes, and experiences worldwide, forming the basis of RIA25's data.

### J

#### JID (JSON Identifier)

A unique identifier for each JSON file in the system, typically based on the question number and survey year.

#### JSON (JavaScript Object Notation)

A lightweight data-interchange format used for structuring the processed survey data in RIA25.

### M

#### Metadata

Supplementary information about the survey data, including question text, question number, survey year, and other contextual information.

### N

#### Next.js

The React framework used to build the web interface for RIA25.

#### Non-Comparable Topic

A canonical topic marked as not directly comparable between survey years due to methodology changes or question framing differences.

#### Normalized Data Strategy

RIA25's approach to organizing survey data around canonical topics rather than raw question numbers, ensuring consistent data representation and valid comparisons.

### O

#### OpenAI

The company providing the AI models and API services that power RIA25's intelligence capabilities.

### P

#### Prompt Engineering

The process of designing and refining instructions (prompts) given to the AI model to optimize its responses and behavior.

### Q

#### Query

A user request for information or analysis submitted to the RIA25 system.

### R

#### Response Data

The structured information about how survey respondents answered specific questions, typically broken down by demographic segments.

#### RIA25 (Research Insights Assistant 2025)

The AI-powered system designed to provide insights from the 2025 Global Workforce Survey data.

#### Retrieval Rules

Guidelines defined in the canonical topic mapping that specify how to retrieve and present data based on topic comparability.

### S

#### Segment Detection

The system's ability to identify which demographic segments are relevant to a particular user query.

#### Single-Year Topic

A canonical topic available in only one survey year, typically 2025, with no counterpart in other years.

#### System Prompt

The core set of instructions that guide the AI's behavior, including rules for data handling, segment detection, and response formatting.

### T

#### Themes

Categorical groupings of canonical topics in the mapping file, such as "Talent Attraction & Retention" or "Skills & Development".

#### Two-Segment Rule

A design principle in RIA25 that limits cross-segmentation analysis to a maximum of two demographic dimensions to maintain statistical validity.

#### Topic-Centric Structure

The organization of data around meaningful topics rather than raw question numbers, a key feature of the normalized data strategy.

### U

#### User Message

A predefined message included in the canonical topic mapping that explains any limitations or considerations when presenting data for a topic.

### V

#### Vector Embedding

The process of converting text data into numerical vector representations that capture semantic meaning, enabling similarity-based retrieval.

#### Vector Store

A database optimized for storing and retrieving vector embeddings, used in RIA25 to enable efficient retrieval of relevant survey data.

#### Vercel

The cloud platform used for deploying the RIA25 web interface.

### Y

#### Year-over-Year Comparison

Analysis that examines how survey responses have changed between the 2024 and 2025 surveys for comparable questions.

## Acronyms

| Acronym | Definition                        |
| ------- | --------------------------------- |
| API     | Application Programming Interface |
| CSV     | Comma-Separated Values            |
| DEI     | Diversity, Equity, and Inclusion  |
| ETL     | Extract, Transform, Load          |
| JSON    | JavaScript Object Notation        |
| RIA     | Research Insights Assistant       |
| YoY     | Year-over-Year                    |
| QA      | Quality Assurance                 |

## Survey Demographic Categories

| Category  | Description                           | Example Values                                       |
| --------- | ------------------------------------- | ---------------------------------------------------- |
| Region    | Geographic region of respondent       | North America, EMEA, APAC, LATAM                     |
| Age       | Age range of respondent               | 18-24, 25-34, 35-44, 45-54, 55+                      |
| Gender    | Gender identity of respondent         | Male, Female, Non-binary, Prefer not to say          |
| Org Size  | Size of respondent's organization     | <100, 100-999, 1000-4999, 5000-9999, 10000+          |
| Sector    | Industry sector of respondent         | Technology, Finance, Healthcare, Manufacturing, etc. |
| Job Level | Hierarchical position in organization | Entry-level, Mid-level, Senior, Executive            |

## Technical Environment

| Component        | Technology        | Purpose                   |
| ---------------- | ----------------- | ------------------------- |
| Frontend         | Next.js, React    | User interface            |
| Backend Services | Node.js           | Data processing           |
| AI Integration   | OpenAI API        | Intelligence capabilities |
| Vector Database  | OpenAI Embeddings | Semantic search           |
| Deployment       | Vercel            | Hosting platform          |

## Related Documentation

For more detailed information on specific topics, refer to:

- [Normalized Data Strategy](/RIA25_Documentation/3_Data_Architecture/normalized_data_strategy.md) - Complete overview of the normalized data approach
- [Canonical Topic Mapping Reference](/RIA25_Documentation/11_References/canonical_topic_reference.md) - Detailed reference for the canonical topic mapping system

---

_Last updated: April 5, 2024_
