# RIA25 Project Overview

## Project Summary

RIA25 (Research Insights Assistant 2025) is an AI-powered system designed to provide actionable insights from the 2025 Global Workforce Survey data. Building on the foundation of its predecessor, RIA25 offers enhanced capabilities for data comparison, visualization, and analysis while ensuring accuracy and preventing data fabrication. The system leverages advanced prompt engineering, vector store retrieval, and the OpenAI API to deliver comprehensive workforce insights based on survey data from both 2025 and 2024 (where comparable).

## Project Goals

1. **Data-Driven Insights**: Provide accurate, data-driven workforce insights from survey responses
2. **Nuanced Analysis**: Deliver analysis that respects the complexity of demographic segments without oversimplification
3. **Year-over-Year Comparison**: Enable valid comparisons between 2024 and 2025 data where methodologically sound
4. **Demographic Segmentation**: Support analysis across various demographic dimensions while preventing invalid cross-segmentation
5. **User-Friendly Interface**: Create an intuitive interface for accessing complex survey data insights
6. **Ethical AI Deployment**: Ensure responsible implementation with guardrails against misinformation and bias

## Development Phases

| Phase       | Timeframe             | Key Activities                                                   |
| ----------- | --------------------- | ---------------------------------------------------------------- |
| Planning    | January-February 2024 | Requirements gathering, system design, data strategy development |
| Development | March 2024            | Data processing, prompt engineering, vector store implementation |
| Testing     | Late March 2024       | System testing, prompt refinement, accuracy validation           |
| Deployment  | April 2024            | Production deployment, monitoring setup, documentation           |
| Maintenance | Ongoing               | Updates, enhancements, and support                               |

## Project Roles

- **Developers**: Responsible for system implementation and maintenance
- **Data Engineers**: Handling data processing and transformation
- **End Users**: Business stakeholders accessing workforce insights

## Core Components

1. **Data Processing Pipeline**: Transforms raw CSV survey data into structured JSON format
2. **Vector Store**: OpenAI vector database for efficient retrieval of relevant survey data
3. **Prompt System**: Carefully designed prompt engineering to guide AI responses and enforce data integrity
4. **API Layer**: Integration with OpenAI's Assistants API
5. **Web Interface**: User-friendly front-end for querying the system
6. **Documentation**: Comprehensive documentation for usage and maintenance

## Key Innovations

1. **Two-Segment Rule**: Approach to prevent invalid cross-segmentation of demographic data
2. **Anti-Fabrication Measures**: Guidelines to prevent AI from generating fictional data
3. **Canonical Topic Mapping**: Dynamic mapping of user queries to canonical survey topics
4. **Selective Year-over-Year Comparison**: Rules-based approach to only compare methodologically compatible data points

## Project Objectives

RIA25 aims to achieve:

- Processing of 2025 Global Workforce Survey data
  0- Comparison where possible with 2024 Global Workforce Survey data
- Implementation of data integrity safeguards
- Deployment with appropriate monitoring
- Comprehensive documentation and support resources

## Next Steps

1. User feedback collection and analysis
2. Potential enhancements based on usage patterns
3. Preparation for future survey data integration
4. Ongoing performance optimization

---

_This overview was last updated on April 5, 2024_
