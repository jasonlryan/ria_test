/**
 * Data Retrieval Service
 * Handles data retrieval, smart filtering, caching, and query processing.
 * Encapsulates logic for identifying relevant files, loading data, filtering by segments,
 * and processing queries including starter questions.
 * 
 * Last Updated: Sat June 1 2025
 */

import fs from "fs";
import path from "path";
import logger from "../../../utils/shared/logger";
import { UnifiedCache } from "../../../utils/cache/cache-utils";
import {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery,
} from "../../../utils/data/repository/adapters/retrieval-adapter";
import { DEFAULT_SEGMENTS } from "../../../utils/cache/segment_keys";
import {
  loadCompatibilityMapping,
  filterIncomparableFiles,
} from "../../../utils/compatibility/compatibility";
// Updated import to use the TypeScript implementation
import { SmartFilteringProcessor } from "../../../utils/data/repository/implementations/SmartFiltering";
import { unifiedOpenAIService } from "./unifiedOpenAIService";
import { FilterResult } from "../../../utils/data/repository/interfaces/FilterProcessor";
import OpenAI from 'openai';

// Define our own CompatibilityMetadata type since we can't locate the import
interface CompatibilityMetadata {
  isFullyCompatible: boolean;
  topicCompatibility: Record<string, {
    comparable: boolean;
    availableYears: string[];
    availableMarkets: string[];
    userMessage?: string;
  }>;
  segmentCompatibility: Record<string, {
    comparable: boolean;
    comparableValues: string[];
    userMessage: string;
  }>;
  mappingVersion?: string;
  assessedAt: number;
  error?: {
    type: string;
    message: string;
    details: string;
  };
}

// Create processor instance for filters
const smartFilteringProcessor = new SmartFilteringProcessor();

export class DataRetrievalService {
  constructor() {}

  /**
   * Process a query using the unified OpenAI service
   * @param prompt - The prompt text to process
   * @param options - Processing options
   * @returns The processed response
   */
  async processWithUnifiedService(prompt: string, options: any = {}): Promise<any> {
    const startTime = Date.now();
    try {
      // Prepare messages for the OpenAI API with proper typing
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
      throw error;
    }
  }

  /**
   * Identify relevant data files based on a query and context.
   * @param query - The query text
   * @param context - Context for the query
   * @param isFollowUp - Whether this is a follow-up query
   * @param previousQuery - The previous query if any
   * @param previousAssistantResponse - The previous assistant response if any
   * @returns file IDs, matched topics, explanation, and compatibility metadata
   */
  async identifyRelevantFiles(
    query: string,
    context: string,
    isFollowUp = false,
    previousQuery = "",
    previousAssistantResponse = ""
  ): Promise<any> {
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
    logger.info(
      `[COMPATIBILITY] Assessment for query: "${query.substring(0, 100)}..."`
    );
    logger.info(`[COMPATIBILITY] Topics: ${relevantTopics.join(", ")}`);
    logger.info(`[COMPATIBILITY] Segments: ${requestedSegments.join(", ")}`);
    logger.info(
      `[COMPATIBILITY] Is Fully Compatible: ${compatibilityMetadata.isFullyCompatible}`
    );

    if (!compatibilityMetadata.isFullyCompatible) {
      const incompatibleTopics = Object.keys(
        compatibilityMetadata.topicCompatibility || {}
      )
        .filter(
          (topic) =>
            compatibilityMetadata.topicCompatibility[topic].comparable === false
        )
        .join(", ");
      logger.info(`[COMPATIBILITY] Incompatible Topics: ${incompatibleTopics}`);
    }

    // Add compatibility metadata to the result
    return {
      ...fileIdentificationResult,
      compatibilityMetadata,
    };
  }

