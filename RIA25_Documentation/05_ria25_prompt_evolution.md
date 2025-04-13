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

---

_Last updated: April 13, 2025_
