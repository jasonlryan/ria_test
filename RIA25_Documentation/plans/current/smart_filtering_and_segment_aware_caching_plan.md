# Smart Filtering & Segment-Aware Caching: Implementation Plan

## 1. Default Segmentation Keys Logic (Hybrid Approach)

- **Global Default:**  
  Define a global default set of segmentation keys, e.g.:

  ```js
  const GLOBAL_DEFAULT_SEGMENTS = ["region", "age", "gender"];
  ```

- **Per-Starter-Question Override:**  
  Each starter question file (`SQ*.json`) can optionally define a `default_segments` array, e.g.:

  ```json
  {
    "starterQuestionCode": "SQ2",
    "question": "...",
    ...
    "default_segments": ["sector"],
    ...
  }
  ```

- **Selection Logic:**  
  In the smart filtering function, after parsing the query:
  1. If the query requests specific segments (e.g., "by age", "for women"), use only those.
  2. If no specific segments are requested:
     - If the loaded starter question file has a `default_segments` field, use those segments.
     - Otherwise, fall back to the global default.

## 2. Code Structure

- **Segment Selection Function:**

  ```js
  function getSegmentsForQuery(queryIntent, starterQuestion) {
    if (queryIntent.segments && queryIntent.segments.length > 0) {
      return queryIntent.segments;
    }
    if (starterQuestion && starterQuestion.default_segments) {
      return starterQuestion.default_segments;
    }
    return GLOBAL_DEFAULT_SEGMENTS;
  }
  ```

- **Usage:**  
  When processing a starter question, pass the loaded starter question object to this function.

## 3. Smart Cache Enhancement

- **Cache Structure:**  
  In the incremental cache (e.g., `incremental_cache.js`), store not just file IDs, but also which segments from each file are cached:

  ```js
  {
    fileId: "2025_11.json",
    segments: ["sector", "region", "age"] // which segments are cached for this file
  }
  ```

- **Follow-up Query Handling:**  
  When a follow-up query requests additional segments from a cached file, check if those segments are already cached; if not, fetch and cache them.

## 4. Filtering and Caching Pipeline

- Use the `getSegmentsForQuery` function in your smart filtering pipeline to determine which segments to extract and return for each query.
- When processing a starter question, always pass the loaded starter question object to this function.

## 5. Benefits

- Ensures that for questions like SQ2, all sector data is always included by default.
- For other questions, a sensible default is used unless the user requests something specific.
- The cache is now aware of which segments are available for each file, making follow-up queries more efficient and accurate.
- Allows per-question customization of default segments via data files, while maintaining a global fallback.

---

## Next Steps

1. Add `default_segments` to any starter question file that needs a custom default.
2. Update the smart filtering code to use the hybrid logic above.
3. Enhance the cache structure to track segments per file.
