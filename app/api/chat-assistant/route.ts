// I created this route to get my updates working, I left the others just in case - they're not being used in the embed page though.
// This repo got me started: https://github.com/Superexpert/openai-assistant-starter-kit

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Stream } from "openai/streaming";
import readline from "readline";
import fs from 'fs';
import path from 'path';
import logger from "../../../utils/logger";
import { logPerformanceMetrics, logPerformanceToFile } from "../../../utils/shared/loggerHelpers";
import { formatErrorResponse, formatBadRequestResponse } from "../../../utils/shared/errorHandler";

import { DEFAULT_SEGMENTS } from "../../../utils/data/segment_keys";
// Add import for retrieval system
import { processQueryWithData, identifyRelevantFiles, getPrecompiledStarterData, isStarterQuestion } from "../../../utils/openai/retrieval";
import { getCachedFilesForThread, updateThreadCache } from "../../../utils/cache-utils";
import { buildPromptWithFilteredData } from "../../../utils/openai/promptUtils";

// Centralized mode check
const isDirectMode = process.env.FILE_ACCESS_MODE === 'direct';
// Force standard mode for data retrieval
const forceStandardMode = true; // Force standard mode to ensure data retrieval works

// [ENV] FILE_ACCESS_MODE is set to: '${process.env.FILE_ACCESS_MODE}'
// [MODE] Running in ${isDirectMode ? 'DIRECT (file IDs only)' : 'STANDARD (processed data)'} mode

// Skip data extraction entirely in DIRECT mode
// We skip file retrieval and data extraction in DIRECT mode - the assistant will do that itself
// In STANDARD mode, we still retrieve and process data before sending to the assistant

// Configure OpenAI with reasonable defaults
const OPENAI_TIMEOUT_MS = 90000; // 90 seconds

// NOTE: We're now using Node.js runtime rather than Edge to allow for filesystem access
// If you deploy to Vercel, ensure your plan supports Node.js API routes

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

import { sanitizeOutput, isJsonContent } from "../../../utils/shared/utils";

/**
 * Sanitizes the output from OpenAI to remove embedded citation markers
 */
// function sanitizeOutput(text: string): string {
//   // Use the simpler version from staging: only remove [[n](#source)] style citations
//   // This avoids collapsing whitespace which breaks markdown.
//   return String(text || '').replace(/\[\[(\d+)\]\(#.*?\)\]/g, "");
// }

/**
 * Determines if the message content is likely a valid JSON string
 */
// function isJsonContent(content: string): boolean {
//   if (typeof content !== 'string') return false;
  
//   // Try to parse as JSON
//   try {
//     const parsed = JSON.parse(content);
//     return typeof parsed === 'object';
//   } catch {
//     return false; 
//   }
// }

import { waitForNoActiveRuns } from "../../../utils/shared/polling";

/**
 * Waits until there are no active runs on the thread.
 * Active statuses: "queued", "in_progress", "requires_action"
 */
// async function waitForNoActiveRuns(openai: OpenAI, threadId: string, pollInterval = 250, timeoutMs = 60000) {
//   const activeStatuses = new Set(["queued", "in_progress", "requires_action"]);
//   const start = Date.now();
//   while (true) {
//     const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
//     const activeRun = runs.data.find(run => activeStatuses.has(run.status));
//     if (!activeRun) break;
//     if (Date.now() - start > timeoutMs) {
//       throw new Error("Timeout waiting for previous run to complete on thread " + threadId);
//     }
//     await new Promise(res => setTimeout(res, pollInterval));
//   }
// }

/**
 * Logs starter question invocations to a log file asynchronously.
 */
