# OpenAI Responses API Migration Plan (Incremental & Developer-Controlled)

**Last Updated:** Tue May 10 2025

## Core Principles

1.  **Small, Verifiable Steps:** Each step should be a minimal change that can be tested immediately.
2.  **Developer in Control:** The AI assistant will propose changes, but the developer will apply, test, and commit them. This avoids automated tools mangling the code.
3.  **Feature Flags are Key:** The `USE_RESPONSES_API` flag (in `utils/shared/feature-flags.ts`) will be used to toggle between legacy (Assistants API) and new (Responses API) paths, allowing for easy reversion if a step introduces issues.
4.  **Backend First, Then Frontend:** Ensure API endpoints function correctly with the new Responses API before making significant UI changes.
5.  **Focus on One Flow at a Time:** Address new conversations, then continued conversations, then streaming, then tools.

---

## Phase 1: Solidify Backend Service Layer for Responses API

_Goal: Ensure `UnifiedOpenAIService` can reliably make non-streaming and streaming calls using the Responses API, without affecting the currently working legacy path. **Keep `USE_RESPONSES_API=false` for all application use during this phase, unless a step specifies turning it ON for isolated testing.** _

### Step 1.1: Type Definitions & Basic Internal Call Method (Non-Streaming)

- **File:** `app/api/services/unifiedOpenAIService.ts`
- **Action:**
  1.  **Verify/Add TypeScript Interfaces:** Ensure robust and correct interfaces for:
      - `ResponsesCreateNonStreamingParams` (and `Streaming` variant)
      - `ResponsesContinueNonStreamingParams` (and `Streaming` variant)
      - `ResponseResult` (expected structure from a non-streaming call: `id`, `output_text`, `tool_calls?`, `usage?`, etc.)
      - Reference official OpenAI Node SDK types for accuracy.
  2.  **Implement Internal Helper:** Create a new, `private` async method, e.g., `_executeResponsesApiCall(params: any, isStreaming: boolean): Promise<any>`.
      - This method will be the _sole_ place that directly calls `this.client.responses.create(params)`. It should handle the `stream` property within `params`.
      - It should include basic error logging for the direct API call.
- **Testing (Isolated):**
  - Create a temporary test script or an ad-hoc, unexposed route that can directly invoke `_executeResponsesApiCall`.
  - Call it for a new conversation, non-streaming. Verify the raw OpenAI response structure.
  - Call it for a continued conversation (using a `previous_response_id` obtained from the first call), non-streaming. Verify.
- **Commit:** `git commit -m "Feat(API): Add types and internal _executeResponsesApiCall for Responses API"`

### Step 1.2: Refactor `createResponse` & `continueConversation` in `UnifiedOpenAIService`

- **File:** `app/api/services/unifiedOpenAIService.ts`
- **Action:**
  1.  Modify `public async createResponse(...)`:
      - Add a check for `isFeatureEnabled('USE_RESPONSES_API')`.
      - If `true`, call `this._executeResponsesApiCall(params, false)` (for non-streaming initially) and adapt its return to the expected `OpenAIResponse<ResponseResult>` structure.
      - If `false`, execute the existing legacy (Assistants API) logic.
  2.  Modify `public async continueConversation(...)`:
      - Add a check for `isFeatureEnabled('USE_RESPONSES_API')`.
      - If `true`, call `this._executeResponsesApiCall(params_with_previous_response_id, false)` and adapt its return.
      - If `false`, execute existing legacy logic.
- **Testing:**
  - **With `USE_RESPONSES_API=false` (default):** Run the application. It MUST function exactly as before (using legacy Assistants API and streaming).
  - **With `USE_RESPONSES_API=true` (via env override for isolated test):** Use your isolated test script/route to call the public `createResponse` and `continueConversation`. Verify they correctly route to the Responses API and return a full, non-streamed `ResponseResult`.
- **Commit:** `git commit -m "Refactor(API): Route create/continueConversation to Responses API via flag (non-streaming)"`

### Step 1.3: Implement Streaming Logic in `UnifiedOpenAIService`

