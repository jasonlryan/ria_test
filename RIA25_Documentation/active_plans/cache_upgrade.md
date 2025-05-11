# Cache Upgrade Implementation Plan

**Last Updated:** Sun May 11 2025

## 1. Overview

This document outlines the implementation plan for upgrading the caching mechanism in the RIA25 application. The goal is to introduce a more granular cache for processed segment statistics and make the data retrieval process (specifically `1_data_retrieval.md` logic) aware of this cache. This will improve efficiency, reduce redundant processing, and enable smarter handling of follow-up queries.

## 2. Goals

- Implement a granular cache for (file + segment) processed statistics.
- Persistently track all raw segments available within each data file.
- Modify `1_data_retrieval.md` logic to be aware of and utilize the granular cache and available raw segment information.
- Update the backend orchestration layer to manage cache reads/writes and conditionally invoke `SmartFilteringProcessor`.
- Ensure graceful fallback mechanisms if cache entries are missing.

## 3. Cache Design

We will use the existing Redis KV store for this enhanced caching.

### 3.1. Granular Statistics Cache

- **Purpose:** Store the actual processed statistics (e.g., the `FilteredDataItem[]` or a summary object) for a specific file and a specific segment.
- **Key Schema:** `stats:<file_id>:<segment_id>`
  - Example: `stats:2025_1:sector`
- **Value:** JSON string representation of the processed statistics object for that file/segment combination.
- **TTL:** To be determined based on data update frequency (e.g., 24 hours, or tied to data refresh cycles).

### 3.2. Available Raw Segments Cache

- **Purpose:** Store the list of all unique, canonical segment keys found to be present (raw, before processing) within a specific data file.
- **Key Schema:** `filemeta:<file_id>:available_raw_segments`
  - Example: `filemeta:2025_1:available_raw_segments`
- **Value:** JSON string representation of an array of segment strings (e.g., `["overall", "region", "age", "sector", "education"]`).
- **TTL:** Should be long, potentially indefinite, or only invalidated when the underlying source data file changes.

## 4. Implementation Steps

### Step 4.1: Modify `SmartFilteringProcessor` (or its calling orchestrator)

- **Task:** After `SmartFilteringProcessor` successfully processes data, the calling code needs to populate the new caches.
- **Logic:**
  1.  **Populate Available Raw Segments Cache:**
      - When `SmartFilteringProcessor` first scans a file (or set of files) and identifies the complete list of `availableSegments` (the `Set<string>` it builds internally).
      - For each unique `file_id` involved in the processing run, store its list of `availableSegments` in Redis under the `filemeta:<file_id>:available_raw_segments` key. This should ideally happen only once per file unless the file content changes.
  2.  **Populate Granular Statistics Cache:**
      - After `SmartFilteringProcessor` returns its `FilterResult` (which contains `stats: FilteredDataItem[]`).
      - Iterate through the `stats`. For each `FilteredDataItem`, identify its source `file_id` and `category` (which represents the segment).
      - Group these stats by `(file_id, segment_id)`.
      - For each unique `(file_id, segment_id)` combination, store the corresponding array of `FilteredDataItem` objects (or a relevant summary) as a JSON string in Redis under the `stats:<file_id>:<segment_id>` key.
- **Files to Potentially Modify:**
  - The service or adapter layer that calls `SmartFilteringProcessor` (e.g., `utils/data/repository/adapters/retrieval-adapter.ts` or a service like `DataRetrievalService`).

### Step 4.2: Update Data Retrieval Logic (Backend preparing for `1_data_retrieval.md`)

- **Task:** Before invoking the LLM for `1_data_retrieval.md` (especially for follow-up queries), gather information from the new caches.
- **Logic (for `isFollowUp = true`):**
  1.  Determine the relevant `file_ids` based on the previous turn's context (already somewhat in place).
  2.  For each relevant `file_id`:
      - Attempt to fetch the list of "available raw segments" from `filemeta:<file_id>:available_raw_segments`.
      - Attempt to identify which segments for this file _already have their stats cached_ by checking for the existence of `stats:<file_id>:<segment_id>` keys or by querying a manifest (if a separate manifest is maintained).
  3.  Construct a data structure or summary of this cache state.
- **Files to Potentially Modify:**
  - The controller or service that prepares the context and calls the `1_data_retrieval.md` LLM prompt (e.g., `app/api/query/queryController.ts` or similar).

### Step 4.3: Modify `1_data_retrieval.md` Prompt

