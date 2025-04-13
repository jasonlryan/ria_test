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
import { parseResponse } from "../../../utils/helpers";
import chatConfig from "../../../config/chat.config.json";
import CollapsibleContent from "../../../components/CollapsibleContent";
// Add the new AssistantSelector component
import AssistantSelector from "../../../components/AssistantSelector";

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

function Embed({ params: { assistantId } }) {
  const title = "WORKFORCE 2025";
  const description =
    "Explore insights from our comprehensive workforce survey with RIA, your AI research assistant";

  const [loading, setLoading] = useState(false);
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
  const [threadId, setThreadId] = useState(() => {
    // Initialize from localStorage if available, but only in client side
    if (typeof window !== "undefined") {
      const savedThreadId = localStorage.getItem("chatThreadId");
      return savedThreadId || null;
    }
    return null;
  });

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
          console.log(
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
      console.log("🧵 THREAD ID SAVED TO LOCALSTORAGE:", threadId);
    }
  }, [threadId]);

  // Log thread data on init
  useEffect(() => {
    console.log("🧵 THREAD DATA CACHE INITIALIZED:", threadDataCache);
    if (threadId) {
      console.log(
        "🧵 CURRENT THREAD CACHED FILES:",
        getCachedFilesForThread(threadId)
      );
    }
  }, [threadId, threadDataCache, getCachedFilesForThread]);

  // Add version and params logging
  useEffect(() => {
    console.log("=== EMBED PAGE DIAGNOSTICS ===");
    console.log("Version: 2025");
    console.log("Assistant ID:", assistantId);
    console.log("Initial Render Time:", new Date().toISOString());
    console.log("========================");
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
      // Dynamically import the corresponding starter JSON
      import(`../../../utils/openai/precompiled_starters/${starterCode}.json`)
        .then((module) => {
          const starter = module.default || module;
          if (starter && starter.question) {
            sendPrompt(threadId, starter.question);
          } else {
            console.warn(
              `Starter file for code ${starterCode} did not contain a 'question' field.`
            );
          }
        })
        .catch((err) => {
          console.error(
            `Could not load starter question for code ${starterCode}:`,
            err
          );
        });
    } else if (questionText) {
      starterTriggeredRef.current = true;
      sendPrompt(threadId, questionText);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset chat
  const refreshChat = () => {
    console.log("Refreshing chat, clearing messages and thread ID");

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

    console.log("Chat reset complete");
  };

  // TODO: Move this into a helper function.
  const sendPrompt = async (threadId?: string, immediateQuestion?: string) => {
    // Use immediateQuestion if provided, otherwise use prompt state
    const questionText = immediateQuestion || prompt || "";

    // Don't send if question is empty
    if (!questionText.trim()) return;

    // Track analytics
    track("Question", { question: questionText });

    // Reset prompt immediately to prevent double submissions
    if (!immediateQuestion) {
      setPrompt("");
    }

    // Set loading state
    setLoading(true);

    // Set up the initial streaming message
    setStreamingMessage({
      id: "processing",
      role: "assistant",
      content:
        "<span class='loading-message'>Understanding your question...</span>",
      createdAt: new Date(),
      stage: "querying",
    });

    // Set up a loading animation sequence with more informative messages
    const loadingStages = [
      {
        stage: "retrieving",
        message: "Searching through workforce survey data...",
      },
      { stage: "analyzing", message: "Examining trends and statistics..." },
      {
        stage: "processing",
        message: "Identifying key patterns in the data...",
      },
      {
        stage: "connecting",
        message: "Connecting insights across demographics...",
      },
      { stage: "finalizing", message: "Formulating a comprehensive answer..." },
    ];

    let currentStage = 0;
    // Create a stable reference to the interval ID
    const intervalRef = { current: null };

    intervalRef.current = setInterval(() => {
      // Extra safety check to ensure the component is still mounted
      if (!loading) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      // Safety check that the array element exists
      if (currentStage < loadingStages.length && loadingStages[currentStage]) {
        setStreamingMessage((prev) => ({
          ...prev,
          content: `<span class='loading-message'>${loadingStages[currentStage].message}</span>`,
          stage: loadingStages[currentStage].stage,
        }));

        currentStage = (currentStage + 1) % loadingStages.length;
      }
    }, 4000);

    // Record the ID of the message we're sending for user display
    messageId.current += 1;
    const msgId = messageId.current;

    // Add user message to chat
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: msgId.toString(),
        role: "user",
        content: questionText,
        createdAt: new Date(),
      },
    ]);

    try {
      console.log("Processing query:", questionText);

      // Get cached files for this thread
      const cachedFiles = threadId
        ? getCachedFilesForThread(threadId)
        : { fileIds: [] };

      // Log thread information
      console.log("🧵 THREAD INFO:");
      console.log(`- Thread ID: ${threadId || "none"}`);
      console.log(
        `- Query: "${questionText.substring(0, 30)}${
          questionText.length > 30 ? "..." : ""
        }"`
      );
      console.log(
        `- Has cached data: ${
          Boolean(threadId) && cachedFiles.fileIds.length > 0
        }`
      );
      console.log(`- Cached files: ${cachedFiles.fileIds.length}`);

      // STAGE 1: Data Retrieval
      // Update streaming message to show retrieval status
      setStreamingMessage((prev) => ({
        ...prev,
        content: `<span class='loading-message'>Retrieving data...</span>`,
        stage: "retrieving",
      }));

      console.log(
        `📊 Retrieving data for query with ${cachedFiles.fileIds.length} cached files`
      );

      // Send request to query API, including cached file IDs
      const dataRetrievalResponse = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: questionText,
          context: "all-sector",
          cachedFileIds: cachedFiles.fileIds,
        }),
      });

      if (!dataRetrievalResponse.ok) {
        setStreamingMessage((prev) => ({
          ...prev,
          content: `<span class='loading-message'>Data retrieval failed with status ${dataRetrievalResponse.status}</span>`,
          stage: "error",
        }));
        console.error(
          "Error in data retrieval:",
          dataRetrievalResponse.statusText
        );
        throw new Error(
          `Data retrieval failed with status ${dataRetrievalResponse.status}`
        );
      }

      const dataResult = await dataRetrievalResponse.json();
      console.log("Data retrieval result:", {
        status: dataResult.status,
        files: dataResult.file_ids?.length || 0,
        error: dataResult.error,
      });

      // Check for errors in the data retrieval response
      if (dataResult.error) {
        setStreamingMessage((prev) => ({
          ...prev,
          content: `I'm sorry, I encountered an error retrieving the relevant data: ${dataResult.error}`,
          stage: "error",
        }));
        setLoading(false);
        clearInterval(intervalRef.current);
        return;
      }

      // Check for special error cases
      if (dataResult && dataResult.status === "error_no_context") {
        console.log("Error - no context available");

        // Create a user-friendly error message
        const errorMessage = {
          role: "assistant",
          content: `I need some context first. ${
            dataResult.error ||
            "Please ask me a question about workforce trends before requesting content transformations like articles or summaries."
          }`,
          id: `error-${Date.now()}`,
          createdAt: new Date(),
        };

        // Add the error message to the chat
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
        setStreamingMessage(null);
        setLoading(false);
        clearInterval(intervalRef.current);

        // Log the error
        console.error("Error:", dataResult.error);

        // End the function here
        return;
      }

      // Update thread cache with file IDs if new files were retrieved
      if (threadId && dataResult?.file_ids && dataResult.file_ids.length > 0) {
        const newFileIds = dataResult.file_ids;
        const newData = { raw_data: dataResult.raw_data };

        // Update the cache
        updateThreadCache(threadId, newFileIds, newData);
      }

      // STAGE 2: After data retrieval, before sending to assistant
      // Update the streaming message to show we're generating insights
      setStreamingMessage((prev) => ({
        ...prev,
        content: `<span class='loading-message'>Generating insights...</span>`,
        stage: "analyzing",
      }));

      // Add more detailed logging
      console.log("Starting stage 2: Generating insights from retrieved data");

      // Prepare content for the assistant with safety checks
      const assistantPrompt = `
Query: ${questionText}

Analysis Summary: ${dataResult?.analysis || "No analysis available"}

${
  dataResult?.files_used
    ? `Files Used: ${dataResult.files_used.join(", ")}`
    : ""
}
${dataResult?.data_points ? `Data Points: ${dataResult.data_points}` : ""}
${dataResult?.status ? `Status: ${dataResult.status}` : ""}

${
  dataResult?.raw_data
    ? `Raw Survey Data:
