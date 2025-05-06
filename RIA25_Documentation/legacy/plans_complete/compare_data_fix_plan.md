A. STEP-BY-STEP IMPLEMENTATION PLAN
────────────────────────────────────────
High-level goal Stop the system from serving data for topics whose comparable = false when the user explicitly requests a YoY comparison, while surfacing the appropriate userMessage for those topics.
FILES TO TOUCH
• app/api/services/dataRetrievalService.js
• utils/openai/retrieval.js
• utils/openai/promptUtils.js
• utils/shared/compatibilityLogger.js (optional logging refinement)
• Tests in /scripts/test*compatibility*\* (new/updated)
PHASE 1 – API & DATA FLOW
Add a new optional param precomputedIdentification to
utils/openai/retrieval.processQueryWithData(...).
– If it is provided, bypass the second call to
identifyRelevantFiles, and use the object directly.
– Also accept compatibilityMetadata via context fallback.
In app/api/services/DataRetrievalService.processQueryWithData
(a) After calling this.identifyRelevantFiles, do not call the
global processQueryWithData naïvely.
(b) Instead call:
Apply to data_compati...
;
Inside utils/openai/retrieval.processQueryWithData
(a) Accept additional param precomputedIdentification = null.
(b) Use:
Apply to data_compati...
;
(c) Derive compatibility = context.compatibilityMetadata ?? fileIdResult.compatibilityMetadata;
(d) Gate the filtering block on that compatibility variable.
Ensure the removedTopics map is pushed into
context.incomparableTopicMessages regardless of where the
filtering happened.
PHASE 2 – PROMPT / RESPONSE LAYER
Update utils/openai/promptUtils.buildPromptWithFilteredData
to read:
Apply to data_compati...
}
(This already exists but must be guaranteed to receive the data.)
Expose context.compatibilityVerbosity so prompts can decide how
verbose the notice should be (“minimal” | “standard” | “detailed”).
PHASE 3 – TESTING
Add Jest / Vitest integration tests:
• comparison_with_incomparable_topics.test.js
– Feed a query like
"Compare Attraction_Factors between 2024 and 2025"
– Assert:
returned fileIds array does NOT include 2024_1.json / 2025_1.json
context.incomparableTopicMessages["Attraction_Factors"] is defined
Assistant response contains the userMessage.
• comparison_with_only_comparable_topics.test.js
– Expect no filtering and full two-year data.
PHASE 4 – LOGGING & MONITORING
Inside utils/shared/compatibilityLogger add a helper
logCompatibilityFiltering(queryId, removedTopics, counts) so that
each filtered-out topic is tracked at INFO level.
PHASE 5 – DOCS & CLEAN-UP
Update “Implementation Progress Report” section of
RIA25_Documentation/plans/current/data_compatibility_integration.md
to move the “Data Filtering for Incomparable Topics” item from
“In Progress” → “Completed”.