- **Task:** Update the prompt to make the LLM aware of the cached information and guide its decision-making.
- **Additions to Prompt (Conceptual):**
  - Inject the cache state information gathered in Step 4.2 into the prompt.
    - Example: `"cached_info": { "2025_1": { "processed_and_cached_segments": ["sector", "age"], "available_raw_segments_in_file": ["overall", "region", "age", "sector", "education", "job_level"] } }`
  - Update instructions for `isFollowUp = true`:
    - "When analyzing the current query and its relation to the previous context and files:"
    - "First, check if the segments requested by the current query for a relevant file are listed in `processed_and_cached_segments`. If so, these can be served from cache."
    - "If the current query requests segments for a relevant file that are _not_ in `processed_and_cached_segments` but _are_ in `available_raw_segments_in_file`, these will require fresh processing."
    - "If the query is vague (e.g., 'tell me more', 'elaborate') and no specific segments are requested, consider the `available_raw_segments_in_file` for the relevant files. If there are segments that have not yet been processed (i.e., not in `processed_and_cached_segments`), you may suggest processing one of these as a way to provide further detail. Prioritize segments that are conceptually related to the ongoing discussion."
  - The output JSON from `1_data_retrieval.md` might need to be enhanced to distinguish segments to be fetched from cache vs. segments needing new processing.
    - Example: `"segments_to_process": [{"file_id": "2025_1", "segment_id": "education", "source": "new_processing"}], "segments_from_cache": [{"file_id": "2025_1", "segment_id": "sector", "source": "cache"}]` (or a simpler structure if the orchestrator can infer).
- **Files to Potentially Modify:**
  - `utils/openai/1_data_retrieval.md`

### Step 4.4: Update Orchestration Layer (Post `1_data_retrieval.md`, Pre `SmartFilteringProcessor`)

- **Task:** Modify the main application logic that handles the output from `1_data_retrieval.md` and decides how to fetch/process data.
- **Logic:**
  1.  Receive the (potentially updated structure) JSON output from `1_data_retrieval.md`.
  2.  Initialize an empty list/object for final statistics to be sent to `assistant_prompt.md`.
  3.  **For segments to be served from cache:**
      - Directly fetch the pre-computed statistics from Redis using the `stats:<file_id>:<segment_id>` keys.
      - Add these to the final statistics list.
  4.  **For segments requiring new processing:**
      - Gather all unique `file_ids` and their respective `segment_ids` that need fresh processing.
      - Load the raw data for these `file_ids` (if not already loaded).
      - Invoke `SmartFilteringProcessor` with these files and the specific list of segments needing new processing.
      - (The logic in Step 4.1 will then ensure these newly processed stats are also cached).
      - Add these newly processed stats to the final statistics list.
  5.  Pass the combined (cached + newly processed) statistics to `assistant_prompt.md`.
- **Files to Potentially Modify:**
  - The controller or service that orchestrates the calls between `1_data_retrieval.md`, data loading, `SmartFilteringProcessor`, and `assistant_prompt.md`.

### Step 4.5: Cache Invalidation Strategy

- **Task:** Define and implement a strategy for cache invalidation.
- **Considerations:**
  - **Time-Based (TTL):** Simplest approach, but might serve stale data if content updates before TTL expires, or clear fresh data too soon.
  - **Event-Driven:** If there's a mechanism to detect when underlying data files (`scripts/output/split_data/*.json`) are updated, this event could trigger invalidation of related cache entries (both `stats:*` and `filemeta:*`). This is more complex but more accurate.
  - **Manual/Periodic:** A script or admin function to clear all or parts of the cache during data refresh cycles.
- **Initial Recommendation:** Start with a reasonable TTL for `stats:*` keys. For `filemeta:*:available_raw_segments`, TTL could be longer or tied to a manual refresh if file structures are stable. Implement more sophisticated event-driven invalidation later if needed.

### Step 4.6: Testing

- **Unit Tests:**
  - Test cache read/write functions.
  - Test logic for populating caches in the orchestrator.
  - Test modifications to `1_data_retrieval.md` (if possible through simulated LLM calls or by validating prompt construction).
- **Integration Tests:**
  - Test the end-to-end flow for initial queries and follow-up queries.
  - Verify that data is correctly served from cache when expected.
  - Verify that new data is processed and cached correctly.
  - Test scenarios with vague follow-ups to see if the system intelligently uses "available but not yet processed" segments.
- **Performance Tests:**
  - Measure response times before and after the caching changes to quantify improvements.

## 5. Fallback Mechanisms

- If a requested `stats:<file_id>:<segment_id>` key is not found in the cache (cache miss, or expired), the system should gracefully fall back to treating it as "new processing" (i.e., load the file and run `SmartFilteringProcessor` for that file/segment). This ensures data is always served even if the cache is cold or an entry is missing.

## 6. Logging and Monitoring

- Enhance logging to provide clear insights into cache hits and misses for both types of cache.
- Log when "available raw segments" are being used to proactively suggest or process data.
- Monitor cache size and eviction rates in Redis.

---

_Last updated: Sun May 11 2025_
