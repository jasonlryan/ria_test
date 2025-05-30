/**
 * Chat Assistant Controller
 * Handles chat completion API endpoints.
 * Processes queries, manages context, performs data retrieval,
 * and constructs appropriate prompts for the LLM.
 */

import { NextRequest } from "next/server";
import logger from "../../../utils/shared/logger";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";
import {
  updateThreadWithContext,
  getThreadContext,
} from "../../../utils/cache/cache-utils";
import { unifiedOpenAIService } from "../services/unifiedOpenAIService";
import { threadMetaKey } from "../../../utils/cache/key-schema";
// // TEMPORARILY COMMENTED - Will fix these imports in phase 4
// // import { CompatibilityMetadata } from "../../../utils/compatibility/compatibilityTypes";
// // import { SystemMessage, UserMessage, AssistantMessage } from "../../../utils/message/messageTypes";
// // import { generateTopicInsights } from "../../../utils/insights/insightGenerator";
// // import { CHAT_MODELS } from "../../../constants/aiModels";

type CompatibilityMetadata = any; // temporary type definition

const { DEFAULT_SEGMENTS, CANONICAL_SEGMENTS } = require("../../../utils/cache/segment_keys");

// Helper to check for legacy thread_ IDs if still needed by unifiedOpenAIService logic
function isLegacyOpenAIThreadId(id: string): boolean {
    return typeof id === 'string' && (id.startsWith('thread_') || !id.startsWith('resp_'));
}

/**
 * Determines if a query represents a completely new topic
 * rather than a follow-up on the existing topic
 * @param currentQuery Current user query
 * @param previousQuery Previous user query
 * @returns True if this is likely a new topic
 */