async function logStarterQuestionInvocation({
  starterQuestionCode,
  question,
  assistantId,
  threadId,
  dataFiles,
  stats,
  timestamp = new Date().toISOString()
}) {
  if (process.env.VERCEL) return; // Skip file logging on Vercel
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
// post a new message and stream OpenAI Assistant response
export async function POST(request: NextRequest) {
  try {
    // Performance tracking
    const apiStartTime = Date.now();
    let perfTimings = {
      requestStart: apiStartTime,
      runCreated: 0,
      pollStart: 0,
      firstPoll: 0,
      messageReceived: 0,
      totalTime: 0,
      pollingInterval: 250 // Current setting - for tracking changes
    };
    
    // Parse the request body
    const body = await request.json();
    let { assistantId, threadId, content } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    // Add direct logging for content
    // logger.info(`[STARTER DEBUG] Content received: "${content}"`);
    
    // Direct check for starter question pattern
    const isDirectStarterQuestion = typeof content === 'string' && /^SQ\d+$/i.test(content.trim());
    // Starter Question Optimization: Intercept starter question codes and route to assistant with special prompt
    if (isDirectStarterQuestion || (typeof content === 'string' && isStarterQuestion(content))) {
      // Use uppercase version of content for consistency
      const starterCode = typeof content === 'string' ? content.trim().toUpperCase() : content;

      const precompiled = getPrecompiledStarterData(starterCode);

      if (precompiled) {
        // Improved logging for starter questions

        // Call the logging function (fire and forget)
        logStarterQuestionInvocation({
          starterQuestionCode: precompiled.starterQuestionCode || starterCode,
          question: precompiled.question,
          assistantId,
          threadId: threadId,
          dataFiles: precompiled.data_files,
          stats: precompiled.stats
        });

        // Load the starter prompt template
        const starterPromptPath = path.join(process.cwd(), "prompts", "starter_prompt_template.md");
        let starterPromptTemplate = "";
        try {
          starterPromptTemplate = await fs.promises.readFile(starterPromptPath, "utf8");
        } catch (err) {
          starterPromptTemplate = "You are answering a precompiled starter question. Use the provided summary and stats to generate a narrative response.";
        }

        try {
          // Build the full prompt for the assistant
          const fullPrompt =
    `${starterPromptTemplate}

    ---
    Starter Question: ${precompiled.question || starterCode}
    Summary: ${precompiled.summary}
    Stats: ${JSON.stringify(precompiled.stats, null, 2)}
    Matched Topics: ${precompiled.matched_topics ? precompiled.matched_topics.join(", ") : ""}
    Data Files: ${precompiled.data_files ? precompiled.data_files.join(", ") : ""}
    ${precompiled.notes ? "Notes: " + precompiled.notes : ""}
    `;
          // Replace the user content with the constructed prompt
          body.content = fullPrompt;
          content = body.content;
        } catch (promptError) {
           // Consider how to handle this error - maybe return a specific error response?
           // For now, it will fall through and use the original content if prompt construction fails.
        }
      } else {
         // Proceeding with original content if precompiled data is null
      }
    } else {
        // Did NOT identify as starter question
    }

    if (!assistantId) {
      return NextResponse.json(
        { error: "Missing required field: assistantId" },
        { status: 400 }
      );
    }
    
    logger.info(`[REQUEST] New ${threadId ? "follow-up" : "initial"} request | Assistant: ${assistantId}`);

    // Initialize OpenAI client with API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Log API key info for debugging (safely)
    // logger.debug("OpenAI API Key info:", {
    //   defined: !!process.env.OPENAI_API_KEY,
    //   length: process.env.OPENAI_API_KEY?.length,
    //   prefix: process.env.OPENAI_API_KEY?.substring(0, 7),
    //   suffix: process.env.OPENAI_API_KEY?.substring(
    //     process.env.OPENAI_API_KEY.length - 4
    //   ),
    // });

    // Handle thread creation if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const thread = await openai.beta.threads.create();
      finalThreadId = thread.id;
      logger.info(`[THREAD] Created new thread: ${finalThreadId}`);
    } else {
      logger.info(`[THREAD] Reusing existing thread: ${finalThreadId}`);
    }

    // Wait for any active runs to finish before adding a new message
    await waitForNoActiveRuns(openai, finalThreadId);
    // Confirm follow-on logic: threadId is reused for follow-up questions, and cache is used per thread
    // if (threadId) {
    //   logger.info(`[FOLLOW-UP] This is a follow-up question using thread: ${finalThreadId}`);
    // }

    // Track file IDs for logging
    let usedFileIds: string[] = [];
    let cachedFileIds: string[] = [];
    let originalUserContent = content;

    // If not a starter question and not DIRECT mode, inject filteredData into the prompt
    if (!isStarterQuestion(content) && !(isDirectMode && !forceStandardMode)) {
      // Retrieve cached files for this thread if available
      cachedFileIds = await getCachedFilesForThread(finalThreadId);
      // Run smart filtering and data retrieval
      const result = await processQueryWithData(content, "all-sector", cachedFileIds, finalThreadId);

      // === OUT OF SCOPE HANDLING ===
      if (result && result.out_of_scope === true) {
        logger.info(`[OUT OF SCOPE] Query flagged as out-of-scope. Returning message to frontend.`);
        return NextResponse.json({
          out_of_scope: true,
          message: result.out_of_scope_message || "Your query is outside the scope of workforce survey data."
        }, { status: 200 });
      }

      // Track file IDs used for this query
      if (result.dataScope && result.dataScope.fileIds && result.dataScope.fileIds.size > 0) {
        usedFileIds = Array.from(result.dataScope.fileIds).map(String);
        // Update thread cache immediately after data retrieval
        await updateThreadCache(finalThreadId, usedFileIds);
      }

      // Efficient summary log for filteredData
      const statCount = result.filteredData?.stats?.length || 0;
      const fileSet = new Set(result.filteredData?.stats?.map(stat => stat.fileId));
      const fileCount = fileSet.size;
      const summaryText = result.filteredData?.summary || 'No summary available.';
      logger.info(`[DATA] Data files used: ${Array.from(fileSet).join(", ")}`);
      logger.info(`[DATA] Segments selected: ${DEFAULT_SEGMENTS.join(", ")}`);
      logger.info(`[DATA] Summary: ${summaryText}`);

      // Build the STANDARD MODE JSON object for the assistant
      let filteredStats = [];
      
      // logger.info(`[DEBUG] Raw result structure: {
      //   hasFilteredData: ${!!result.filteredData},
      //   filteredDataKeys: ${result.filteredData ? Object.keys(result.filteredData).join(", ") : "none"},
      //   filteredDataType: ${typeof result.filteredData},
      //   hasStats: ${!!result.stats},
      //   statsType: ${typeof result.stats},
      //   statsIsArray: ${Array.isArray(result.stats)},
      //   statsLength: ${result.stats && Array.isArray(result.stats) ? result.stats.length : -1},
      //   statsSampleCount: ${result.stats && Array.isArray(result.stats) ? Math.min(result.stats.length, 2) : 0}
      // }`);
      
      // DIRECT ACCESS: Try to use stats directly from result first as the most reliable source
      if (result.stats && Array.isArray(result.stats) && result.stats.length > 0) {
        // logger.info(`[DEBUG] Using result.stats directly (${result.stats.length} items)`);
        filteredStats = result.stats;
      }
      // Option 1: result.filteredData.filteredData exists and is an array
      else if (result.filteredData?.filteredData && Array.isArray(result.filteredData.filteredData) && result.filteredData.filteredData.length > 0) {
        // logger.info(`[DEBUG] Using result.filteredData.filteredData (${result.filteredData.filteredData.length} items)`);
        filteredStats = result.filteredData.filteredData;
      } 
      // Option 2: result.filteredData.stats exists and is an array
      else if (result.filteredData?.stats && Array.isArray(result.filteredData.stats) && result.filteredData.stats.length > 0) {
        // logger.info(`[DEBUG] Using result.filteredData.stats (${result.filteredData.stats.length} items)`);
        filteredStats = result.filteredData.stats;
      }
      
      // Ensure we have valid data before proceeding - add debug logging
      // logger.info(`[DEBUG] filteredStats: { isArray: ${Array.isArray(filteredStats)}, length: ${filteredStats?.length || 0} }`);
      
      // If we still don't have valid data, log error
      if (!Array.isArray(filteredStats) || filteredStats.length === 0) {
        logger.error(`[ERROR] Failed to get valid filteredStats from result: ${JSON.stringify({
          resultKeys: Object.keys(result),
          filteredDataType: typeof result.filteredData,
          filteredDataKeys: result.filteredData ? Object.keys(result.filteredData) : 'N/A',
          statsType: typeof result.stats
        })}`);
      }

      // Log detailed stats being sent (up to 20 for brevity) in a concise table
      // (Removed verbose prompt and data logging to console)

      // Construct a natural language prompt with the data
      const segmentsUsed = (result.segments && Array.isArray(result.segments))
        ? result.segments.join(", ")
        : DEFAULT_SEGMENTS.join(", ");

      // Group filteredStats by fileId, question, response
      const groupStats = (stats: any[]) => {
        // Defensive check to ensure stats is an array
        if (!Array.isArray(stats)) {
          logger.error(`[ERROR] groupStats received non-array: ${typeof stats}`);
          return []; // Return empty array to prevent errors
        }
        const grouped = [];
        const keyMap = new Map();
        for (const stat of stats) {
          const key = `${stat.fileId}||${stat.question}||${stat.response}`;
          if (!keyMap.has(key)) {
            keyMap.set(key, {
              fileId: stat.fileId,
              question: stat.question,
              response: stat.response,
              overall: null,
              region: {},
              age: {},
              gender: {}
            });
          }
          const entry = keyMap.get(key);
          if (stat.segment === "overall") {
            entry.overall = stat.percentage;
          } else if (stat.segment.startsWith("region:")) {
            const region = stat.segment.split(":")[1];
            entry.region[region] = stat.percentage;
          } else if (stat.segment.startsWith("age:")) {
            const age = stat.segment.split(":")[1];
            entry.age[age] = stat.percentage;
          } else if (stat.segment.startsWith("gender:")) {
            const gender = stat.segment.split(":")[1];
            entry.gender[gender] = stat.percentage;
          }
        }
        return Array.from(keyMap.values());
      };

      const formatGroupedStats = (grouped: any[]) => {
        return grouped.map(entry => {
          let lines = [];
          lines.push(`Question: ${entry.question}`);
          lines.push(`Response: ${entry.response}`);
          if (entry.overall !== null) {
            lines.push(`- overall: ${entry.overall}%`);
          }
          if (Object.keys(entry.region).length > 0) {
            lines.push(`- region { ${Object.entries(entry.region).map(([k, v]) => `${k}: ${v}%`).join(", ")} }`);
          }
          if (Object.keys(entry.age).length > 0) {
            lines.push(`- age { ${Object.entries(entry.age).map(([k, v]) => `${k}: ${v}%`).join(", ")} }`);
          }
          if (Object.keys(entry.gender).length > 0) {
            lines.push(`- gender { ${Object.entries(entry.gender).map(([k, v]) => `${k}: ${v}%`).join(", ")} }`);
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

      // Write the full prompt to logs/assistant_full_prompt.txt for inspection
      if (!process.env.VERCEL) {
        try {
          const logsDir = path.join(process.cwd(), "logs");
          const promptLogFile = path.join(logsDir, "assistant_full_prompt.txt");
          await fs.promises.mkdir(logsDir, { recursive: true });
          await fs.promises.writeFile(promptLogFile, standardModePrompt, "utf8");
          // logger.info(`[LOG] Full assistant prompt written to ${promptLogFile}`);
        } catch (err) {
          logger.error("Failed to write full assistant prompt to log:", err);
        }
      }

      content = standardModePrompt;
    } else if (!isStarterQuestion(content) && isDirectMode && !forceStandardMode) {
      // For DIRECT mode, track file IDs after identifyRelevantFiles
      cachedFileIds = await getCachedFilesForThread(finalThreadId);
      const relevantFilesResult = await identifyRelevantFiles(content, "all-sector");
      if (relevantFilesResult?.file_ids) {
        usedFileIds = Array.from(new Set([...(cachedFileIds || []), ...(relevantFilesResult.file_ids || [])])).map(String);
      }
      // Efficient summary log for DIRECT mode
      const fileCount = usedFileIds.length;
      // logger.info(`[DATA] DIRECT MODE: Identified ${fileCount} relevant files.`);
    }

    // Concise log for prompt sent to assistant
    // (Removed prompt content logging to console)

    // Add the user message to the thread
    await openai.beta.threads.messages.create(finalThreadId, {
      role: "user",
      content: content,
    });
    logger.info(`[ASSISTANT] Message sent to thread: ${finalThreadId}`);

    // Create a run with the assistant
    const startTime = Date.now();
    // Only pass the mode information to the assistant, not a full set of instructions
    // The assistant already has comprehensive instructions in its configuration
    const run = await openai.beta.threads.runs.create(finalThreadId, {
      assistant_id: assistantId,
      instructions: (isDirectMode && !forceStandardMode) ? "OPERATING MODE: DIRECT" : "OPERATING MODE: STANDARD",
    });
    
    perfTimings.runCreated = Date.now();

    const assistantCreationTime = ((Date.now() - startTime) / 1000).toFixed(3);

    // Create a simpler manual streaming implementation
    // This implementation avoids issues with controller closing by keeping event handling simple
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          perfTimings.pollStart = Date.now();
          
          // Send initial events
          controller.enqueue(encoder.encode(`event: run\ndata: ${JSON.stringify({
            id: run.id,
            status: "created",
            event: "created",
          })}\n\n`));
          
          // Poll for completion
          let runStatus = "queued";
          let messageReceived = false;
          let pollCount = 0;
          
          while (!messageReceived && runStatus !== "failed") {
            try {
              pollCount++;
              
              // Record first poll time
              if (pollCount === 1) {
                perfTimings.firstPoll = Date.now();
              }
              
              // Get current status
              const currentRun = await openai.beta.threads.runs.retrieve(finalThreadId, run.id);
              runStatus = currentRun.status;
              
              // Send status update
              controller.enqueue(encoder.encode(`event: run\ndata: ${JSON.stringify({
                id: run.id,
                status: runStatus,
                event: runStatus,
              })}\n\n`));
              
              // If requires_action, handle tools
              if (runStatus === "requires_action" && 
                  currentRun.required_action?.type === "submit_tool_outputs" &&
                  currentRun.required_action.submit_tool_outputs?.tool_calls) {
                
                const toolCalls = currentRun.required_action.submit_tool_outputs.tool_calls;
                
                for (const toolCall of toolCalls) {
                  if (toolCall.function.name === "retrieve_workforce_data") {
                    try {
                      // Start a timer for performance tracking
                      const toolStartTime = performance.now();
                      
                      const args = JSON.parse(toolCall.function.arguments);
                      const query = args.query;
                      
                      if (!query) throw new Error("Missing query parameter");
                      
                      // Get cached files for this thread if available
                      const cachedFileIds = await getCachedFilesForThread(finalThreadId);
                      
                      // DIRECT MODE: Only identify relevant files without retrieving data
                      if (isDirectMode && !forceStandardMode) {
                        // We deliberately DO NOT retrieve/extract data - only identify files
                        const relevantFilesResult = await identifyRelevantFiles(query, "all-sector");
                        const fileIdArray = relevantFilesResult?.file_ids || [];
                        
                        // Merge with cached files (avoid duplicates)
                        const allRelevantFileIds = Array.from(
                          new Set([...(cachedFileIds || []), ...(fileIdArray || [])])
                        );
                        
                        // IMMEDIATE SUBMISSION - Submit just the file IDs to the assistant
                        // Do this before extensive logging to minimize response time
                        await openai.beta.threads.runs.submitToolOutputs(finalThreadId, run.id, {
                          tool_outputs: [{
                            tool_call_id: toolCall.id,
                            output: JSON.stringify({
                              prompt: query,
                              file_ids: allRelevantFileIds,
                              matched_topics: relevantFilesResult.matched_topics || [],
                              is_followup_query: cachedFileIds.length > 0,
                              explanation: relevantFilesResult.explanation || "No explanation provided"
                            }),
                          }],
                        });
                        
                        // Non-critical operations moved after submission
                        const identificationTime = performance.now() - toolStartTime;
                        // console.log("\n=== FILE IDENTIFICATION SUMMARY (DIRECT MODE) ===");
                        // console.log(`THREAD ID: ${finalThreadId}`);
                        // console.log(`PROMPT: "${query}"`);
                        // console.log(`FILE COUNT: ${allRelevantFileIds.length}`);
                        // console.log(`FILE IDS: ${JSON.stringify(allRelevantFileIds, null, 2)}`);
                        // console.log(`RESPONSE TIME: ${Math.round(identificationTime)}ms`);
                        // console.log(`IS FOLLOWUP: ${cachedFileIds.length > 0 ? "YES" : "NO"}`);
                        // console.log("================================\n");
                      } else {
                        // STANDARD MODE: Process and retrieve data
                        const result = await processQueryWithData(query, "all-sector", cachedFileIds, finalThreadId);

                        // IMMEDIATE SUBMISSION - Send processed data to assistant right away
                        await openai.beta.threads.runs.submitToolOutputs(finalThreadId, run.id, {
                          tool_outputs: [{
                            tool_call_id: toolCall.id,
                            output: JSON.stringify({
                              filteredData: result.filteredData,
                              queryIntent: result.queryIntent,
                              dataScope: result.dataScope,
                              cacheStatus: result.cacheStatus,
                              processing_time_ms: result.processing_time_ms,
                            }),
                          }],
                        });

                        // Non-critical operations moved after submission
                        if (result.dataScope && result.dataScope.fileIds && result.dataScope.fileIds.size > 0) {
                          const fileIdsArray = Array.from(result.dataScope.fileIds).map(String);
                          updateThreadCache(finalThreadId, fileIdsArray).catch(err => {
                            // console.error("Error updating thread cache:", err);
                          });
                        }

                        // Logging moved after submission
                        // console.log("\n=== DATA RETRIEVAL SUMMARY (STANDARD MODE) ===");
                        // console.log(`THREAD ID: ${finalThreadId}`);
                        // console.log(`PROMPT: "${query}"`);
                        // console.log(`CACHE STATUS: ${result.cacheStatus}`);
                        // console.log(`PROCESSING TIME: ${result.processing_time_ms}ms`);
                        // console.log("================================\n");
                      }
                    } catch (error) {
                      logger.error("Error processing tool call:", error);
                      // Still need to submit even on error
                      await openai.beta.threads.runs.submitToolOutputs(finalThreadId, run.id, {
                        tool_outputs: [{
                          tool_call_id: toolCall.id,
                          output: JSON.stringify({ error: error.message }),
                        }],
                      });
                    }
                  }
                }
              }
              
              // If completed, get the message
              if (runStatus === "completed") {
                const messages = await openai.beta.threads.messages.list(finalThreadId);
                
                if (messages.data && messages.data.length > 0) {
                  // Record when message was received
                  perfTimings.messageReceived = Date.now();
                  
                  const message = messages.data[0];
                  let fullText = "";
                  
                  for (const content of message.content) {
                    if (content.type === "text") {
                      fullText += content.text.value;
                    }
                  }
                  
                  // Clean the text
                  const cleanText = sanitizeOutput(fullText);
                  
                  // Add debug log for text content - REMOVED
                  // logger.debug(`Sending text content (${cleanText.length} chars)`);
                  
                  // Stream text in smaller chunks with a moderate delay for visible but smoother streaming
                  const chunkSize = 40; // Increased from 25 to 40 characters per chunk
                  for (let i = 0; i < cleanText.length; i += chunkSize) {
                    const chunk = cleanText.substring(i, i + chunkSize);
                    
                    controller.enqueue(encoder.encode(`event: textDelta\ndata: ${JSON.stringify({
                      value: chunk,
                    })}\n\n`));
                    
                    // Moderate delay for visible but smoother streaming
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  
                  // Then send the full message
                  // logger.debug("Sending messageDone event with content length:", cleanText.length);
                  controller.enqueue(encoder.encode(`event: messageDone\ndata: ${JSON.stringify({
                    id: message.id,
                    threadId: finalThreadId,
                    role: message.role,
                    content: cleanText,
                    createdAt: message.created_at,
                    runId: run.id,
                  })}\n\n`));
                  
                  messageReceived = true;
                }
              }
              
              // If failed, send error
              if (runStatus === "failed") {
                const errorMessage = currentRun.last_error
                  ? `${currentRun.last_error.code}: ${currentRun.last_error.message}`
                  : "Unknown error";
                
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                  message: `Run failed: ${errorMessage}`,
                  code: currentRun.last_error?.code || "unknown",
                  runId: run.id,
                })}\n\n`));
              }
              
              // Short wait between polls
              if (!messageReceived && runStatus !== "failed") {
                await new Promise(resolve => setTimeout(resolve, perfTimings.pollingInterval));
              }
            } catch (error) {
              logger.error("Error in polling loop:", error);
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                message: `Error processing run: ${error.message}`,
              })}\n\n`));
              break;
            }
          }
          
          // Log performance data
          perfTimings.totalTime = Date.now() - apiStartTime;
          logger.info(`[PERF] Response time: ${perfTimings.totalTime}ms | Run creation: ${perfTimings.runCreated - apiStartTime}ms | Processing: ${perfTimings.messageReceived - perfTimings.runCreated}ms | Poll count: ${pollCount}`);
          
          // Save to performance_metrics.log file
          // Robust query extraction for logging
          let queryText = "";
          if (content.includes('Query:')) {
            // Try to extract after "Query:"
            queryText = content.split('Query:')[1].split('\n')[0].trim();
          } else if (originalUserContent && typeof originalUserContent === "string") {
            queryText = originalUserContent.substring(0, 100);
          } else {
            queryText = "";
          }
          if (!queryText) {
            queryText = "??";
          }

          // pollCount and perfTimings.totalTime are already correct
          // status: 200 for success, or use runStatus if available
          let statusCode = 200;
          if (typeof runStatus === "string" && runStatus !== "completed") {
            if (runStatus === "failed") {
              statusCode = 500;
            } else {
              statusCode = 0;
            }
          }

          // Always ensure arrays for file IDs
          const safeCachedFileIds = Array.isArray(cachedFileIds) ? cachedFileIds : [];
          const safeUsedFileIds = Array.isArray(usedFileIds) ? usedFileIds : [];

          // Log to file in the original format, using tracked file IDs
          logPerformanceToFile(
            queryText,
            safeCachedFileIds,
            safeUsedFileIds,
            pollCount,
            perfTimings.totalTime,
            statusCode,
            "" // No extra message
          );
          
        } catch (error) {
          logger.error("Stream start error:", error);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
            message: `Stream error: ${error.message}`,
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    // Return the stream
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    logger.error("Error in chat-assistant API:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Update the PUT handler to handle errors better and validate input
export async function PUT(request: NextRequest) {
  try {
    // Parse the request with error handling
    let requestBody;
    try {
      requestBody = await request.json();
      // logger.info("PUT request body received:", {
      //   hasThreadId: !!requestBody.threadId,
      //   hasRunId: !!requestBody.runId,
      //   hasToolCall: !!requestBody.toolCall,
      //   toolCallType: requestBody.toolCall?.function?.name || 'unknown'
      // });
    } catch (parseError) {
      logger.error("Failed to parse request JSON:", parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body", 
        details: parseError.message 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const { threadId, runId, toolCall } = requestBody;
    
    // Validate all required fields
    if (!threadId || !runId || !toolCall || !toolCall.id || !toolCall.function || !toolCall.function.name) {
      const missingFields = [];
      if (!threadId) missingFields.push('threadId');
      if (!runId) missingFields.push('runId');
      if (!toolCall) missingFields.push('toolCall');
      else {
        if (!toolCall.id) missingFields.push('toolCall.id');
        if (!toolCall.function) missingFields.push('toolCall.function');
        else if (!toolCall.function.name) missingFields.push('toolCall.function.name');
      }
      
      logger.error("Missing required fields in PUT request:", missingFields);
      return new Response(JSON.stringify({ 
        error: "Missing required fields", 
        missingFields 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // logger.info("Tool call received:", {
    //   threadId,
    //   runId,
    //   toolName: toolCall.function.name,
    // });
    
    // Initialize OpenAI client with timeout
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 2
    });
    
    // Handle the retrieve_workforce_data function
    if (toolCall.function.name === "retrieve_workforce_data") {
      // Parse arguments with error handling
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
        // logger.debug("[TOOL] Function arguments:", JSON.stringify(args));
      } catch (argError) {
        logger.error("[ERROR] Failed to parse function arguments for tool call:", argError);
        args = {}; // Default to empty object
      }
      
      const query = args.query || "workforce trends";
      logger.info(`[TOOL] Processing retrieval for query: "${query}" | Thread: ${threadId}`);
      
      try {
        // Get cached files for this thread if available
        const cachedFileIds = await getCachedFilesForThread(threadId);
        // logger.info(`[CACHE] Thread ${threadId} has ${cachedFileIds.length} cached file IDs`);
        
        if (isDirectMode && !forceStandardMode) {
          // DIRECT MODE: Only identify relevant files without retrieving data
          // We deliberately DO NOT retrieve/extract data - only identify files
          // The assistant has vector store access and will retrieve data itself
          const identificationStartTime = performance.now();
          
          logger.info("⭐ DIRECT MODE: Only identifying files, SKIPPING DATA EXTRACTION");
          
          // Identify relevant files
          const relevantFilesResult = await identifyRelevantFiles(query, "all-sector");
          logger.info(`Identified ${relevantFilesResult.file_ids?.length || 0} relevant files`);
          
          // Record identification time
          const identificationTime = performance.now() - identificationStartTime;
          
          // Merge with cached files (avoid duplicates)
          const allRelevantFileIds = Array.from(new Set([
            ...(cachedFileIds || []),
            ...(relevantFilesResult.file_ids || [])
          ]));
          
          // Update thread cache with ALL file IDs
          if (allRelevantFileIds.length > 0) {
            // logger.info(`[CACHE] Updating thread cache with ${allRelevantFileIds.length} file IDs`);
            await updateThreadCache(threadId, allRelevantFileIds);
          }
          
          // logger.info("File identification completed successfully");
          
          // Submit the tool outputs back to the assistant
          try {
            logger.info("Submitting tool output to OpenAI run:", runId);
            
            // Log direct mode summary
            // logger.info("=== DATA RETRIEVAL SUMMARY (DIRECT MODE) ===");
            // logger.info(`THREAD ID: ${threadId}`);
            // logger.info(`PROMPT: "${query}"`);
            // logger.info(`FILE COUNT: ${allRelevantFileIds.length}`);
            // logger.debug(`FILE IDS: ${JSON.stringify(allRelevantFileIds, null, 2)}`);
            // logger.info(`RESPONSE TIME: ${Math.round(identificationTime)}ms`);
            // logger.info(`IS FOLLOWUP: ${cachedFileIds.length > 0 ? "YES" : "NO"}`);
            // logger.info("================================");
            
            // Send just the file IDs to the assistant
            await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    prompt: query,
                    file_ids: allRelevantFileIds,
                    matched_topics: relevantFilesResult.matched_topics || [],
                    is_followup_query: cachedFileIds.length > 0,
                    explanation: relevantFilesResult.explanation || "No explanation provided"
                  })
                }
              ]
            });
            logger.info("Tool output submitted successfully");
            
            return new Response(JSON.stringify({ 
              status: "success",
              file_ids: allRelevantFileIds.length,
              identification_time_ms: Math.round(identificationTime)
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (submitError) {
            logger.error("Error submitting tool output:", submitError);
            throw submitError;
          }
        } else {
          // STANDARD MODE: Process and retrieve data (new smart filtering approach)
          // Always call processQueryWithData with threadId for cache and follow-up support
          const result = await processQueryWithData(query, "all-sector", cachedFileIds, threadId);

          // If we got new files, update the thread cache (if applicable)
          if (result.dataScope && result.dataScope.fileIds && result.dataScope.fileIds.size > 0) {
            const fileIdsArray = Array.from(result.dataScope.fileIds).map(String);
            logger.info(`[CACHE] Updating thread cache with ${fileIdsArray.length} files`);
            await updateThreadCache(threadId, fileIdsArray);
          }

          // Log clear summary of the critical data
          // logger.info("=== DATA RETRIEVAL SUMMARY (STANDARD MODE) ===");
          // logger.info(`THREAD ID: ${threadId}`);
          // logger.info(`PROMPT: "${query}"`);
          // logger.info(`CACHE STATUS: ${result.cacheStatus}`);
          // logger.info(`PROCESSING TIME: ${result.processing_time_ms}ms`);
          // logger.info("================================");

          // Log detailed stats being sent (up to 20 for brevity) in a concise table
          const filteredStats = (result.filteredData?.stats || []).filter(
            stat => DEFAULT_SEGMENTS.includes(stat.category)
          );
          if (filteredStats.length > 0) {
            const maxStatsToLog = 20;
            logger.info(`[DATA] Stats sent to assistant (showing up to ${maxStatsToLog}):`);
            // Print header
            logger.info(
              `| # | fileId         | category      | segment        | value         | question`
            );
            logger.info(
              `|---|---------------|--------------|---------------|--------------|---------`
            );
            filteredStats.slice(0, maxStatsToLog).forEach((stat, idx) => {
              logger.info(
                `| ${String(idx + 1).padEnd(2)}| ${String(stat.fileId).padEnd(13)} | ${String(stat.category).padEnd(12)} | ${String(stat.segment).padEnd(13)} | ${String(stat.value).padEnd(12)} | ${stat.question}`
              );
            });
            if (filteredStats.length > maxStatsToLog) {
              logger.info(`[DATA] ...and ${filteredStats.length - maxStatsToLog} more stats not shown.`);
            }
          } else {
            logger.info(`[DATA] No stats matched for selected segments.`);
          }

          // Submit the tool outputs back to the assistant
          try {
            logger.info("Submitting tool output to OpenAI run:", runId);

            await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    filteredData: result.filteredData,
                    queryIntent: result.queryIntent,
                    dataScope: result.dataScope,
                    cacheStatus: result.cacheStatus,
                    processing_time_ms: result.processing_time_ms,
                  }),
                },
              ],
            });
            logger.info("Tool output submitted successfully");

            return new Response(
              JSON.stringify({
                status: "success",
                cacheStatus: result.cacheStatus,
                processing_time_ms: result.processing_time_ms,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                },
              }
            );
          } catch (submitError) {
            logger.error("Error submitting tool output:", submitError);
            throw submitError;
          }
        }
      } catch (error) {
        logger.error("Error processing data retrieval:", error);
        
        // Submit error back to the assistant (if we have valid threadId and runId)
        try {
          if (threadId && runId && toolCall.id) {
            await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    error: error.message || "Error processing workforce data retrieval"
                  })
                }
              ]
            });
          }
        } catch (submitError) {
          logger.error("Error submitting tool error output:", submitError);
        }
        
        return new Response(JSON.stringify({ 
          status: "error", 
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Handle unsupported function
    return new Response(JSON.stringify({ error: "Unsupported function" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    logger.error("Tool call handling error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