- **File:** `app/api/services/unifiedOpenAIService.ts`
- **Action:**
  1.  Modify `_executeResponsesApiCall`: If `isStreaming: true`, ensure it correctly sets `stream: true` in the params to `this.client.responses.create()` and returns the `AsyncIterable<any>` directly.
  2.  Modify `public async createResponse(...)` and `public async continueConversation(...)`:
      - If `isFeatureEnabled('USE_RESPONSES_API')` is `true` AND their `options` parameter includes `stream: true`:
        - They should call `this._executeResponsesApiCall(..., true)`.
        - They should return the `AsyncIterable<any>` (perhaps wrapped, e.g., `{ data: streamIterable, error: null }`).
- **Testing (Isolated, `USE_RESPONSES_API=true`):**
  - Use your isolated test script/route.
  - Call `createResponse` with `stream: true`. Iterate over the first few chunks from the returned `AsyncIterable`. **Log the full JSON structure of these chunks.** This is critical for the next phase.
  - Repeat for `continueConversation` with `stream: true`.
- **Commit:** `git commit -m "Feat(API): Enable streaming output from UnifiedOpenAIService for Responses API"`

---

## Phase 2: Adapt Controller & Route for Responses API Streaming

_Goal: Make `chatAssistantController.ts` use the updated service methods and correctly handle streaming via `streamAsSSE` when `USE_RESPONSES_API` is enabled._

### Step 2.1: Refine `extractDeltaText` and `streamAsSSE`

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Action:**
  1.  Based on the **actual chunk JSON structures logged in Step 1.3**, carefully review and refine the `extractDeltaText(chunk: any): string | undefined` helper function. Ensure it robustly extracts text from all observed delta chunk formats from the Responses API (e.g., `chunk.delta`, `chunk.response.output[].text`, `chunk.type === 'response.output.delta'`, etc.).
  2.  Review `streamAsSSE(responseStream: AsyncIterable<any>, ...)`:
      - Ensure it correctly uses `extractDeltaText`.
      - Verify it correctly identifies and processes `responseId` from the first relevant chunk (e.g., from `chunk.id` on a `response.created` type event, or the main stream object if the SDK provides it there).
      - Ensure it handles `tool_call` events (even if just logging them for now).
      - Ensure it correctly detects `finish_reason` to close the SSE stream.
      - Make sure the temporary "CAPTURE_CHUNK_FOR_PARSER" log is **removed**.
- **Testing (Isolated):**
  - Create a mock `AsyncIterable` in a test file that yields the JSON chunk structures you captured in Step 1.3.
  - Pass this mock stream to `streamAsSSE`.
  - Verify that the `ReadableStream` returned by `streamAsSSE` emits the correct SSE formatted events (`event: responseId`, `event: textDelta`, `event: status` with `completed`, `event: messageDone`).
- **Commit:** `git commit -m "Refactor(Controller): Refine streamAsSSE and extractDeltaText for Responses API chunk structures"`

### Step 2.2: Update `postHandler` for Non-Streaming Responses API (Initial Test)

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Action:**
  1.  Modify the main logic block in `postHandler` where it calls the `unifiedOpenAIService`.
  2.  Add the `isFeatureEnabled('USE_RESPONSES_API')` check.
  3.  **If `true` (and for this step only):**
      - Call `unifiedOpenAIService.createResponse(...)` or `unifiedOpenAIService.continueConversation(...)` with `stream: false`.
      - The service will return an `OpenAIResponse<ResponseResult>` (non-streamed).
      - Take `responseResult.output_text` and `responseResult.id`.
      - Construct and return a simple `NextResponse.json({ responseText: output_text, responseId: id })`.
      - _For this step, the UI will NOT show live typing when the flag is on; it will get a single JSON payload after a delay._
  4.  If `false`, the existing legacy streaming logic should execute.
