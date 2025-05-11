/**
 * Chat Assistant Controller
 * Handles chat completion API endpoints.
 * Processes queries, manages context, performs data retrieval,
 * and constructs appropriate prompts for the LLM.
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
} from "../../../utils/data/repository/adapters/retrieval-adapter";
import {
  getCachedFilesForThread,
  updateThreadWithFiles,
  CachedFile,
  updateThreadWithContext,
  getThreadContext,
  UnifiedCache
} from "../../../utils/cache/cache-utils";
import { buildPromptWithFilteredData } from "../../../utils/openai/promptUtils";
import { unifiedOpenAIService, RunStatus } from "../services/unifiedOpenAIService";
import { isFeatureEnabled } from "../../../utils/shared/feature-flags";
import { migrationMonitor } from "../../../utils/shared/monitoring";
import { threadMetaKey } from "../../../utils/cache/key-schema";
import kvClient from "../../../utils/cache/kvClient";
import { normalizeQueryText, createThreadContext } from "../../../utils/shared/queryUtils";
import {
  loadCompatibilityMapping,
  filterIncomparableFiles,
  lookupFiles,
  getComparablePairs
} from "../../../utils/compatibility/compatibility";
import { DataRetrievalService } from "../services/dataRetrievalService";
// // TEMPORARILY COMMENTED - Will fix these imports in phase 4
// // import { CompatibilityMetadata } from "../../../utils/compatibility/compatibilityTypes";
// // import { SystemMessage, UserMessage, AssistantMessage } from "../../../utils/message/messageTypes";
// // import { generateTopicInsights } from "../../../utils/insights/insightGenerator";
// // import { CHAT_MODELS } from "../../../constants/aiModels";

type CompatibilityMetadata = any; // temporary type definition

// Temporary interface to handle type mismatches during the migration
// This will be replaced with proper types in Phase 4
interface ProcessedQueryResult {
  out_of_scope?: boolean;
  out_of_scope_message?: string;
  stats?: any[];
  segments?: string[];
  conversation_state?: string;
  filteredData?: {
    stats?: any[];
    filteredData?: any[];
    summary?: string;
  };
  // Additional properties accessed in the file
  dataScope?: {
    fileIds?: Set<string>;
  };
  queryIntent?: any;
  cacheStatus?: any;
  processing_time_ms?: number;
}

const OPENAI_TIMEOUT_MS = 90000;
const isDirectMode = process.env.FILE_ACCESS_MODE === "direct";
const forceStandardMode = true;
const { DEFAULT_SEGMENTS, CANONICAL_SEGMENTS } = require("../../../utils/cache/segment_keys");

// This will be called when filtering tool output results
function processResult(result: any): ProcessedQueryResult {
  // Cast the result to our temporary interface
  return result as ProcessedQueryResult;
}

// Modify handleResponseStream definition to accept new parameters
async function handleResponseStream(responseStream, controller, threadId, threadContext, getStreamClosed, setStreamClosed, encoder, perfTimings, startTime, apiStartTime) {
  if (!responseStream) {
    throw new Error("Response stream not available");
  }
  
  let fullText = '';
  let responseId = null;
  let chunkCount = 0;

  for await (const chunk of responseStream) {
    chunkCount++;
    // Remove verbose logging, keep only the brief log for the first two chunks
    // logger.info(`[STREAM_DEBUG_VERBOSE] Chunk ${chunkCount} type: ${chunk.type}, Keys: ${Object.keys(chunk)}`);
    // if (chunk.type === 'response.output_text.delta') {
    //   logger.info(`[STREAM_DEBUG_VERBOSE] Delta content: ${(chunk as any).delta || (chunk.data?.delta)}`);
    // }
    if (chunkCount <= 2) { 
      logger.info(`[STREAM_DEBUG] Chunk ${chunkCount}: ${JSON.stringify(chunk).substring(0,300)}`);
    }
    // Handle the response ID that comes at the beginning
    if (chunk.id && !responseId) {
      responseId = chunk.id;
      
      // Update thread with response ID for future continuations
      await updateThreadWithContext(threadId, {
        ...(threadContext || {}),
        responseId: responseId
      });
      logger.info(`[THREAD] Updated thread with response ID: ${responseId}`);
      
      // Use getStreamClosed() before enqueueing
      if (!getStreamClosed()) {
        controller.enqueue(
          encoder.encode(
            `event: responseId\ndata: ${JSON.stringify({ id: responseId })}\n\n`
          )
        );
      } else {
        logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue responseId to a closed controller. Chunk skipped.');
      }
    }
    
    // Handle response.output_text.delta (various shapes)
    let textChunk: string | undefined;
    // New-style raw event
    if (chunk.type === 'response.output_text.delta') {
      textChunk = (chunk as any).delta || (chunk.data?.delta);
    }
    // Legacy nested format
    else if (chunk.response && chunk.response.output_text && chunk.response.output_text.delta) {
      textChunk = chunk.response.output_text.delta;
    } else if (chunk.output_text && chunk.output_text.delta) {
      textChunk = chunk.output_text.delta;
    }

    if (textChunk !== undefined) {
      fullText += textChunk;
      if (!getStreamClosed()) {
        controller.enqueue(
          encoder.encode(
            `event: textDelta\ndata: ${JSON.stringify({ value: textChunk })}\n\n`
          )
        );
      } else {
        logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue textDelta to a closed controller. Chunk skipped.');
      }
    }
    
    // Check if this is a finish chunk
    else if (chunk.finish_reason) {
      if (!getStreamClosed()) {
        controller.enqueue(
          encoder.encode(
            `event: status\ndata: ${JSON.stringify({ status: "completed" })}\n\n`
          )
        );
      } else {
        logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue status to a closed controller. Chunk skipped.');
      }
    }
    
    // Handle tool calls
    if (chunk.response && chunk.response.tool_call) {
      if (!getStreamClosed()) {
        controller.enqueue(
          encoder.encode(
            `event: toolCall\ndata: ${JSON.stringify(chunk.response.tool_call)}\n\n`
          )
        );
      } else {
        logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue toolCall to a closed controller. Chunk skipped.');
      }
    } else if (chunk.tool_call) {
      if (!getStreamClosed()) {
        controller.enqueue(
          encoder.encode(
            `event: toolCall\ndata: ${JSON.stringify(chunk.tool_call)}\n\n`
          )
        );
      } else {
        logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue toolCall to a closed controller. Chunk skipped.');
      }
    }
  }
  
  // Send final message when we have content
  if (!getStreamClosed() && responseId && fullText) {
    perfTimings.messageReceived = Date.now();
    logger.info(`[ASSISTANT] Response received in ${perfTimings.messageReceived - startTime}ms`);
    
    if (!getStreamClosed()) {
      controller.enqueue(
        encoder.encode(
          `event: messageDone\ndata: ${JSON.stringify({
            id: responseId,
            threadId: threadId,
            role: "assistant",
            content: fullText,
            createdAt: Date.now(),
          })}\n\n`
        )
      );
    } else {
      logger.warn('[STREAM_LIFECYCLE] Attempted to enqueue messageDone to a closed controller. Chunk skipped.');
    }
  }
}

/**
 * Log starter question invocations to a file
 */
