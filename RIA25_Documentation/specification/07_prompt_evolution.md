# RIA25 Prompt System Evolution

## Introduction

This document outlines the development journey of the RIA25 prompt system, tracking its evolution from initial test questions to the final sophisticated system prompt that powers the workforce insights assistant. The development process took place primarily in March 2024, with refinements continuing into April.

## Timeline of Development

### Initial Testing Phase (March 22, 2024)

The development process began with `test_questions.md`, which established a foundation for testing the system's capabilities with various query types:

- **Individual file testing questions**: Focused on detailed demographics, cross-segment analysis, outlier identification, and conditional analysis
- **Cross-file comparative questions**: Testing relationships between attraction and retention factors, consistency checks, and generational analysis
- **Complex analytical questions**: Exploring contradictory trends, sector-specific deep dives, and integrated gender analysis

These test questions were designed to verify if the system could correctly:

- Access the canonical mapping
- Apply default 2025 behavior
- Handle comparable vs. non-comparable topics
- Process basic theme/topic questions
- Manage demographic detail questions
- Respond to ambiguous queries

### Query Parsing Development (March 24, 2024)

The development then focused on establishing a robust query parsing system:

1. **`query_parser.md` (01:59 PM)**: The first version of the query parser defined:

   - Critical requirements (single message responses, no fabrication)
   - A structured workflow (parse query, validate against canonical mapping, retrieve data, format response)
   - Data structure examples and verification steps
   - Clear guidelines on correct vs. incorrect responses

2. **`new_parser.md` (03:51 PM)**: Expanded the parser with:

   - More detailed stages (connection to canonical file, parse and map query, answer delivery)
   - Explicit error handling
   - Required reporting sections
   - Clear display format for parsing reports

3. **`query_parser_config.json` (03:57 PM)**: Formalized the parser configuration in JSON format

4. **`parser_spec.md` (04:02 PM)**: Created a comprehensive specification document that outlined:

   - Purpose and goals (process natural language queries, map to canonical topics)
   - Core principles (zero hard-coding, transparency, data integrity)
   - System architecture (component structure, data flow, dependencies)
   - Functional requirements
   - Technical specifications for each processing stage
   - Output formats and critical rules

5. **`new_parser.json` (09:24 PM)**: Finalized the parser configuration in a structured JSON format

### Segment Detection Refinement (March 24, 2024)

A critical development was the implementation of segment detection in `test_segment_detection.json` (09:52 PM), which addressed:

- Detecting combinations of demographic segments (countries, job levels, age groups, genders, sectors)
- Identifying semantic patterns suggesting cross-segment analysis
- Implementing a strict response protocol for segment violations
- Ensuring segments are analyzed separately with appropriate disclaimers

This represented a significant enhancement to prevent invalid cross-segment analysis that wasn't supported by the underlying data structure.

### Anti-Fabrication Testing (March 24, 2024)

Multiple iterations of anti-fabrication tests were developed at 08:49 PM:

- **`prompt_final_no_fabrication_test1.md`**: Established comprehensive guidelines for:

  - Vector store data retrieval
  - Topic identification
  - Query management
  - File retrieval and verification
  - Segment handling rules (global data only)
  - Data processing
  - Narrative-driven response structure
  - Strict anti-fabrication rules
  - Presentation guidelines
  - Error handling
  - Response quality checklist
  - Tone of voice guidelines

- **`prompt_final_no_fabrication_test2.md` through `test4.md`**: Successive refinements to the anti-fabrication approach, each building on the previous version

### System Prompt Finalization (March 24 - April 4, 2024)

1. **`system_prompt.md` (05:16 PM, March 24)**: Initial comprehensive system prompt

2. **`system_prompt.json` (04:16 PM, April 4)**: Final refined system prompt in JSON format, featuring:
   - Critical data access instructions
   - Mandatory reporting structures
   - Enhanced query processing with automatic segment detection
   - Comprehensive data verification processes
   - The Two Segment Rule enforcement
   - Narrative guidelines
   - DEI handling protocols
   - Clear scope boundaries
   - Response quality standards
   - Critical rules
   - Data fabrication prevention measures
   - Two segment verification protocols

## Key Evolutionary Themes

Throughout the development process, several key themes emerged:

1. **Increasing Formalization**: From markdown documents to structured JSON configurations
2. **Enhanced Data Integrity**: Growing focus on preventing fabrication and ensuring data retrieval
3. **Segmentation Enforcement**: Development of robust mechanisms to prevent invalid cross-segment analysis
4. **Query Processing Refinement**: Evolution from basic parsing to sophisticated intent and topic mapping
5. **Response Quality Standards**: Increasingly detailed guidelines for comprehensive, narrative-driven responses
6. **Transparency**: Implementation of detailed reporting while maintaining a seamless user experience

## Conclusion

The RIA25 prompt system underwent significant evolution from initial testing concepts to a sophisticated, rule-based system with strict data integrity enforcement. The final system prompt (`system_prompt.json`) represents the culmination of this development process, incorporating lessons learned through multiple testing iterations and refinements.

