# Responses API Migration Brief

**Last Updated:** Mon May 12 13:28:49 BST 2025

## Objective

Migrate RIA25 from OpenAI Assistants API to the new **Responses API** in a single, controlled rollout. This brief summarises the concrete engineering steps required now that groundwork (feature-flags, unified services, testing harness) is complete.

---

## 0. Codebase Context

The RIA25 Next.js/TypeScript monorepo follows the **Controller → Service** standard.
Key locations touched by this migration:

| Layer          | Representative Paths                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers    | `app/api/controllers/chatAssistantController.ts`, `app/api/controllers/retrieveDataController.ts` (former `openaiController.ts` removed) |
| Services       | `app/api/services/unifiedOpenAIService.ts` (new canonical)                                                                                   |
| OpenAI Helpers | `utils/openai/streaming.ts`, `utils/openai/responses-adapter.ts`                                                                             |
| Feature Flags  | `utils/shared/feature-flags.ts`                                                                                                              |
| Cache          | `utils/cache/cache-utils.ts`, `lib/kvClient.ts`                                                                                              |
| Tests          | `tests/services/unifiedOpenAIService.test.ts`, `tests/openai/streaming.test.ts`                                                              |

---

## 1. Scope

| Area          | Change                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI SDK    | Upgrade to `openai@>=1.5.0`. Remove legacy beta endpoints.                                                                                         |
| Service Layer | Enable `UnifiedOpenAIService` with `USE_RESPONSES_API=true`. Delete legacy service imports after smoke tests.                                      |
| Controllers   | `chatAssistantController` and `retrieveDataController` now call **UnifiedOpenAIService** exclusively. `openaiController` was removed. |
| Streaming     | Replace SSE handling with `streamResponseToClient()` helper (already coded).                                                                       |
| Tool Calls    | Use `responses.tools` array. Map file-search & web-search calls.                                                                                   |
| Persistence   | Responses API can be stateless – keep thread metadata in KV only when `store=true`.                                                                |
| Feature Flags | Freeze: `USE_RESPONSES_API=true` (permanent), retire `UNIFIED_OPENAI_SERVICE` flag after rollout.                                                  |

---

## 2. Rollout Checklist

1. **Merge `bin_clean` ➜ `main`.** ✅
2. **Set env vars** in `.env.production`: ✅
   ```
   USE_RESPONSES_API=true
   UNIFIED_OPENAI_SERVICE=true   # temporary – safe to delete later
   ```
3. **Deploy to staging.** ✅
   - Run end-to-end smoke tests (`npm run test:e2e`). ✅
   - Verify cache writes, streaming, and tool-call JSON. ✅
4. **Monitor metrics** (`.next/repository-metrics.json`) for: ⚠️ IN PROGRESS
   - Average latency (target ≤ previous p95). ⚠️ OPTIMIZING
   - Error rate (<1%). ✅
5. **Production flip (feature-flag no-op).** ⚠️ SCHEDULED
   - Remove fallback code in a follow-up PR. ⚠️ PENDING
6. **Codebase cleanup** (Week +1): ⚠️ PENDING
   - Delete legacy Assistants helpers: `utils/openai/legacy/*` (the former `openaiController.ts` has already been removed).
   - Remove deprecated feature-flags.

---

## 3. Risks & Mitigations

| Risk                                  | Mitigation                                                                |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Unexpected 4xx/5xx from Responses API | Use retry logic in `UnifiedOpenAIService` (back-off 2×).                  |
| Streaming format mismatch             | Covered by integration test `streaming.test.ts`.                          |
| Tool-call incompatibility             | File-search IDs are backward compatible; covered by unit tests.           |
| Performance regression                | Compare metrics baseline collected in Phase 1. Rollback by toggling flag. |

---

## 4. Owner & Timeline

_Owner:_ @jasonryan  
_Go-live:_ **Friday 21 Jun 2025** (after 14:00 UTC) - ON TRACK  
_Rollback window:_ 2 hours – toggle `USE_RESPONSES_API=false` and redeploy.

---

## 5. Post-Migration Tasks

- Update documentation (`docs/responses_api.md`) to remove Assistants references.
- Archive legacy code under `legacy/` and delete in 30 days.
- Conduct a retrospective to capture performance and developer-experience improvements.

---

## 6. Recent Updates (June 6, 2025)

### 6.1 Critical Streaming Issues

Several critical issues have been identified with streaming implementation:

- **Disappearing First-Answer Bubble** - Resolved by implementing fallback `messageDone` event when stream ends
- **Follow-up Context Loss** - Being fixed by implementing enhanced thread metadata persistence in KV
- **Segment Selection Issues** - Fix in progress for proper persistence of selected segments

### 6.2 Performance Improvements

Performance optimizations have been implemented:

- **Duplicate File Discovery Elimination** ✅ COMPLETED
  - Removed redundant API calls by trusting LLM file selection
  - Implemented cached fileIds for follow-up queries
- **Memory Cache Implementation** ✅ COMPLETED

  - Added process-level caching for JSON parsing
  - Reduced average latency by 3-8 seconds per request

- **KV Round-Trip Reduction** ⚠️ IN PROGRESS
  - Consolidating cache updates to reduce network calls
  - Optimizing metadata storage for faster retrieval

### 6.3 Pre-Production Testing

- **Stress testing:** Completed with 500 concurrent requests, system remained stable
- **Latency tracking:** P95 latency reduced from 12s to 5.2s
- **Error rate:** <0.5% error rate observed in staging environment

---

_Last updated: Mon May 12 13:28:49 BST 2025_
