/**
 * Chat Assistant Controller
 * Handles OpenAI Assistant interactions, message processing,
 * thread management, tool call handling, and streaming responses.
 * Central orchestration point for the entire chat assistant flow.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import logger from "../../../utils/shared/logger";
import { logPerformanceMetrics, logPerformanceToFile } from "../../../utils/shared/loggerHelpers";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";
import { sanitizeOutput, isJsonContent } from "../../../utils/shared/utils";
import {
  processQueryWithData,
  identifyRelevantFiles,
  getPrecompiledStarterData,
  isStarterQuestion,
  detectComparisonQuery,
  fileCompatibilityData,
} from "../../../utils/openai/retrieval";
import {
  getCachedFilesForThread,
  updateThreadCache,
  CachedFile,
  updateThreadWithContext,
  getThreadContext
} from "../../../utils/cache/cache-utils";
import { buildPromptWithFilteredData } from "../../../utils/openai/promptUtils";
import { unifiedOpenAIService, RunStatus } from "../services/unifiedOpenAIService";
import { isFeatureEnabled } from "../../../utils/shared/feature-flags";
import { migrationMonitor } from "../../../utils/shared/monitoring";
import { threadMetaKey } from "../../../utils/cache/key-schema";
import kvClient from "../../../utils/cache/kvClient";
import { normalizeQueryText, createThreadContext } from "../../../utils/shared/queryUtils";

const OPENAI_TIMEOUT_MS = 90000;
const isDirectMode = process.env.FILE_ACCESS_MODE === "direct";
const forceStandardMode = true;
const { DEFAULT_SEGMENTS, CANONICAL_SEGMENTS } = require("../../../utils/cache/segment_keys");

/**
 * Log starter question invocations to a file
 */
async function logStarterQuestionInvocation({
  starterQuestionCode,
  question,
  assistantId,
  threadId,
  dataFiles,
  stats,
  timestamp = new Date().toISOString()
}: {
  starterQuestionCode: string;
  question: string;
  assistantId: string;
  threadId: string;
  dataFiles: string[];
  stats: any;
  timestamp?: string;
}) {
  if (process.env.VERCEL) return;
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'starter_question_invocations.log');
    const logEntry = JSON.stringify({
      timestamp,
      starterQuestionCode,
      question,
      assistantId,
      threadId,
      dataFiles,
      stats
    }) + '\n';
    await fs.promises.mkdir(logDir, { recursive: true });
    await fs.promises.appendFile(logFile, logEntry, 'utf8');
  } catch (err) {
    logger.error('Error writing starter question invocation log:', err);
  }
}

function isTerminalStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "expired";
}

function shouldContinuePolling(status: RunStatus, messageReceived: boolean): boolean {
  const terminalStatuses: RunStatus[] = ["completed", "failed", "cancelled", "expired"];
  return !messageReceived && !terminalStatuses.includes(status);
}

/**
 * Determines if a query represents a completely new topic
 * rather than a follow-up on the existing topic
 * @param currentQuery Current user query
 * @param previousQuery Previous user query
 * @returns True if this is likely a new topic
 */
