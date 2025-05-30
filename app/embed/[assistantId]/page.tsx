"use client";

// Tracking in Analytics for the question asked
import { track } from "@vercel/analytics";

// This ended up being a big refactor, but its much more up to date now, and has less guff.
// Found this starting kit and used that as a reference: https://github.com/Superexpert/openai-assistant-starter-kit/tree/main
// api/chat-assistant/route.ts is where we call the OpenAI API to get the response, there we can stream the response.

// React
import React, {
  useState,
  useRef,
  useEffect,
  Suspense,
  useCallback,
} from "react";
// Open AI
import { AssistantStream } from "openai/lib/AssistantStream";
// Markdown
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// Components
import PromptInput from "../../../components/PromptInput";
// Helpers
import { parseResponse } from "../../../utils/shared/helpers";
import chatConfig from "../../../config/chat.config.json";
import CollapsibleContent from "../../../components/CollapsibleContent";
// Add the new AssistantSelector component
import { sendHeightToParent } from "../../../utils/shared/iframe/iframe-resizer";

// Enable debug logging based on environment
export const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS !== undefined ? process.env.NEXT_PUBLIC_DEBUG_LOGS === "true" : process.env.NODE_ENV !== "production";

// Define interface for MarkdownErrorBoundary props and state
interface MarkdownErrorBoundaryProps {
  children: React.ReactNode;
}

interface MarkdownErrorBoundaryState {
  hasError: boolean;
}

// Error boundary for markdown rendering during streaming
class MarkdownErrorBoundary extends React.Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: MarkdownErrorBoundaryProps) {
    if (prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback: render as plain text when markdown parsing fails
      return (
        <div style={{ whiteSpace: "pre-wrap" }}>{this.props.children}</div>
      );
    }
    return this.props.children;
  }
}

// Define interface for StreamingMarkdown props
interface StreamingMarkdownProps {
  content: string;
}

// Streaming-friendly markdown component
function StreamingMarkdown({ content }: StreamingMarkdownProps) {
  // Add a zero-width space and handle incomplete markup for better parsing
  const safeContent = content ? content + "\u200B" : "";

  // Fix common incomplete markdown that could cause render issues
  const fixedContent = React.useMemo(() => {
    let fixed = safeContent;

    // Handle incomplete lists
    if (fixed.match(/^\s*[-*+]\s*$/m)) {
      fixed += " ";
    }

    // Handle incomplete code blocks
    const backtickMatches = fixed.match(/```/g);
    if (backtickMatches && backtickMatches.length % 2 !== 0) {
      fixed += "\n```";
    }

    // Handle incomplete bold/italic
    const asteriskMatches = fixed.match(/\*\*/g);
    if (asteriskMatches && asteriskMatches.length % 2 !== 0) {
      fixed += "**";
    }

    // Handle incomplete tables
    if (fixed.includes("|") && !fixed.includes("|-")) {
      const lineWithPipe = fixed.split("\n").find((line) => line.includes("|"));
      if (lineWithPipe) {
        const pipeCount = (lineWithPipe.match(/\|/g) || []).length;
        if (pipeCount > 1) {
          // Check if there's an incomplete table header without separator row
          const lines = fixed.split("\n");
          const tableLineIndex = lines.findIndex((line) => line.includes("|"));
          if (tableLineIndex >= 0 && lines.length > tableLineIndex + 1) {
            if (!lines[tableLineIndex + 1].includes("|-")) {
              // Add appropriate separator row based on column count
              let separator = "|";
              for (let i = 0; i < pipeCount - 1; i++) {
                separator += "---|";
              }
              lines.splice(tableLineIndex + 1, 0, separator);
              fixed = lines.join("\n");
            }
          }
        }
      }
    }

    return fixed;
  }, [safeContent]);

  return (
    <MarkdownErrorBoundary>
      <ReactMarkdown
        className="prose max-w-none text-sm sm:text-base"
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
          // Ensure proper heading styles
          h1: ({ node, ...props }) => (
            <h1 {...props} className="font-bold text-primary" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="font-bold text-primary" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="font-semibold text-primary" />
          ),
          h4: ({ node, ...props }) => (
            <h4 {...props} className="font-semibold text-primary" />
          ),
        }}
      >
        {fixedContent}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}

