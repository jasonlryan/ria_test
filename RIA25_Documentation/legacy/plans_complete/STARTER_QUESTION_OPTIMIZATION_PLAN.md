# Starter Question & Precompiled Query Optimization Plan

## Overview

To optimize the handling of starter questions and prewritten queries (e.g., `SQ1`, `SQ2`), this plan introduces a system for detecting these queries and serving precompiled data or responses with minimal latency. This approach allows the backend to intercept known queries and return precompiled data, bypassing expensive data retrieval and LLM analysis steps when possible.

---

## File Structure

```
/utils/
  openai/
    1_data_retrieval.md
    retrieval.js
    precompiled_starters/
      SQ1.json
      SQ2.json
      ...
/prompts/
  assistant_prompt.md
  starter_prompt_template.md   # (optional, if you want a special prompt for starters)
/app/
  api/
    chat-assistant/
      route.ts
    ...
/scripts/
  generate_precompiled_starters.js   # (optional, for batch generation)
```

---

## New/Modified Files and Their Roles

- **/utils/openai/precompiled_starters/SQ1.json, SQ2.json, ...**

  - Each file contains the precompiled data (summary, stats, or even a full narrative) for a specific starter question.
  - Example:
    ```json
    {
      "starterQuestionCode": "SQ1",
      "summary": "In 2025, remote work trends show...",
      "stats": { "remote": 68, "hybrid": 22, "onsite": 10 },
      "matched_topics": ["Remote_Work", "Work_Flexibility"]
    }
    ```

- **/prompts/starter_prompt_template.md** (optional)

  - If you want a special prompt for the LLM when handling starter questions, place it here.
  - Example:
    ```
    You are answering a precompiled starter question. Use the provided summary and stats to generate a narrative response.
    ```

- **/app/api/chat-assistant/route.ts** (modified)

  - Add logic to detect a starter question code in the request.
  - If detected, load the corresponding precompiled data file and either:
    - Return it directly (if it’s a full narrative), or
    - Pass it to the LLM with the appropriate prompt for synthesis.

- **/utils/openai/retrieval.js** (modified)

  - Add a helper function to load precompiled starter data by code.

- **/scripts/generate_precompiled_starters.js** (optional)
  - Script to batch-generate or update your precompiled starter data files.

---

## New/Modified Functions

- **getPrecompiledStarterData(code: string): object**

  - Loads and returns the precompiled data for a given starter question code.

- **isStarterQuestion(prompt: string): boolean**

  - Detects if the incoming prompt is a starter question (e.g., matches `SQ\d+`).

- **handleStarterQuestion(req, res)**
  - Main handler to intercept starter questions, load data, and return or pass to LLM.

---

## Example Flow in `route.ts` (Pseudocode)

```js
if (isStarterQuestion(body.starterQuestionCode)) {
  const precompiled = getPrecompiledStarterData(body.starterQuestionCode);
  if (precompiled) {
    // Option 1: Return directly
    // return NextResponse.json({ result: precompiled.summary });

    // Option 2: Pass to LLM for narrative
    const llmPrompt = buildStarterPrompt(precompiled, starterPromptTemplate);
    // ...call LLM as usual with llmPrompt...
  }
}
// ...normal flow for other queries...
```

---

## Summary Table

| File/Function                    | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| precompiled_starters/SQ1.json    | Store precompiled data for SQ1              |
| starter_prompt_template.md       | (Optional) Special LLM prompt for starters  |
| getPrecompiledStarterData        | Load precompiled data by code               |
| isStarterQuestion                | Detect starter question code                |
| handleStarterQuestion            | Main handler for optimized flow             |
| generate_precompiled_starters.js | (Optional) Batch generate/update data files |

---

## Conclusion

This structure allows you to efficiently intercept and handle starter questions, serving precompiled data with minimal latency and maximum flexibility. You can expand this pattern for any number of starter questions or prewritten queries.
