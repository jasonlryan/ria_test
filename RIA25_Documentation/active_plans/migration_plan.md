**Last Updated:** Sun May 11 2025

# OpenAI Responses API Migration Plan (LLM-Driven Two-Step Pipeline)

## Core Principles

1. **LLM-Driven File Discovery:**
   The LLM (using the prompt in `1_data_retrieval.md`) is responsible for parsing the user query and identifying relevant data files, topics, and segments.
2. **Separation of Concerns:**
   The backend orchestrates the flow but does not hard-code file selection logic; all mapping rules and business logic are encoded in the LLM prompt.
3. **Two-Step Pipeline:**
   - **Step 1:** LLM selects files (non-streaming).
   - **Step 2:** LLM generates the final answer using the selected files (streaming).
4. **Extensibility:**
   Prompts can be updated to change business logic without code changes.

---

## Model Selection Standard

- **Default Model:** All LLM calls (file discovery and report generation) MUST use `gpt-4.1-mini` unless a different model is explicitly required for a specific step.
- This is enforced in both the controller and the unifiedOpenAIService.
- If a different model is needed for a particular step, document and justify the change in this plan.

---

## Phase 1: Implement LLM-Driven File Discovery

- **Service Layer:**
  - Add a method to call the Responses API with the `1_data_retrieval.md` prompt, filling in the user query, previous context, and canonical mapping.
  - Parse the LLM's output as JSON to get `file_ids`, `matched_topics`, `segments`, etc.
- **Controller Layer:**
  - On each user query, call the LLM file discovery method.
  - Use the returned file IDs for data retrieval.

### Phase 1.1: Implement LLM-Driven File Discovery in DataRetrievalService

- **Location:** `app/api/services/dataRetrievalService.ts` (`DataRetrievalService` class)
- **Method:** `async identifyRelevantFilesWithLLM(query: string, context: string, isFollowUp: boolean, previousQuery: string, previousAssistantResponse: string, canonicalMapping: object): Promise<any>`
- **Purpose:**
  - Loads and fills the `1_data_retrieval.md` prompt template with the user query, previous context, and canonical mapping.
  - **Explicitly instructs the LLM to use the OpenAI vector store with the correct ID for all file lookups and semantic searches.**
  - **Clarifies in the prompt that only files/topics present in the canonical mapping are valid for selection, and the vector store is to be used for semantic search among these.**
  - Calls the OpenAI Responses API (non-streaming) via `unifiedOpenAIService`.
  - Parses the LLM's JSON output to extract `file_ids`, `matched_topics`, `segments`, `out_of_scope`, `conversation_state`, and `explanation`.
  - Handles errors robustly (invalid JSON, LLM hallucination, API errors) and logs all failures.
- **Expected Output:**
  - A valid object with at least `file_ids`, `matched_topics`, `segments`, `out_of_scope`, `conversation_state`, and `explanation` fields.
  - If the LLM output is not valid JSON, the method should retry once, then return an error object and log the failure.
- **Integration:**
  - The controller will call this method for every user query to determine which files to load for the report-generation step.

---

## Phase 2: Data Retrieval and Report Generation

- Load the content of the files identified by the LLM.
- Build a prompt for the LLM with the user query and loaded data.
- Call the Responses API (streaming) to generate the final answer.
- Stream the response to the frontend.

---

## Phase 3: Error Handling and Fallbacks

- If the LLM output is not valid JSON, handle gracefully (retry, fallback, or error message).
- Optionally, use backend file selection as a fallback only.

---

## Phase 4: Testing and Documentation

- Add tests for both LLM steps.
- Update documentation to reflect the LLM-driven pipeline.

---

## Phase 5: Codebase Cleanup and Optimization

- Remove all legacy Assistants API code, types, and imports
- Delete or refactor redundant files (e.g., openaiController.ts, legacy code in /utils/openai/)
- Remove feature flags for API switching (Responses API is now canonical)
- Update or remove legacy tests and migration scripts
- Refactor cache/session logic to use only response/session IDs
- Update documentation and comments to reflect the new, streamlined architecture

---

## Benefits

- **Maximum flexibility:** All mapping and business rules are in the prompt.
- **Easier updates:** Change logic by editing the prompt, not the code.
- **Better query understanding:** LLM can handle ambiguous or novel queries.

_Last updated: Sun May 11 2025_
