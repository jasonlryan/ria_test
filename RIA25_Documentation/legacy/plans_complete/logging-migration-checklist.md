# Core Logging Implementation Checklist

This checklist includes the core source files (JavaScript/TypeScript) where structured logging should be implemented.  
Files are selected from main backend logic, utilities, and main components, and exclude documentation, config, and data files.

---

## **API Routes**

- [ ] app/api/create-logs-dir/route.js
- [ ] app/api/openai/route.ts
- [ ] app/api/query/route.js
- [ ] app/api/retrieve-data/route.js
- [ ] app/api/save-to-logs/route.js
- [ ] app/api/test-assistant/route.ts
- [ ] app/api/test-key/route.ts

## **App Components**

- [ ] app/components/AssistantSelector.tsx

## **Embed/Test Pages**

- [ ] app/test-retrieval/page.js

## **Components**

- [ ] components/AssistantSelector.tsx
- [ ] components/CollapsibleBlock.tsx
- [ ] components/CollapsibleContent.tsx
- [ ] components/DataRetrievalTester.js
- [ ] components/MainComponent.js
- [ ] components/Nav.tsx
- [ ] components/PromptInput.tsx
- [ ] components/icons/AboutProject.tsx
- [ ] components/icons/ConversationStarter.tsx
- [ ] components/icons/DemoScenario.tsx
- [ ] components/icons/ImportantDisclaimer.tsx
- [ ] components/icons/KFLogo.tsx
- [ ] components/icons/Refresh.tsx
- [ ] components/icons/Send.tsx
- [ ] components/icons/TechnicalDetails.tsx

## **Scripts**

- [ ] scripts/analyze-performance.js
- [ ] scripts/process_2025_data.js
- [ ] scripts/process_survey_data.js
- [ ] scripts/2025_DATA_PROCESSING/generate_consolidated_csv.js

## **Upgrades**

- [ ] upgrades/data-retrieval-implementation/api-endpoint.js
- [ ] upgrades/data-retrieval-implementation/openai-integration.js
- [ ] upgrades/data-retrieval-implementation/validation.js

## **Utils**

- [ ] utils/cache-utils.ts
- [ ] utils/helpers.tsx
- [ ] utils/logger.js
- [ ] utils/data/incremental_cache.js
- [ ] utils/data/smart_filtering.js
- [ ] utils/data/types.js
- [ ] utils/openai/retrieval.js
- [ ] utils/validation/data-validation.js

## **Tests**

- [ ] tests/index-tests.js
- [ ] tests/index.js

---

**Instructions:**

- For each file, import the centralized logger and replace all `console.log`, `console.warn`, and `console.error` with the appropriate logger method.
- Add structured context to log messages where possible.
- Remove obsolete or noisy logs.
- Test log output in both development and production modes.

**Note:**  
Do not add logging to files or directories ignored by .gitignore, or to documentation/config/data files.