  /**
   * Assess data compatibility for the given topics and segments
   * @param topics - Topic IDs to check for compatibility
   * @param segments - Segment types to check for compatibility
   * @returns Compatibility metadata
   */
  assessCompatibility(topics: string[], segments: string[]): CompatibilityMetadata {
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
      } as CompatibilityMetadata;

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
        let comparableValues: string[] = [];
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
          details: error instanceof Error ? error.message : String(error),
        },
        topicCompatibility: {},
        segmentCompatibility: {},
        mappingVersion: "unknown",
        assessedAt: Date.now(),
      } as CompatibilityMetadata;
    }
  }

  /**
   * Load data files from filesystem or API.
   * @param fileIds - Array of file IDs to load
   * @returns loaded data files
   */
  async loadDataFiles(fileIds: string[]): Promise<any[]> {
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
   * @param loadedData - Loaded data files
   * @param segments - Segments to filter by
   * @returns Filtered data
   */
  filterDataBySegments(loadedData: any[], segments: string[]): any[] {
    logger.info(
      `[FILTERING] Filtering data by segments: ${JSON.stringify(segments)}`
    );

    try {
      // Use the TypeScript implementation
      const result = smartFilteringProcessor.filterDataBySegments(
        loadedData,
        { segments } as any
      );

      // Extract stats or use empty array as fallback
      return result.stats || [];
    } catch (error) {
      logger.error(
        `[FILTERING] Error filtering data by segments: ${error instanceof Error ? error.message : String(error)}`
      );
      // Return the original data on error
      return loadedData;
    }
  }

  /**
   * Process a query with the appropriate data
   * @param query - The query text
   * @param context - Context for the query
   * @param cachedFileIds - Array of cached file IDs
   * @param threadId - Thread ID for context
   * @param isFollowUp - Whether this is a follow-up query
   * @param previousQuery - The previous query if any
   * @param previousAssistantResponse - The previous assistant response if any
   * @returns Processed query result
   */
  async processQueryWithData(
    query: string,
    context: string,
    cachedFileIds: string[] = [],
    threadId: string = "default",
    isFollowUp: boolean = false,
    previousQuery: string = "",
    previousAssistantResponse: string = ""
  ): Promise<any> {
    // Fast path for starter questions
    if (isStarterQuestion(query)) {
      const starterCode = query.trim().toUpperCase();
      const precompiled = getPrecompiledStarterData(starterCode);
      if (precompiled) {
        logger.info(
          `Using precompiled data for starter question: ${starterCode}`
        );
        return precompiled;
      }
    }

    // Detect if this is a comparison query asking for 2024 data
    const isComparisonQuery = detectComparisonQuery(query);
    logger.info(
      `[DATA_RETRIEVAL] Query is comparison query: ${isComparisonQuery}`
    );

    // If we have precomputed identification, use it
    let fileIdResult = null;
    if (isFollowUp && cachedFileIds && cachedFileIds.length > 0) {
      logger.info(
        `[FOLLOW-UP] Using ${cachedFileIds.length} cached file IDs for thread ${threadId}`
      );

      // For follow-ups, reuse the cached file IDs
      fileIdResult = {
        file_ids: [...cachedFileIds],
        matched_topics: [],
        explanation: "Files from cache",
      };
    } else {
      // Otherwise identify files based on the query
      fileIdResult = await identifyRelevantFiles(
        query,
        context,
        isFollowUp,
        previousQuery,
        previousAssistantResponse
      );
    }

    // Explicitly filter 2024 files by default UNLESS this is a comparison query
    if (!isComparisonQuery) {
      // Only include 2025 files unless explicitly requesting 2024 data
      const has2024Reference = /\b2024\b/i.test(query);

      if (!has2024Reference && fileIdResult) {
        const original = fileIdResult?.file_ids?.length || 0;

        if (fileIdResult?.file_ids) {
          fileIdResult.file_ids = fileIdResult.file_ids.filter(
            (fileId) => !fileId.startsWith("2024_") && !fileId.includes("_2024")
          );

          // Log the filtering action
          if (original !== fileIdResult.file_ids.length) {
            logger.info(
              `[COMPATIBILITY] Filtered out ${
                original - fileIdResult.file_ids.length
              } files from 2024 (default behavior, not a comparison query)`
            );
          }
        }
      }
    } else {
      // This is a comparison query, so filter out incomparable files
      if (fileIdResult.file_ids.length > 1) {
        // Group files by year to detect mixed years
        const filesByYear: Record<string, string[]> = {};
        fileIdResult.file_ids.forEach((fileId: string) => {
          const year = fileId.startsWith("2024_")
            ? "2024"
            : fileId.startsWith("2025_")
            ? "2025"
            : "unknown";

          if (!filesByYear[year]) {
            filesByYear[year] = [];
          }
          filesByYear[year].push(fileId);
        });

        // If we have multiple years of data, apply compatibility filtering
        if (
          filesByYear["2024"] &&
          filesByYear["2025"] &&
          filesByYear["2024"].length > 0 &&
          filesByYear["2025"].length > 0
        ) {
          logger.info(
            `[COMPATIBILITY] Detected mixed years in comparison query. Filtering incomparable files.`
          );

          // Filter incomparable files
          const { filteredFileIds, incomparableTopicMessages } =
            filterIncomparableFiles(
              fileIdResult.file_ids,
              true // This is a comparison query
            );

          // Update the file IDs
          fileIdResult.file_ids = filteredFileIds;

          // Store incomparable topic messages for the prompt
          if (context) {
            (context as any).incomparableTopicMessages = incomparableTopicMessages;
          }
        }
      }
    }

    // Update the context with our compatibility checks
    const updatedContext = {
      ...(typeof context === 'string' ? { originalContext: context } : context),
      compatibilityChecked: true,
      isComparisonQuery,
    };

    // Delegate to the core retrieval implementation to avoid duplicated logic.
    const result = await processQueryWithData(
      query,
      context,
      cachedFileIds,
      threadId,
      isFollowUp,
      previousQuery,
      previousAssistantResponse
    );

    // Ensure we always return a valid object
    return (
      result || {
        processedData: [
          { id: "default-id", value: "No data found", messageType: "fallback" },
        ],
        relevantFiles: [{ id: "mock-file", segments: [{ label: "default" }] }],
        isComparison: isComparisonQuery,
      }
    );
  }
} 