- **Testing:**
  - **With `USE_RESPONSES_API=false`:** Application works as before (legacy streaming).
  - **With `USE_RESPONSES_API=true` (set via `.env.local` or temporary code change):**
    - Start a new chat. The UI will _not_ stream. After a delay, the full assistant message should appear. Check browser network tools: `/api/chat-assistant` should have returned a single JSON response.
    - Verify client-side logic (e.g., in `page.tsx`) correctly receives this JSON and updates the display. The new `responseId` from the JSON should be stored (e.g., in `localStorage` via `setThreadId`).
    - Send a follow-up message. Verify the backend uses the correct `previous_response_id` for the `continueConversation` call.
- **Commit:** `git commit -m "Feat(Controller): Basic non-streaming Responses API path in postHandler (flagged)"`

### Step 2.3: Enable Full SSE Streaming in `postHandler` for Responses API

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Action:**
  1.  In `postHandler`, inside the `if (isFeatureEnabled('USE_RESPONSES_API'))` block:
      - Change the calls to `unifiedOpenAIService.createResponse(...)` and `unifiedOpenAIService.continueConversation(...)` to pass `stream: true`.
      - These calls will now return `{ data: AsyncIterable<any> }` (or similar, depending on your Step 1.3 wrapper).
      - Get the `AsyncIterable` (e.g., `const openAIStream = serviceResponse.data`).
      - **Crucially**: Update `threadContextCached` with the new `responseId` _before_ piping to `streamAsSSE`. The `responseId` might be available on the `openAIStream` object itself, or `streamAsSSE` must robustly extract it from the very first event and update context via a callback or by mutating `threadContextCached` if passed by reference (less ideal).
      - Pass this `openAIStream` to your refined `streamAsSSE(...)` function.
      - Return `new Response(sseStream, { headers: { 'Content-Type': 'text/event-stream', ... }})`.
- **Testing:**
  - **With `USE_RESPONSES_API=true`:**
    - **This is the critical integration test.** Start a new chat. The browser network tab should show an `EventSource` connection to `/api/chat-assistant`.
    - The assistant's response should stream token-by-token into the UI.
    - Verify the `responseId` (our client-side `threadId`) is correctly set from the stream's first event and stored.
    - Test follow-up messages. They should also stream correctly, using the stored ID as `previous_response_id`.
  - **With `USE_RESPONSES_API=false`:** Application must still work perfectly using the legacy path.
- **Commit:** `git commit -m "Feat(Controller): Enable full SSE streaming via Responses API in postHandler (flagged)"`

---

## Phase 3: Frontend Adjustments & Finalization

_Goal: Ensure `app/embed/[assistantId]/page.tsx` handles UI aspects correctly with the new API path, and then make the Responses API the default._

### Step 3.1: Verify Frontend SSE Event Handling & `questionToSend`

- **File:** `app/embed/[assistantId]/page.tsx`
- **Action:**
  1.  Review the `es.onmessage` logic. Ensure it correctly parses all events now being sent by your `streamAsSSE` for the Responses API (especially `responseId`, `textDelta`, `messageDone`, `status`, `toolCall` if any, `error`).
  2.  Confirm the `sendPrompt` function (and its callers like `handleUIConversationPromptClick` and `PromptInput.tsx`) correctly sets `questionToSend` to the actual user query string. The null-guard (`if (typeof questionToSend !== 'string' || !questionToSend.trim())`) should be present and effective.
  3.  Ensure `threadId` state in `page.tsx` (which acts as `previous_response_id`) is correctly updated from the `responseId` event and passed back in subsequent `sendPrompt` calls via `options.threadId`.
- **Testing (`USE_RESPONSES_API=true`):**
  - Thoroughly test UI interactions: typing, submitting with Enter, clicking starter questions.
  - Monitor browser console for any UI-side errors or unexpected event payloads.
  - Ensure conversation context is maintained across turns.
- **Commit:** `git commit -m "Refactor(UI): Align EventSource handling and prompt submission with Responses API stream"`

### Step 3.2: Fix Starter Prompts Display (If Still an Issue)

- **File:** `app/embed/[assistantId]/page.tsx` and `config/chat.config.json`
- **Action:**
  1.  Ensure `page.tsx` correctly imports `chatConfig from '../../../config/chat.config.json'`.
  2.  Ensure the component logic that renders starter questions (both the side panel and any "ghost" buttons in the main chat area if they were intended) correctly maps over `chatConfig.starterQuestions` and uses the `item.text`.
  3.  Ensure `handleUIConversationPromptClick` correctly passes the `question.text` to `sendPrompt` with `forceNewThread: true`.
