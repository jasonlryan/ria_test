# Data Compatibility Integration Plan

> **Last Updated:** Mon Apr 21 2025  
> **Target Audience:** Developers, System Architects, Technical Stakeholders  
> **Related Documents:**
>
> - 03_data_processing_workflow.md
> - 06_system_architecture.md
> - utils/openai/1_data_retrieval.md
> - prompts/assistant_prompt.md

## Overview

This document outlines the implementation plan for enhancing the data compatibility assessment, tracking, and handling across the RIA25 system. The goal is to ensure that compatibility information from the canonical mapping is properly retrieved, stored, transmitted, and utilized throughout the system, resulting in accurate and transparent analysis that respects data limitations.

## How This Works (Plain English Summary)

- **When you ask for data (for example, "What is the 2025 result for the UK?")**, the system will give you exactly what you asked for—just the 2025 UK data. It will not automatically include data from other years or groups unless you specifically ask for a comparison.

- **If you ask for a comparison (for example, "How did satisfaction change from 2024 to 2025 in the UK?")**, the system will check if a valid comparison is possible. If it is, it will show both years and explain the comparison. If not, it will show only the valid data and clearly explain why a comparison isn't possible.

- **Behind the scenes, the system always checks if comparisons are possible** for the topic and group you mentioned. It keeps track of which topics, countries, or groups can be compared across years, and which cannot.

- **If comparable data is available but you didn't ask for a comparison**, the system will not include extra data by default. However, it can optionally add a friendly note at the end of the answer, such as:  
  "Comparable data for previous years is available. If you’d like to see a comparison, just ask!"

- **If only some groups can be compared** (for example, UK and US can be compared, but Japan cannot), the answer will compare the groups that are valid, and for the others, it will show only the available data and explain why.

- **All limitations or special rules will be clearly explained** at the start of the answer, so you always know what you’re seeing and why.

- **This approach keeps answers focused and avoids overwhelming you with extra information you didn’t request.** It also makes it easy to follow up and ask for a comparison if you’re interested, knowing that the data is available.

- **The system can be configured to always mention when comparable data is available, or to stay silent unless you ask.** This can be adjusted based on user or project preference.

---

## Current State Assessment

### Identified Gaps

1. **Incomplete Data Flow**: While the data retrieval prompt (`1_data_retrieval.md`) has been enhanced to assess compatibility, the compatibility information may not be properly preserved through the system pipeline.

2. **Storage Limitation**: The compatibility assessment is not consistently stored with thread context for reference in follow-up questions.

3. **Assistant Handling**: The assistant prompt lacks specific instructions on how to handle compatibility information.

4. **Code Implementation**: Current implementation in `utils/openai/retrieval.js` and related files may not fully support the enhanced compatibility requirements.

## Implementation Plan

<!-- (rest of the file remains unchanged) -->