export async function postHandler(request: NextRequest) {
  const startTime = Date.now();
  const textEncoder = new TextEncoder();
  let threadContextCached: any = null;

  try {
    const body = await request.json();
    const {
        content, 
        previous_response_id, 
        original_user_query,  
        files_used_for_this_prompt // Array of file ID strings used for the `content` prompt
    } = body;

    logger.info(
      `[CHAT_ASSISTANT_CTRL_ENTER] Request: previous_response_id: ${previous_response_id}, files_used_for_this_prompt (received): ${JSON.stringify(files_used_for_this_prompt)}, original_user_query (received): "${original_user_query}", content (start): "${String(content).substring(0,100)}..."`
    );

    if (!content) { return formatBadRequestResponse("Missing 'content' (assistantPrompt)"); }
    if (!original_user_query) { logger.warn("[CHAT_ASSISTANT_CTRL] original_user_query not provided in request body."); /* Proceed but log */ }
    if (!files_used_for_this_prompt || !Array.isArray(files_used_for_this_prompt)) { 
        logger.warn("[CHAT_ASSISTANT_CTRL] files_used_for_this_prompt not provided or not an array. File context for KV might be incomplete."); 
    }

    const isFollowUp = !!(previous_response_id && typeof previous_response_id === 'string' && previous_response_id.startsWith('resp_'));
    logger.info(`[CHAT_ASSISTANT_CTRL_ROUTING] isFollowUp: ${isFollowUp}`);

    let openAIResponseIdToContinueFrom = null;
    if (isFollowUp && previous_response_id) {
      threadContextCached = await getThreadContext(previous_response_id); // Fetch context of the PREVIOUS turn
      if (threadContextCached?.responseId && !isLegacyOpenAIThreadId(threadContextCached.responseId)) {
        openAIResponseIdToContinueFrom = threadContextCached.responseId; // This is OpenAI's ID from PREVIOUS turn
        logger.info(`[CHAT_ASSISTANT_CTRL_ROUTING] Follow-up. Will continue OpenAI conversation from: ${openAIResponseIdToContinueFrom}.`);
      } else {
        logger.warn(`[CHAT_ASSISTANT_CTRL_ROUTING] Follow-up for ${previous_response_id}, but no valid OpenAI continue_id in its KV context. Will start new OpenAI response stream.`);
      }
    } else {
      logger.info("[CHAT_ASSISTANT_CTRL_ROUTING] New conversation flow for OpenAI call.");
    }
    
    const stream = new ReadableStream({
      async start(sseController) {
        let clientStreamClosed = false;
        const originalControllerClose = sseController.close.bind(sseController);
        sseController.close = () => {
          if (!clientStreamClosed) { clientStreamClosed = true; originalControllerClose(); logger.info('[STREAM_LIFECYCLE_CAC] Client SSE stream controller closed.'); }
        };

        let actualOpenAIResponseIdFromStream: string | null = null;
        let fullAssistantReplyText = '';

        try {
          let openAIStreamPromise;
          if (openAIResponseIdToContinueFrom) {
            logger.info(`[CHAT_ASSISTANT_CTRL_OPENAI] Calling continueConversation (OpenAI ID: ${openAIResponseIdToContinueFrom}). Prompt length: ${String(content).length}`);
            openAIStreamPromise = unifiedOpenAIService.continueConversation(openAIResponseIdToContinueFrom, content, { model: "gpt-4.1-mini", stream: true });
          } else {
            logger.info(`[CHAT_ASSISTANT_CTRL_OPENAI] Calling createResponse. Prompt length: ${String(content).length}`);
            openAIStreamPromise = unifiedOpenAIService.createResponse(content, { model: "gpt-4.1-mini", stream: true });
          }

          const { data: responseStreamFromOpenAI, error: openAIError } = await openAIStreamPromise;
          if (openAIError || !responseStreamFromOpenAI) { throw new Error(openAIError?.message || "Failed to get stream from OpenAI."); }

          // --- Iterating through the OpenAI stream --- 
          // This simplified loop directly extracts needed info and forwards events.
          // The more complex handleResponseStream is no longer needed here if this controller is purely for this.
          logger.info("[CHAT_ASSISTANT_CTRL] Iterating OpenAI stream...");
          for await (const chunk of responseStreamFromOpenAI) {
            if (!actualOpenAIResponseIdFromStream) {
              const chunkId = chunk.id || chunk.response?.id;
              if (chunkId && typeof chunkId === 'string') {
                actualOpenAIResponseIdFromStream = chunkId;
                logger.info(`[CHAT_ASSISTANT_CTRL] OpenAI Response ID for THIS turn: ${actualOpenAIResponseIdFromStream}`);
                if (!clientStreamClosed) sseController.enqueue(textEncoder.encode(`event: responseId\ndata: ${JSON.stringify({ id: actualOpenAIResponseIdFromStream })}\n\n`));
              }
            }
            let textChunk: string | undefined;
            if (chunk.type === 'response.output_text.delta') { textChunk = (chunk as any).delta || (chunk.data?.delta); }
            else if (chunk.response?.output_text?.delta) { textChunk = chunk.response.output_text.delta; }
            if (textChunk !== undefined) {
              fullAssistantReplyText += textChunk;
              if (!clientStreamClosed) sseController.enqueue(textEncoder.encode(`event: textDelta\ndata: ${JSON.stringify({ value: textChunk })}\n\n`));
            }
            if (chunk.finish_reason) {
              logger.info(`[CHAT_ASSISTANT_CTRL] OpenAI stream finished. Reason: ${chunk.finish_reason}`);
              break;
            }
          }
          logger.info("[CHAT_ASSISTANT_CTRL] OpenAI stream iteration completed.");
          // --- End of OpenAI stream iteration --- 

          if (!actualOpenAIResponseIdFromStream) {
            logger.error("[CHAT_ASSISTANT_CTRL] CRITICAL: No response ID from OpenAI stream. Cannot save context or send proper messageDone.");
            throw new Error("Failed to obtain response ID from OpenAI stream.");
          }

          // Store context for the NEXT turn using the ID of THIS turn's OpenAI response
          let fileMetadataForKV: any[] = [];
          const filesUsedInThisTurn = files_used_for_this_prompt; // From the body, which is from /api/query output

          if (filesUsedInThisTurn && Array.isArray(filesUsedInThisTurn) && filesUsedInThisTurn.length > 0) {
            fileMetadataForKV = filesUsedInThisTurn.map((fileId: string) => ({
              fileId,
              // Topics are not strictly necessary to carry in this minimal fileMetadata for context continuity;
              // they can be re-derived. Focus is on preserving the list of active file IDs.
              topics: [], 
            }));
            logger.info(`[CHAT_ASSISTANT_CTRL_KV_PREP] Constructed fileMetadataForKV with ${fileMetadataForKV.length} items from files_used_for_this_prompt: ${JSON.stringify(filesUsedInThisTurn)}`);
          } else if (isFollowUp && threadContextCached?.fileMetadata && Array.isArray(threadContextCached.fileMetadata) && threadContextCached.fileMetadata.length > 0) {
            // If files_used_for_this_prompt is empty, BUT it's a follow-up and the PREVIOUS turn had file context, carry that forward.
            // This handles cases where 1_data_retrieval might return file_ids:[] for a follow-up if it intends to use existing file context.
            fileMetadataForKV = threadContextCached.fileMetadata;
            logger.warn(`[CHAT_ASSISTANT_CTRL_KV_PREP] files_used_for_this_prompt was empty for this turn. Carrying over fileMetadata from PREVIOUS turn's context (${fileMetadataForKV.length} items): ${JSON.stringify(fileMetadataForKV.map(fm => fm.fileId))}`);
          } else {
            logger.warn("[CHAT_ASSISTANT_CTRL_KV_PREP] No file information available (neither files_used_for_this_prompt nor cached fileMetadata from previous turn) to store in KV.");
          }
          
          const contextToSave = {
            previousQueries: [original_user_query || "(Query not provided)", ...(threadContextCached?.previousQueries || [])].slice(0, 5),
            fileMetadata: fileMetadataForKV, 
            assistantResponseContent: fullAssistantReplyText, 
            responseId: actualOpenAIResponseIdFromStream, 
            lastUpdated: Date.now(),
            promptSentToOpenAI: content.substring(0, 1000) + (content.length > 1000 ? "... (truncated)" : "") 
          };
          logger.info("[CHAT_ASSISTANT_CTRL_KV_SAVE_OBJECT] Object to be saved in KV:", JSON.stringify(contextToSave, null, 2));

          const kvKeyForSavingContext = threadMetaKey(actualOpenAIResponseIdFromStream); // Generate key to log
          logger.debug(`[CHAT_ASSISTANT_CTRL_KV_KEY] Saving context with effective key: ${kvKeyForSavingContext}`);
          await updateThreadWithContext(actualOpenAIResponseIdFromStream, contextToSave);
          logger.info(`[CHAT_ASSISTANT_CTRL_KV_STORE] Stored context for THIS turn under key: ${actualOpenAIResponseIdFromStream}`);

          // Send messageDone event to client
          if (!clientStreamClosed) {
            const finalContent = fullAssistantReplyText.trim() || "Assistant response generated.";
            logger.info(`[CHAT_ASSISTANT_CTRL_SSE] Sending messageDone. ID: ${actualOpenAIResponseIdFromStream}, Content length: ${finalContent.length}`);
            sseController.enqueue(
              textEncoder.encode(
                `event: messageDone\ndata: ${JSON.stringify({
                  id: actualOpenAIResponseIdFromStream,
                  threadId: actualOpenAIResponseIdFromStream, // For client, this is the ID of the current interaction
                  role: "assistant",
                  content: finalContent,
                  createdAt: Date.now(),
                })}\n\n`
              )
            );
          }
          
          if (!clientStreamClosed) {
            logger.info('[STREAM_LIFECYCLE_CAC] Client SSE stream closing cleanly after messageDone.');
            sseController.close();
          }

        } catch (error) {
          logger.error("[STREAM_ERROR_PRIMARY_CAC] Error during OpenAI call or stream handling:", error);
          if (!clientStreamClosed) { 
            try {
              sseController.enqueue(
                textEncoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: "[CAC_ERR] " + error.message })}\n\n`
                )
              );
              logger.info('[STREAM_LIFECYCLE_CAC] Sent error event to client.');
            } catch (enqueueError) {
              logger.error("[STREAM_LIFECYCLE_ERROR_CAC] Failed to enqueue error event:", enqueueError);
            }
            sseController.close(); // Always close on error
          }
        } finally {
          if (!clientStreamClosed) {
              logger.warn("[STREAM_LIFECYCLE_WARN_CAC] Stream controller still open in start()'s final `finally`. Forcing close.");
              sseController.close();
          }
          logger.info("[STREAM_LIFECYCLE_INFO_CAC] Exited ReadableStream start() function.");
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });

  } catch (error) {
    logger.error("[CHAT_ASSISTANT_CTRL_FATAL] Overall fatal error: ", error);
    return formatErrorResponse(error.message || "An unexpected error occurred.");
  }
}

// Ensure isLegacyThreadId helper is defined (it was at the end of the previous file snippet)
// function isLegacyThreadId(id: string): boolean {
//     return typeof id === 'string' && (id.startsWith('thread_') || !id.startsWith('resp_'));
// }