async function logStarterQuestionInvocation({
  starterQuestionCode,
  question,
  threadId,
  dataFiles,
  stats,
  timestamp = new Date().toISOString()
}: {
  starterQuestionCode: string;
  question: string;
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
  const encoder = new TextEncoder();
  let perfTimings = {
    requestStart: apiStartTime,
    runCreated: 0,
    pollStart: 0,
    firstPoll: 0,
    messageReceived: 0,
    totalTime: 0,
    pollingInterval: 250,
  };
  let threadContextCached: any = null;
  const dataRetrievalService = new DataRetrievalService();

  try {
    const body = await request.json();
    let { threadId, content } = body;

    if (!content) {
      return formatBadRequestResponse("Missing required field: content");
    }

    // Only use responseId for continuation in Responses API
    let previousResponseId = body.previous_response_id;
    let isFollowUp = typeof previousResponseId === 'string' && previousResponseId.startsWith('resp_');
    let context = {
      normalizedCurrentQuery: normalizeQueryText(content),
      normalizedPreviousQuery: "",
      previousResponse: "",
      isFollowUp,
      systemPrompt: "",
      tools: []
    };

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

    logger.info(`[REQUEST] New ${isFollowUp ? "follow-up" : "initial"} request`);

    let finalThreadId = threadId;
    if (!finalThreadId) {
      // Replace thread creation with response creation
      // Instead of creating an empty thread first, we'll create a response directly
      const initialMessage = {
        role: "user",
        content: content
      };
      
      // Create the initial system message if needed
      const systemMessage = {
        role: "system",
        content: context.systemPrompt
      };
      
      const messages = [systemMessage, initialMessage];
      
      try {
        // Create response with the full content immediately
        const { data: responseResult } = await unifiedOpenAIService.createResponse(
          content,
          {
            model: "gpt-4.1-mini",
            tools: context.tools || [],
          }
        );
        
        // Extract response ID from the response result
        const responseId = responseResult && typeof responseResult === 'object' && 'id' in responseResult
          ? String(responseResult.id)
          : `response_${Date.now()}`;
        
        // Use responseId as finalThreadId for consistency with existing code
        finalThreadId = responseId;
        
        logger.info(`[RESPONSE] Created new response with ID: ${responseId}`);
        migrationMonitor.trackCall('unified', 'createResponse', startTime);
        
        // Store the thread context with the response ID
        await updateThreadWithContext(finalThreadId, {
          previousQueries: [context.normalizedCurrentQuery],
          rawQueries: [content],
          isFollowUp: false,
          lastQueryTime: Date.now(),
          responseId: responseId // Explicitly store response ID for continuation
        });
        
        logger.info(`[THREAD] Initialized context with first query and response ID: ${responseId}`);
      } catch (error) {
        logger.error(`[RESPONSE] Error creating initial response: ${error.message}`);
        throw error;
      }
    } else {
      logger.info(`[THREAD] Reusing existing thread ID: ${finalThreadId}`);
      
      // All thread context and continuation logic should now use responseId only, not threadId or threadContextCached.
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
            loadCompatibilityMapping()?.files
          ) {
            checkPerformed = true;
            const compatMapping = loadCompatibilityMapping();
            for (const fileId of cachedFileIds) {
              const normalizedId = String(fileId).replace(/\.json$/, "");
              const compatInfo =
                compatMapping.files[normalizedId];
              if (compatInfo && compatInfo.comparable === false) {
                 if (
                  compatInfo.topicId &&
                  !incompatibleFilesInfo.some(
                    (item) => item.topic === compatInfo.topicId
                  )
                ) {
                  incompatibleFilesInfo.push({
                    topic: compatInfo.topicId,
                    message: compatInfo.userMessage || "Comparison not available due to methodology changes.",
                  });
                }
              }
            }
          } else {
             if (cachedFileIds.length === 0) {
                logger.warn(`[CONTROLLER_COMPAT_CHECK] Skipping check: No cached files found for thread ${finalThreadId}.`);
             } else {
                logger.error(`[CONTROLLER_COMPAT_CHECK] Skipping check: Compatibility mapping not loaded or invalid!`);
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

    let usedFileIds: string[] = [];
    let cachedFileIds: string[] = [];
    let originalUserContent = content;
    let result;

    // LLM-driven file discovery
    let fileDiscoveryResult;
    try {
      // Load canonical mapping (assume from existing utility or file)
      const canonicalMapping = require("../../../scripts/reference files/2025/canonical_topic_mapping.json");
      const contextString = typeof context === 'string' ? context : '';
      fileDiscoveryResult = await dataRetrievalService.identifyRelevantFilesWithLLM(
        content, // user query
        contextString, // context as string
        isFollowUp,
        context.normalizedPreviousQuery || '',
        context.previousResponse || '',
        canonicalMapping
      );
      logger.info(`[LLM_FILE_DISCOVERY] Used LLM-driven file discovery for query.`);
    } catch (err) {
      logger.error(`[LLM_FILE_DISCOVERY] LLM file discovery failed, falling back to repository: ${err.message}`);
      // Fallback to repository implementation if LLM fails
      fileDiscoveryResult = await dataRetrievalService.identifyRelevantFiles(
        content,
        '', // fallback context as string
        isFollowUp,
        context.normalizedPreviousQuery || '',
        context.previousResponse || ''
      );
    }

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

        await updateThreadWithFiles(finalThreadId, cachedFilesForUpdate);
        cachedFileIds = cachedFilesForUpdate.map(f => f.id);

        // === NEW: Inline compatibility gate for cached file sets ===
        if (cachedFileIds.length > 1) {
          try {
            const fileMetaCheck = lookupFiles(cachedFileIds);
            const pairRes = getComparablePairs(fileMetaCheck);
            if (pairRes.invalid.length > 0) {
              logger.warn(`[CONTROLLER_COMPAT_GATE] Cached file set non-comparable. Blocking.`);
              return NextResponse.json({
                incompatible_comparison: true,
                message: pairRes.message || "Year-on-year comparisons are not available due to methodology changes."
              }, { status: 200 });
            }
          } catch (compatErr) {
            logger.error(`[CONTROLLER_COMPAT_GATE] Error during cached-file compatibility check: ${compatErr instanceof Error ? compatErr.message : String(compatErr)}`);
          }
        }

        result = processResult(await processQueryWithData(
          context.normalizedCurrentQuery,
          "all-sector",
          fileIdArray,
          finalThreadId,
          context.isFollowUp,
          context.normalizedPreviousQuery,
          context.previousResponse
        ));

        if (result && result.out_of_scope === true) {
          return NextResponse.json({
            out_of_scope: true,
            message: result.out_of_scope_message || "Your query is outside the scope of workforce survey data.",
          });
        }

        usedFileIds = fileIdArray;
      } else {
        // Critical fix: Get cached files but ensure we actually have their IDs
        let cachedFiles = await getCachedFilesForThread(finalThreadId);
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
          
          // === NEW: respect adapter-level incompatibility flag ===
          if (relevantFilesResult?.incompatible === true) {
            logger.warn(`[CONTROLLER_COMPAT_GATE] Adapter flagged non-comparable files (follow-up). Returning early.`);
            return NextResponse.json({
              incompatible_comparison: true,
              message: relevantFilesResult.incompatibleMessage ||
                "Year-on-year comparisons are not available due to methodology changes."
            }, { status: 200 });
          }
          
          // Add these files to the thread cache
          if (cachedFileIds.length > 0) {
            const cachedFilesForUpdate: CachedFile[] = cachedFileIds.map(id => ({
              id,
              data: {},
              loadedSegments: new Set(),
              availableSegments: new Set()
            }));
            await updateThreadWithFiles(finalThreadId, cachedFilesForUpdate);
            cachedFileIds = cachedFilesForUpdate.map(f => f.id);
            logger.info(`[FOLLOW-UP] Updated thread cache with ${cachedFileIds.length} files`);
          }
        }

        // === NEW: Inline compatibility gate for cached file sets ===
        if (cachedFileIds.length > 1) {
          try {
            const fileMetaCheck = lookupFiles(cachedFileIds);
            const pairRes = getComparablePairs(fileMetaCheck);
            if (pairRes.invalid.length > 0) {
              logger.warn(`[CONTROLLER_COMPAT_GATE] Cached file set non-comparable. Blocking.`);
              return NextResponse.json({
                incompatible_comparison: true,
                message: pairRes.message || "Year-on-year comparisons are not available due to methodology changes."
              }, { status: 200 });
            }
          } catch (compatErr) {
            logger.error(`[CONTROLLER_COMPAT_GATE] Error during cached-file compatibility check: ${compatErr instanceof Error ? compatErr.message : String(compatErr)}`);
          }
        }

        result = processResult(await processQueryWithData(
          context.normalizedCurrentQuery,
          "all-sector",
          cachedFileIds,
          finalThreadId,
          true, // Force isFollowUp to true
          context.normalizedPreviousQuery,
          context.previousResponse
        ));

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
          await updateThreadWithFiles(finalThreadId, cachedFiles);
          cachedFileIds = cachedFiles.map(f => f.id);
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
        
        // Check if there are relevantFiles with data that we can use directly
        if (result.relevantFiles && Array.isArray(result.relevantFiles) && result.relevantFiles.length > 0) {
          logger.warn(`[DATA] No structured stats found, but ${result.relevantFiles.length} relevantFiles exist. Extracting data directly.`);
          
          // Create direct file data for OpenAI prompt
          const directFileData = result.relevantFiles.map((file: any) => {
            // Get responses from the file if available
            const fileResponses = file.responses || [];
            
            // Extract a sample of responses
            const exampleResponses = fileResponses.slice(0, 5).map((resp: any) => {
              const responseText = resp.response || "No response text";
              const segments: Record<string, any> = {};
              
              // Extract segment data from response
              if (resp.data) {
                Object.entries(resp.data).forEach(([segKey, segValue]: [string, any]) => {
                  if (segKey !== 'overall' && typeof segValue === 'object') {
                    segments[segKey] = segValue;
                  } else if (segKey === 'overall') {
                    segments.overall = segValue;
                  }
                });
              }
              
              return { response: responseText, segments };
            });
            
            return {
              id: file.id,
              responseCount: fileResponses.length,
              examples: exampleResponses,
            };
          });
          
          // Add the direct data to our filtered data for the prompt
          if (!result.filteredData) {
            result.filteredData = {};
          }
          result.filteredData.directFileData = directFileData;
          logger.info(`[DATA] Added direct file data with ${directFileData.length} files and ${directFileData.reduce((sum, file) => sum + file.responseCount, 0)} responses`);
        }
      }

      // Load the assistant prompt
      const assistantPromptPath = path.join(process.cwd(), 'utils', 'openai', 'assistant_prompt.md');
      const assistantPrompt = fs.readFileSync(assistantPromptPath, 'utf-8');
      logger.info(`[PROMPT] Loaded assistant prompt from ${assistantPromptPath}`);

      // Create structured data for the prompt builder
      const filteredDataObj = {
        stats: filteredStats,
        segments: result.segments || DEFAULT_SEGMENTS
      };

      // Build the prompt with the dedicated utility function
      const standardModePrompt = buildPromptWithFilteredData(
        originalUserContent,
        filteredDataObj,
        {
          // Add explicit instruction in the query to use exact statistics
          prefixInstruction: "IMPORTANT: Use ONLY the exact percentage statistics provided below. Do not use your own statistics or knowledge about the data.",
          // Add metadata if available
          compatibilityMetadata: result.compatibilityMetadata
        }
      );

      // Combine the assistant prompt with the filtered data prompt
      const fullPrompt = `${assistantPrompt}\n\n${standardModePrompt}`;

      // Log this for debugging (truncated)
      logger.info(`[PROMPT] Combined assistant prompt with filtered data prompt: ${fullPrompt.substring(0, 200)}...`);

      // Set content to the full prompt for use in the stream
      content = fullPrompt;

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

      // Track context for all threads right after message creation
      // Store both the raw and normalized queries for future reference
      const queryContext = {
        rawQuery: content,
        normalizedQuery: context.normalizedCurrentQuery,
        timestamp: Date.now(),
      };

      // Ensure we store query context in thread metadata
      try {
        // Reuse cached thread context if we already fetched it
        if (!threadContextCached) {
          threadContextCached = await getThreadContext(finalThreadId);
        }
        const existingQueries = threadContextCached.previousQueries || [];
        
        // Store both current normalized query and raw query for future reference
        await updateThreadWithContext(finalThreadId, {
          previousQueries: [context.normalizedCurrentQuery, ...existingQueries].slice(0, 5),
          rawQueries: [content, ...(threadContextCached.rawQueries || [])].slice(0, 5),
          isFollowUp: true,
          lastQueryTime: Date.now()
        });
        
        logger.info(`[THREAD] Updated thread ${finalThreadId} with query context (total queries: ${existingQueries.length + 1})`);
      } catch (err) {
        logger.error(`[THREAD] Failed to update thread context: ${err.message}`);
      }

      perfTimings.runCreated = Date.now();

      // Create a response directly using the Responses API instead of the Assistants API
      // No need for createRun, we directly create a response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let streamClosed = false;
          const originalControllerClose = controller.close.bind(controller);
          controller.close = () => {
            if (!streamClosed) {
              streamClosed = true;
              originalControllerClose();
              logger.info('[STREAM_LIFECYCLE] Controller explicitly closed.');
            }
          };

          try {
            let messageReceived = false;
            perfTimings.pollStart = Date.now();

            // For follow-up queries, use the continueConversation method
            if (isFollowUp && threadContextCached && threadContextCached.responseId) {
              // Check if the response ID is an old thread ID (starts with thread_)
              const isLegacyThreadId = typeof threadContextCached.responseId === 'string' && 
                (threadContextCached.responseId.startsWith('thread_') || !threadContextCached.responseId.startsWith('resp_'));
              
              if (isLegacyThreadId) {
                logger.info(`[RESPONSE] Legacy or invalid response ID detected (${threadContextCached.responseId}). Creating new response instead.`);
                
                // Create a new streaming response with the full prompt content
                const { data: responseStream } = await unifiedOpenAIService.createResponse(
                  content,
                  {
                    model: "gpt-4.1-mini",
                    tools: context.tools || [],
                    stream: true
                  }
                );
                
                // Store the new response ID for future continuations
                if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
                  await updateThreadWithContext(finalThreadId, {
                    ...threadContextCached,
                    responseId: responseStream.id
                  });
                  logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
                }
                
                // Pass controller and the streamClosed tracker to handleResponseStream
                await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
              } else {
                logger.info(`[RESPONSE] Continuing conversation with response ID: ${threadContextCached.responseId}`);
                
                // Create a streaming response using continueConversation
                try {
                  const { data: responseStream } = await unifiedOpenAIService.continueConversation(
                    threadContextCached.responseId,
                    content,
                    {
                      model: "gpt-4.1-mini",
                      tools: context.tools || [],
                      stream: true
                    }
                  );
                  
                  // Store the new response ID if it changed
                  if (responseStream && typeof responseStream === 'object' && 'id' in responseStream && 
                      responseStream.id !== threadContextCached.responseId) {
                    await updateThreadWithContext(finalThreadId, {
                      ...threadContextCached,
                      responseId: responseStream.id
                    });
                    logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
                  }
                  
                  // Pass controller and the streamClosed tracker to handleResponseStream
                  await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
                } catch (error) {
                  logger.error(`[RESPONSE] Error continuing conversation: ${error.message}. Falling back to new response.`);
                  
                  // Fall back to creating a new response
                  const { data: responseStream } = await unifiedOpenAIService.createResponse(
                    content,
                    {
                      model: "gpt-4.1-mini",
                      tools: context.tools || [],
                      stream: true
                    }
                  );
                  
                  // Store the new response ID for future continuations
                  if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
                    await updateThreadWithContext(finalThreadId, {
                      ...threadContextCached,
                      responseId: responseStream.id
                    });
                    logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
                  }
                  
                  // Pass controller and the streamClosed tracker to handleResponseStream
                  await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
                }
              }
            } else {
              // For initial queries or queries without a previous response ID, create a new response
              logger.info(`[RESPONSE] Creating new response for content length: ${content.length}`);
              
              // Create a streaming response with the full prompt content
              const { data: responseStream } = await unifiedOpenAIService.createResponse(
                content,
                {
                  model: "gpt-4.1-mini",
                  tools: context.tools || [],
                  stream: true
                }
              );
              
              // Store the response ID for future continuations
              if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
                await updateThreadWithContext(finalThreadId, {
                  ...(threadContextCached || {}),
                  responseId: responseStream.id
                });
                logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
              }
              
              // Pass controller and the streamClosed tracker to handleResponseStream
              await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
            }
            
            perfTimings.totalTime = Date.now() - apiStartTime;
          } catch (error) {
            logger.error("Stream start error:", error);
            if (!streamClosed) {
              logger.info('[STREAM_LIFECYCLE] Controller closing in stream finally block.');
              controller.close(); // This will now call our wrapper
            }
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
    } else if (!isStarterQuestion(content) && isDirectMode && !forceStandardMode) {
      let cachedFiles = await getCachedFilesForThread(finalThreadId);
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

    // Track context for all threads right after message creation
    // Store both the raw and normalized queries for future reference
    const queryContext = {
      rawQuery: content,
      normalizedQuery: context.normalizedCurrentQuery,
      timestamp: Date.now(),
    };

    // Ensure we store query context in thread metadata
    try {
      // Reuse cached thread context if we already fetched it
      if (!threadContextCached) {
        threadContextCached = await getThreadContext(finalThreadId);
      }
      const existingQueries = threadContextCached.previousQueries || [];
      
      // Store both current normalized query and raw query for future reference
      await updateThreadWithContext(finalThreadId, {
        previousQueries: [context.normalizedCurrentQuery, ...existingQueries].slice(0, 5),
        rawQueries: [content, ...(threadContextCached.rawQueries || [])].slice(0, 5),
        isFollowUp: true,
        lastQueryTime: Date.now()
      });
      
      logger.info(`[THREAD] Updated thread ${finalThreadId} with query context (total queries: ${existingQueries.length + 1})`);
    } catch (err) {
      logger.error(`[THREAD] Failed to update thread context: ${err.message}`);
    }

    perfTimings.runCreated = Date.now();

    // Create a response directly using the Responses API instead of the Assistants API
    // No need for createRun, we directly create a response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        const originalControllerClose = controller.close.bind(controller);
        controller.close = () => {
          if (!streamClosed) {
            streamClosed = true;
            originalControllerClose();
            logger.info('[STREAM_LIFECYCLE] Controller explicitly closed.');
          }
        };

        try {
          let messageReceived = false;
          perfTimings.pollStart = Date.now();

          // For follow-up queries, use the continueConversation method
          if (isFollowUp && threadContextCached && threadContextCached.responseId) {
            // Check if the response ID is an old thread ID (starts with thread_)
            const isLegacyThreadId = typeof threadContextCached.responseId === 'string' && 
              (threadContextCached.responseId.startsWith('thread_') || !threadContextCached.responseId.startsWith('resp_'));
            
            if (isLegacyThreadId) {
              logger.info(`[RESPONSE] Legacy or invalid response ID detected (${threadContextCached.responseId}). Creating new response instead.`);
              
              // Create a new streaming response with the full prompt content
              const { data: responseStream } = await unifiedOpenAIService.createResponse(
                content,
                {
                  model: "gpt-4.1-mini",
                  tools: context.tools || [],
                  stream: true
                }
              );
              
              // Store the new response ID for future continuations
              if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
                await updateThreadWithContext(finalThreadId, {
                  ...threadContextCached,
                  responseId: responseStream.id
                });
                logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
              }
              
              // Pass controller and the streamClosed tracker to handleResponseStream
              await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
            } else {
              logger.info(`[RESPONSE] Continuing conversation with response ID: ${threadContextCached.responseId}`);
              
              // Create a streaming response using continueConversation
              try {
                const { data: responseStream } = await unifiedOpenAIService.continueConversation(
                  threadContextCached.responseId,
                  content,
                  {
                    model: "gpt-4.1-mini",
                    tools: context.tools || [],
                    stream: true
                  }
                );
                
                // Store the new response ID if it changed
                if (responseStream && typeof responseStream === 'object' && 'id' in responseStream && 
                    responseStream.id !== threadContextCached.responseId) {
                  await updateThreadWithContext(finalThreadId, {
                    ...threadContextCached,
                    responseId: responseStream.id
                  });
                  logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
                }
                
                // Pass controller and the streamClosed tracker to handleResponseStream
                await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
              } catch (error) {
                logger.error(`[RESPONSE] Error continuing conversation: ${error.message}. Falling back to new response.`);
                
                // Fall back to creating a new response
                const { data: responseStream } = await unifiedOpenAIService.createResponse(
                  content,
                  {
                    model: "gpt-4.1-mini",
                    tools: context.tools || [],
                    stream: true
                  }
                );
                
                // Store the new response ID for future continuations
                if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
                  await updateThreadWithContext(finalThreadId, {
                    ...threadContextCached,
                    responseId: responseStream.id
                  });
                  logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
                }
                
                // Pass controller and the streamClosed tracker to handleResponseStream
                await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
              }
            }
          } else {
            // For initial queries or queries without a previous response ID, create a new response
            logger.info(`[RESPONSE] Creating new response for content length: ${content.length}`);
            
            // Create a streaming response with the full prompt content
            const { data: responseStream } = await unifiedOpenAIService.createResponse(
              content,
              {
                model: "gpt-4.1-mini",
                tools: context.tools || [],
                stream: true
              }
            );
            
            // Store the response ID for future continuations
            if (responseStream && typeof responseStream === 'object' && 'id' in responseStream) {
              await updateThreadWithContext(finalThreadId, {
                ...(threadContextCached || {}),
                responseId: responseStream.id
              });
              logger.info(`[RESPONSE] Updated thread with new response ID: ${responseStream.id}`);
            }
            
            // Pass controller and the streamClosed tracker to handleResponseStream
            await handleResponseStream(responseStream, controller, finalThreadId, threadContextCached, () => streamClosed, (val) => streamClosed = val, encoder, perfTimings, startTime, apiStartTime);
          }
          
          perfTimings.totalTime = Date.now() - apiStartTime;
        } catch (error) {
          logger.error("Stream start error:", error);
          if (!streamClosed) {
            logger.info('[STREAM_LIFECYCLE] Controller closing in stream finally block.');
            controller.close(); // This will now call our wrapper
          }
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
    
    // Re-derive fileMetadata so the compatibility gate has something to work with
    let derivedFileMeta = [];
    try {
      const { lookupFiles } = await import(
        "../../../utils/compatibility/compatibility"
      );
      if (Array.isArray(existingCache.files) && existingCache.files.length > 0) {
        const ids = existingCache.files.map((f: any) =>
          typeof f === "string" ? f : f.id
        );
        derivedFileMeta = lookupFiles(ids);
      }
    } catch (e) {
      // fail silently – we just won't have metadata
    }

    const updatedCache = {
      ...existingCache,
      compatibilityMetadata: undefined,
      fileMetadata: derivedFileMeta,
      lastUpdated: Date.now(),
    };
    
    // Update the thread cache with reset compatibility metadata
    await kvClient.set(metaKey, updatedCache, { ex: 60 * 60 * 24 }); // 24 hour TTL
    
    logger.info(`[COMPAT_CACHE] Successfully reset compatibility metadata while preserving cached files for thread ${threadId}`);
  } catch (error) {
    logger.error(`[COMPAT_CACHE] Error resetting compatibility metadata: ${error.message}`);
  }
}