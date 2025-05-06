# RIA25 Project Overview

## Project Summary

RIA25 (Research Insights Assistant 2025) is an AI-powered system designed to provide actionable insights from the 2025 Global Workforce Survey data. It integrates advanced prompt engineering, vector store retrieval, and the OpenAI API to deliver comprehensive workforce insights based on survey data from both 2025 and 2024 (where comparable).

## Project Goals

- Provide accurate, data-driven workforce insights from survey responses
- Deliver nuanced analysis respecting demographic segment complexity
- Enable valid year-over-year comparisons where methodologically sound
- Support demographic segmentation while preventing invalid cross-segmentation
- Create an intuitive user interface for complex survey data insights
- Ensure ethical AI deployment with guardrails against misinformation and bias

## Development Phases

| Phase       | Timeframe             | Key Activities                                                   |
| ----------- | --------------------- | ---------------------------------------------------------------- |
| Planning    | January-February 2024 | Requirements gathering, system design, data strategy development |
| Development | March 2024            | Data processing, prompt engineering, vector store implementation |
| Testing     | Late March 2024       | System testing, prompt refinement, accuracy validation           |
| Deployment  | April 2024            | Production deployment, monitoring setup, documentation           |
| Maintenance | Ongoing               | Updates, enhancements, and support                               |

## Project Roles

- Developers: System implementation and maintenance
- Data Engineers: Data processing and transformation
- End Users: Business stakeholders accessing workforce insights

## Core Components

The system comprises:

- Data Processing Pipeline: Transforms raw CSV survey data into structured JSON with harmonization and canonical topic mapping (see `process_survey_data.js`, `process_2025_data.js`)
- Vector Store: OpenAI vector database for efficient retrieval of relevant survey data
- Prompt System: Engineered prompts guiding AI responses and enforcing data integrity
- API Layer: Next.js API endpoints orchestrating query handling, data retrieval, validation, and logging
- Utility Modules: Core logic for retrieval, validation, and caching
- Web Interface: User-friendly front-end for querying the system
- Documentation: Comprehensive usage and maintenance resources

---

### System Structure Update (2025)

The 2025 update includes:

- Harmonization logic for 2024/2025 data enabling valid year-over-year comparison
- API endpoints structured around Next.js with dedicated controllers and services
- Modular utility modules for retrieval, validation, and caching
- Vector store integration via OpenAI embeddings and API endpoints
- Prompt templates supporting anti-fabrication and canonical topic mapping

## Key Innovations

- Two-Segment Rule: Prevents invalid cross-segmentation of demographic data
- Anti-Fabrication Measures: Ensures AI does not generate fictional data
- Canonical Topic Mapping: Dynamic mapping of user queries to canonical survey topics
- Selective Year-over-Year Comparison: Rules-based approach for valid comparisons

## Project Objectives

RIA25 aims to:

- Process 2025 Global Workforce Survey data with comparison to 2024 where valid
- Implement data integrity safeguards
- Deploy with monitoring and support
- Provide comprehensive documentation

## Next Steps

- Collect and analyze user feedback
- Enhance features based on usage patterns
- Prepare for future survey data integration
- Optimize performance continuously

---

_Last updated: April 13, 2025_