- **Testing (`USE_RESPONSES_API=true`):** All starter questions should be visible and correctly initiate new, streaming conversations.
- **Commit:** `git commit -m "Fix(UI): Ensure starter prompts are correctly loaded and displayed"`

### Step 3.3: Make Responses API the Default

- **File:** `utils/shared/feature-flags.ts`
- **Action:**
  1.  Change the default for `USE_RESPONSES_API` to `enabled: true`.
  2.  (Optional) Remove the environment variable override if you were using one for testing.
- **Testing:** Run the application without any special flags. It should now use the Responses API path by default. Perform a full smoke test.
- **Commit:** `git commit -m "Feat: Enable Responses API by default"`

---

## Phase 4: Caching, Tool Calling (Optional), and Legacy Code Cleanup

_Goal: Adapt caching to use `responseId` (if necessary), implement Responses API tool calling (if assistant uses tools), and safely remove all old Assistants API code._

### Step 4.1: Update Caching Utilities (If Impacted)

- **File:** `utils/cache/cache-utils.ts` (and key schema files)
- **Action:**
  1.  Review how conversation context / thread metadata is cached (e.g., `threadMetaKey`).
  2.  The primary identifier for a conversation is now the `responseId` obtained from the first OpenAI response (which `page.tsx` stores as `threadId`). Ensure cache keys are based on this ID.
  3.  If you were caching Assistants API `thread_id` or `run_id` specific data, this logic will need to change or be removed.
- **Testing:** Verify that conversation context (like `previousQueries`, `rawQueries`, the latest `responseId`) is correctly cached and retrieved from KV using the new identifier scheme.
- **Commit:** `git commit -m "Refactor(Cache): Adapt KV caching to use Responses API conversation identifiers"`

### Step 4.2: Implement Responses API Tool Calling (If Assistant Uses Tools)

- **Action:** This is a larger sub-project if your assistant needs to call functions/tools.
  1.  When the Responses API stream emits a `tool_call` event (or `response.tool_calls.delta`), your `streamAsSSE` needs to forward this to the client, or the backend needs to pause the SSE stream to the client.
  2.  The backend (likely `chatAssistantController` or `unifiedOpenAIService`) must:
      - Identify the tool call(s).
      - Execute the corresponding function(s) (e.g., your `file-search`, `web-search`).
      - Call `this.client.responses.create(...)` again, this time including the `tool_results` in the request, along with `previous_response_id`.
      - The new stream from this call then continues the conversation.
  3.  The client might need UI to indicate a tool is being used.
- **Testing:** Queries that trigger tools should execute them correctly and incorporate results into the final streamed response.
- **Commit (likely multiple):** `git commit -m "Feat(API): Implement tool ... for Responses API"`

### Step 4.3: Remove Legacy Assistants API Code

- **Action:** Once the Responses API path is fully stable, tested, and the default:
  1.  In `unifiedOpenAIService.ts`, remove all code blocks guarded by `if (!isFeatureEnabled('USE_RESPONSES_API'))`.
  2.  Remove any methods solely used by the Assistants API path (e.g., direct calls to `this.client.beta.threads...`, `this.client.beta.runs...`).
  3.  Remove unused Assistants API type imports (e.g., `Thread`, `Run` from `openai/resources/beta/...`).
  4.  In `chatAssistantController.ts`, remove any legacy logic paths.
  5.  Delete `app/api/controllers/openaiController.ts` if it is now fully redundant.
  6.  Remove `OPENAI_ASSISTANT_ID` from `.env` files and any code that uses it.
- **Testing:** Extensive regression testing of all chat functionalities.
- **Commit:** `git commit -m "Refactor: Remove legacy OpenAI Assistants API code paths"`

---

_This plan provides a structured approach. Adjust as needed based on discoveries during implementation. Communicate any deviations._

**Footer Last Updated:** Tue May 10 2025
