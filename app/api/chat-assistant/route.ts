// I created this route to get my updates working, I left the others just in case - they're not being used in the embed page though.
// This repo got me started: https://github.com/Superexpert/openai-assistant-starter-kit

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Stream } from "openai/streaming";
import readline from "readline";

// Add import for retrieval system
import { processQueryWithData, identifyRelevantFiles } from "../../../utils/openai/retrieval";

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
  try {
    // Attempt to parse as JSON and check if it's an object
    const parsed = JSON.parse(content.trim());
    return typeof parsed === "object" && parsed !== null;
  } catch (e) {
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

// post a new message and stream OpenAI Assistant response
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { assistantId, threadId, content } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
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

    const assistantCreationTime = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`[ASSISTANT] Run creation time: ${assistantCreationTime}s`);
    console.log(`[ASSISTANT] Run ID: ${run.id} | Thread ID: ${finalThreadId}`);

    // Create a simpler manual streaming implementation
    // This implementation avoids issues with controller closing by keeping event handling simple
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial events
          controller.enqueue(encoder.encode(`event: run\ndata: ${JSON.stringify({
            id: run.id,
            status: "created",
            event: "created",
          })}\n\n`));
          
          // Poll for completion
          let runStatus = "queued";
          let messageReceived = false;
          
          while (!messageReceived && runStatus !== "failed") {
            try {
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
                      const args = JSON.parse(toolCall.function.arguments);
                      const query = args.query;
                      
                      if (!query) throw new Error("Missing query parameter");
                      
                      // Get cached files for this thread if available
                      const cachedFileIds = await getCachedFilesForThread(finalThreadId);
                      console.log(`[CACHE] Thread ${finalThreadId} has ${cachedFileIds.length} cached file IDs`);
                      
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
                          await updateThreadCache(finalThreadId, allRelevantFileIds);
                        }
                        
                        // Log direct mode summary
                        console.log("\n=== DATA RETRIEVAL SUMMARY (DIRECT MODE) ===");
                        console.log(`THREAD ID: ${finalThreadId}`);
                        console.log(`PROMPT: "${query}"`);
                        console.log(`FILE COUNT: ${allRelevantFileIds.length}`);
                        console.log(`FILE IDS: ${JSON.stringify(allRelevantFileIds, null, 2)}`);
                        console.log(`RESPONSE TIME: ${Math.round(identificationTime)}ms`);
                        console.log(`IS FOLLOWUP: ${cachedFileIds.length > 0 ? "YES" : "NO"}`);
                        console.log("================================\n");
                        
                        // Send just the file IDs to the assistant
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
                      } else {
                        // STANDARD MODE: Process and retrieve data (existing approach)
                        // Pass cached files to processQueryWithData
                        const result = await processQueryWithData(query, "all-sector", cachedFileIds);
                        
                        // If we got new files, update the thread cache
                        if (result.file_ids && result.file_ids.length > 0 && !result.status?.includes("follow_up")) {
                          console.log(`[CACHE] Updating thread cache with ${result.file_ids.length} files`);
                          await updateThreadCache(finalThreadId, result.file_ids);
                        }
                        
                        // Log standard mode summary
                        console.log("\n=== DATA RETRIEVAL SUMMARY (STANDARD MODE) ===");
                        console.log(`THREAD ID: ${finalThreadId}`);
                        console.log(`PROMPT: "${query}"`);
                        console.log(`FILE COUNT: ${result.file_ids?.length || 0}`);
                        console.log(`FILE IDS: ${JSON.stringify(result.file_ids || [])}`);
                        console.log(`RESPONSE TIME: ${result.processing_time_ms}ms`);
                        console.log(`IS FOLLOWUP: ${result.status?.includes("follow_up") ? "YES" : "NO"}`);
                        console.log("================================\n");
                        
                        // Send processed data to the assistant
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
                      }
                    } catch (error) {
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
                  
                  // MODIFICATION: Stream text in larger chunks for better performance while maintaining streaming
                  const chunkSize = 200; // Characters per chunk (increased from 50)
                  for (let i = 0; i < cleanText.length; i += chunkSize) {
                    const chunk = cleanText.substring(i, i + chunkSize);
                    
                    controller.enqueue(encoder.encode(`event: textDelta\ndata: ${JSON.stringify({
                      value: chunk,
                    })}\n\n`));
                    
                    // No delay between chunks for faster response times
                    // Previous code had: await new Promise(resolve => setTimeout(resolve, 30));
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
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            } catch (error) {
              console.error("Error in polling loop:", error);
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                message: `Error processing run: ${error.message}`,
              })}\n\n`));
              break;
            }
          }
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
