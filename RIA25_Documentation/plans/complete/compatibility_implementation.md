# Compatibility Check Implementation (Revised Approach: Direct JSON Return)

## Problem Statement

The system fails to reliably prevent year-on-year comparisons for topics marked as incompatible in `file_compatibility.json`, especially during follow-up queries. We need a robust way to block these invalid comparisons _before_ expensive data retrieval and processing occur.

## Solution Requirements

1.  Reliably block incompatible year-on-year **follow-up** comparison queries.
2.  Utilize `file_compatibility.json` as the source of truth for compatibility status.
3.  Utilize cached file information (from `getCachedFilesForThread`) for follow-up checks.
4.  **Bypass** the main data retrieval LLM call (`identifyRelevantFiles` using `1_data_retrieval.md`) and subsequent processing entirely for blocked cases.
5.  Generate and return a **direct JSON response** containing a clear warning message, similar to the existing, functional "out_of_scope" mechanism.
6.  Ensure the frontend correctly handles this direct JSON response without breaking.

## Revised Implementation Plan: Controller Fork with Direct JSON Return

The core idea is to check for incompatible follow-up comparison requests _within the controller_ (`chatAssistantController.ts`) _before_ initiating the standard data retrieval process. If incompatibility is detected based on cached files, we bypass retrieval and **immediately return a JSON response** containing the warning, mimicking the pattern used successfully for out-of-scope queries.

**Step-by-Step Implementation Guide:**

