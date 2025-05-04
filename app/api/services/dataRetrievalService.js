/**
 * Data Retrieval Service
 * Handles data retrieval, smart filtering, caching, and query processing.
 * Encapsulates logic for identifying relevant files, loading data, filtering by segments,
 * and processing queries including starter questions.
 */

import fs from "fs";
import path from "path";
import logger from "../../../utils/shared/logger";
import { UnifiedCache } from "../../../utils/cache/cache-utils";
import {
  identifyRelevantFiles,
  getPrecompiledStarterData,
  isStarterQuestion,
  processQueryWithData,
} from "../../../utils/openai/retrieval";
import { DEFAULT_SEGMENTS } from "../../../utils/cache/segment_keys";
import {
  logCompatibilityAssessment,
  logCompatibilityCache,
  logCompatibilityToFile,
  logCompatibilityInPrompt,
} from "../../../utils/compatibility/compatibilityLogger";
import { getSpecificData } from "../../../utils/data/smart_filtering";
import { unifiedOpenAIService } from "../services/unifiedOpenAIService";
import { migrationMonitor } from "../../../utils/shared/monitoring";

// Import compatibility types (using JS comment format since we're in a .js file)
// @ts-check
// const { CompatibilityMetadata } = require("../../../utils/compatibility/compatibilityTypes");

export class DataRetrievalService {
  constructor() {}

  /**
   * Process a query using the unified OpenAI service
   * @param {string} prompt - The prompt text to process
   * @param {object} options - Processing options
   * @returns {Promise<object>} The processed response
   */
  async processWithUnifiedService(prompt, options = {}) {
    const startTime = Date.now();
    try {
      // Prepare messages for the OpenAI API
      const messages = [
        {
          role: "system",
          content: "You are a helpful assistant analyzing survey data.",
        },
        { role: "user", content: prompt },
      ];

      // Add any additional context messages if provided
      if (options.contextMessages && Array.isArray(options.contextMessages)) {
        messages.push(...options.contextMessages);
      }

      // Process with unified service
      const result = await unifiedOpenAIService.createChatCompletion(messages, {
        model: options.model || "gpt-4.1-mini",
        temperature: options.temperature || 0.5,
        max_tokens: options.maxTokens || 1500,
      });

      // Track performance
      const duration = Date.now() - startTime;
      logger.info(
        `[DATA_RETRIEVAL] Unified service processed query in ${duration}ms`
      );

      return result.data;
    } catch (error) {
      logger.error(
        `[DATA_RETRIEVAL] Error processing with unified service: ${error.message}`
      );
      migrationMonitor.trackError(
        "unified",
        "processWithUnifiedService",
        error
      );
      throw error;
    }
  }

  /**
   * Identify relevant data files based on a query and context.
   * @param {string} query
   * @param {string} context
   * @param {boolean} isFollowUp
   * @param {string} previousQuery
   * @param {string} previousAssistantResponse
   * @returns {Promise<object>} file IDs, matched topics, explanation, and compatibility metadata
   */
  async identifyRelevantFiles(
    query,
    context,
    isFollowUp = false,
    previousQuery = "",
    previousAssistantResponse = ""
  ) {
    // Get the file identification result from the existing function
    const fileIdentificationResult = await identifyRelevantFiles(
      query,
      context,
      isFollowUp,
      previousQuery,
      previousAssistantResponse
    );

    // Extract topics and segments for compatibility assessment
    const relevantTopics = fileIdentificationResult.matched_topics || [];
    const requestedSegments =
      fileIdentificationResult.segments || DEFAULT_SEGMENTS;

    // Assess compatibility for the identified topics and segments
    const compatibilityMetadata = this.assessCompatibility(
      relevantTopics,
      requestedSegments
    );

    // Log compatibility assessment results
    logCompatibilityAssessment(
      query,
      compatibilityMetadata,
      relevantTopics,
      requestedSegments
    );

    // Add compatibility metadata to the result
    return {
      ...fileIdentificationResult,
      compatibilityMetadata,
    };
  }

