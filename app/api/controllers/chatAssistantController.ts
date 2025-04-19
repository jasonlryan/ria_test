/**
 * Chat Assistant Controller
 * Handles OpenAI Assistant interactions, message processing,
 * thread management, tool call handling, and streaming responses.
 * Central orchestration point for the entire chat assistant flow.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import logger from "../../../utils/logger";
import { logPerformanceMetrics, logPerformanceToFile } from "../../../utils/shared/loggerHelpers";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";
import { sanitizeOutput, isJsonContent } from "../../../utils/shared/utils";
import { waitForNoActiveRuns } from "../../../utils/shared/polling";
import { processQueryWithData, identifyRelevantFiles, getPrecompiledStarterData, isStarterQuestion } from "../../../utils/openai/retrieval";
import { getCachedFilesForThread, updateThreadCache, CachedFile } from "../../../utils/cache-utils";
import { buildPromptWithFilteredData } from "../../../utils/openai/promptUtils";

const OPENAI_TIMEOUT_MS = 90000;
const isDirectMode = process.env.FILE_ACCESS_MODE === "direct";
const forceStandardMode = true;
import { DEFAULT_SEGMENTS } from "../../../utils/data/segment_keys";

export async function postHandler(request: NextRequest) {
  try {
    const apiStartTime = Date.now();
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

    const isDirectStarterQuestion = typeof content === "string" && /^SQ\d+$/i.test(content.trim());

    if (isDirectStarterQuestion || (typeof content === "string" && isStarterQuestion(content))) {
      const starterCode = typeof content === "string" ? content.trim().toUpperCase() : content;
      const precompiled = getPrecompiledStarterData(starterCode);

      if (precompiled) {
        // Removed call to logStarterQuestionInvocation due to missing export
        // logStarterQuestionInvocation({
        //   starterQuestionCode: precompiled.starterQuestionCode || starterCode,
        //   question: precompiled.question,
        //   assistantId,
        //   threadId,
        //   dataFiles: precompiled.data_files,
        //   stats: precompiled.stats,
        // });

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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let finalThreadId = threadId;
    if (!finalThreadId) {
      const thread = await openai.beta.threads.create();
      finalThreadId = thread.id;
      logger.info(`[THREAD] Created new thread: ${finalThreadId}`);
    } else {
      logger.info(`[THREAD] Reusing existing thread: ${finalThreadId}`);
    }

    await waitForNoActiveRuns(openai, finalThreadId);

    let usedFileIds: string[] = [];
    let cachedFileIds: string[] = [];
    let originalUserContent = content;
    
    // Get previous message for context if this is a follow-up
    let previousQuery = "";
    let previousAssistantResponse = "";
    
    if (isFollowUp) {
      try {
        const messages = await openai.beta.threads.messages.list(finalThreadId, { limit: 4 });
        // Find previous user message and assistant response
        for (let i = 0; i < messages.data.length - 1; i++) {
          if (messages.data[i].role === "assistant" && messages.data[i+1].role === "user") {
            // Safely extract text content from messages
            const assistantContent = messages.data[i].content?.[0];
            const userContent = messages.data[i+1].content?.[0];
            
            if (assistantContent && 'text' in assistantContent) {
              previousAssistantResponse = assistantContent.text.value || "";
            }
            
            if (userContent && 'text' in userContent) {
              previousQuery = userContent.text.value || "";
            }
            break;
          }
        }
        logger.info(`[CONTEXT] Found previous query: "${previousQuery.substring(0, 50)}..."`);
      } catch (error) {
        logger.error(`[ERROR] Failed to retrieve previous messages: ${error.message}`);
      }
    }

    if (!isStarterQuestion(content) && !(isDirectMode && !forceStandardMode)) {
      const cachedFiles = await getCachedFilesForThread(finalThreadId);
      cachedFileIds = cachedFiles.map(file => file.id);

      // Pass isFollowUp flag and previous context to processQueryWithData
      const result = await processQueryWithData(
        content,
        "all-sector",
        cachedFileIds,
        finalThreadId,
        isFollowUp,
        previousQuery,
        previousAssistantResponse
      );

      if (result && result.out_of_scope === true) {
        return NextResponse.json({
          out_of_scope: true,
          message: result.out_of_scope_message || "Your query is outside the scope of workforce survey data.",
        });
      }

      if (result.dataScope && result.dataScope.fileIds && result.dataScope.fileIds.size > 0) {
        usedFileIds = Array.from(result.dataScope.fileIds).map(String);
        // Create proper CachedFile objects for updating the cache
        const cachedFiles: CachedFile[] = usedFileIds.map((id) => ({
          id,
          data: {},
          loadedSegments: new Set(),
          availableSegments: new Set(),
        }));
        await updateThreadCache(finalThreadId, cachedFiles);
      }

      return NextResponse.json({ success: true });
    }
    
    // Add any additional code here for the else branch
    
  } catch (error) {
    logger.error(`[ERROR] Chat Assistant Controller: ${error.message}`);
    return formatErrorResponse(error);
  }
}
