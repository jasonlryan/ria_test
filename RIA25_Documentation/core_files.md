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

- `app/api/chat-assistant/route.ts` — Main chat assistant API route.
- `app/api/create-logs-dir/route.js`, etc. — Supporting API endpoints. (`direct-save/route.js` now archived in `scripts/legacy/`)

## 4. Utilities and Integrations

- `utils/openai/retrieval.js` — OpenAI integration and data retrieval logic.
- `utils/cache-utils.ts` — Thread cache management utilities.
- `utils/helpers.tsx` — Helper functions (e.g., performance metrics).

## 5. Data Processing Scripts

- `scripts/process_2025_data.js` — Main 2025 data processing script.
- `scripts/process_survey_data.js` — Survey data processing and harmonization.

## 6. Configuration

- `config/chat.config.json` — Chat assistant configuration.
- `package.json`, `next.config.js`, `tsconfig.json` — Project and build configuration.

## 7. Documentation (for architecture and workflow reference)

- `RIA25_Documentation/01_project_overview.md` — Project overview.
- `RIA25_Documentation/03_data_processing_workflow.md` — Data processing workflow.
- `RIA25_Documentation/04_system_architecture.md` — System architecture.

---

These files collectively represent the backbone of the RIA25 project.