  /**
   * Assess data compatibility for the given topics and segments
   * @param {string[]} topics - Topic IDs to check for compatibility
   * @param {string[]} segments - Segment types to check for compatibility
   * @returns {object} Compatibility metadata
   */
  assessCompatibility(topics, segments) {
    try {
      const mappingPath = path.join(
        process.cwd(),
        "scripts",
        "reference files",
        "2025",
        "canonical_topic_mapping.json"
      );

      const mappingData = fs.readFileSync(mappingPath, "utf8");
      const mapping = JSON.parse(mappingData);
      const mappingVersion = mapping.metadata?.version || "1.0";

      // Initialize compatibility metadata
      const compatibilityMetadata = {
        isFullyCompatible: true,
        topicCompatibility: {},
        segmentCompatibility: {},
        mappingVersion,
        assessedAt: Date.now(),
      };

      // Check topic compatibility
      for (const topicId of topics) {
        let foundTopic = null;

        // Find the topic in the mapping
        for (const theme of mapping.themes || []) {
          for (const topic of theme.topics || []) {
            if (topic.id === topicId) {
              foundTopic = topic;
              break;
            }
          }
          if (foundTopic) break;
        }

        if (!foundTopic) {
          // Topic not found in mapping
          compatibilityMetadata.topicCompatibility[topicId] = {
            comparable: false,
            availableYears: [],
            availableMarkets: [],
            userMessage:
              "This topic is not available in the canonical mapping.",
          };
          compatibilityMetadata.isFullyCompatible = false;
          continue;
        }

        // Get topic compatibility information
        const isComparable = foundTopic.comparable || false;
        const availableYears = [];
        if (foundTopic.mapping?.["2024"]) availableYears.push("2024");
        if (foundTopic.mapping?.["2025"]) availableYears.push("2025");

        const availableMarkets = foundTopic.availableMarkets || [];
        const userMessage =
          foundTopic.userMessage ||
          (isComparable
            ? "Data can be compared across years."
            : "Year‑on‑year comparisons not available for this topic.");

        compatibilityMetadata.topicCompatibility[topicId] = {
          comparable: isComparable,
          availableYears,
          availableMarkets,
          userMessage,
        };

        // Update overall compatibility flag
        if (!isComparable && availableYears.length > 1) {
          compatibilityMetadata.isFullyCompatible = false;
        }
      }

      // Check segment compatibility
      for (const segmentType of segments) {
        let isSegmentCompatible = true;
        let comparableValues = [];
        let userMessage = "";

        // Check segment compatibility based on mapping rules
        switch (segmentType) {
          case "country":
            // Only comparable markets can be compared across years
            comparableValues = mapping.dataAccess?.comparableMarkets || [];
            isSegmentCompatible = comparableValues.length > 0;
            userMessage = isSegmentCompatible
              ? "Country data can be compared across years for these markets: " +
                comparableValues.join(", ")
              : "No comparable country data available across years.";
            break;

          case "age":
          case "gender":
          case "sector":
          case "org_size":
          case "job_level":
          case "relationship_status":
          case "education":
          case "generation":
          case "employment_status":
            // These demographics are accessible within a single data file
            // and generally comparable across years unless specified otherwise
            isSegmentCompatible = true;
            userMessage = `${segmentType} data is available for analysis and can typically be compared across years.`;
            break;

          default:
            // For any unknown segments, default to allowing access
            // but with a note about potential cross-year comparison issues
            isSegmentCompatible = true;
            userMessage = `${segmentType} data is available, but cross-year comparisons should be made with caution.`;
        }

        compatibilityMetadata.segmentCompatibility[segmentType] = {
          comparable: isSegmentCompatible,
          comparableValues,
          userMessage,
        };

        // Only update isFullyCompatible for cross-year compatibility issues when they actually matter
        // A segment being potentially incomparable across years shouldn't block access to that segment
        // within a single year's data file
        if (!isSegmentCompatible && segmentType === "country") {
          // Country is the only segment where incompatibility might legitimately prevent access
          compatibilityMetadata.isFullyCompatible = false;
        }
      }

      return compatibilityMetadata;
    } catch (error) {
      logger.error(`Compatibility assessment error: ${error.message}`);
      return {
        isFullyCompatible: false,
        error: {
          type: "TECHNICAL",
          message: "Unable to assess compatibility due to a technical issue",
          details: error.message,
        },
        topicCompatibility: {},
        segmentCompatibility: {},
        mappingVersion: "unknown",
        assessedAt: Date.now(),
      };
    }
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
   * Filter data by segments
   * @param {object[]} loadedData - Loaded data files
   * @param {string[]} segments - Segments to filter by
   * @returns {object[]} Filtered data
   */
  filterDataBySegments(loadedData, segments) {
    // Call the getSpecificData function from smart_filtering
    const { getSpecificData } = require("../../../utils/data/smart_filtering");

    logger.info(
      `[FILTERING] Filtering data by segments: ${JSON.stringify(segments)}`
    );

    try {
      // Convert loadedData to format expected by getSpecificData
      const formattedData = {
        files: loadedData,
      };

      const result = getSpecificData(formattedData, { demographics: segments });

      // Log found/missing segments
      if (segments && segments.length > 0) {
        const foundSegments = new Set();

        // Extract found segments from filtered data
        if (result.stats && result.stats.length > 0) {
          result.stats.forEach((stat) => {
            if (stat.category) {
              foundSegments.add(stat.category);
            }
          });
        }

        const foundSegmentsArray = Array.from(foundSegments);
        const missingSegments = segments.filter(
          (seg) => !foundSegmentsArray.includes(seg)
        );

        logger.info(
          `[FILTERING] Found segments: ${JSON.stringify(foundSegmentsArray)}`
        );
        if (missingSegments.length > 0) {
          logger.warn(
            `[FILTERING] Missing requested segments: ${JSON.stringify(
              missingSegments
            )}`
          );
        }
      }

      return result.stats || [];
    } catch (error) {
      logger.error(
        `[FILTERING] Error filtering data by segments: ${error.message}`
      );
      // Return the original data on error
      return loadedData;
    }
  }

  /**
   * Process a query with the appropriate data
   * @param {string} query
   * @param {string} context
   * @param {Array<string>} cachedFileIds
   * @param {string} threadId
   * @param {boolean} isFollowUp
   * @param {string} previousQuery
   * @param {string} previousAssistantResponse
   * @returns {Promise<object>}
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
    const startTime = Date.now();

    try {
      // Check if this is a starter question (unchanged logic)
      if (isStarterQuestion(query)) {
        const starterCode = query.trim().toUpperCase();
        const precompiled = getPrecompiledStarterData(starterCode);

        if (precompiled) {
          logger.info(
            `[DATA_RETRIEVAL] Using precompiled data for starter question: ${starterCode}`
          );
          return precompiled;
        }
      }

      // Get cached files from thread if available
      let cachedFiles = [];
      if (cachedFileIds.length === 0) {
        cachedFiles = await this.getCachedFiles(threadId);
        cachedFileIds = cachedFiles.map((file) => file.fileId);
      }

      // Identify relevant files
      const fileIdentificationResult = await this.identifyRelevantFiles(
        query,
        context,
        isFollowUp,
        previousQuery,
        previousAssistantResponse
      );

      const fileIds = fileIdentificationResult.file_ids || [];
      const explanation = fileIdentificationResult.explanation || "";
      const requestedSegments =
        fileIdentificationResult.segments || DEFAULT_SEGMENTS;
      const isComparison = this.isComparisonQuery(query);
      const compatibilityMetadata =
        fileIdentificationResult.compatibilityMetadata;

      logger.info(
        `[DATA_RETRIEVAL] Identified ${
          fileIds.length
        } relevant files for query "${query.substring(0, 50)}..."`
      );

      // Load data from files
      const loadedData = await this.loadDataFiles(fileIds);

      // Filter data by segments
      const filteredData = this.filterDataBySegments(
        loadedData,
        requestedSegments
      );

      // Process the data using unified OpenAI service instead of direct API
      let analysis;
      try {
        // Create a rich prompt with all the data context
        let prompt = query;
        if (filteredData.stats && filteredData.stats.length > 0) {
          prompt += "\n\n### Data:\n";
          prompt += JSON.stringify(filteredData.stats, null, 2);
        }

        if (compatibilityMetadata) {
          prompt += "\n\n### Compatibility Information:\n";
          prompt += JSON.stringify(compatibilityMetadata, null, 2);

          // Add warnings about incomparable topics
          if (!compatibilityMetadata.isFullyCompatible) {
            prompt +=
              "\n\nWARNING: Some topics cannot be compared between years. Check compatibility metadata.";
          }
        }

        // Add additional context for follow-up queries
        const contextMessages = [];
        if (isFollowUp && previousQuery && previousAssistantResponse) {
          contextMessages.push(
            { role: "user", content: previousQuery },
            { role: "assistant", content: previousAssistantResponse }
          );
        }

        // Process with unified service
        const result = await this.processWithUnifiedService(prompt, {
          contextMessages,
          model: isComparison ? "gpt-4.1-turbo" : "gpt-4.1-mini",
        });

        analysis = result.content || "";
      } catch (error) {
        logger.error(
          `[DATA_RETRIEVAL] Error processing query: ${error.message}`
        );
        analysis = `Sorry, I encountered an error analyzing the data: ${error.message}`;
      }

      // Update thread cache with new data
      if (loadedData.length > 0) {
        await this.updateThreadCache(threadId, loadedData);
      }

      // Prepare response
      const response = {
        query,
        result: analysis,
        metadata: {
          explanation,
          processingTimeMs: Date.now() - startTime,
          fileCount: fileIds.length,
          isComparison,
          isFollowUp,
          source: "unified-service",
        },
        compatibilityInfo: compatibilityMetadata,
      };

      return response;
    } catch (error) {
      logger.error(
        `[DATA_RETRIEVAL] Error in processQueryWithData: ${error.message}`
      );
      return {
        query,
        result: `Sorry, I encountered an error: ${error.message}`,
        metadata: {
          error: error.message,
          processingTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Checks if a query is asking for a comparison between years
   * @param {string} query - The user query
   * @returns {boolean} - Whether the query is asking for a comparison
   */
  isComparisonQuery(query) {
    if (!query) return false;

    // Normalize the query
    const normalizedQuery = query.toLowerCase();

    // Patterns that indicate a comparison query
    const comparisonPatterns = [
      // Year-specific patterns
      /compare.*2024.*2025/i,
      /compare.*2025.*2024/i,
      /comparison.*2024.*2025/i,
      /comparison.*2025.*2024/i,
      /2024.*compared to.*2025/i,
      /2025.*compared to.*2024/i,
      /2024.*vs\.?.*2025/i,
      /2025.*vs\.?.*2024/i,
      /2024.*versus.*2025/i,
      /2025.*versus.*2024/i,

      // Direct comparison requests
      /\bcompare with 2024\b/i,
      /\bcompare to 2024\b/i,
      /\bcompare with previous year\b/i,
      /\bcompare to previous year\b/i,
      /\bcompare with last year\b/i,
      /\bcompare to last year\b/i,

      // Evolution/between patterns
      /\bbetween 2024 and 2025\b/i,
      /\bbetween 2025 and 2024\b/i,
      /\bfrom 2024 to 2025\b/i,
      /\bfrom 2025 to 2024\b/i,
      /\b2024 to 2025\b/i,
      /\b2025 to 2024\b/i,
      /\bevolution.*between/i,

      // Generic time comparison patterns
      /change(d|s)? (from|since|over|between)/i,
      /difference(s)? (from|since|over|between)/i,
      /trend(s)? (from|since|over|between)/i,
      /evolution (from|since|over|between)/i,
      /compare (\w+ )?(year|time)/i,
      /comparison (\w+ )?(year|time)/i,
      /previous (year|time)/i,
      /year[\s-]on[\s-]year/i,
      /year[\s-]over[\s-]year/i,
      /over time/i,
      /across years/i,
      /across time/i,

      // Follow-up comparison queries
      /^can you compare/i,
      /^compare with/i,
      /^compare to/i,
      /^how does this compare/i,
      /^what about (in )?2024/i,
      /^what about (the )?(previous|last) year/i,
    ];

    // Check if any comparison pattern matches
    return comparisonPatterns.some((pattern) => pattern.test(normalizedQuery));
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
    // NOTE: All segments should be accessible within a single file regardless of cross-year
    // compatibility concerns. Segment compatibility should only affect cross-year comparisons,
    // not whether a segment can be retrieved from an individual file.

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
    logger.info(
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
   * Get cached files for a thread
   * @param {string} threadId - Thread ID
   * @returns {Promise<Array>} Array of cached files
   */
  async getCachedFiles(threadId) {
    return UnifiedCache.getCachedFilesForThread(threadId);
  }

  /**
   * Update thread cache with files
   * @param {string} threadId - Thread ID
   * @param {Array} files - Files to cache
   * @returns {Promise<boolean>} Success status
   */
  async updateThreadCache(threadId, files) {
    try {
      // Convert loadedData array to format expected by the cache system
      const cachedFiles = files.map((file) => {
        // Format loadedData to CachedFile structure
        return {
          id: file.id,
          fileId: file.id, // Adding fileId for compatibility with some parts of the codebase
          data: file.data || {},
          loadedSegments: new Set(Object.keys(file.data || {})),
          availableSegments: new Set(Object.keys(file.data || {})),
        };
      });

      // Log the conversion for debugging
      logger.info(`[CACHE] Formatted ${files.length} files for thread cache`);

      // Update the thread cache with properly formatted files
      return UnifiedCache.updateThreadWithFiles(threadId, cachedFiles);
    } catch (error) {
      logger.error(`[CACHE] Error updating thread cache: ${error.message}`);
      return false;
    }
  }
}

export default DataRetrievalService;