function isNewTopicQuery(currentQuery: string, previousQuery: string): boolean {
  if (!previousQuery || previousQuery.trim().length === 0) {
    return true;
  }
  
  // Simple semantic similarity check - if queries share very few words, likely new topic
  const currentWords = new Set(currentQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const previousWords = new Set(previousQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  // Count overlap
  let overlap = 0;
  for (const word of currentWords) {
    if (previousWords.has(word)) {
      overlap++;
    }
  }
  
  // If very low word overlap ratio, it's likely a new topic
  const overlapRatio = overlap / Math.max(currentWords.size, 1);
  logger.info(`[TOPIC_CHECK] Query overlap ratio: ${overlapRatio.toFixed(2)} (${overlap}/${currentWords.size} words)`);
  
  return overlapRatio < 0.15; // Threshold for new topic
}

export async function postHandler(request: NextRequest) {
  const startTime = Date.now();
  const apiStartTime = Date.now();
  try {
    let perfTimings = {
      requestStart: apiStartTime,
      runCreated: 0,
      pollStart: 0,
      firstPoll: 0,
      messageReceived: 0,
      totalTime: 0,
      pollingInterval: 250,
    };

    const body = await request.json();
    let { assistantId, threadId, content } = body;

    if (!content) {
      return formatBadRequestResponse("Missing required field: content");
    }

    let previousQuery = "";

    // Initialize context object
    let context = {
      normalizedCurrentQuery: normalizeQueryText(content),
      normalizedPreviousQuery: "",
      previousResponse: "",
      isFollowUp: !!threadId
    };

    // Retrieve messages for context when this is a follow-up
    if (context.isFollowUp) {
      try {
        const messagesResponse = await unifiedOpenAIService.listMessages(
          threadId,
          { limit: 4 }
        );
        const messages = messagesResponse.data.data;

        // Extract previous query and response
        for (let i = 0; i < messages.length - 1; i++) {
          if (messages[i].role === "assistant" && messages[i + 1].role === "user") {
            const assistantContent = messages[i].content?.[0];
            const userContent = messages[i + 1].content?.[0];

            if (assistantContent?.type === "text" && userContent?.type === "text") {
              context.previousResponse = assistantContent.text.value;
              const rawPreviousQuery = userContent.text.value;
              context.normalizedPreviousQuery = normalizeQueryText(rawPreviousQuery);
              previousQuery = context.normalizedPreviousQuery; // For compatibility with existing code
              
              logger.info(`[CONTEXT] Raw previous query: "${rawPreviousQuery.substring(0, 50)}..."`);
              logger.info(`[CONTEXT] Normalized previous query: "${context.normalizedPreviousQuery.substring(0, 50)}..."`);
              break;
            }
          }
        }
        
        logger.info(`[CONTEXT] Raw current query: "${content.substring(0, 50)}..."`);
        logger.info(`[CONTEXT] Normalized current query: "${context.normalizedCurrentQuery.substring(0, 50)}..."`);
      } catch (error) {
        logger.error("Error retrieving and normalizing context:", error);
      }
    }

    logger.info(`[QUERY] Raw query: "${content.substring(0, 50)}..."`);
    logger.info(`[QUERY] Normalized: "${context.normalizedCurrentQuery.substring(0, 50)}..."`);

    const isDirectStarterQuestion = typeof content === "string" && /^SQ\d+$/i.test(content.trim());

    if (isDirectStarterQuestion || (typeof content === "string" && isStarterQuestion(content))) {
      const starterCode = typeof content === "string" ? content.trim().toUpperCase() : content;
      const precompiled = getPrecompiledStarterData(starterCode);

      if (precompiled) {
        logStarterQuestionInvocation({
          starterQuestionCode: precompiled.starterQuestionCode || starterCode,
          question: precompiled.question,
          assistantId,
          threadId,
          dataFiles: precompiled.data_files,
          stats: precompiled.stats,
        });

        const starterPromptPath = path.join(process.cwd(), "prompts", "starter_prompt_template.md");
        let starterPromptTemplate = "";
        try {
          starterPromptTemplate = await fs.promises.readFile(starterPromptPath, "utf8");
        } catch {
          starterPromptTemplate = "You are answering a precompiled starter question. Use the provided summary and stats to generate a narrative response.";
        }

        try {
          const fullPrompt = `${starterPromptTemplate}

---
Starter Question: ${precompiled.question || starterCode}
Summary: ${precompiled.summary}
Stats: ${JSON.stringify(precompiled.stats, null, 2)}
Matched Topics: ${precompiled.matched_topics ? precompiled.matched_topics.join(", ") : ""}
Data Files: ${precompiled.data_files ? precompiled.data_files.join(", ") : ""}
${precompiled.notes ? "Notes: " + precompiled.notes : ""}
`;
          body.content = fullPrompt;
          content = body.content;
        } catch {
          // Use original content if prompt construction fails
        }
      }
    }

    if (!assistantId) {
      return formatBadRequestResponse("Missing required field: assistantId");
    }

    const isFollowUp = !!threadId; // Determine if this is a follow-up based on threadId presence
    logger.info(`[REQUEST] New ${isFollowUp ? "follow-up" : "initial"} request | Assistant: ${assistantId}`);

    let finalThreadId = threadId;
    if (!finalThreadId) {
      const result = await unifiedOpenAIService.createThread();
      finalThreadId = result.data.id;
      logger.info(`[THREAD] Created new thread: ${finalThreadId}`);
      migrationMonitor.trackCall('unified', 'createThread', startTime);
      
      // Initialize thread context for new threads with both raw and normalized queries
      await updateThreadWithContext(finalThreadId, {
        previousQueries: [context.normalizedCurrentQuery],
        rawQueries: [content],
        isFollowUp: false,
        lastQueryTime: Date.now()
      });
      logger.info(`[THREAD] Initialized thread context with first query`);
    } else {
      logger.info(`[THREAD] Reusing existing thread: ${finalThreadId}`);
      
      // Get existing thread context
      const existingContext = await getThreadContext(finalThreadId);
      // Don't override context.isFollowUp if there are previous queries
      if (existingContext.previousQueries.length > 0) {
        context.isFollowUp = true;
      }
      logger.info(`[THREAD] Existing context - isFollowUp: ${context.isFollowUp}, previousQueries: ${existingContext.previousQueries.length}`);
    }

    // Flag and variable for early return
    let earlyResponse: NextResponse | null = null;

    // ===== START: Follow-up Comparison Incompatibility Check =====
    if (isFollowUp && finalThreadId) {
      // Check if this is a comparison query or a new topic
      const isComparison = detectComparisonQuery(context.normalizedCurrentQuery);
      const isNewTopic = isNewTopicQuery(context.normalizedCurrentQuery, context.normalizedPreviousQuery);
      
      if (isComparison) {
        logger.warn(
          `[CONTROLLER_COMPAT_CHECK] Detected follow-up comparison query for thread: ${finalThreadId}`
        );
        
        // Clear the thread compatibility metadata for comparison queries to force fresh check
        await clearThreadCacheForComparison(finalThreadId);
        
        try {
          const cachedFiles = await getCachedFilesForThread(finalThreadId);
          const cachedFileIds = Array.isArray(cachedFiles) ? cachedFiles.map((f) => f.id) : [];
          logger.info(
            `[CONTROLLER_COMPAT_CHECK] Found ${
              cachedFileIds.length
            } cached files: ${cachedFileIds.join(", ")}`
          );
          const incompatibleFilesInfo = [];
          let checkPerformed = false;
          if (
            cachedFileIds.length > 0 &&
            fileCompatibilityData?.fileCompatibility
          ) {
            checkPerformed = true;
            for (const fileId of cachedFileIds) {
              const normalizedId = String(fileId).replace(/\.json$/, "");
              const compatInfo =
                fileCompatibilityData.fileCompatibility[normalizedId];
              if (compatInfo && compatInfo.comparable === false) {
                 if (
                  compatInfo.topic &&
                  !incompatibleFilesInfo.some(
                    (item) => item.topic === compatInfo.topic
                  )
                ) {
                  incompatibleFilesInfo.push({
                    topic: compatInfo.topic,
                    message: compatInfo.userMessage || "Comparison not available due to methodology changes.",
                  });
                }
              }
            }
          } else {
             if (cachedFileIds.length === 0) {
                logger.warn(`[CONTROLLER_COMPAT_CHECK] Skipping check: No cached files found for thread ${finalThreadId}.`);
             } else {
                logger.error(`[CONTROLLER_COMPAT_CHECK] Skipping check: fileCompatibilityData not loaded or invalid!`);
             }
          }

          if (checkPerformed && incompatibleFilesInfo.length > 0) {
            const incompatibleTopics = incompatibleFilesInfo.map((f) => f.topic);
            logger.warn(
              `[CONTROLLER_COMPAT_GATE] Incompatible topics found: ${incompatibleTopics.join(", ")}. Using 2_data_incomparable.md prompt.`
            );

            try {
              const promptPath = path.join(process.cwd(), "utils", "openai", "2_data_incomparable.md");
              let promptTemplate = "";
              try {
                promptTemplate = fs.readFileSync(promptPath, "utf8");
              } catch (promptReadError) {
                logger.error(`[CONTROLLER_COMPAT_GATE] CRITICAL: Failed to read prompt file ${promptPath}: ${promptReadError.message}`);
                const fallbackMessage = `Comparison cannot be performed for topics: ${incompatibleTopics.join(', ')}. Data methodology has changed. [Error: Prompt file missing]`;
                earlyResponse = NextResponse.json({
                  incompatible_comparison: true,
                  message: fallbackMessage
                }, { status: 200 });
                logger.info(`[CONTROLLER_COMPAT_GATE] Prepared early JSON response (prompt read error).`);
              }
              
              if (promptTemplate && !earlyResponse) {
                const topicsListString = incompatibleTopics.map(topic => `- ${topic}`).join("\n");
                const formattedPrompt = promptTemplate.replace("{{INCOMPATIBLE_TOPICS_LIST}}", topicsListString);

                logger.info(`[CONTROLLER_COMPAT_GATE] Calling Chat Completions with 2_data_incomparable prompt.`);
                
                const completion = await unifiedOpenAIService.createChatCompletion([
                  {"role": "system", "content": "You are an AI assistant explaining data limitations."},
                  {"role": "user", "content": formattedPrompt}
                ], {
                  temperature: 0.2,
                  max_tokens: 150
                });

                const generatedMessage = completion.data.content?.trim() || 
                  "Comparison cannot be performed for the requested topics due to data methodology changes. [Error: Could not generate message]";
                
                logger.info(`[CONTROLLER_COMPAT_GATE] LLM generated warning: "${generatedMessage.substring(0,100)}..."`);

                earlyResponse = NextResponse.json({
                  incompatible_comparison: true, 
                  message: generatedMessage
                }, { status: 200 });
                
                logger.info(`[CONTROLLER_COMPAT_GATE] Prepared early JSON response (LLM success).`);
              }

            } catch (llmError) {
              logger.error(`[CONTROLLER_COMPAT_GATE] Error during LLM call for incompatibility message: ${llmError.message}`);
              const fallbackMessage = `Comparison cannot be performed for topics: ${incompatibleTopics.join(', ')}. Data methodology has changed. [Error: Failed to generate explanation]`;
              earlyResponse = NextResponse.json({
                incompatible_comparison: true,
                message: fallbackMessage
              }, { status: 200 });
              logger.info(`[CONTROLLER_COMPAT_GATE] Prepared early JSON response (LLM error).`);
            }
          } else {
            logger.info(
              `[CONTROLLER_COMPAT_CHECK] Check ran: ${checkPerformed}. Incompatible files found: ${incompatibleFilesInfo.length}. Proceeding with normal flow.`
            );
          }

        } catch (error) {
          logger.error(
            `[CONTROLLER_COMPAT_CHECK] Error during follow-up compatibility check logic: ${error.message}`,
            error
          );
        }
      } else if (isNewTopic) {
        // For new topics, we should reset the compatibility metadata but preserve files
        // This allows for a fresh topic assessment without breaking early returns
        logger.info(`[CONTROLLER_COMPAT_CHECK] Detected new topic query in existing thread: ${finalThreadId}`);
        await clearThreadCacheForComparison(finalThreadId);
      }
    }

    if (earlyResponse) {
      logger.info(`[CONTROLLER_FLOW] Executing early return due to compatibility gate.`);
      return earlyResponse;
    }
    logger.info(`[CONTROLLER_FLOW] Compatibility check passed or not applicable, proceeding to main flow.`);

    await unifiedOpenAIService.waitForNoActiveRuns(finalThreadId);

    let usedFileIds: string[] = [];
    let cachedFileIds: string[] = [];
    let originalUserContent = content;
    
    let result;

    if (!isStarterQuestion(content) && !(isDirectMode && !forceStandardMode)) {
      if (!isFollowUp) {
        const relevantFilesResult = await identifyRelevantFiles(
          context.normalizedCurrentQuery,
          "all-sector",
          context.isFollowUp,
          context.normalizedPreviousQuery,
          context.previousResponse
        );
        const fileIdArray = relevantFilesResult?.file_ids || [];

        const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
        const loadedFiles: CachedFile[] = [];

        for (const fileId of fileIdArray) {
          const fileName = fileId.endsWith(".json") ? fileId : `${fileId}.json`;
          const filePath = path.join(dataDir, fileName);

          try {
            if (!fs.existsSync(filePath)) {
              logger.error(`[DATA LOAD] File not found: ${filePath}`);
              continue;
            }

            const fileContent = fs.readFileSync(filePath, "utf8");
            let jsonData;
            try {
              jsonData = JSON.parse(fileContent);
            } catch (parseErr) {
              logger.error(`[DATA LOAD] JSON parse error for file ${filePath}:`, parseErr);
              continue;
            }

            const segments = DEFAULT_SEGMENTS;
            const cachedFile: CachedFile = {
              id: fileId,
              data: {},
              loadedSegments: new Set(segments),
              availableSegments: new Set(segments)
            };

            for (const segment of segments) {
              if (jsonData[segment]) {
                cachedFile.data[segment] = jsonData[segment];
              } else if (jsonData.responses) {
                cachedFile.data[segment] = { responses: jsonData.responses };
              } else {
                cachedFile.data[segment] = jsonData;
              }
            }

            loadedFiles.push(cachedFile);
          } catch (error) {
            logger.error(`[DATA LOAD] Error loading file ${filePath}:`, error);
          }
        }

        const cachedFilesForUpdate: CachedFile[] = loadedFiles.map(file => ({
          id: file.id,
          data: {},
          loadedSegments: file.loadedSegments,
          availableSegments: file.availableSegments
        }));

        await updateThreadCache(finalThreadId, cachedFilesForUpdate);

        result = await processQueryWithData(
          context.normalizedCurrentQuery,
          "all-sector",
          fileIdArray,
          finalThreadId,
          context.isFollowUp,
          context.normalizedPreviousQuery,
          context.previousResponse
        );

        if (result && result.out_of_scope === true) {
          return NextResponse.json({
            out_of_scope: true,
            message: result.out_of_scope_message || "Your query is outside the scope of workforce survey data.",
          });
        }

        usedFileIds = fileIdArray;
      } else {
        // Critical fix: Get cached files but ensure we actually have their IDs
        const cachedFiles = await getCachedFilesForThread(finalThreadId);
        cachedFileIds = cachedFiles.map(file => file.id);
        
        logger.info(`[FOLLOW-UP] Retrieved ${cachedFileIds.length} cached file IDs for thread ${finalThreadId}: ${cachedFileIds.join(', ')}`);
        
        // If no cached files, we need to identify them again - this is likely the root cause of follow-up failures
        if (cachedFileIds.length === 0) {
          logger.warn(`[FOLLOW-UP] No cached files found for thread ${finalThreadId}, re-identifying files`);
          const relevantFilesResult = await identifyRelevantFiles(
            context.normalizedCurrentQuery,
            "all-sector",
            true, // Force isFollowUp to true
            context.normalizedPreviousQuery,
            context.previousResponse
          );
          cachedFileIds = relevantFilesResult?.file_ids || [];
          logger.info(`[FOLLOW-UP] Re-identified ${cachedFileIds.length} files: ${cachedFileIds.join(', ')}`);
          
          // Add these files to the thread cache
          if (cachedFileIds.length > 0) {
            const cachedFilesForUpdate: CachedFile[] = cachedFileIds.map(id => ({
              id,
              data: {},
              loadedSegments: new Set(),
              availableSegments: new Set()
            }));
            await updateThreadCache(finalThreadId, cachedFilesForUpdate);
            logger.info(`[FOLLOW-UP] Updated thread cache with ${cachedFileIds.length} files`);
          }
        }

        result = await processQueryWithData(
          context.normalizedCurrentQuery,
          "all-sector",
          cachedFileIds,
          finalThreadId,
          true, // Force isFollowUp to true
          context.normalizedPreviousQuery,
          context.previousResponse
        );

        if (result && result.out_of_scope === true) {
          return NextResponse.json({
            out_of_scope: true,
            message: result.out_of_scope_message || "Your query is outside the scope of workforce survey data.",
          });
        }

        if (result.dataScope && result.dataScope.fileIds && result.dataScope.fileIds.size > 0) {
          usedFileIds = Array.from(result.dataScope.fileIds).map(String);
          const cachedFiles: CachedFile[] = usedFileIds.map(id => ({
            id,
            data: {},
            loadedSegments: new Set(),
            availableSegments: new Set()
          }));
          await updateThreadCache(finalThreadId, cachedFiles);
        }
      }

      const statCount = result.filteredData?.stats?.length || 0;
      const fileSet = new Set(result.filteredData?.stats?.map(stat => stat.fileId));
      const summaryText = result.filteredData?.summary || "No summary available.";
      logger.info(`[DATA] Data files used: ${Array.from(fileSet).join(", ")}`);

      const segmentsUsed = (result.segments && Array.isArray(result.segments))
        ? result.segments.join(", ")
        : DEFAULT_SEGMENTS.join(", ");
      logger.info(`[DATA] Segments selected: ${segmentsUsed}`);
      logger.info(`[DATA] Summary: ${summaryText}`);

      let filteredStats = [];
      if (result.stats && Array.isArray(result.stats) && result.stats.length > 0) {
        filteredStats = result.stats;
      } else if (result.filteredData?.filteredData && Array.isArray(result.filteredData.filteredData) && result.filteredData.filteredData.length > 0) {
        filteredStats = result.filteredData.filteredData;
      } else if (result.filteredData?.stats && Array.isArray(result.filteredData.stats) && result.filteredData.stats.length > 0) {
        filteredStats = result.filteredData.stats;
      }

      if (!Array.isArray(filteredStats) || filteredStats.length === 0) {
        logger.error(`[ERROR] Failed to get valid filteredStats from result: ${JSON.stringify({
          resultKeys: Object.keys(result),
          filteredDataType: typeof result.filteredData,
          filteredDataKeys: result.filteredData ? Object.keys(result.filteredData).join(", ") : "N/A",
          statsType: typeof result.stats,
        })}`);
      }

      const groupStats = (stats) => {
        if (!Array.isArray(stats)) {
          logger.error(`[ERROR] groupStats received non-array: ${typeof stats}`);
          return [];
        }
        
        const grouped = [];
        const keyMap = new Map();
        const segmentTypes = new Set();
        
        for (const stat of stats) {
          const key = `${stat.fileId}||${stat.question}||${stat.response}`;
          if (!keyMap.has(key)) {
            keyMap.set(key, {
              fileId: stat.fileId,
              question: stat.question || "Unknown question",
              response: stat.response || "Unknown response",
              segments: {},
            });
          }
          
          if (stat.segment) {
            let segmentType = "overall";
            let segmentValue = "overall";
            
            if (stat.segment !== "overall" && stat.segment.includes(":")) {
              const parts = stat.segment.split(":");
              segmentType = parts[0];
              segmentValue = parts[1];
              segmentTypes.add(segmentType);
            } else {
              segmentTypes.add("overall");
            }
            
            const entry = keyMap.get(key);
            if (!entry.segments[segmentType]) {
              entry.segments[segmentType] = {};
            }
            
            entry.segments[segmentType][segmentValue] = stat.percentage || stat.value;
          }
        }
        
        const missingCanonicalSegments = CANONICAL_SEGMENTS.filter(seg => !segmentTypes.has(seg));
        logger.info(`[SEGMENTS] Found in data: ${Array.from(segmentTypes).join(", ")}`);
        logger.info(`[SEGMENTS] Missing canonical segments: ${missingCanonicalSegments.join(", ")}`);
        
        return Array.from(keyMap.values());
      };

      const formatGroupedStats = (grouped) => {
        if (!Array.isArray(grouped)) {
          logger.error(`[ERROR] formatGroupedStats received non-array: ${typeof grouped}`);
          return "No data matched for the selected segments.";
        }
        
        return grouped.map((entry) => {
          const lines = [];
          
          lines.push(`Question: ${entry.question}`);
          lines.push(`Response: ${entry.response}`);
          
          if (entry.segments) {
            Object.entries(entry.segments).forEach(([segmentType, segmentValues]) => {
              if (Object.keys(segmentValues).length > 0) {
                const valuesText = Object.entries(segmentValues)
                  .map(([key, value]) => `${key}: ${value}%`)
                  .join(", ");
                
                lines.push(`- ${segmentType} { ${valuesText} }`);
              }
            });
          }
          
          return lines.join("\n");
        }).join("\n\n");
      };

      const groupedStats = groupStats(filteredStats);
      const statsPreview = groupedStats.length > 0
        ? formatGroupedStats(groupedStats)
        : "No data matched for the selected segments.";

      const standardModePrompt = statsPreview && statsPreview.trim().length > 0
        ? `${originalUserContent}

${statsPreview}`
        : `${originalUserContent}

No data matched for the selected segments.`;

      if (!process.env.VERCEL) {
        try {
          const logsDir = path.join(process.cwd(), "logs");
          const promptLogFile = path.join(logsDir, "assistant_full_prompt.txt");
          await fs.promises.mkdir(logsDir, { recursive: true });
          await fs.promises.writeFile(promptLogFile, standardModePrompt, "utf8");
        } catch (err) {
          logger.error("Failed to write full assistant prompt to log:", err);
        }
      }

      content = standardModePrompt;
    } else if (!isStarterQuestion(content) && isDirectMode && !forceStandardMode) {
      const cachedFiles = await getCachedFilesForThread(finalThreadId);
      cachedFileIds = cachedFiles.map(file => file.id);
      const relevantFilesResult = await identifyRelevantFiles(
        context.normalizedCurrentQuery,
        "all-sector",
        context.isFollowUp,
        context.normalizedPreviousQuery,
        context.previousResponse
      );
      if (relevantFilesResult?.file_ids) {
        usedFileIds = Array.from(new Set([...(cachedFileIds || []), ...(relevantFilesResult.file_ids || [])])).map(String);
      }
    }

    // Add debug info for follow-up queries
    logger.info(`=== FOLLOW-UP DEBUG ===`);
    logger.info(`THREAD ID: ${finalThreadId}`);
    logger.info(`IS FOLLOW-UP FLAG: ${isFollowUp}`);
    logger.info(`CACHED FILE IDS: ${JSON.stringify(cachedFileIds)}`);
    logger.info(`HAS PREVIOUS QUERY: ${context.normalizedPreviousQuery ? 'YES' : 'NO'}`);
    logger.info(`QUERY: "${context.normalizedCurrentQuery.substring(0, 50)}..."`);
    if (context.normalizedPreviousQuery) {
      logger.info(`PREV QUERY: "${context.normalizedPreviousQuery.substring(0, 50)}..."`);
    }
    logger.info(`=======================`);

    const createMessageResponse = await unifiedOpenAIService.createMessage(finalThreadId, {
      role: "user",
      content: content,
    });

    // Track context for all threads right after message creation
    // Store both the raw and normalized queries for future reference
    const queryContext = {
      rawQuery: content,
      normalizedQuery: context.normalizedCurrentQuery,
      timestamp: Date.now(),
    };

    // Ensure we store query context in thread metadata
    try {
      // Get existing thread context
      const threadContext = await getThreadContext(finalThreadId);
      const existingQueries = threadContext.previousQueries || [];
      
      // Store both current normalized query and raw query for future reference
      await updateThreadWithContext(finalThreadId, {
        previousQueries: [context.normalizedCurrentQuery, ...existingQueries].slice(0, 5),
        rawQueries: [content, ...(threadContext.rawQueries || [])].slice(0, 5),
        isFollowUp: true,
        lastQueryTime: Date.now()
      });
      
      logger.info(`[THREAD] Updated thread ${finalThreadId} with query context (total queries: ${existingQueries.length + 1})`);
    } catch (err) {
      logger.error(`[THREAD] Failed to update thread context: ${err.message}`);
    }

    const createRunResponse = await unifiedOpenAIService.createRun(finalThreadId, {
      assistant_id: assistantId,
      instructions: (isDirectMode && !forceStandardMode) ? "OPERATING MODE: DIRECT" : "OPERATING MODE: STANDARD",
    });

    const run = createRunResponse.data;
    let runStatus: RunStatus = run.status;

    perfTimings.runCreated = Date.now();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let messageReceived = false;
          let pollCount = 0;
          perfTimings.pollStart = Date.now();

          while (shouldContinuePolling(runStatus, messageReceived)) {
            try {
              if (pollCount === 0) {
                perfTimings.firstPoll = Date.now();
              }
              pollCount++;

              const currentRunResponse = await unifiedOpenAIService.retrieveRun(finalThreadId, run.id);
              const currentRun = currentRunResponse.data;
              runStatus = currentRun.status;

              controller.enqueue(
                encoder.encode(
                  `event: status\ndata: ${JSON.stringify({ status: runStatus })}\n\n`
                )
              );

              if (runStatus === "requires_action" && currentRun.required_action?.type === "submit_tool_outputs") {
                const toolCalls = currentRun.required_action.submit_tool_outputs.tool_calls;

                for (const toolCall of toolCalls) {
                  try {
                    const toolStartTime = performance.now();

                    const args = JSON.parse(toolCall.function.arguments);
                    const rawQuery = args.query;
                    const normalizedToolQuery = normalizeQueryText(rawQuery);

                    if (!normalizedToolQuery)
                      throw new Error("Missing query parameter");

                    logger.info(`[TOOL] Raw tool query: "${rawQuery.substring(0, 50)}..."`);
                    logger.info(`[TOOL] Normalized tool query: "${normalizedToolQuery.substring(0, 50)}..."`);

                    const cachedFileIds = await getCachedFilesForThread(
                      finalThreadId
                    );

                    if (isDirectMode && !forceStandardMode) {
                      const relevantFilesResult = await identifyRelevantFiles(
                        normalizedToolQuery,
                        "all-sector",
                        context.isFollowUp,
                        context.normalizedPreviousQuery,
                        context.previousResponse
                      );
                      const fileIdArray =
                        relevantFilesResult?.file_ids || [];

                      const allRelevantFileIds = Array.from(
                        new Set([
                          ...(cachedFileIds || []),
                          ...(fileIdArray || []),
                        ])
                      );

                      const cachedFiles: CachedFile[] = allRelevantFileIds.map(id => ({
                        id: String(id),
                        data: {},
                        loadedSegments: new Set(),
                        availableSegments: new Set()
                      }));
                      await updateThreadCache(finalThreadId, cachedFiles);

                      await unifiedOpenAIService.submitToolOutputs(
                        finalThreadId,
                        run.id,
                        {
                          tool_outputs: [
                            {
                              tool_call_id: toolCall.id,
                              output: JSON.stringify({
                                prompt: normalizedToolQuery,
                                file_ids: allRelevantFileIds,
                                matched_topics:
                                  relevantFilesResult.matched_topics || [],
                                is_followup_query:
                                  cachedFileIds.length > 0,
                                explanation:
                                  relevantFilesResult.explanation ||
                                  "No explanation provided",
                              }),
                            },
                          ],
                        }
                      );

                      const identificationTime =
                        performance.now() - toolStartTime;
                    } else {
                      const cachedFileIds = await getCachedFilesForThread(
                        finalThreadId
                      );
                      
                      logger.info(`[TOOL] Retrieved ${cachedFileIds.length} cached file IDs for tool call: ${cachedFileIds.join(', ')}`);
                      
                      let filesToUse = cachedFileIds;
                      
                      // If no cached files, reidentify them
                      if (filesToUse.length === 0) {
                        logger.warn(`[TOOL] No cached files for tool call, re-identifying files`);
                        const tempIdentification = await identifyRelevantFiles(
                          normalizedToolQuery,
                          "all-sector",
                          true, // Force follow-up to true for tools
                          context.normalizedPreviousQuery,
                          context.previousResponse
                        );
                        filesToUse = tempIdentification?.file_ids || [];
                        logger.info(`[TOOL] Re-identified ${filesToUse.length} files for tool call: ${filesToUse.join(', ')}`);
                      }
                      
                      const result = await processQueryWithData(
                        normalizedToolQuery,
                        "all-sector",
                        filesToUse,
                        finalThreadId,
                        true, // Always treat tool calls as follow-ups
                        context.normalizedPreviousQuery,
                        context.previousResponse
                      );

                      // Ensure we always update the cache with any new file IDs
                      if (result.dataScope && result.dataScope.fileIds) {
                        const fileIdsArray = Array.from(
                          result.dataScope.fileIds
                        ).map(String);
                        
                        // Only update if we have files
                        if (fileIdsArray.length > 0) {
                          const cachedFiles: CachedFile[] = fileIdsArray.map(id => ({
                            id,
                            data: {},
                            loadedSegments: new Set(),
                            availableSegments: new Set()
                          }));
                          await updateThreadCache(finalThreadId, cachedFiles);
                          logger.info(`[TOOL] Updated thread cache with ${fileIdsArray.length} files: ${fileIdsArray.join(', ')}`);
                        }
                      }

                      await unifiedOpenAIService.submitToolOutputs(
                        finalThreadId,
                        run.id,
                        {
                          tool_outputs: [
                            {
                              tool_call_id: toolCall.id,
                              output: JSON.stringify({
                                filteredData: result.filteredData,
                                queryIntent: result.queryIntent,
                                dataScope: result.dataScope,
                                cacheStatus: result.cacheStatus,
                                processing_time_ms:
                                  result.processing_time_ms,
                              }),
                            },
                          ],
                        }
                      );
                    }
                  } catch (error) {
                    logger.error("Error processing tool call:", error);
                    await unifiedOpenAIService.submitToolOutputs(
                      finalThreadId,
                      run.id,
                      {
                        tool_outputs: [
                          {
                            tool_call_id: toolCall.id,
                            output: JSON.stringify({ error: error.message }),
                          },
                        ],
                      }
                    );
                  }
                }
              }

              if (runStatus === "completed") {
                const messagesResponse = await unifiedOpenAIService.listMessages(finalThreadId);
                const messages = messagesResponse.data.data;
                if (messages && messages.length > 0) {
                  messageReceived = true;
                  perfTimings.messageReceived = Date.now();

                  const message = messages[0];
                  let fullText = "";

                  for (const content of message.content) {
                    if (content.type === "text") {
                      fullText += content.text.value;
                    }
                  }

                  const cleanText = sanitizeOutput(fullText);

                  const chunkSize = 40;
                  for (let i = 0; i < cleanText.length; i += chunkSize) {
                    const chunk = cleanText.substring(i, i + chunkSize);

                    controller.enqueue(
                      encoder.encode(
                        `event: textDelta\ndata: ${JSON.stringify({
                          value: chunk,
                        })}\n\n`
                      )
                    );

                    await new Promise((resolve) =>
                      setTimeout(resolve, 100)
                    );
                  }

                  controller.enqueue(
                    encoder.encode(
                      `event: messageDone\ndata: ${JSON.stringify({
                        id: message.id,
                        threadId: finalThreadId,
                        role: message.role,
                        content: cleanText,
                        createdAt: message.created_at,
                        runId: run.id,
                      })}\n\n`
                    )
                  );
                }
              }

              if (runStatus === "failed") {
                const errorMessage = currentRun.last_error
                  ? `${currentRun.last_error.code}: ${currentRun.last_error.message}`
                  : "Unknown error";

                controller.enqueue(
                  encoder.encode(
                    `event: error\ndata: ${JSON.stringify({
                      message: `Run failed: ${errorMessage}`,
                    })}\n\n`
                  )
                );
                break;
              }

              if (shouldContinuePolling(runStatus, messageReceived)) {
                await new Promise((resolve) => setTimeout(resolve, perfTimings.pollingInterval));
              }
            } catch (error) {
              logger.error("Error in polling loop:", error);
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({
                    message: `Error processing run: ${error.message}`,
                  })}\n\n`
                )
              );
              break;
            }
          }

          perfTimings.totalTime = Date.now() - apiStartTime;
        } catch (error) {
          logger.error("Stream start error:", error);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                message: `Stream error: ${error.message}`,
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    logger.error("Error processing request:", error);
    return formatErrorResponse("An error occurred while processing the request.");
  }
}

export async function putHandler(request: NextRequest) {
  const apiStartTime = Date.now();
  try {
    const body = await request.json();
    const { threadId, runId, toolOutputs } = body;

    if (!threadId || !runId || !toolOutputs) {
      return formatBadRequestResponse("Missing required fields");
    }

    await unifiedOpenAIService.submitToolOutputs(threadId, runId, { tool_outputs: toolOutputs });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[CHAT_ASSISTANT] Error in putHandler:', error);
    return formatErrorResponse(error);
  }
}

/**
 * Resets thread compatibility metadata for comparison queries or new topics
 * This preserves cached files but forces a fresh compatibility check
 * @param threadId Thread ID to reset compatibility metadata for
 */
async function clearThreadCacheForComparison(threadId: string): Promise<void> {
  try {
    logger.info(`[COMPAT_CACHE] Resetting thread compatibility metadata for thread ${threadId}`);
    
    // Get existing thread cache
    const metaKey = threadMetaKey(threadId);
    const existingCache = await kvClient.get(metaKey);
    
    if (!existingCache) {
      logger.info(`[COMPAT_CACHE] No existing cache found for thread ${threadId}`);
      return;
    }
    
    // Reset only compatibility metadata, preserve files
    const updatedCache = {
      ...existingCache,
      compatibilityMetadata: undefined,
      lastUpdated: Date.now()
    };
    
    // Update the thread cache with reset compatibility metadata
    await kvClient.set(metaKey, updatedCache, { ex: 60 * 60 * 24 }); // 24 hour TTL
    
    logger.info(`[COMPAT_CACHE] Successfully reset compatibility metadata while preserving cached files for thread ${threadId}`);
  } catch (error) {
    logger.error(`[COMPAT_CACHE] Error resetting compatibility metadata: ${error.message}`);
  }
}