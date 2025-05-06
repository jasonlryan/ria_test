# Responses API Migration Brief

**Last Updated:** {{DATE}}

## Objective

Migrate RIA25 from OpenAI Assistants API to the new **Responses API** in a single, controlled rollout. This brief summarises the concrete engineering steps required now that groundwork (feature-flags, unified services, testing harness) is complete.

---

## 0. Codebase Context

The RIA25 Next.js/TypeScript monorepo follows the **Controller → Service** standard.
Key locations touched by this migration:

| Layer          | Representative Paths                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers    | `app/api/controllers/chatAssistantController.ts`, `app/api/controllers/openaiController.ts`, `app/api/controllers/retrieveDataController.ts` |
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
| Controllers   | `chatAssistantController`, `openaiController`, `retrieveDataController` now call **UnifiedOpenAIService** exclusively. Remove thread/run handling. |
| Streaming     | Replace SSE handling with `streamResponseToClient()` helper (already coded).                                                                       |
| Tool Calls    | Use `responses.tools` array. Map file-search & web-search calls.                                                                                   |
| Persistence   | Responses API can be stateless – keep thread metadata in KV only when `store=true`.                                                                |
| Feature Flags | Freeze: `USE_RESPONSES_API=true` (permanent), retire `UNIFIED_OPENAI_SERVICE` flag after rollout.                                                  |

---

## 2. Rollout Checklist

1. **Merge `bin_clean` ➜ `main`.**
2. **Set env vars** in `.env.production`:
   ```
   USE_RESPONSES_API=true
   UNIFIED_OPENAI_SERVICE=true   # temporary – safe to delete later
   ```
3. **Deploy to staging.**
   - Run end-to-end smoke tests (`npm run test:e2e`).
   - Verify cache writes, streaming, and tool-call JSON.
4. **Monitor metrics** (`.next/repository-metrics.json`) for:
   - Average latency (target ≤ previous p95).
   - Error rate (<1%).
5. **Production flip (feature-flag no-op).**
   - Remove fallback code in a follow-up PR.
6. **Codebase cleanup** (Week +1):
   - Delete legacy Assistants helpers: `openaiController.ts`, `utils/openai/legacy/*`.
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
_Go-live:_ **Friday 21 Jun 2025** (after 14:00 UTC)  
_Rollback window:_ 2 hours – toggle `USE_RESPONSES_API=false` and redeploy.

---

## 5. Post-Migration Tasks

- Update documentation (`docs/responses_api.md`) to remove Assistants references.
- Archive legacy code under `legacy/` and delete in 30 days.
- Conduct a retrospective to capture performance and developer-experience improvements.

---

_Merge this file into `RIA25_Documentation/active_plans/` to track final execution._
