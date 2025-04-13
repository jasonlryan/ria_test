// I created this route to get my updates working, I left the others just in case - they're not being used in the embed page though.
// This repo got me started: https://github.com/Superexpert/openai-assistant-starter-kit

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Stream } from "openai/streaming";
import readline from "readline";
import fs from 'fs';
import path from 'path';

// Add import for retrieval system
import { processQueryWithData, identifyRelevantFiles, getPrecompiledStarterData, isStarterQuestion } from "../../../utils/openai/retrieval";

// Add import for cache utilities
import { getCachedFilesForThread, updateThreadCache } from "../../../utils/cache-utils";

// Check if we're in direct mode (file IDs only) or standard mode (processed data)
console.log(`[ENV] FILE_ACCESS_MODE is set to: '${process.env.FILE_ACCESS_MODE}'`);
const isDirectMode = process.env.FILE_ACCESS_MODE === 'direct';
console.log(`[MODE] Running in ${isDirectMode ? 'DIRECT (file IDs only)' : 'STANDARD (processed data)'} mode`);

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

/**
 * Sanitizes the output from OpenAI to remove embedded citation markers
 */
function sanitizeOutput(text: string): string {
  // Use the simpler version from staging: only remove [[n](#source)] style citations
  // This avoids collapsing whitespace which breaks markdown.
  return String(text || '').replace(/\[\[(\d+)\]\(#.*?\)\]/g, "");
}

/**
 * Determines if the message content is likely a valid JSON string
 */
function isJsonContent(content: string): boolean {
  if (typeof content !== 'string') return false;
  
  // Try to parse as JSON
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object';
  } catch {
    return false; 
  }
}

/**
 * Logs performance metrics in a consistent format for testing
 */
function logPerformanceMetrics(stage, metrics) {
  console.log(`\n----- ${stage} -----`);
  Object.entries(metrics).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.log("---------------------");
}

/**
 * Logs performance metrics to the performance_metrics.log file asynchronously
 */
function logPerformanceToFile(query, cachedFileIds, fileIds, pollCount, totalTimeMs, status, message = '') {
  // Create the log entry first, before any IO
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'performance_metrics.log');
  
  // Format the log entry (query | cachedFileIds | fileIds | pollCount | responseTime | status | timestamp)
  const cachedFileIdsStr = Array.isArray(cachedFileIds) ? cachedFileIds.join(',') : '';
  const fileIdsStr = Array.isArray(fileIds) ? fileIds.join(',') : '';
  const timestamp = new Date().toISOString();
  
  const logEntry = `${query.substring(0, 100)} | ${cachedFileIdsStr} | ${fileIdsStr} | ${pollCount} | ${totalTimeMs} | ${status} | ${timestamp}\n`;
  
  // Don't block the main thread - use async file operations
  // This is not awaited, so it won't block the response
  fs.promises.mkdir(logDir, { recursive: true })
    .then(() => fs.promises.appendFile(logFile, logEntry))
    .then(() => {
      // Only log success at debug level
      if (process.env.NODE_ENV === 'development') {
        console.log(`Performance metrics saved to ${logFile}`);
      }
    })
    .catch(error => {
      console.error('Error writing to performance log:', error);
    });
}

/**
 * Waits until there are no active runs on the thread.
 * Active statuses: "queued", "in_progress", "requires_action"
 */
async function waitForNoActiveRuns(openai: OpenAI, threadId: string, pollInterval = 250, timeoutMs = 60000) {
  const activeStatuses = new Set(["queued", "in_progress", "requires_action"]);
  const start = Date.now();
  while (true) {
    const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    const activeRun = runs.data.find(run => activeStatuses.has(run.status));
    if (!activeRun) break;
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timeout waiting for previous run to complete on thread " + threadId);
    }
    await new Promise(res => setTimeout(res, pollInterval));
  }
}

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
    console.error('Error writing starter question invocation log:', err);
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

    // Starter Question Optimization: Intercept starter question codes and route to assistant with special prompt
    if (isStarterQuestion(content)) {
      const precompiled = getPrecompiledStarterData(content);
      if (precompiled) {
        // Improved logging for starter questions
        console.log(`[QUERY API] 🚀 Starter question detected: ${content} (using precompiled data from utils/openai/precompiled_starters/${content.toUpperCase()}.json)`);
        console.log(`[QUERY API] 📦 Sending precompiled data files: ${content.toUpperCase()}.json`);
        console.log(`[QUERY API] 🔕 Retrieval step bypassed for starter question.`);

        // Call the logging function (fire and forget)
        logStarterQuestionInvocation({
          starterQuestionCode: precompiled.starterQuestionCode || content,
          question: precompiled.question,
          assistantId,
          threadId,
          dataFiles: precompiled.data_files,
          stats: precompiled.stats
        });

        // Load the starter prompt template
        const starterPromptPath = path.join(process.cwd(), "prompts", "starter_prompt_template.md");
        let starterPromptTemplate = "";
        try {
          starterPromptTemplate = fs.readFileSync(starterPromptPath, "utf8");
        } catch (err) {
          console.error("Error loading starter prompt template:", err);
          starterPromptTemplate = "You are answering a precompiled starter question. Use the provided summary and stats to generate a narrative response.";
        }

        // Build the full prompt for the assistant
        const fullPrompt =
  `${starterPromptTemplate}

  ---
  Starter Question: ${precompiled.question || content}
  Summary: ${precompiled.summary}
  Stats: ${JSON.stringify(precompiled.stats, null, 2)}
  Matched Topics: ${precompiled.matched_topics ? precompiled.matched_topics.join(", ") : ""}
  Data Files: ${precompiled.data_files ? precompiled.data_files.join(", ") : ""}
  ${precompiled.notes ? "Notes: " + precompiled.notes : ""}
  `;

        // Replace the user content with the constructed prompt
        body.content = fullPrompt;
        content = body.content;
      }
      // If not found, continue as normal (could also return an error)
    }

    if (!assistantId) {
      return NextResponse.json(
        { error: "Missing required field: assistantId" },
        { status: 400 }
      );
    }
    
    console.log(`[REQUEST] New ${threadId ? "follow-up" : "initial"} request | Assistant: ${assistantId}`);

    // Initialize OpenAI client with API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Log API key info for debugging (safely)
    console.log("OpenAI API Key info:", {
      defined: !!process.env.OPENAI_API_KEY,
      length: process.env.OPENAI_API_KEY?.length,
      prefix: process.env.OPENAI_API_KEY?.substring(0, 7),
      suffix: process.env.OPENAI_API_KEY?.substring(
        process.env.OPENAI_API_KEY.length - 4
      ),
    });

    // Handle thread creation if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      console.log("[THREAD] Creating new thread...");
      const thread = await openai.beta.threads.create();
      finalThreadId = thread.id;
      console.log(`[THREAD] Created new thread: ${finalThreadId}`);
    }

    // Wait for any active runs to finish before adding a new message
    await waitForNoActiveRuns(openai, finalThreadId);

    // Add the user message to the thread
    await openai.beta.threads.messages.create(finalThreadId, {
      role: "user",
      content: content,
    });
    console.log(`[THREAD] Added message to thread: ${finalThreadId}`);

    // Create a run with the assistant
    console.log(`[ASSISTANT] Creating run with assistant ${assistantId}`);

    const startTime = Date.now();
    // Only pass the mode information to the assistant, not a full set of instructions
    // The assistant already has comprehensive instructions in its configuration
    const run = await openai.beta.threads.runs.create(finalThreadId, {
      assistant_id: assistantId,
      instructions: isDirectMode ? "OPERATING MODE: DIRECT" : "OPERATING MODE: STANDARD",
    });
    
    perfTimings.runCreated = Date.now();

    const assistantCreationTime = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`[ASSISTANT] Run creation time: ${assistantCreationTime}s`);
    console.log(`[ASSISTANT] Run ID: ${run.id} | Thread ID: ${finalThreadId}`);

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
                      if (isDirectMode) {
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
                        console.log("\n=== FILE IDENTIFICATION SUMMARY (DIRECT MODE) ===");
                        console.log(`THREAD ID: ${finalThreadId}`);
                        console.log(`PROMPT: "${query}"`);
                        console.log(`FILE COUNT: ${allRelevantFileIds.length}`);
                        console.log(`FILE IDS: ${JSON.stringify(allRelevantFileIds, null, 2)}`);
                        console.log(`RESPONSE TIME: ${Math.round(identificationTime)}ms`);
                        console.log(`IS FOLLOWUP: ${cachedFileIds.length > 0 ? "YES" : "NO"}`);
                        console.log("================================\n");
                      } else {
                        // STANDARD MODE: Process and retrieve data
                        const result = await processQueryWithData(query, "all-sector", cachedFileIds);
                        
                        // IMMEDIATE SUBMISSION - Send processed data to assistant right away
                        await openai.beta.threads.runs.submitToolOutputs(finalThreadId, run.id, {
                          tool_outputs: [{
                            tool_call_id: toolCall.id,
                            output: JSON.stringify({
                              analysis: result.analysis,
                              files_used: result.files_used,
                              matched_topics: result.matched_topics,
                              data_points: result.data_points,
                              processing_time_ms: result.processing_time_ms,
                            }),
                          }],
                        });
                        
                        // Non-critical operations moved after submission
                        if (result.file_ids && result.file_ids.length > 0 && !result.status?.includes("follow_up")) {
                          updateThreadCache(finalThreadId, result.file_ids).catch(err => {
                            console.error("Error updating thread cache:", err);
                          });
                        }
                        
                        // Logging moved after submission
                        console.log("\n=== DATA RETRIEVAL SUMMARY (STANDARD MODE) ===");
                        console.log(`THREAD ID: ${finalThreadId}`);
                        console.log(`PROMPT: "${query}"`);
                        console.log(`FILE COUNT: ${result.file_ids?.length || 0}`);
                        console.log(`FILE IDS: ${JSON.stringify(result.file_ids || [])}`);
                        console.log(`RESPONSE TIME: ${result.processing_time_ms}ms`);
                        console.log(`IS FOLLOWUP: ${result.status?.includes("follow_up") ? "YES" : "NO"}`);
                        console.log("================================\n");
                      }
                    } catch (error) {
                      console.error("Error processing tool call:", error);
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
                  
                  // Add debug log for text content
                  console.log(`Sending text content (${cleanText.length} chars)`);
                  
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
                  console.log("Sending messageDone event with content length:", cleanText.length);
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
              console.error("Error in polling loop:", error);
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                message: `Error processing run: ${error.message}`,
              })}\n\n`));
              break;
            }
          }
          
          // Log performance data
          perfTimings.totalTime = Date.now() - apiStartTime;
          console.log("\n===== PERFORMANCE METRICS =====");
          console.log(`Total response time: ${perfTimings.totalTime}ms`);
          console.log(`Run creation time: ${perfTimings.runCreated - apiStartTime}ms`);
          console.log(`Processing time: ${perfTimings.messageReceived - perfTimings.runCreated}ms`);
          console.log(`Polling interval: ${perfTimings.pollingInterval}ms`);
          console.log(`Poll count: ${pollCount}`);
          console.log(`CHANGE LOG: Reduced polling interval to ${perfTimings.pollingInterval}ms (from 1000ms)`);
          console.log("===============================\n");
          
          // Save to performance_metrics.log file
          // Extract query from content (first 100 chars max)
          const queryText = content.includes('Query:') 
            ? content.split('Query:')[1].split('\n')[0].trim()
            : content.substring(0, 100);

          // Get cached file IDs if available
          const cachedFileIds = await getCachedFilesForThread(finalThreadId);

          // Log to file with polling optimization details - AFTER sending response
          const logMessage = `Polling interval: ${perfTimings.pollingInterval}ms (reduced from 1000ms)`;
          logPerformanceToFile(
            queryText,
            cachedFileIds, 
            [], // File IDs from this request (not easily available here)
            pollCount, 
            perfTimings.totalTime,
            0, // Status code
            logMessage
          );
          
        } catch (error) {
          console.error("Stream start error:", error);
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
    console.error("Error in chat-assistant API:", error);
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
      console.log("PUT request body received:", {
        hasThreadId: !!requestBody.threadId,
        hasRunId: !!requestBody.runId,
        hasToolCall: !!requestBody.toolCall,
        toolCallType: requestBody.toolCall?.function?.name || 'unknown'
      });
    } catch (parseError) {
      console.error("Failed to parse request JSON:", parseError);
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
      
      console.error("Missing required fields:", missingFields);
      return new Response(JSON.stringify({ 
        error: "Missing required fields", 
        missingFields 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    console.log("Tool call received:", {
      threadId,
      runId,
      toolName: toolCall.function.name,
    });
    
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
        console.log("[TOOL] Function arguments:", JSON.stringify(args));
      } catch (argError) {
        console.error("[ERROR] Failed to parse function arguments:", argError);
        args = {}; // Default to empty object
      }
      
      const query = args.query || "workforce trends";
      console.log(`[TOOL] Processing retrieval for query: "${query}" | Thread: ${threadId}`);
      
      try {
        // Get cached files for this thread if available
        const cachedFileIds = await getCachedFilesForThread(threadId);
        console.log(`[CACHE] Thread ${threadId} has ${cachedFileIds.length} cached file IDs`);
        
        if (isDirectMode) {
          // DIRECT MODE: Only identify relevant files without retrieving data
          // We deliberately DO NOT retrieve/extract data - only identify files
          // The assistant has vector store access and will retrieve data itself
          const identificationStartTime = performance.now();
          
          console.log("⭐ DIRECT MODE: Only identifying files, SKIPPING DATA EXTRACTION");
          
          // Identify relevant files
          const relevantFilesResult = await identifyRelevantFiles(query, "all-sector");
          console.log(`Identified ${relevantFilesResult.file_ids?.length || 0} relevant files`);
          
          // Record identification time
          const identificationTime = performance.now() - identificationStartTime;
          
          // Merge with cached files (avoid duplicates)
          const allRelevantFileIds = Array.from(new Set([
            ...(cachedFileIds || []),
            ...(relevantFilesResult.file_ids || [])
          ]));
          
          // Update thread cache with ALL file IDs
          if (allRelevantFileIds.length > 0) {
            console.log(`[CACHE] Updating thread cache with ${allRelevantFileIds.length} file IDs`);
            await updateThreadCache(threadId, allRelevantFileIds);
          }
          
          console.log("File identification completed successfully");
          
          // Submit the tool outputs back to the assistant
          try {
            console.log("Submitting tool output to OpenAI run:", runId);
            
            // Log direct mode summary
            console.log("\n=== DATA RETRIEVAL SUMMARY (DIRECT MODE) ===");
            console.log(`THREAD ID: ${threadId}`);
            console.log(`PROMPT: "${query}"`);
            console.log(`FILE COUNT: ${allRelevantFileIds.length}`);
            console.log(`FILE IDS: ${JSON.stringify(allRelevantFileIds, null, 2)}`);
            console.log(`RESPONSE TIME: ${Math.round(identificationTime)}ms`);
            console.log(`IS FOLLOWUP: ${cachedFileIds.length > 0 ? "YES" : "NO"}`);
            console.log("================================\n");
            
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
            console.log("Tool output submitted successfully");
            
            return new Response(JSON.stringify({ 
              status: "success",
              file_ids: allRelevantFileIds.length,
              identification_time_ms: Math.round(identificationTime)
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (submitError) {
            console.error("Error submitting tool output:", submitError);
            throw submitError;
          }
        } else {
          // STANDARD MODE: Process and retrieve data (existing approach)
          // Call our optimized data retrieval function with cached files
          const result = await processQueryWithData(query, "all-sector", cachedFileIds);
          
          // If we got new files, update the thread cache
          if (result.file_ids && result.file_ids.length > 0 && !result.status?.includes("follow_up")) {
            console.log(`[CACHE] Updating thread cache with ${result.file_ids.length} files`);
            await updateThreadCache(threadId, result.file_ids);
          }
          
          // Log clear summary of the critical data
          console.log("\n=== DATA RETRIEVAL SUMMARY (STANDARD MODE) ===");
          console.log(`THREAD ID: ${threadId}`);
          console.log(`PROMPT: "${query}"`);
          console.log(`FILE COUNT: ${result.file_ids?.length || 0}`);
          console.log(`FILE IDS: ${JSON.stringify(result.file_ids || [])}`);
          console.log(`RESPONSE TIME: ${result.processing_time_ms}ms`);
          console.log(`IS FOLLOWUP: ${result.status?.includes("follow_up") ? "YES" : "NO"}`);
          console.log("================================\n");
          
          console.log("Data retrieval completed with", result.data_points, "data points");
          
          // Submit the tool outputs back to the assistant
          try {
            console.log("Submitting tool output to OpenAI run:", runId);
            
            await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
              tool_outputs: [
                {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    analysis: result.analysis,
                    files_used: result.files_used,
                    matched_topics: result.matched_topics,
                    data_points: result.data_points,
                    processing_time_ms: result.processing_time_ms
                  })
                }
              ]
            });
            console.log("Tool output submitted successfully");
            
            return new Response(JSON.stringify({ 
              status: "success",
              data_points: result.data_points,
              processing_time_ms: result.processing_time_ms
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (submitError) {
            console.error("Error submitting tool output:", submitError);
            throw submitError;
          }
        }
      } catch (error) {
        console.error("Error processing data retrieval:", error);
        
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
          console.error("Error submitting tool error output:", submitError);
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
    console.error("Tool call handling error:", error);
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
