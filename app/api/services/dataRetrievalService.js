/**
 * Data Retrieval Service
 * Handles data retrieval, smart filtering, caching, and query processing.
 * Encapsulates logic for identifying relevant files, loading data, filtering by segments,
 * and processing queries including starter questions.
 */

import fs from "fs";
import path from "path";
import logger from "../../utils/logger";
import {
  getCachedFilesForThread,
  updateThreadCache,
} from "../../utils/cache-utils";
import {
  identifyRelevantFiles,
  getPrecompiledStarterData,
  isStarterQuestion,
  processQueryWithData,
} from "../../utils/openai/retrieval";
import { DEFAULT_SEGMENTS } from "../../utils/data/segment_keys";

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
    // Delegate to existing retrieval.js processQueryWithData function
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
   * Retrieve precompiled starter question data.
   * @param {string} code
   * @returns {object|null}
   */
  getPrecompiledStarterData(code) {
    return getPrecompiledStarterData(code);
  }

  /**
   * Check if a prompt is a starter question code.
   * @param {string} prompt
   * @returns {boolean}
   */
  isStarterQuestion(prompt) {
    return isStarterQuestion(prompt);
  }

  /**
   * Get cached file IDs for a thread.
   * @param {string} threadId
   * @returns {Promise<string[]>}
   */
  async getCachedFiles(threadId) {
    return getCachedFilesForThread(threadId);
  }

  /**
   * Update cached file IDs for a thread.
   * @param {string} threadId
   * @param {string[]} fileIds
   * @returns {Promise<void>}
   */
  async updateThreadCache(threadId, fileIds) {
    return updateThreadCache(threadId, fileIds);
  }
}

export default DataRetrievalService;