The progression shows a deliberate path from initial concept testing to increasingly formalized structures, with particular emphasis on data integrity, segment handling, and high-quality response generation. The final system encapsulates these developments into a comprehensive JSON configuration that powers the workforce insights assistant.

---

## Current Implementation (2025)

- **Prompt Templates**: The system uses prompt templates and configurations stored in the `prompts/` directory (e.g., `system_prompt.md`, `system_prompt.json`, `starter_prompt_template.md`).
- **Integration in Codebase**: Prompt selection, anti-fabrication logic, and canonical topic mapping are programmatically enforced in `utils/openai/retrieval.js` and orchestrated by API endpoints (`app/api/chat-assistant/route.ts`).
- **Canonical Topic Mapping**: The prompt system leverages canonical topic mapping to ensure queries are mapped to valid survey topics, with harmonization logic for year-over-year comparison.
- **Anti-Fabrication Enforcement**: The anti-fabrication and two-segment rules are enforced both in prompt templates and in the logic of utility modules, ensuring that responses are always grounded in real data and system constraints.
- **Dynamic Prompting**: The system dynamically selects and customizes prompts based on the query, topic, and data context, supporting robust, high-integrity responses.

This implementation ensures that the prompt system is not only a set of static templates but an integrated, programmatically enforced part of the RIA25 architecture.

## Starter Question System

### Overview

To optimize performance and user experience, RIA25 implements a sophisticated starter question system that allows for predefined, high-performing queries with optimized data retrieval paths. This system was implemented in April 2024 to address latency concerns and provide consistent, high-quality responses for common workforce queries.

### Precompiled Starter Questions

The system supports predefined starter questions (e.g., `SQ1`, `SQ2`) through a structured approach:

- **File Structure**:

  - Precompiled data files stored in `/utils/openai/precompiled_starters/` directory
  - Each starter question has a corresponding JSON file (e.g., `SQ1.json`, `SQ2.json`)
  - Optional specialized prompt template in `/prompts/starter_prompt_template.md`

- **JSON Format Example**:
  ```json
  {
    "starterQuestionCode": "SQ1",
    "question": "What factors influence employee retention?",
    "data_files": ["2025_1_2", "2025_3_4"],
    "segments": ["region", "age"],
    "matched_topics": ["Remote_Work", "Work_Flexibility"],
    "summary": "In 2025, the key factors influencing employee retention are..."
  }
  ```

### Two-Stage Query Processing

When a starter question is detected:

1. **Stage 1: Optimized Data Retrieval**

   - The system checks if the query matches a known starter question pattern
   - If matched, it loads the precompiled data directly from the corresponding JSON file
   - The precompiled data includes the exact file IDs, segments to use, and a natural language question
   - This stage completely bypasses the expensive LLM-based file identification process

2. **Stage 2: Response Generation**
   - The natural language question and prefiltered data are sent directly to the OpenAI Assistant
   - The assistant uses this optimized context to generate a response
   - This approach ensures consistency and reduces token usage

### Implementation Details

The starter question system is implemented across several key files:

1. **Frontend (`app/embed/[assistantId]/page.tsx`)**:

   - Detects `?starterQuestion=SQ2` URL parameter
   - Implements a two-stage fetch process:
     - First fetch to `/api/query` for data retrieval and optimization
     - Second fetch to `/api/chat-assistant` for response generation
   - Provides accurate loading feedback during each stage

2. **Backend (`utils/openai/retrieval.js`)**:

   - Contains `isStarterQuestion(query)` function to detect starter question patterns
   - Implements `getPrecompiledStarterData(code)` to load the appropriate JSON file
   - Completely bypasses the LLM file identification step for starter questions
   - Returns consistent data structure for both starter and standard questions

3. **API Endpoints**:
   - `/api/query/route.js`: Handles data retrieval with special logic for starter questions
   - `/api/chat-assistant/route.ts`: Processes the optimized data and generates responses

### Performance Benefits

The starter question system provides significant performance improvements:

- **Reduced Latency**: Bypassing the LLM file identification step saves 5-10 seconds
- **Consistent Responses**: Precompiled data ensures high-quality, consistent answers
- **Optimized Segment Selection**: Each starter question includes explicitly defined segments most relevant to the query
- **Lower Token Usage**: Precompiled summaries and filtered data reduce token consumption
- **Better User Experience**: Faster responses and consistent quality for common queries

### Extensibility

The starter question system is designed to be easily extended:

- New starter questions can be added by creating additional JSON files
- Existing starter questions can be updated to reflect new data or insights
- The system supports both complete precompiled responses and data-driven responses
- An optional script `/scripts/generate_precompiled_starters.js` can be used to batch-generate or update starter data files

This approach provides an optimal balance between performance, consistency, and flexibility, particularly for frequently asked questions about workforce trends.

---

_Last updated: April 30, 2024_
