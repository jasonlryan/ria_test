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

    let result;

    if (!isStarterQuestion(content) && !(isDirectMode && !forceStandardMode)) {
      // For the first message in a thread, always load full data from files
      if (!isFollowUp) {
        // Identify relevant files for the query
        const relevantFilesResult = await identifyRelevantFiles(content, "all-sector");
        const fileIdArray = relevantFilesResult?.file_ids || [];

        // Load full data from files
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

        // Update cache with loaded files metadata only
        const cachedFilesForUpdate: CachedFile[] = loadedFiles.map(file => ({
          id: file.id,
          data: {},
          loadedSegments: file.loadedSegments,
          availableSegments: file.availableSegments
        }));

        await updateThreadCache(finalThreadId, cachedFilesForUpdate);

        // Process query with loaded file IDs
        result = await processQueryWithData(
          content,
          "all-sector",
          fileIdArray,
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

        usedFileIds = fileIdArray;
      } else {
        // For follow-up messages, load additional segments from files
        const cachedFiles = await getCachedFilesForThread(finalThreadId);
        cachedFileIds = cachedFiles.map(file => file.id);

        result = await processQueryWithData(
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

      // Extract filteredStats from result
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
              gender: {},
              job_level: {},
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
          } else if (stat.segment.startsWith("job_level:")) {
            const jobLevel = stat.segment.split(":")[1];
            entry.job_level[jobLevel] = stat.percentage;
          }
        }
        return Array.from(keyMap.values());
      };

      const formatGroupedStats = (grouped) => {
        if (!Array.isArray(grouped)) {
          logger.error(`[ERROR] formatGroupedStats received non-array: ${typeof grouped}`);
          return "No data matched for the selected segments.";
        }
        // Defensive check: if grouped is a function (likely a bug), return default message
        if (typeof grouped === "function") {
          logger.error("[ERROR] formatGroupedStats received a function instead of array");
          return "No data matched for the selected segments.";
        }
        return grouped.map((entry) => {
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
          if (Object.keys(entry.job_level).length > 0) {
            lines.push(`- job_level { ${Object.entries(entry.job_level).map(([k, v]) => `${k}: ${v}%`).join(", ")} }`);
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
      const relevantFilesResult = await identifyRelevantFiles(content, "all-sector");
      if (relevantFilesResult?.file_ids) {
        usedFileIds = Array.from(new Set([...(cachedFileIds || []), ...(relevantFilesResult.file_ids || [])])).map(String);
      }
    }

    await openai.beta.threads.messages.create(finalThreadId, {
      role: "user",
      content: content,
    });
    logger.info(`[ASSISTANT] Message sent to thread: ${finalThreadId}`);

    const startTime = Date.now();
    const run = await openai.beta.threads.runs.create(finalThreadId, {
      assistant_id: assistantId,
      instructions: (isDirectMode && !forceStandardMode) ? "OPERATING MODE: DIRECT" : "OPERATING MODE: STANDARD",
    });

    perfTimings.runCreated = Date.now();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          perfTimings.pollStart = Date.now();

          controller.enqueue(
            encoder.encode(
              `event: run\ndata: ${JSON.stringify({
                id: run.id,
                status: "created",
                event: "created",
              })}\n\n`
            )
          );

          let runStatus = "queued";
          let messageReceived = false;
          let pollCount = 0;

          while (!messageReceived && runStatus !== "failed") {
            try {
              pollCount++;

              if (pollCount === 1) {
                perfTimings.firstPoll = Date.now();
              }

              const currentRun = await openai.beta.threads.runs.retrieve(
                finalThreadId,
                run.id
              );
              runStatus = currentRun.status;

              controller.enqueue(
                encoder.encode(
                  `event: run\ndata: ${JSON.stringify({
                    id: run.id,
                    status: runStatus,
                    event: runStatus,
                  })}\n\n`
                )
              );

              if (
                runStatus === "requires_action" &&
                currentRun.required_action?.type === "submit_tool_outputs" &&
                currentRun.required_action.submit_tool_outputs?.tool_calls
              ) {
                const toolCalls =
                  currentRun.required_action.submit_tool_outputs.tool_calls;

                for (const toolCall of toolCalls) {
                  if (toolCall.function.name === "retrieve_workforce_data") {
                    try {
                      const toolStartTime = performance.now();

                      const args = JSON.parse(toolCall.function.arguments);
                      const query = args.query;

                      if (!query)
                        throw new Error("Missing query parameter");

                      const cachedFileIds = await getCachedFilesForThread(
                        finalThreadId
                      );

                      if (isDirectMode && !forceStandardMode) {
                        const relevantFilesResult = await identifyRelevantFiles(
                          query,
                          "all-sector"
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

                        await openai.beta.threads.runs.submitToolOutputs(
                          finalThreadId,
                          run.id,
                          {
                            tool_outputs: [
                              {
                                tool_call_id: toolCall.id,
                                output: JSON.stringify({
                                  prompt: query,
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
                        const result = await processQueryWithData(
                          query,
                          "all-sector",
                          cachedFileIds,
                          finalThreadId
                        );

                        const fileIdsArray = Array.from(
                          result.dataScope.fileIds
                        ).map(String);
                        const cachedFiles: CachedFile[] = fileIdsArray.map(id => ({
                          id,
                          data: {},
                          loadedSegments: new Set(),
                          availableSegments: new Set()
                        }));
                        await updateThreadCache(finalThreadId, cachedFiles);

                        await openai.beta.threads.runs.submitToolOutputs(
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
                      await openai.beta.threads.runs.submitToolOutputs(
                        finalThreadId,
                        run.id,
                        {
                          tool_outputs: [
                            {
                              tool_call_id: toolCall.id,
                              output: JSON.stringify({
                                error: error.message,
                              }),
                            },
                          ],
                        }
                      );
                    }
                  }
                }
              }

              if (runStatus === "completed") {
                const messages = await openai.beta.threads.messages.list(
                  finalThreadId
                );

                if (messages.data && messages.data.length > 0) {
                  perfTimings.messageReceived = Date.now();

                  const message = messages.data[0];
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

                  messageReceived = true;
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
              }

              if (!messageReceived && runStatus !== "failed") {
                await new Promise((resolve) =>
                  setTimeout(resolve, perfTimings.pollingInterval)
                );
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
          
          // Log performance data
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
export async function putHandler(request: NextRequest) {
  const apiStartTime = Date.now();
  try {
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return formatErrorResponse(parseError, 400);
    }

    const { threadId, runId, toolCall } = requestBody;

    const missingFields = [];
    if (!threadId) missingFields.push("threadId");
    if (!runId) missingFields.push("runId");
    if (!toolCall) missingFields.push("toolCall");
    else {
      if (!toolCall.id) missingFields.push("toolCall.id");
      if (!toolCall.function) missingFields.push("toolCall.function");
      else if (!toolCall.function.name) missingFields.push("toolCall.function.name");
    }

    if (missingFields.length > 0) {
      return formatBadRequestResponse("Missing required fields", missingFields);
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 2,
    });

    if (toolCall.function.name === "retrieve_workforce_data") {
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }

      const query = args.query || "workforce trends";
      logger.info(`[TOOL] Processing retrieval for query: "${query}" | Thread: ${threadId}`);

      try {
        // Get any existing cached file IDs for this thread
        const cachedFiles = await getCachedFilesForThread(threadId);
        const cachedFileIds = cachedFiles.map(file => file.id);
        logger.info(`[TOOL] Existing cached files for thread ${threadId}: ${cachedFileIds.length ? cachedFileIds.join(', ') : 'none'}`);

        // First identify relevant files using LLM
        const relevantFilesResult = await identifyRelevantFiles(query, "all-sector", 
          cachedFileIds.length > 0, // isFollowUp 
          "", // previousQuery - could improve by retrieving from history
          ""); // previousAssistantResponse
          
        const fileIdArray = relevantFilesResult?.file_ids || [];
        logger.info(`[TOOL] Identified relevant files: ${fileIdArray.join(', ')}`);

        // Combine new files with existing cached files
        const allRelevantFileIds = Array.from(new Set([
          ...cachedFileIds,
          ...fileIdArray,
        ]));

        // HYBRID APPROACH: Directly load files while also caching them
        // This ensures data is always available for the assistant
        const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
        const loadedFiles: CachedFile[] = [];
        
        for (const fileId of allRelevantFileIds) {
          const fileName = fileId.endsWith(".json") ? fileId : `${fileId}.json`;
          const filePath = path.join(dataDir, fileName);
          
          try {
            if (!fs.existsSync(filePath)) {
              logger.error(`[TOOL] File not found: ${filePath}`);
              continue;
            }
            
            const fileContent = fs.readFileSync(filePath, "utf8");
            let jsonData;
            try {
              jsonData = JSON.parse(fileContent);
            } catch (parseErr) {
              logger.error(`[TOOL] JSON parse error for file ${filePath}:`, parseErr);
              continue;
            }
            
            // Create a properly formatted CachedFile object
            const segments = DEFAULT_SEGMENTS;
            const cachedFile: CachedFile = {
              id: fileId,
              data: {},
              loadedSegments: new Set(segments),
              availableSegments: new Set(segments)
            };
            
            // Add data for each segment
            for (const segment of segments) {
              if (jsonData[segment]) {
                cachedFile.data[segment] = jsonData[segment];
              } else if (jsonData.responses) {
                // Handle different file structures
                cachedFile.data[segment] = { responses: jsonData.responses };
              } else {
                // Fallback for any other structure
                cachedFile.data[segment] = jsonData;
              }
            }
            
            loadedFiles.push(cachedFile);
          } catch (error) {
            logger.error(`[TOOL] Error loading file ${filePath}:`, error);
          }
        }
        
        // Update thread cache with loaded files - fire and forget
        updateThreadCache(threadId, loadedFiles).catch(err => {
          logger.error(`[TOOL] Error updating thread cache:`, err);
        });
        
        // Process the data to extract relevant information
        const filteredData = await processQueryWithData(
          query, 
          "all-sector", 
          allRelevantFileIds, 
          threadId,
          cachedFileIds.length > 0, // isFollowUp
          "", // previousQuery 
          ""); // previousAssistantResponse
        
        // Send the processed data to the assistant
        await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
          tool_outputs: [
            {
              tool_call_id: toolCall.id,
              output: JSON.stringify({
                filteredData: filteredData.filteredData,
                queryIntent: filteredData.queryIntent,
                dataScope: {
                  fileIds: allRelevantFileIds,
                  segments: filteredData.segments || DEFAULT_SEGMENTS,
                  topics: relevantFilesResult.matched_topics || []
                },
                cacheStatus: {
                  cached: cachedFileIds.length,
                  new: fileIdArray.length,
                  total: allRelevantFileIds.length
                },
                matched_topics: relevantFilesResult.matched_topics || [],
                explanation: relevantFilesResult.explanation || "No explanation provided",
                processing_time_ms: filteredData.processing_time_ms
              }),
            },
          ],
        });

        return new Response(JSON.stringify({
          status: "success",
          file_ids: allRelevantFileIds.length,
          fileList: allRelevantFileIds,
          cacheStatus: {
            cached: cachedFileIds.length,
            new: fileIdArray.length,
            total: allRelevantFileIds.length
          },
          processing_time_ms: Math.round(performance.now() - apiStartTime),
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        logger.error("Error processing tool call:", error);
        await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
          tool_outputs: [
            {
              tool_call_id: toolCall.id,
              output: JSON.stringify({ error: error.message }),
            },
          ],
        });
        return formatErrorResponse(error);
      }
    }

    return formatBadRequestResponse("Unsupported function");
  } catch (error) {
    return formatErrorResponse(error);
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
