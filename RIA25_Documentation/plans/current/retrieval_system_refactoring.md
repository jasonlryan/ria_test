# Architecture Refactoring: Consolidating the Retrieval System

Below is a concise but thorough overview of how the current retrieval system architecture works, where its fragility comes from, and a comprehensive plan to consolidate our maze of legacy code, adapters, and repositories into a single, maintainable implementation.

---

## 1. Current request flow (high-level)

1. **API Route** → `queryController`
2. **Controller** builds thread context ➜ hands off to **`DataRetrievalService`**
3. **DataRetrievalService**
   - Decides `isFollowUp` (based on KV thread meta)
   - Calls **`identifyRelevantFiles`** → can traverse three layers:
     1. legacy `utils/openai/retrieval.js`
     2. feature-flagged _adapter_
     3. repository-pattern implementation (`PromptRepository`, etc.)
4. Returns file IDs ➜ **`processQueryWithData`** (can recurse through same three layers)
5. **`retrieveDataFiles`** (again 3 layers)
6. Compatibility checks appear **five** times:
   - `detectComparisonQuery` (retrieval.js)
   - early-return gate in `processQueryWithData` (retrieval.js)
   - extra gate in `DataRetrievalService.processQueryWithData`
   - `filterIncomparableFiles` (compatibility.ts)
   - controller-level "cache compatibility" guard

Result: duplicate logic, racing branches, and sometimes multiple OpenAI calls.

---

## 2. Why the _first_ query can be marked `follow-up`

KV thread metadata is created the moment a thread ID is generated. When the controller immediately reads KV, it finds the entry it just wrote, so `isFollowUp` becomes `true` even for the first user query.

---

## 3. Why 2024 files still sneak in

- The **1_data_retrieval.md** prompt enforces "2025 by default", but some branches bypass the prompt (cached or repository fast-path).
- Multiple layers merge file-ID arrays; once a 2024 ID slips in, later filters must remove it in every branch.
- An **old compatibility loader** still looks for `fileCompatibility` (v1 schema), logs "0 file entries" and treats everything as comparable; only the TS loader reads the new schema.

---

## 4. Structural fragility

- **Duplication**: same steps in controller, service, adapter, retrieval.js (JS + TS mix).
- **Feature-flag spaghetti**: `USE_REPOSITORY_PATTERN`, `ENABLE_RETRIEVAL_ADAPTER`, `SHADOW_MODE`, etc.
- **Side-effects**: global caches + KV writes inside adapter functions.
- **Schema drift**: three generations of compatibility JSON.
- **Fallback cascades**: errors trigger legacy fallbacks which re-prompt OpenAI.

---

## 5. Hardening & Simplification Roadmap

> See detailed phase checklist at the end of this document.

---

## Simplification & Hardening Migration Plan

**Last Updated:** Mon May 5 18:01:43 BST 2025

### Phase 0 — Build unblock & quick wins (COMPLETED)

✅ Fix unterminated template literal and duplicate export in `dataRetrievalService.js`.
✅ Correct `queryController` import to named `DataRetrievalService`.
✅ Adjust thread-meta check:

```ts
const isFollowUp = meta?.previousQueries?.length > 0;
```

✅ Ensure unified compatibility mapping is loaded once and cached.

### Phase 1 — Force repository path (COMPLETED)

✅ Set env flags permanently:

```bash
USE_REPOSITORY_PATTERN=true
ENABLE_RETRIEVAL_ADAPTER=true
```

✅ Controllers/services import only `utils/data/repository/adapters/retrieval-adapter` functions.
✅ Remove legacy fall-back conditions in adapter.
✅ Completed behavioral testing and fixed robustness issues.
✅ Fixed data structure format in adapter output.

**Critical issue identified**: While the retrieval system correctly identifies files and builds data structures, the actual data content is not being sent with the prompt to OpenAI. This needs urgent attention in Phase 2.

### Phase 2 — Legacy shim & Data transmission (COMPLETED)

✅ Rename `utils/openai/retrieval.js` → `retrieval.legacy.js`.
✅ Create shim `utils/openai/retrieval.js` exporting from adapter.
✅ Fixed data transmission issue:

- Identified SmartFiltering duplication as root cause
- Consolidated to single implementation
- Ensured proper data flow from repository to OpenAI prompts

### Phase 3 — Clean feature-flag spaghetti (COMPLETED)

✅ Deleted branches guarded by feature flags.
✅ Kept single roll-back flag for safety.
✅ Consolidated import paths to repository adapter.

### Phase 4 — One compatibility gate (COMPLETED)

✅ Added utility functions in `compatibility.ts`:

- `lookupFiles()` - Enriches file IDs with metadata
- `getComparablePairs()` - Validates file combinations across years
  ✅ Enhanced repository with compatibility metadata handling.
  ✅ Implemented controller-level compatibility checking.
  ✅ Added hardened compatibility gate with two clear paths:
- Single-year queries: default to 2025 data only
- Comparison queries: validate compatible topics only
  ✅ Fixed critical issue with undefined years in file metadata.
  ✅ Connected controller with adapter's compatibility flag.
  ✅ Validated proper blocking of incompatible comparisons.

### Phase 5 — Clean-up & tests (1–2 days)

1. Delete legacy compatibility loaders & v1 JSON.
2. Convert remaining JS in `utils/openai` to TS.
3. Add Vitest tests:
   • first-query follow-up detection
   • default-to-2025 rule
   • comparison query blocking for non-comparable topics.
4. Add developer documentation for compatibility system.
5. Clean up debug logging once system is stable.

_Last updated: Mon May 5 18:01:43 BST 2025_
