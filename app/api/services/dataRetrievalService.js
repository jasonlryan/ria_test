/**
 * Data Retrieval Service
 * Handles data retrieval, smart filtering, caching, and query processing.
 * Encapsulates logic for identifying relevant files, loading data, filtering by segments,
 * and processing queries including starter questions.
 */

import fs from "fs";
import path from "path";
import logger from "../../../utils/logger";
import {
  getCachedFilesForThread,
  updateThreadCache,
} from "../../../utils/cache-utils";
import {
  identifyRelevantFiles,
  getPrecompiledStarterData,
  isStarterQuestion,
  processQueryWithData,
} from "../../../utils/openai/retrieval";
import { DEFAULT_SEGMENTS } from "../../../utils/data/segment_keys";

export class DataRetrievalService {
  constructor() {}

  /**
   * Identify relevant data files based on a query and context.
   * @param {string} query
   * @param {string} context
   * @param {boolean} isFollowUp
   * @param {string} previousQuery
   * @param {string} previousAssistantResponse
   * @returns {Promise<object>} file IDs, matched topics, explanation
   */
  async identifyRelevantFiles(
    query,
    context,
    isFollowUp = false,
    previousQuery = "",
    previousAssistantResponse = ""
  ) {
    return identifyRelevantFiles(
      query,
      context,
      isFollowUp,
      previousQuery,
      previousAssistantResponse
    );
  }

  /**
   * Load data files from filesystem or API.
   * @param {string[]} fileIds
   * @returns {Promise<object[]>} loaded data files
   */
  async loadDataFiles(fileIds) {
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    const files = [];

    for (const fileId of fileIds) {
      const fileName = fileId.endsWith(".json") ? fileId : fileId + ".json";
      const filePath = path.join(dataDir, fileName);

      try {
        if (!fs.existsSync(filePath)) {
          logger.error(`File does not exist: ${filePath}`);
          continue;
        }
        const fileContent = fs.readFileSync(filePath, "utf8");
        const jsonData = JSON.parse(fileContent);
        files.push({
          id: fileId.replace(/\.json$/, ""),
          data: jsonData,
        });
      } catch (error) {
        logger.error(`Error loading file ${filePath}:`, error);
        continue;
      }
    }

    return files;
  }

  /**
   * Filter loaded data by demographic segments.
   * @param {object} loadedData
   * @param {string[]} segments
   * @returns {object} filtered data and stats
   */
  filterDataBySegments(loadedData, segments) {
    // This function can call getSpecificData or similar filtering logic
    // For now, delegate to processQueryWithData or implement filtering here
    // Placeholder: return loadedData as-is
    return loadedData;
  }

  /**
   * Process a query with data retrieval, filtering, and caching.
   * @param {string} query
   * @param {string} context
   * @param {string[]} cachedFileIds
   * @param {string} threadId
   * @param {boolean} isFollowUp
   * @param {string} previousQuery
   * @param {string} previousAssistantResponse
   * @returns {Promise<object>} processed result
   */
  async processQueryWithData(
    query,
    context,
    cachedFileIds = [],
    threadId = "default",
    isFollowUp = false,
    previousQuery = "",
    previousAssistantResponse = ""
  ) {
    // Step 1: Retrieve existing cache for the thread
    const cacheEntry = await this.getCachedFiles(threadId);

    // Step 2: Extract requested segments from query intent or use default
    const requestedSegments =
      isFollowUp && previousQuery
        ? this.extractSegmentsFromQuery(previousQuery)
        : DEFAULT_SEGMENTS;

    // Step 3: Calculate missing segments for each cached file
    const missingSegmentsIndex = this.calculateMissingSegments(
      requestedSegments,
      cacheEntry
    );

    // Step 4: For each cached file with missing segments, load additional segments
    for (const file of cacheEntry) {
      if (missingSegmentsIndex[file.id]) {
        const missingSegments = missingSegmentsIndex[file.id];
        const additionalData = await this.loadAdditionalSegments(
          file.id,
          missingSegments
        );
        this.mergeFileSegments(file, additionalData, missingSegments);
      }
    }

    // Step 5: Proceed with existing processQueryWithData logic
    return processQueryWithData(
      query,
      context,
      cachedFileIds,
      threadId,
      isFollowUp,
      previousQuery,
      previousAssistantResponse
    );
  }

  /**
   * Extracts requested segments from a query string.
   * @param {string} query
   * @returns {string[]} segments
   */
  extractSegmentsFromQuery(query) {
    // Implement logic to parse query and extract requested segments
    // Placeholder implementation
    return DEFAULT_SEGMENTS;
  }

  /**
   * Calculates missing segments for each cached file.
   * @param {string[]} requestedSegments
   * @param {CachedFile[]} cachedFiles
   * @returns {Object} mapping of fileId to missing segments
   */
  calculateMissingSegments(requestedSegments, cachedFiles) {
    const missingSegments = {};
    for (const file of cachedFiles) {
      const loaded = file.loadedSegments || new Set();
      const missing = requestedSegments.filter((seg) => !loaded.has(seg));
      if (missing.length > 0) {
        missingSegments[file.id] = missing;
      }
    }
    return missingSegments;
  }

  /**
   * Loads additional segments from disk for a specific file.
   * @param {string} fileId
   * @param {string[]} segments
   * @returns {Promise<Object>} segment data
   */
  async loadAdditionalSegments(fileId, segments) {
    // Implement targeted file read to extract only requested segments
    // Placeholder: load entire file for now
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    const fileName = fileId.endsWith(".json") ? fileId : `${fileId}.json`;
    const filePath = path.join(dataDir, fileName);
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileContent);
    // Extract only requested segments from jsonData
    const segmentData = {};
    for (const seg of segments) {
      if (jsonData[seg]) {
        segmentData[seg] = jsonData[seg];
      }
    }
    console.log(
      `[LazyLoad] Loaded additional segments for file ${fileId}: ${segments.join(
        ", "
      )}`
    );
    return segmentData;
  }

  /**
   * Merges additional segment data into an existing cached file.
   * @param {CachedFile} existingFile
   * @param {Object} newSegmentData
   * @param {string[]} newSegments
   */
  mergeFileSegments(existingFile, newSegmentData, newSegments) {
    if (!existingFile.data) {
      existingFile.data = {};
    }
    for (const seg of newSegments) {
      existingFile.data[seg] = newSegmentData[seg];
    }
    if (!existingFile.loadedSegments) {
      existingFile.loadedSegments = new Set();
    }
    newSegments.forEach((seg) => existingFile.loadedSegments.add(seg));
  }

  /**
   * Get cached file IDs for a thread.
   * @param {string} threadId
   * @returns {Promise<CachedFile[]>}
   */
  async getCachedFiles(threadId) {
    return getCachedFilesForThread(threadId);
  }

  /**
   * Update cached file IDs for a thread.
   * @param {string} threadId
   * @param {CachedFile[]} fileIds
   * @returns {Promise<void>}
   */
  async updateThreadCache(threadId, fileIds) {
    return updateThreadCache(threadId, fileIds);
  }
}

export default DataRetrievalService;