function Embed(props) {
  // Access assistantId through props.params to avoid Next.js 15 error
  const assistantId = props.params.assistantId;

  const title = "WORKFORCE 2025";
  const description =
    "Explore insights from our comprehensive workforce survey with RIA, your AI research assistant";

  const [loading, setLoading] = useState(false);
  // Debug: log parent loading state
  if (DEBUG_LOGS) console.log("Embed render, loading:", loading);
  // Message being streamed
  const [streamingMessage, setStreamingMessage] = useState(null);
  // Whole chat
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: chatConfig.welcomeMessage,
      createdAt: new Date(),
    },
  ]);
  const messageId = useRef(0);
  // Add a ref to store accumulated streaming text
  const accumulatedText = useRef("");
  // User prompt
  const [prompt, setPrompt] = useState("");
  // Get the thread id from the response, and then can pass it back to the next request to continue the conversation.
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);

  // Thread data cache to track files loaded per thread
  const [threadDataCache, setThreadDataCache] = useState(() => {
    if (typeof window !== "undefined") {
      const savedCache = localStorage.getItem("threadDataCache");
      return savedCache ? JSON.parse(savedCache) : {};
    }
    return {};
  });

  // Function to get cached files for a thread
  const getCachedFilesForThread = useCallback(
    (threadId) => {
      return threadDataCache[threadId] || { fileIds: [], data: {} };
    },
    [threadDataCache]
  );

  // Function to update thread cache with new files
  const updateThreadCache = useCallback((threadId, newFileIds, newData) => {
    setThreadDataCache((prevCache) => {
      try {
        const updatedCache = { ...prevCache };

        if (!updatedCache[threadId]) {
          updatedCache[threadId] = { fileIds: [], data: {} };
        }

        // Add new file IDs without duplicates
        const existingIds = updatedCache[threadId].fileIds || [];
        const allFileIds = [...existingIds];

        // Add any new file IDs that aren't already in the array
        newFileIds.forEach((id) => {
          if (!allFileIds.includes(id)) {
            allFileIds.push(id);
          }
        });

        updatedCache[threadId].fileIds = allFileIds;

        // Update data
        updatedCache[threadId].data = {
          ...(updatedCache[threadId].data || {}),
          ...newData,
        };

        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("threadDataCache", JSON.stringify(updatedCache));
          if (DEBUG_LOGS) console.log(
            `💾 Cache updated for thread ${threadId}: ${allFileIds.length} files`
          );
        }

        return updatedCache;
      } catch (error) {
        console.error("Error updating thread cache:", error);
        return prevCache; // Return unchanged state on error
      }
    });
  }, []);

  // Save threadId to localStorage whenever it changes
  useEffect(() => {
    if (threadId) {
      localStorage.setItem("chatThreadId", threadId);
      if (DEBUG_LOGS) console.log("🧵 THREAD ID SAVED TO LOCALSTORAGE:", threadId);
    }
  }, [threadId]);

  // Log thread data on init
  useEffect(() => {
    if (DEBUG_LOGS) console.log("🧵 THREAD DATA CACHE INITIALIZED:", threadDataCache);
    if (threadId) {
      if (DEBUG_LOGS) console.log(
        "🧵 CURRENT THREAD CACHED FILES:",
        getCachedFilesForThread(threadId)
      );
    }
  }, [threadId, threadDataCache, getCachedFilesForThread]);

  // Add version and params logging
  useEffect(() => {
    if (DEBUG_LOGS) console.log("=== EMBED PAGE DIAGNOSTICS ===");
    if (DEBUG_LOGS) console.log("Version: 2025");
    if (DEBUG_LOGS) console.log("Assistant ID:", assistantId);
    if (DEBUG_LOGS) console.log("Initial Render Time:", new Date().toISOString());
    if (DEBUG_LOGS) console.log("========================");
  }, [assistantId]);

  // Starter question code support: check for ?starterQuestion=CODE and trigger assistant
  // Use a ref to ensure this logic only runs once per mount, preventing duplicate question submissions and errors.
  const starterTriggeredRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (starterTriggeredRef.current) return; // Prevent double-triggering
    // Only trigger if chat is at initial state (welcome message only)
    if (!messages || messages.length > 1) return;

    const params = new URLSearchParams(window.location.search);
    const starterCode = params.get("starterQuestion");
    const questionText = params.get("question");

    if (starterCode) {
      starterTriggeredRef.current = true;
      if (DEBUG_LOGS) console.log(
        "[STARTER EFFECT] Triggering sendPrompt with starterCode:",
        starterCode
      );
      // Instead of loading the JSON and sending the question, send the starter code directly to the backend
      sendPrompt(threadId, starterCode);
    } else if (questionText) {
      starterTriggeredRef.current = true;
      if (DEBUG_LOGS) console.log(
        "[STARTER EFFECT] Triggering sendPrompt with questionText:",
        questionText
      );
      sendPrompt(threadId, questionText);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // At the top of Embed component, after other useRef declarations:
  const sendPromptCallId = useRef(0);
  const isSendingPrompt = useRef(false); // New ref to guard re-entrancy
  const animationFrameId = useRef<number | null>(null);

  // Ref to hold the AbortController for the active streaming request
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // At top level, after other useRef declarations
  const userScrolledRef = useRef(false);

  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    if (DEBUG_LOGS) console.log(
      `[EFFECT_LOADING_CHANGED] loading is now: ${loading}, isSendingPrompt.current: ${isSendingPrompt.current}`
    );
  }, [loading]);

  // useEffect for clearing localStorage on mount (KEEP THIS)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("chatThreadId");
      localStorage.removeItem("chatLastResponseId");
      localStorage.removeItem("threadDataCache");
      if (DEBUG_LOGS) console.log(
        "[INITIAL_MOUNT_EFFECT] Cleared session IDs & cache from localStorage."
      );
    }
  }, []);

  const sendPrompt = async (
    clientThreadId_param?: string,
    immediateQuestion?: string
  ) => {
    const localThreadId = clientThreadId_param || threadId;
    const currentCallId = ++sendPromptCallId.current;
    if (DEBUG_LOGS) console.log(
      `[SEND_PROMPT_ENTER] Call ID: ${currentCallId}, Query: "${(
        immediateQuestion ||
        prompt ||
        ""
      ).substring(
        0,
        30
      )}...", Current loading state: ${loading}, isSendingPrompt ref: ${
        isSendingPrompt.current
      }, localThreadId: ${localThreadId}, lastResponseId: ${lastResponseId}`
    );

    // Primary guard: if the main loading state is true, block immediately.
    if (loading) {
      if (DEBUG_LOGS) console.warn(
        `[SEND_PROMPT_BLOCKED_BY_LOADING_STATE] Call ID: ${currentCallId}. 'loading' is true. isSendingPrompt.current was: ${isSendingPrompt.current}`
      );
      return;
    }

    // Secondary/Defensive guard for the ref.
    // If loading was false, isSendingPrompt.current should ideally also be false.
    // If it's true, it implies a mismatch or incomplete reset from a previous call for the ref specifically.
    if (isSendingPrompt.current) {
      if (DEBUG_LOGS) console.warn(
        `[SEND_PROMPT_BLOCKED_BY_REF_MISMATCH] Call ID: ${currentCallId}. 'loading' was false, but 'isSendingPrompt.current' was true. Blocking and resetting ref.`
      );
      isSendingPrompt.current = false; // Reset it to prevent getting stuck if this state is ever reached.
      return; // Still block if this inconsistent state is found.
    }

    // If we passed both guards, we can proceed.
    isSendingPrompt.current = true;
    setLoading(true);

    const OPENAI_ASSISTANT_TIMEOUT_MS = 90000;
    let streamFinalizedThisCall = false;
    let watchdogThisCall: NodeJS.Timeout | null = null;
    const interactionEvents = ["click", "keydown", "wheel", "touchstart"] as const;
    let interactionHandler: (() => void) | null = null;
    function detachInteractionListeners() {
      if (messageListRef.current && interactionHandler) {
        interactionEvents.forEach((evt) =>
          messageListRef.current!.removeEventListener(evt, interactionHandler!)
        );
        interactionHandler = null;
      }
    }

    const finalizeStream = (reason = "unknown") => {
      const localCallId_finalize = currentCallId; // Use currentCallId from sendPrompt's scope
      if (DEBUG_LOGS) console.log(
        `[FINALIZE_STREAM_ENTER] Call ID: ${localCallId_finalize}, Reason: ${reason}, streamFinalizedThisCall: ${streamFinalizedThisCall}, Comp loading state: ${loading}`
      );
      if (streamFinalizedThisCall) {
        if (DEBUG_LOGS) console.log(
          `[FINALIZE_STREAM_BAIL_ALREADY_FINALIZED] Call ID: ${localCallId_finalize}, Reason: ${reason}.`
        );
        if (
          watchdogThisCall &&
          reason !== "watchdog_STREAM_HANDLER" &&
          reason !== "watchdog"
        ) {
          clearTimeout(watchdogThisCall);
        }
        return;
      }
      streamFinalizedThisCall = true;
      if (watchdogThisCall) {
        clearTimeout(watchdogThisCall);
        watchdogThisCall = null;
        if (DEBUG_LOGS) console.log(
          `[FINALIZE_STREAM_CLEARED_WATCHDOG] Call ID: ${localCallId_finalize} (Reason: ${reason})`
        );
      }
      if (
        !loading &&
        (reason.includes("messageDone") ||
          reason.includes("eof_STREAM_HANDLER") ||
          reason.includes("errorEvent_STREAM_HANDLER") ||
          reason.includes("streamLoopError_STREAM_HANDLER"))
      ) {
        console.error(
          `[FINALIZE_STREAM_UNEXPECTED_LOADING_FALSE] Call ID: ${localCallId_finalize}, Reason: ${reason}. Loading was false! Proceeding.`
        );
      } else if (!loading && !isPreStreamErrorReason(reason)) {
        if (DEBUG_LOGS) console.warn(
          `[FINALIZE_STREAM_WARN_BAIL_STALE] Call ID: ${localCallId_finalize}, Reason: ${reason}. Loading false. Bailing out.`
        );
        return;
      }
      try {
        const finalContent = accumulatedText.current.trim();
        if (DEBUG_LOGS) console.log(
          `[FINALIZE_STREAM_CONTENT] Call ID: ${localCallId_finalize}, Content (len ${
            finalContent.length
          }): "${finalContent.substring(0, 100)}..."`
        );
        if (finalContent || reason === "messageDone_STREAM_HANDLER") {
          const newMessageId = (messageId.current + 1).toString();
          setMessages((prevMessages) => {
            if (prevMessages.find((msg) => msg.id === newMessageId)) {
              if (DEBUG_LOGS) console.warn(
                `[FINALIZE_STREAM_DUPLICATE_GUARD] Call ID: ${localCallId_finalize}, Msg ID ${newMessageId} exists. Not adding.`
              );
              return prevMessages;
            }
            messageId.current++;
            const newMessage = {
              id: newMessageId,
              role: "assistant" as const,
              content: finalContent,
              createdAt: new Date(),
            };
            if (DEBUG_LOGS) console.log(
              `[FINALIZE_STREAM_SET_MESSAGES] Call ID: ${localCallId_finalize}, ADDING (Reason: ${reason}):`,
              JSON.parse(JSON.stringify(newMessage))
            );
            const updatedMessages = [...prevMessages, newMessage];
            if (DEBUG_LOGS) console.log(
              `[FINALIZE_STREAM_SET_MESSAGES] Call ID: ${localCallId_finalize}, New count: ${updatedMessages.length}. IDs:`,
              updatedMessages.map((m) => m.id)
            );
            return updatedMessages;
          });
        } else {
          if (DEBUG_LOGS) console.log(
            `[FINALIZE_STREAM_SET_MESSAGES] Call ID: ${localCallId_finalize}, No content for '${reason}'. Skipping.`
          );
        }
      } catch (error) {
        console.error(
          `[FINALIZE_STREAM_ERROR] Call ID: ${localCallId_finalize}, Error (Reason: ${reason}):`,
          error
        );
      } finally {
        if (DEBUG_LOGS) console.log(
          `[FINALIZE_STREAM_FINALLY] Call ID: ${localCallId_finalize}, Resetting states (Reason: ${reason}). Current loading state before setLoading(false): ${loading}`
        );
        setLoading(false);
        if (DEBUG_LOGS) console.log(
          `[FINALIZE_STREAM_FINALLY] Call ID: ${localCallId_finalize}, Called setLoading(false). isSendingPrompt.current is about to be set.`
        );
        accumulatedText.current = "";
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
          if (DEBUG_LOGS) console.log(
            `[FINALIZE_STREAM_CLEANUP] Call ID: ${localCallId_finalize}, Cancelled anim frame.`
          );
        }
        // Remove interaction listeners and clear controller reference
        detachInteractionListeners();
        streamAbortControllerRef.current = null;
        if (localCallId_finalize === sendPromptCallId.current) {
          isSendingPrompt.current = false;
          if (DEBUG_LOGS) console.log(
            `[FINALIZE_STREAM_FINALLY] Call ID: ${localCallId_finalize}, Reset isSendingPrompt to false.`
          );
        } else {
          if (DEBUG_LOGS) console.warn(
            `[FINALIZE_STREAM_FINALLY_STALE_CALL] Call ID: ${localCallId_finalize} not current ${sendPromptCallId.current}. Not resetting isSendingPrompt.`
          );
        }
        setTimeout(scrollToBottom, 0);
      }
    };
    const isPreStreamErrorReason = (reason: string) => {
      return [
        "dataRetrievalError",
        "outOfScope",
        "dataResultError",
        "errorNoContext",
        "jsonResponse",
        "assistantApiError",
        "overallSendPromptError",
      ].some((prefix) => reason.startsWith(prefix));
    };

    const questionText = immediateQuestion || prompt || "";
    if (!questionText.trim()) {
      setLoading(false);
      isSendingPrompt.current = false;
      if (DEBUG_LOGS) console.log(
        `[SEND_PROMPT_EXIT_NO_TEXT] Call ID: ${currentCallId}, Reset isSendingPrompt.`
      );
      return;
    }
    track("Question", { question: questionText });
    if (!immediateQuestion) setPrompt("");
    messageId.current++;
    const userMessage = {
      id: messageId.current.toString(),
      role: "user" as const,
      content: questionText,
      createdAt: new Date(),
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    if (DEBUG_LOGS) console.log("[UI] Added user message:", userMessage);
    setStreamingMessage({
      id: "processing",
      role: "assistant",
      content: "<span class='loading-message'>Retrieving data...</span>",
      createdAt: new Date(),
      stage: "retrieving",
    });
    // Reset manual scroll flag so auto-scroll resumes for this new question
    userScrolledRef.current = false;

    try {
      let dataResult;
      try {
        if (DEBUG_LOGS) console.log("[SEND_PROMPT_API_QUERY] Preparing to call /api/query.");
        const cachedFiles = localThreadId
          ? getCachedFilesForThread(localThreadId)
          : { fileIds: [] };
        const queryApiBody: any = {
          query: questionText,
          context: "all-sector",
          cachedFileIds:
            localThreadId && cachedFiles.fileIds.length > 0
              ? cachedFiles.fileIds
              : [],
        };
        if (lastResponseId) {
          queryApiBody.previous_response_id = lastResponseId;
          if (localThreadId) queryApiBody.threadId = localThreadId;
          if (DEBUG_LOGS) console.log(
            `[UI_TO_QUERY_API] Follow-up call to /api/query with prev_resp_id: ${lastResponseId}, threadId: ${localThreadId}`
          );
        } else {
          if (DEBUG_LOGS) console.log(
            "[UI_TO_QUERY_API] New chat call to /api/query. No prev_resp_id or threadId sent."
          );
          delete queryApiBody.threadId;
          delete queryApiBody.previous_response_id;
        }
        if (DEBUG_LOGS) console.log(
          "[SEND_PROMPT_API_QUERY] Body for /api/query:",
          JSON.stringify(queryApiBody)
        );
        const dataRetrievalResponse = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryApiBody),
        });
        if (!dataRetrievalResponse.ok) {
          const errorText = await dataRetrievalResponse.text();
          throw new Error(
            `Data retrieval failed: ${dataRetrievalResponse.status} ${errorText}`
          );
        }

        dataResult = await dataRetrievalResponse.json();
        if (DEBUG_LOGS) console.log(
          "[UI] dataResult from /api/query (raw full object):",
          JSON.parse(JSON.stringify(dataResult))
        );
        if (
          dataResult.finalAssistantPrompt &&
          typeof dataResult.finalAssistantPrompt === "string"
        ) {
          if (DEBUG_LOGS) console.log(
            "[UI] Received finalAssistantPrompt. Length:",
            dataResult.finalAssistantPrompt.length
          );
          if (DEBUG_LOGS) console.log(
            "[UI] finalAssistantPrompt (first 500 chars):",
            dataResult.finalAssistantPrompt.substring(0, 500)
          );
          if (dataResult.finalAssistantPrompt.length < 200) {
            if (DEBUG_LOGS) console.warn(
              "[UI] WARNING: finalAssistantPrompt from backend is very short."
            );
          }
        } else {
          console.error(
            "[UI] CRITICAL ERROR: finalAssistantPrompt missing/invalid in dataResult!",
            dataResult
          );
          accumulatedText.current = "Error: Failed to prepare prompt.";
          finalizeStream("missingBackendFinalPrompt");
          return;
        }
        if (dataResult.stats && Array.isArray(dataResult.stats)) {
          if (DEBUG_LOGS) console.log(
            `[UI] dataResult also contains .stats with ${dataResult.stats.length} items.`
          );
        }
        if (dataResult.files_used && Array.isArray(dataResult.files_used)) {
          if (DEBUG_LOGS) console.log(
            `[UI] dataResult.files_used contains: ${JSON.stringify(
              dataResult.files_used
            )}`
          );
        } else {
          if (DEBUG_LOGS) console.warn(
            "[UI] dataResult.files_used is missing or not an array:",
            dataResult.files_used
          );
        }
      } catch (dataRetrievalError) {
        console.error(
          "[SEND_PROMPT_ERROR] Stage 1 Data Retrieval Error:",
          dataRetrievalError
        );
        accumulatedText.current = `Error retrieving data: ${dataRetrievalError.message}`;
        finalizeStream("dataRetrievalError");
        return;
      }

      if (dataResult.out_of_scope) {
        accumulatedText.current =
          dataResult.out_of_scope_message || "Query outside scope.";
        finalizeStream("outOfScope");
        return;
      }
      if (dataResult.error) {
        accumulatedText.current = `Data error: ${dataResult.error}`;
        finalizeStream("dataResultError");
        return;
      }
      if (dataResult.status === "error_no_context") {
        accumulatedText.current = dataResult.error || "Context needed.";
        finalizeStream("errorNoContext");
        return;
      }

      setStreamingMessage((prev) => ({
        ...prev,
        content: "<span class='loading-message'>Generating insights...</span>",
        stage: "analyzing",
      }));

      const assistantPrompt = dataResult.finalAssistantPrompt;
      if (DEBUG_LOGS) console.log(
        "[UI] Using assistantPrompt for /api/chat-assistant (first 500 chars):",
        assistantPrompt?.substring(0, 500)
      );
      if (DEBUG_LOGS) console.log("[UI] assistantPrompt FULL LENGTH:", assistantPrompt?.length);

      const assistantApiCallStart = Date.now();
      const controller = new AbortController();
      streamAbortControllerRef.current = controller;
      const assistantTimeoutId = setTimeout(() => {
        if (DEBUG_LOGS) console.warn("[SEND_PROMPT_TIMEOUT] Assistant API request timed out.");
        controller.abort();
      }, OPENAI_ASSISTANT_TIMEOUT_MS);

      try {
        // VERIFY dataResult.files_used BEFORE assigning filesForChatAssistant
        if (DEBUG_LOGS) console.log(
          "[UI_PRE_FILES_FOR_CHAT_ASSISTANT] Verifying dataResult.files_used:",
          dataResult.files_used
        );
        if (DEBUG_LOGS) console.log(
          "[UI_PRE_FILES_FOR_CHAT_ASSISTANT] typeof dataResult.files_used:",
          typeof dataResult.files_used
        );
        if (DEBUG_LOGS) console.log(
          "[UI_PRE_FILES_FOR_CHAT_ASSISTANT] Array.isArray(dataResult.files_used):",
          Array.isArray(dataResult.files_used)
        );

        const filesForChatAssistant =
          dataResult.files_used && Array.isArray(dataResult.files_used)
            ? dataResult.files_used
            : [];

        if (DEBUG_LOGS) console.log(
          "[UI_POST_FILES_FOR_CHAT_ASSISTANT] filesForChatAssistant assigned as:",
          JSON.parse(JSON.stringify(filesForChatAssistant))
        );

        if (
          filesForChatAssistant.length === 0 &&
          dataResult.stats &&
          dataResult.stats.length > 0
        ) {
          if (DEBUG_LOGS) console.warn(
            "[UI_WARN_FILES_USED] dataResult.files_used was empty, but dataResult.stats was not. This might indicate an issue in /api/query response structure if files were indeed used for those stats."
          );
        }

        const assistantApiBody = {
          assistantId: assistantId,
          previous_response_id: lastResponseId,
          content: assistantPrompt,
          original_user_query: questionText,
          files_used_for_this_prompt: filesForChatAssistant, // Use the verified/defaulted list
        };

        if (DEBUG_LOGS) console.log(
          "[UI_TO_CHAT_ASSISTANT_RAW_BODY_PRE_STRINGIFY] assistantApiBody object:",
          JSON.parse(JSON.stringify(assistantApiBody)) // Deep copy for reliable logging before stringify
        );

        if (DEBUG_LOGS) console.log(
          "[UI_TO_CHAT_ASSISTANT] Body for /api/chat-assistant (stringified preview):",
          JSON.stringify(assistantApiBody, (key, value) =>
            key === "content"
              ? `${String(value).substring(0, 100)}... (length ${
                  String(value).length
                })`
              : value
          )
        );

        const assistantResponse = await fetch("/api/chat-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assistantApiBody),
          signal: controller.signal,
        });
        clearTimeout(assistantTimeoutId);
        if (DEBUG_LOGS) console.log(
          `[ASSISTANT_API_CALL_DURATION] ${
            Date.now() - assistantApiCallStart
          }ms`
        );
        if (!assistantResponse.ok) {
          const errorText = await assistantResponse.text();
          throw new Error(
            `Assistant API error: ${assistantResponse.status} ${errorText}`
          );
        }

        const contentType = assistantResponse.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          if (DEBUG_LOGS) console.log("[STREAM_HANDLER] Received JSON from assistant API.");
          const jsonData = await assistantResponse.json();
          accumulatedText.current =
            jsonData.message || "Received non-streamed JSON.";
          finalizeStream("jsonResponse");
          return;
        } else if (contentType?.includes("text/event-stream")) {
          if (DEBUG_LOGS) console.log(
            "[STREAM_HANDLER] Received text/event-stream. Processing."
          );
          if (!assistantResponse.body)
            throw new Error("No response body for stream");
          const reader = assistantResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          accumulatedText.current = "";
          streamFinalizedThisCall = false;

          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
            if (DEBUG_LOGS) console.log(
              "[STREAM_HANDLER_CLEANUP] Cancelled pre-existing animation frame."
            );
          }
          const initialStreamCreatedAt = new Date();
          setStreamingMessage({
            id: "streaming_message_active",
            role: "assistant",
            content: "",
            createdAt: initialStreamCreatedAt,
            stage: "streaming",
          });

          if (watchdogThisCall) {
            if (DEBUG_LOGS) console.log(
              `[STREAM_HANDLER_PRE_WATCHDOG_CLEAR] Call ID: ${currentCallId}, Clearing existing watchdog ID: ${watchdogThisCall}`
            );
            clearTimeout(watchdogThisCall);
            watchdogThisCall = null;
          }
          watchdogThisCall = setTimeout(
            () => finalizeStream("watchdog_STREAM_HANDLER"),
            45000
          );
          if (DEBUG_LOGS) console.log(
            `[STREAM_HANDLER_WATCHDOG_SET] Call ID: ${currentCallId}, Watchdog SET: ID ${watchdogThisCall}`
          );

          // Attach user interaction listeners to allow aborting the stream
          if (messageListRef.current) {
            interactionHandler = () => {
              if (DEBUG_LOGS) console.log("[STREAM_ABORT] User interaction detected, aborting stream");
              streamAbortControllerRef.current?.abort();
              finalizeStream("userInteractionAbort");
            };
            interactionEvents.forEach((evt) =>
              messageListRef.current!.addEventListener(evt, interactionHandler!)
            );
          }

          try {
            while (true) {
              const { value, done } = await reader.read();
              if (value) {
                const rawChunkForLogging = decoder.decode(value, {
                  stream: false,
                });
                if (DEBUG_LOGS) console.log(
                  `[RAW_STREAM_CHUNK_IN_HANDLER] Decoded (len ${
                    rawChunkForLogging.length
                  }): "${rawChunkForLogging.substring(0, 100)}..."`
                );
              }
              if (done) {
                if (DEBUG_LOGS) console.log(
                  `[STREAM_HANDLER_LOOP] Call ID: ${currentCallId}, Stream reported done: true.`
                );
                if (!streamFinalizedThisCall)
                  finalizeStream("eof_STREAM_HANDLER");
                break;
              }
              buffer += decoder.decode(value, { stream: true });
              const textDeltaRegex = /event: textDelta\ndata: ({.*?})\n\n/g;
              let match;
              textDeltaRegex.lastIndex = 0;
              while ((match = textDeltaRegex.exec(buffer)) !== null) {
                try {
                  const eventData = JSON.parse(match[1]);
                  if (eventData.value) {
                    accumulatedText.current += eventData.value;
                    if (animationFrameId.current === null) {
                      animationFrameId.current = requestAnimationFrame(() => {
                        setStreamingMessage((prev) => {
                          if (!prev || prev.id !== "streaming_message_active") {
                            if (DEBUG_LOGS) console.warn(
                              `[RAF_SET_STREAMING_MSG] Call ID: ${currentCallId}, prev streamingMessage was null/unexpected. Re-initializing.`,
                              prev
                            );
                            return {
                              id: "streaming_message_active",
                              role: "assistant",
                              content: accumulatedText.current,
                              createdAt: initialStreamCreatedAt,
                              stage: "streaming",
                            };
                          }
                          return { ...prev, content: accumulatedText.current };
                        });
                        animationFrameId.current = null;
                      });
                    }
                  }
                } catch (e) {
                  console.error(
                    `[STREAM_LOOP_ERROR] Call ID: ${currentCallId}, textDelta:`,
                    e
                  );
                }
              }
              const messageDoneRegex = /event: messageDone\ndata: ({.*?})\n\n/g;
              let doneMatch;
              messageDoneRegex.lastIndex = 0;
              while ((doneMatch = messageDoneRegex.exec(buffer)) !== null) {
                try {
                  const eventData = JSON.parse(doneMatch[1]);
                  if (DEBUG_LOGS) console.log(
                    `[STREAM_LOOP_EVENT] Call ID: ${currentCallId}, ✅ MessageDone:`,
                    eventData
                  );
                  if (eventData.threadId) setThreadId(eventData.threadId);
                  if (eventData.id) setLastResponseId(eventData.id);
                  accumulatedText.current =
                    eventData.content || accumulatedText.current;
                  finalizeStream("messageDone_STREAM_HANDLER");
                } catch (e) {
                  console.error(
                    `[STREAM_LOOP_ERROR] Call ID: ${currentCallId}, messageDone:`,
                    e
                  );
                  if (!streamFinalizedThisCall)
                    finalizeStream("messageDoneError_STREAM_HANDLER");
                }
              }
              const errorEventRegex = /event: error\ndata: ({.*?})\n\n/g;
              let errorMatch;
              errorEventRegex.lastIndex = 0;
              while ((errorMatch = errorEventRegex.exec(buffer)) !== null) {
                try {
                  const eventData = JSON.parse(errorMatch[1]);
                  console.error(
                    `[STREAM_LOOP_EVENT] Call ID: ${currentCallId}, 🛑 ErrorEvent:`,
                    eventData
                  );
                  accumulatedText.current = `Error: ${
                    eventData.message ||
                    eventData.error ||
                    "Unknown stream error"
                  }`;
                  if (!streamFinalizedThisCall)
                    finalizeStream("errorEvent_STREAM_HANDLER");
                } catch (e) {
                  console.error(
                    `[STREAM_LOOP_ERROR] Call ID: ${currentCallId}, errorEvent:`,
                    e
                  );
                  if (!streamFinalizedThisCall)
                    finalizeStream("errorEventParseError_STREAM_HANDLER");
                }
              }
              const lastCompleteEventIdx = buffer.lastIndexOf("\n\n");
              if (lastCompleteEventIdx >= 0) {
                buffer = buffer.substring(lastCompleteEventIdx + 2);
              } else if (buffer.length > 4096) {
                if (DEBUG_LOGS) console.warn(
                  "[STREAM_BUFFER_TRIM] Buffer too large, trimming."
                );
                buffer = buffer.substring(buffer.length - 2048);
              }
            }
          } catch (streamError) {
            console.error(
              `[STREAM_HANDLER_LOOP_CATCH_ERROR] Call ID: ${currentCallId}, Error during stream read:`,
              streamError
            );
            if (!streamFinalizedThisCall)
              finalizeStream("streamLoopError_STREAM_HANDLER");
          } finally {
            if (DEBUG_LOGS) console.log(
              `[STREAM_HANDLER_LOOP_FINALLY] Call ID: ${currentCallId}, Exited stream processing loop.`
            );
            if (!streamFinalizedThisCall && watchdogThisCall) {
              if (DEBUG_LOGS) console.warn(
                `[STREAM_HANDLER_LOOP_FINALLY_WARN] Call ID: ${currentCallId}, Clearing watchdog (ID: ${watchdogThisCall}), loop not finalized.`
              );
              clearTimeout(watchdogThisCall);
              watchdogThisCall = null;
            }
            if (animationFrameId.current) {
              cancelAnimationFrame(animationFrameId.current);
              animationFrameId.current = null;
              if (DEBUG_LOGS) console.log(
                "[STREAM_HANDLER_LOOP_FINALLY_CLEANUP] Cancelled animation frame."
              );
            }
            if (!streamFinalizedThisCall && loading) {
              if (DEBUG_LOGS) console.warn(
                `[STREAM_HANDLER_LOOP_FINALLY_WARN] Call ID: ${currentCallId}, Attempting EOF finalization post-loop.`
              );
              finalizeStream("loopFinallyEof_STREAM_HANDLER");
            }
          }
        } else {
          const responseText = await assistantResponse.text();
          throw new Error(
            `Unexpected Content-Type: ${contentType} ${responseText}`
          );
        }
      } catch (assistantApiError) {
        clearTimeout(assistantTimeoutId);
        console.error(
          "[SEND_PROMPT_ERROR] Stage 2 Assistant API Call Error:",
          assistantApiError
        );
        accumulatedText.current = `Assistant API error: ${assistantApiError.message}`;
        finalizeStream("assistantApiError");
        return;
      }
    } catch (overallError) {
      console.error(
        `[SEND_PROMPT_FATAL] Call ID: ${currentCallId}, Overall error:`,
        overallError
      );
      accumulatedText.current =
        accumulatedText.current || "An unexpected error occurred.";
      finalizeStream(`overallSendPromptError_callId_${currentCallId}`);
    }
  };

  // Auto scroll to bottom of message list. Scroll as message is being streamed.
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Define the scrollToBottom function to respect user scrolling
  const scrollToBottom = useCallback(() => {
    if (!messageListRef.current || userScrolledRef.current) return;

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, []);

  // Define a clean scroll detection function that doesn't interfere with auto-scroll
  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;

    const checkScrollPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;

      // Only update if the value changes to minimize renders
      if (scrolledToBottom !== isAtBottom) {
        setIsAtBottom(scrolledToBottom);
      }

      // When user scrolls up, pause auto-scroll
      if (!scrolledToBottom && userScrolledRef.current === false) {
        userScrolledRef.current = true;
      }
    };

    // Check on scroll events
    container.addEventListener("scroll", checkScrollPosition);

    // Also periodically check when content might be changing
    const intervalId = setInterval(checkScrollPosition, 500);

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      clearInterval(intervalId);
    };
  }, [isAtBottom]);

  // Simplify scroll to bottom function
  const scrollToBottomManually = useCallback(() => {
    if (messageListRef.current) {
      // Reset userScrolledRef so auto-scroll works again
      userScrolledRef.current = false;
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll when messages change or during streaming
  useEffect(() => {
    // Immediate scroll
    scrollToBottom();

    // Delayed scroll to catch rendering
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300); // Additional delayed scroll to catch late renders
  }, [messages, streamingMessage, scrollToBottom]);

  // Add effect for iframe resizing
  useEffect(() => {
    // Initial height update
    sendHeightToParent();

    // Update height whenever messages or streaming state changes
    const updateTimeout = setTimeout(sendHeightToParent, 100);
    return () => clearTimeout(updateTimeout);
  }, [messages, streamingMessage]);

  const handleStarterQuestion = (question: string) => {
    if (loading) return;

    // Don't set prompt for starter questions, send directly
    sendPrompt(threadId, question);
  };

  // Reset chat
  const refreshChat = () => {
    if (DEBUG_LOGS) console.log("Refreshing chat, clearing messages and thread ID");

    // Reset messages to just the welcome message
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: chatConfig.welcomeMessage,
        createdAt: new Date(),
      },
    ]);

    // Reset thread ID and remove from localStorage
    setThreadId(null);
    localStorage.removeItem("chatThreadId");

    // Clear thread data cache for this session
    if (threadId) {
      setThreadDataCache((prevCache) => {
        const updatedCache = { ...prevCache };
        delete updatedCache[threadId];
        localStorage.setItem("threadDataCache", JSON.stringify(updatedCache));
        return updatedCache;
      });
    }

    // Reset any in-progress messages
    setStreamingMessage(null);

    // Reset loading state
    setLoading(false);

    // Reset the prompt if there's any text in it
    if (prompt) {
      setPrompt("");
    }

    // Reset lastResponseId
    setLastResponseId(null);

    if (DEBUG_LOGS) console.log("Chat reset complete");
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Hero Section */}
      <div className="hero-section sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 relative">
          <div className="flex justify-between items-center">
            <div className="text-left max-w-3xl pl-1 sm:pl-2 md:pl-4">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm sm:text-base md:text-lg text-white whitespace-pre-line">
                {description}
              </p>
            </div>
            <button
              onClick={refreshChat}
              className="inline-flex items-center justify-center bg-white hover:bg-gray-100 hover:text-secondary hover:border-secondary border border-transparent text-primary py-1 sm:py-1.5 px-2 sm:px-3 rounded-lg transition-all duration-200 shadow-md whitespace-nowrap w-10 h-10 sm:w-auto sm:h-auto sm:min-w-[100px]"
              aria-label="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M12 5v14" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              <span className="hidden sm:inline text-base font-medium">
                New Chat
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="w-full max-w-7xl mx-auto px-4 pt-1 flex-1 flex flex-col overflow-hidden"
        style={{ minHeight: "500px", height: "100%" }}
      >
        <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
          {/* Chat and Input Section - NOT FIXED, CONTAINED WITHIN PARENT */}
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ maxHeight: "calc(100vh - 90px)" }}
          >
            {/* Chat Container - THE ONLY SCROLLABLE ELEMENT */}
            <div className="chat-container flex-1 overflow-hidden flex flex-col bg-gray-50">
              <div
                className="chat-messages flex-1 relative"
                ref={messageListRef}
                style={{
                  scrollBehavior: "smooth",
                  overflowY: "auto" /* ONLY THIS ELEMENT SCROLLS */,
                  overflowX: "hidden",
                  paddingBottom: "1rem",
                  maxHeight: "calc(100vh - 300px)",
                }}
              >
                {messages.map((msg, index) => {
                  const isLastMessage = index === messages.length - 1;
                  return (
                    <div
                      key={msg.id}
                      className={`message-bubble ${
                        msg.role === "assistant"
                          ? "message-bubble-assistant"
                          : "message-bubble-user"
                      }`}
                      ref={isLastMessage ? lastMessageRef : null}
                    >
                      {msg.role === "assistant" ? (
                        msg.content &&
                        msg.content.includes(
                          "<span class='loading-message'>"
                        ) ? (
                          <div
                            className="message-content prose"
                            dangerouslySetInnerHTML={{ __html: msg.content }}
                          />
                        ) : (
                          <StreamingMarkdown content={msg.content} />
                        )
                      ) : (
                        <div className="message-content">{msg.content}</div>
                      )}
                    </div>
                  );
                })}

                {loading && streamingMessage && streamingMessage.content && (
                  <div
                    className="message-bubble message-bubble-assistant"
                    ref={lastMessageRef}
                    id="streaming-message"
                  >
                    {streamingMessage.content &&
                    streamingMessage.stage &&
                    streamingMessage.content.includes(
                      "<span class='loading-message'>"
                    ) ? (
                      <div
                        className="message-content prose"
                        dangerouslySetInnerHTML={{
                          __html: streamingMessage.content,
                        }}
                      />
                    ) : (
                      <StreamingMarkdown content={streamingMessage.content} />
                    )}
                  </div>
                )}
              </div>

              {/* Scroll button - floating at bottom of viewport within chat area */}
              {!isAtBottom && (
                <div className="sticky bottom-0 w-full flex justify-center pb-2 pointer-events-none">
                  <button
                    onClick={scrollToBottomManually}
                    className="bg-white shadow-md rounded-full p-3 transition-opacity duration-300 ease-in-out z-10 hover:bg-gray-100 pointer-events-auto"
                    aria-label="Scroll to bottom"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-primary"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Input Container - STICKY BOTTOM */}
            <div className="bg-white py-3 sticky bottom-0 z-10 border-t border-gray-200 mt-auto">
              <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                sendPrompt={sendPrompt}
                threadId={threadId}
                loading={loading}
              />

              {/* Legal Text - centered */}
              <div className="text-xs text-gray-500 text-center mt-2">
                By chatting, you agree to the{" "}
                <a
                  href="https://www.kornferry.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-900 font-medium hover:underline"
                >
                  Terms of Use
                </a>{" "}
                and{" "}
                <a
                  href="https://www.kornferry.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-900 font-medium hover:underline"
                >
                  Global Privacy Policy
                </a>
              </div>
            </div>
          </div>

          {/* Collapsible Content Section */}
          <div className="w-full lg:w-auto lg:min-w-[300px] hidden md:block">
            <CollapsibleContent
              handleStarterQuestion={handleStarterQuestion}
              loading={loading}
            />
          </div>

          {/* Mobile version - this empty div ensures the fixed panel doesn't affect layout */}
          <div className="block md:hidden">
            <CollapsibleContent
              handleStarterQuestion={handleStarterQuestion}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Embed;