\`\`\`json
${
  typeof dataResult.raw_data === "string"
    ? dataResult.raw_data
    : JSON.stringify(dataResult.raw_data, null, 2)
}
\`\`\`
`
    : "NO RAW DATA AVAILABLE"
}
`;

      // TEMPORARY: Log the full data being sent to the assistant (USER REQUESTED)
      console.log("==== FULL DATA SENT TO ASSISTANT ====");
      console.log(assistantPrompt);
      console.log("==== END FULL DATA ====");

      // Add concise logging
      console.log("------- Sending to assistant -------");
      console.log("Query:", questionText);
      console.log("Topics:", dataResult.matched_topics);
      console.log("Files:", dataResult.files_used);
      console.log("Data points:", dataResult.data_points);
      console.log("Raw data included:", !!dataResult.raw_data);

      // Add timeout handling for the API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        throw new Error("Assistant API request timed out after 30 seconds");
      }, 30000); // 30 second timeout

      try {
        // Send request to API for assistant processing
        const assistantResponse = await fetch("/api/chat-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: assistantId,
            threadId: threadId,
            content: assistantPrompt,
          }),
          signal: controller.signal,
        });

        // Add message update after 5 seconds of waiting
        // Set a delayed message update to indicate processing
        const processingUpdateTimeout = setTimeout(() => {
          if (loading) {
            setStreamingMessage((prev) => ({
              ...prev,
              content: `<span class='loading-message'>Processing complex data patterns and preparing your answer...</span>`,
              stage: "finalizing",
            }));
          }
        }, 5000);

        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        clearTimeout(processingUpdateTimeout);

        console.log("API response status:", assistantResponse.status);

        if (!assistantResponse.ok) {
          console.error(
            "Error response from OpenAI API:",
            assistantResponse.status
          );

          try {
            // Try to get the error message from the response
            const errorData = await assistantResponse.json();
            console.error("Error details:", errorData);

            // Display out-of-scope errors differently
            if (errorData.error_type === "out_of_scope") {
              setStreamingMessage((prev) => ({
                ...prev,
                stage: "error",
                content: `<span class='error-message'>${
                  errorData.message ||
                  "I'm sorry, but that appears to be outside the scope of what I can help with based on the available data."
                }</span>`,
              }));
            } else {
              setStreamingMessage((prev) => ({
                ...prev,
                stage: "error",
                content: `<span class='error-message'>${
                  errorData.message ||
                  "Error contacting AI assistant. Please try again later."
                }</span>`,
              }));
            }
          } catch (e) {
            // Fallback if we can't parse the error
            setStreamingMessage((prev) => ({
              ...prev,
              stage: "error",
              content: `<span class='error-message'>Error contacting AI assistant. Please try again later.</span>`,
            }));
          }

          throw new Error(
            `API response not OK: ${assistantResponse.status} ${assistantResponse.statusText}`
          );
        }

        if (!assistantResponse.body) {
          throw new Error("No response body received");
        }

        // Add more detailed logging
        console.log("Got response body, starting stream processing");

        // Use a manual event source approach instead of AssistantStream
        const reader = assistantResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Reset accumulated text at the start of streaming
        accumulatedText.current = "";

        // Function to process SSE events
        const processEvents = async (chunk) => {
          // Add the new chunk to our buffer
          buffer += chunk;

          // Log raw buffer for debugging
          console.log(`Raw chunk received (${chunk.length} chars)`);

          // First look for text delta events and accumulate them
          const textDeltaRegex = /event: textDelta\ndata: ({.*?})\n\n/g;
          let match;

          while ((match = textDeltaRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(match[1]);

              if (eventData.value) {
                console.log(
                  `📝 Accumulating text delta: ${eventData.value.substring(
                    0,
                    20
                  )}...`
                );

                // CRITICAL: Accumulate text in the ref first
                accumulatedText.current += eventData.value;

                // Then update React state once with the complete accumulated text
                setStreamingMessage({
                  id: "streaming",
                  role: "assistant",
                  content: accumulatedText.current,
                  createdAt: new Date(),
                });
              }
            } catch (e) {
              console.error("Error processing text delta:", e);
            }
          }

          // Look for message done events
          const messageDoneRegex = /event: messageDone\ndata: ({.*?})\n\n/g;
          let doneMatch;

          while ((doneMatch = messageDoneRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(doneMatch[1]);
              console.log("✅ Message completed, adding to chat");

              // Set the thread ID if available
              if (eventData.threadId) {
                setThreadId(eventData.threadId);
              }

              // Use the accumulated text for the final message
              const finalContent =
                eventData.content || accumulatedText.current || "";

              // *** ADDED FOR DEBUGGING ***
              console.log(
                "DEBUG: Final content being added to messages:",
                JSON.stringify(finalContent)
              );
              // *** END DEBUGGING ***

              // Add the final message
              messageId.current++;
              setMessages((prevMessages) => [
                ...prevMessages,
                {
                  id: messageId.current.toString(),
                  role: "assistant",
                  content: finalContent,
                  createdAt: new Date(eventData.createdAt || Date.now()),
                },
              ]);

              // Reset states
              setLoading(false);
              setStreamingMessage(null);
              accumulatedText.current = "";

              // Clear loading interval
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }

              // Scroll to bottom
              setTimeout(scrollToBottom, 100);
            } catch (e) {
              console.error("Error processing message done:", e);
            }
          }

          // Check for error events
          const errorRegex = /event: error\ndata: ({.*?})\n\n/g;
          let errorMatch;

          while ((errorMatch = errorRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(errorMatch[1]);
              console.error(
                "🛑 Error event:",
                eventData.message || eventData.error
              );

              // Add error message
              messageId.current++;
              setMessages((prevMessages) => [
                ...prevMessages,
                {
                  id: messageId.current.toString(),
                  role: "assistant",
                  content: `I apologize, but I encountered an error: ${
                    eventData.message || eventData.error || "Unknown error"
                  }`,
                  createdAt: new Date(),
                },
              ]);

              // Reset states
              setLoading(false);
              setStreamingMessage(null);

              // Clear loading interval
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }

              // Scroll to bottom
              setTimeout(scrollToBottom, 100);
            } catch (e) {
              console.error("Error processing error event:", e);
            }
          }

          // Trim buffer to avoid memory issues
          const lastCompleteEvent = buffer.lastIndexOf("\n\n");
          if (lastCompleteEvent > 0) {
            buffer = buffer.substring(lastCompleteEvent + 2);
          }
        };

        // Start reading the stream
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log("Stream complete");
              break;
            }

            // Process this chunk
            await processEvents(decoder.decode(value, { stream: true }));
          }
        } catch (streamError) {
          console.error("Error reading stream:", streamError);

          // Add error message to chat
          messageId.current++;
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              id: messageId.current.toString(),
              role: "assistant",
              content:
                "I apologize, but I encountered an issue with the connection. Please try again.",
              createdAt: new Date(),
            },
          ]);

          // Reset states
          setLoading(false);
          setStreamingMessage(null);

          // Clear loading interval if it's still running
          if (intervalRef.current) clearInterval(intervalRef.current);

          // Scroll to bottom
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error("Error processing assistant response:", error);

        // Clear the timeout if there was an error
        clearTimeout(timeoutId);

        // Determine the type of error for a more helpful message
        let errorMessage =
          "I apologize, but I encountered an issue while processing your request.";

        if (error.name === "AbortError") {
          errorMessage =
            "I apologize for the delay. Your request took longer than expected to process. Please try asking a more specific question or try again later.";
        } else if (
          error.message?.includes("network") ||
          error.message?.includes("fetch")
        ) {
          errorMessage =
            "I'm having trouble connecting to the server. Please check your internet connection and try again.";
        } else if (error.message?.includes("API")) {
          errorMessage =
            "I'm experiencing some temporary technical difficulties. Our team has been notified and is working to resolve this. Please try again in a few minutes.";
        }

        // Add error message to chat
        messageId.current++;
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: messageId.current.toString(),
            role: "assistant",
            content: errorMessage,
            createdAt: new Date(),
          },
        ]);

        // Reset states
        setLoading(false);
        setStreamingMessage(null);

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Request error:", error);

      // Add error message to chat
      messageId.current++;
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: messageId.current.toString(),
          role: "assistant",
          content: "Sorry, an error occurred while sending your request.",
          createdAt: new Date(),
        },
      ]);

      // Reset states
      setLoading(false);
      setStreamingMessage(null);

      // Scroll to bottom
      setTimeout(scrollToBottom, 100);
    }
  };

  // Auto scroll to bottom of message list. Scroll as message is being streamed.
  const messageListRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Scroll function that ONLY affects the chat messages panel
  const scrollToBottom = useCallback(() => {
    if (!messageListRef.current) return;

    // Directly scroll the chat messages container ONLY
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    console.log(
      "Scrolling chat panel to:",
      messageListRef.current.scrollHeight
    );
  }, []);

  // Auto-scroll when messages change or during streaming
  useEffect(() => {
    // Immediate scroll
    scrollToBottom();

    // Delayed scroll to catch rendering
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300); // Additional delayed scroll to catch late renders
  }, [messages, streamingMessage, scrollToBottom]);

  const handleStarterQuestion = (question: string) => {
    if (loading) return;

    // Don't set prompt for starter questions, send directly
    sendPrompt(threadId, question);
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
              className="inline-flex items-center bg-white hover:bg-gray-100 hover:text-secondary hover:border-secondary border border-transparent text-primary py-1.5 px-3 rounded-lg transition-all duration-200 shadow-md whitespace-nowrap min-w-[100px]"
              aria-label="New chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5 mr-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              <span className="text-base font-medium">New Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="w-full max-w-7xl mx-auto px-4 pt-1 flex-1 flex flex-col overflow-hidden"
        style={{ height: "calc(100vh - 90px)" }}
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
                className="chat-messages flex-1"
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

                {loading && streamingMessage && (
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

              {/* Assistant selector directly below input with privacy message aligned */}
              <div className="flex items-center justify-between mt-2">
                <AssistantSelector currentAssistantId={assistantId} />

                {/* Legal Text - aligned with selector */}
                <div className="text-xs text-gray-500">
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

      {/* Add this style section inside the component's return, before the main JSX structure */}
      <style jsx global>{`
        .loading-message {
          display: inline-block;
          position: relative;
        }

        .loading-message:after {
          content: "";
          animation: ellipsis 1.5s infinite;
        }

        @keyframes ellipsis {
          0% {
            content: "";
          }
          25% {
            content: ".";
          }
          50% {
            content: "..";
          }
          75% {
            content: "...";
          }
          100% {
            content: "";
          }
        }
      `}</style>
    </div>
  );
}

export default Embed;
