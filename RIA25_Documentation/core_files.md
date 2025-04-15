# Core Files of the RIA25 Codebase

This document lists the core files that define the main structure, logic, and data flow of the RIA25 project. These files are essential for understanding, running, and developing the application.

---

## 1. Application Entry Points (Next.js)

- `app/layout.tsx` — Root layout for the application.
- `app/page.tsx` — Main landing page component.

## 2. Main UI Components

- `components/MainComponent.js` — Central UI component.
- `components/DataRetrievalTester.js` — Data retrieval testing interface.
- `components/Nav.tsx` — Navigation bar.
- `components/PromptInput.tsx` — User prompt input.
- `components/CollapsibleBlock.tsx` and `components/CollapsibleContent.tsx` — UI for collapsible content blocks.

## 3. API and Backend Logic

- `app/api/chat-assistant/route.ts` — **Main chat assistant API route.** This is the primary entry point for user queries and orchestrates the backend processing pipeline.
- `app/api/create-logs-dir/route.js`, etc. — Supporting API endpoints. (`direct-save/route.js` now archived in `scripts/legacy/`)

## 4. Utilities and Integrations

- `utils/openai/retrieval.js` — **Core OpenAI integration and data retrieval logic.** Contains `processQueryWithData` which handles the main STANDARD mode steps (Identification, Loading, Filtering).
- `utils/cache-utils.ts` — Thread cache management utilities.
- `utils/helpers.tsx` — Helper functions (e.g., performance metrics).
- `utils/data/smart_filtering.js` — Contains functions like `getSpecificData` used for **filtering** loaded data based on segments.

## 5. Data Processing Scripts (Run Pre-computationally)

- `scripts/process_2025_data.js` — Main 2025 data processing script.
- `scripts/process_survey_data.js` — Survey data processing and harmonization.

## 6. Configuration

- `config/chat.config.json` — Chat assistant configuration (Potentially defines modes like "STANDARD").
- `package.json`, `next.config.js`, `tsconfig.json` — Project and build configuration.

## 7. Documentation (for architecture and workflow reference)

- `RIA25_Documentation/01_project_overview.md` — Project overview.
- `RIA25_Documentation/03_data_processing_workflow.md` — Data processing workflow.
- `RIA25_Documentation/04_system_architecture.md` — System architecture.

## 8. Prompts & Mapping Data (Used by STANDARD Mode Pipeline)

- `utils/openai/1_data_retrieval.md` — **Identification Prompt:** Used by `utils/openai/retrieval.js` (specifically `identifyRelevantFiles`) to analyze the user query against the canonical mapping and determine which files to load.
- `scripts/reference files/2025/canonical_topic_mapping.json` — **Canonical Mapping Data:** The source of truth defining topics and their corresponding data files, used by the Identification Prompt.
- `prompts/assistant_prompt.md` — **Synthesis Prompt:** Used in the final step (likely invoked by `app/api/chat-assistant/route.ts` after data retrieval/filtering) to generate the natural language response based on the filtered data.
- `scripts/output/split_data/` (Directory) — **Survey Data Files:** Contains the actual `.json` data files loaded during the pipeline based on the results from the Identification step.

---

## 9. Intended STANDARD Mode Runtime Pipeline Flow

This outlines the expected sequence when processing a user query in STANDARD mode:

1.  **API Request:** User query hits `app/api/chat-assistant/route.ts`.
2.  **Orchestration:** `route.ts` calls `processQueryWithData` in `utils/openai/retrieval.js`.
3.  **Step 1: Identify Relevant Files:**
    - `processQueryWithData` calls `identifyRelevantFiles`.
    - `identifyRelevantFiles` uses `utils/openai/1_data_retrieval.md` (Prompt) and `scripts/reference files/2025/canonical_topic_mapping.json` (Mapping) to analyze the query.
    - **Output:** JSON object with `file_ids`, `matched_topics`, `segments`.
4.  **Step 2: Load Data:**
    - `processQueryWithData` uses the `file_ids` to read data from corresponding `.json` files within `scripts/output/split_data/`.
5.  **Step 3: Filter Data:**
    - `processQueryWithData` calls a filtering function (e.g., `getSpecificData` from `utils/data/smart_filtering.js`) using the loaded data and `segments`.
    - **Output:** Filtered data points/statistics.
6.  **Step 4: Synthesize & Send Response:**
    - Control likely returns to `app/api/chat-assistant/route.ts`.
    - `route.ts` prepares the final LLM call using `prompts/assistant_prompt.md` (Synthesis Prompt), providing the original query and the filtered data from Step 3.
    - The LLM generates the natural language response.
    - `route.ts` sends the response back to the user.

**Note:** Based on recent logs, there appears to be an unexpected deviation where the pipeline might be looping back or re-invoking itself after Step 3/before Step 4, requiring investigation within `app/api/chat-assistant/route.ts` or its interaction with `utils/openai/retrieval.js`.

---

These files collectively represent the backbone of the RIA25 project.