**Step 1: Ensure Necessary Utilities are Accessible in Controller**

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Action:** Add or verify imports:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import OpenAI from "openai";
  import fs from "fs";
  import path from "path";
  import logger from "../../../utils/logger";
  import {
    detectComparisonQuery,
    fileCompatibilityData,
  } from "../../../utils/openai/retrieval";
  import { getCachedFilesForThread } from "../../../utils/cache-utils";
  ```
- **Note:** Ensure `fileCompatibilityData` (or a function providing access to it) is properly loaded and exported from `retrieval.js`. Add logging in `retrieval.js` to confirm `fileCompatibilityData` loads correctly on startup, including the number of keys and the first few keys. Example log: `[COMPATIBILITY_LOAD] Successfully loaded file_compatibility.json. Found X file entries. First 5 keys: key1, key2,...`

**Step 2: Implement the Compatibility Check Fork in `postHandler`**

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Function:** `postHandler`
- **Location:** Insert this logic _after_ `isFollowUp` is determined and _after_ `finalThreadId` is established, but _before_ the main data retrieval logic begins (e.g., before the `if (!isStarterQuestion(content) ...)` block around line ~142).

- **Code:**

  ```typescript
  // ===== START: Follow-up Comparison Incompatibility Check (Direct JSON Return) =====
  if (isFollowUp && finalThreadId) {
    const isComparison = detectComparisonQuery(content); // Check current query content

    if (isComparison) {
      logger.warn(
        `[CONTROLLER_COMPAT_CHECK] Detected follow-up comparison query for thread: ${finalThreadId}`
      );
      try {
        // Attempt to get cached files (assuming cache stores file IDs)
        const cachedFiles = await getCachedFilesForThread(finalThreadId);
        // Ensure cachedFiles is an array before mapping
        const cachedFileIds = Array.isArray(cachedFiles)
          ? cachedFiles.map((f) => f.id)
          : [];

        logger.info(
          `[CONTROLLER_COMPAT_CHECK] Found ${
            cachedFileIds.length
          } cached files: ${cachedFileIds.join(", ")}`
        );

        const incompatibleFilesInfo = [];
        let checkPerformed = false; // Flag to ensure check runs

        // Check requires cached files AND loaded compatibility data
        if (
          cachedFileIds.length > 0 &&
          fileCompatibilityData?.fileCompatibility // Check if data loaded correctly
        ) {
          checkPerformed = true; // Mark that the check logic was entered
          for (const fileId of cachedFileIds) {
            // Normalize ID from cache (remove .json if present)
            const normalizedId = String(fileId).replace(/\.json$/, "");

            // Lookup in compatibility data loaded at startup
            const compatInfo =
              fileCompatibilityData.fileCompatibility[normalizedId];

            logger.info(
              `[CONTROLLER_COMPAT_CHECK] Checking cached file "${normalizedId}": Found=${!!compatInfo}, Comparable=${
                compatInfo?.comparable ?? "N/A" // Handle case where comparable might be undefined
              }`
            );

            // If compatibility info exists and explicitly says not comparable
            if (compatInfo && compatInfo.comparable === false) {
              logger.warn(
                `[CONTROLLER_COMPAT_CHECK] Incompatible cached file detected: ${normalizedId} (Topic: ${
                  compatInfo.topic || "Unknown"
                })`
              );
              // Collect unique topics and their messages
              if (
                compatInfo.topic && // Ensure topic exists
                !incompatibleFilesInfo.some(
                  // Use .some for efficiency
                  (item) => item.topic === compatInfo.topic
                )
              ) {
                incompatibleFilesInfo.push({
                  topic: compatInfo.topic,
                  message:
                    compatInfo.userMessage ||
                    "Comparison not available due to methodology changes.", // Provide a default message
                });
              }
            }
          }
        } else {
          if (cachedFileIds.length === 0) {
            logger.warn(
              `[CONTROLLER_COMPAT_CHECK] Skipping check: No cached files found for thread ${finalThreadId}.`
            );
          } else {
            logger.error(
              `[CONTROLLER_COMPAT_CHECK] Skipping check: fileCompatibilityData not loaded or invalid!`
            );
          }
        }

        // --- If incompatible files were found during check, FORK and RETURN JSON ---
        if (checkPerformed && incompatibleFilesInfo.length > 0) {
          const incompatibleTopics = incompatibleFilesInfo.map((f) => f.topic);
          logger.warn(
            `[CONTROLLER_COMPAT_GATE] Incompatible topics found in cache for comparison query: ${incompatibleTopics.join(
              ", "
            )}. Returning direct JSON response.`
          );

          // Construct the user-facing message
          const messageString = `Comparison cannot be performed for some topics due to data methodology changes. Incompatible topics identified: ${incompatibleTopics.join(
            ", "
          )}.`;

          // *** RETURN DIRECT JSON RESPONSE - Mirroring out-of-scope pattern ***
          return NextResponse.json(
            {
              // Use a distinct flag or structure identifiable by the frontend if needed
              incompatible_comparison: true,
              message: messageString,
              // Optionally include details if the frontend can use them
              details: {
                incompatibleTopics: incompatibleTopics,
                topicMessages: incompatibleFilesInfo.reduce((acc, item) => {
                  acc[item.topic] = item.message;
                  return acc;
                }, {}),
              },
            },
            { status: 200 }
          ); // Use 200 OK status like the out-of-scope handler
        } else {
          // Log if check ran but found no incompatible files, or if check was skipped
          logger.info(
            `[CONTROLLER_COMPAT_CHECK] Check ran: ${checkPerformed}. Incompatible files found: ${incompatibleFilesInfo.length}. Proceeding with normal flow.`
          );
        }
      } catch (error) {
        // Log error during the check itself, but allow normal flow to continue
        logger.error(
          `[CONTROLLER_COMPAT_CHECK] Error during follow-up compatibility check logic: ${error.message}`,
          error
        );
      }
    } // end if(isComparison)
  } // end if(isFollowUp && finalThreadId)
  // ===== END: Follow-up Comparison Incompatibility Check =====

  // Original logic continues here ONLY if the above block didn't execute 'return'
  let result;
  if (!isStarterQuestion(content) && !(isDirectMode && !forceStandardMode)) {
    // ... rest of the existing data retrieval/processing logic ...
    // IMPORTANT: The 'result = await processQueryWithData(...)' calls and subsequent
    // handling logic (including the now-redundant check for result.skipFileRetrieval)
    // remain here but will only be reached if the fork logic above does NOT return.
    // Consider removing the post-processQueryWithData skipFileRetrieval check eventually
    // if this new pre-check fork proves reliable.
  }
  // ... etc ...
  ```

**Step 3: Remove Conflicting Logic**

- **File:** `app/api/controllers/chatAssistantController.ts`
- **Action:** Locate the code block (previously around line 240-255) that checks for `result && result.skipFileRetrieval === true` _after_ the call to `processQueryWithData`. **Delete this entire block**, as the check is now performed _before_ `processQueryWithData`.

**Step 4: Verification**

1.  **Restart App:** Check `[COMPATIBILITY_LOAD]` logs in `retrieval.js` output.
2.  **Test Initial Query:** Ensure "Tell me about Attraction Factors" still works correctly (returns 2025 data, streams response). The compatibility check logs should indicate it was skipped or no incompatible files found.
3.  **Test Follow-up Comparison:** Send "compare with 2024" after the initial query.
4.  **Check Backend Logs:**
    - Verify `[CONTROLLER_COMPAT_CHECK]` logs show detection, cached files check, and incompatible file detection (e.g., for Attraction Factors).
    - Verify `[CONTROLLER_COMPAT_GATE] Incompatible topics found... Returning direct JSON response.` appears.
    - Verify **NO** logs appear from `processQueryWithData` or `identifyRelevantFiles` for this specific request.
    - Verify the API call returns a 200 status quickly (no long polling).
5.  **Check Frontend:**
    - Verify the UI displays the incompatibility warning message correctly (e.g., "Comparison cannot be performed... Incompatible topics identified: Attraction_Factors").
    - Verify the UI does **not** hang or show streaming indicators for this warning message.
    - Verify **no** comparison data is shown.
6.  **Test Out-of-Scope:** Send an unrelated query (e.g., "how to bake bread") to ensure the original out-of-scope JSON handling still works correctly.

This revised plan uses the simpler, proven direct JSON return mechanism, avoiding unnecessary complexity and potential failure points associated with the Assistant API run for this specific warning case.
