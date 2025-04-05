"use client";

// Tracking in Analytics for the question asked
import { track } from "@vercel/analytics";

// This ended up being a big refactor, but its much more up to date now, and has less guff.
// Found this starting kit and used that as a reference: https://github.com/Superexpert/openai-assistant-starter-kit/tree/main
// api/chat-assistant/route.ts is where we call the OpenAI API to get the response, there we can stream the response.

// React
import { useState, useRef, useEffect, Suspense, useCallback } from "react";
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

function Embed({ params: { assistantId } }) {
  const title = "WORKFORCE 2025";
  const description =
    "Explore insights from our comprehensive workforce survey with RIA,\nyour AI research assistant";

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
  // User prompt
  const [prompt, setPrompt] = useState("");
  // Get the thread id from the response, and then can pass it back to the next request to continue the conversation.
  const [threadId, setThreadId] = useState(null);

  // Add version and params logging
  useEffect(() => {
    console.log("=== EMBED PAGE DIAGNOSTICS ===");
    console.log("Version: 2025");
    console.log("Assistant ID:", assistantId);
    console.log("Initial Render Time:", new Date().toISOString());
    console.log("========================");
  }, [assistantId]);

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

    // Reset thread ID
    setThreadId(null);

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
          content: `<span class='loading-message'>${
            loadingStages[currentStage]?.message || "Processing..."
          }</span>`,
          stage: loadingStages[currentStage]?.stage || "processing",
        }));
        currentStage++;
      } else {
        // Loop back to the beginning if we've gone through all stages
        currentStage = 0;
        // Don't clear the interval - we'll keep cycling through messages
      }
    }, 3000); // Change message every 3 seconds

    // Add user message to chat
    messageId.current++;
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: messageId.current.toString(),
        role: "user",
        content: questionText,
        createdAt: new Date(),
      },
    ]);

    try {
      console.log("Processing query:", questionText);

      // STAGE 1: Direct Data Retrieval - Do this BEFORE sending to assistant
      setStreamingMessage((prev) => ({
        ...prev,
        content: `<span class='loading-message'>Stage 1: Retrieving workforce data...</span>`,
        stage: "retrieving",
      }));

      // Call our local API to retrieve data with retry logic
      let dataResult;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          console.log(
            `Data retrieval attempt ${retryCount + 1}/${maxRetries + 1}`
          );

          const dataRetrievalResponse = await fetch("/api/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: questionText }),
          });

          if (!dataRetrievalResponse.ok) {
            throw new Error(
              `Data retrieval failed with status ${dataRetrievalResponse.status}`
            );
          }

          dataResult = await dataRetrievalResponse.json();

          // Check if the response contains an error
          if (dataResult.error) {
            console.error(
              "Data retrieval returned an error:",
              dataResult.error
            );

            if (retryCount < maxRetries) {
              retryCount++;
              // Wait before retrying (exponential backoff)
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * Math.pow(2, retryCount))
              );
              continue;
            } else {
              throw new Error(`Data retrieval error: ${dataResult.error}`);
            }
          }

          // If we got here, the request was successful
          break;
        } catch (error) {
          console.error(
            `Data retrieval attempt ${retryCount + 1} failed:`,
            error
          );

          if (retryCount < maxRetries) {
            retryCount++;
            // Wait before retrying (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * Math.pow(2, retryCount))
            );
          } else {
            // All retries failed
            throw new Error(
              `Data retrieval failed after ${maxRetries + 1} attempts: ${
                error.message
              }`
            );
          }
        }
      }

      // Ensure we have a dataResult even if something went wrong
      if (!dataResult) {
        dataResult = {
          analysis:
            "I couldn't retrieve data to answer your question due to a technical issue. Please try again with a different question.",
          matched_topics: [],
          files_used: [],
          data_points: 0,
          status: "error",
        };
      }

      // Check for missing analysis when we should have one
      if (!dataResult.analysis && dataResult.status !== "error") {
        console.warn("Data retrieval did not return any analysis");
      }

      console.log("Data retrieval complete:", {
        status: dataResult.status || "success",
        topics: dataResult.matched_topics?.length || 0,
        files: dataResult.files_used?.length || 0,
        dataPoints: dataResult.data_points || 0,
      });

      // Check if the query was identified as out of scope
      if (dataResult.status === "out_of_scope") {
        console.log(
          "Query was out of scope, showing immediate response and skipping assistant call"
        );

        // Add out-of-scope message to chat
        messageId.current++;
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: messageId.current.toString(),
            role: "assistant",
            content: dataResult.analysis,
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

        // Exit early
        return;
      }

      // STAGE 2: Send to assistant with the retrieved data
      setStreamingMessage((prev) => ({
        ...prev,
        content: `<span class='loading-message'>Stage 2: Generating insights...</span>`,
        stage: "analyzing",
      }));

      // Handle errors during data retrieval
      const hasDataRetrievalError =
        dataResult.status === "error" || dataResult.error;

      // Log the actual raw data structure
      console.log("RAW DATA CHECK:");
      console.log(
        `dataResult object keys: ${Object.keys(dataResult).join(", ")}`
      );
      console.log(`Has raw_data: ${!!dataResult.raw_data}`);
      console.log(
        `Raw data is being saved to logs/raw-data-${Date.now()}.json`
      );

      // Create logs directory if needed
      fetch("/api/create-logs-dir", {
        method: "POST",
      });

      // Save the raw data directly to a file for inspection
      const rawDataSaver = async () => {
        try {
          // Save the raw data exactly as received from API
          const filename = `raw-data-dump-${Date.now()}.json`;
          const filepath = `/Users/jasonryan/Documents/RIA25/logs/${filename}`;

          // Log the raw data in detail
          console.log(`DIRECT DATA CHECK:`);
          console.log(`dataResult type: ${typeof dataResult}`);
          console.log(`dataResult keys: ${Object.keys(dataResult).join(", ")}`);
          console.log(`raw_data exists: ${!!dataResult.raw_data}`);
          console.log(`raw_data type: ${typeof dataResult.raw_data}`);
          console.log(
            `raw_data is array: ${Array.isArray(dataResult.raw_data)}`
          );

          if (Array.isArray(dataResult.raw_data)) {
            console.log(`raw_data length: ${dataResult.raw_data.length}`);
            console.log(
              `raw_data sample: ${JSON.stringify(
                dataResult.raw_data.slice(0, 1)
              ).substring(0, 200)}...`
            );
          }

          // Save directly to file system
          fetch("/api/save-to-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: `dataResult-full-object-${Date.now()}.json`,
              data: JSON.stringify(dataResult, null, 2),
            }),
          });

          // Also save just the raw_data
          fetch("/api/save-to-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: `raw-data-direct-dump-${Date.now()}.json`,
              data: JSON.stringify(dataResult.raw_data, null, 2),
            }),
          });

          console.log(
            `SAVED DATA DUMP TO logs/dataResult-full-object-${Date.now()}.json`
          );
          console.log(
            `SAVED RAW DATA DUMP TO logs/raw-data-direct-dump-${Date.now()}.json`
          );
        } catch (error) {
          console.error("Error saving raw data:", error);
        }
      };

      // Run the data saver
      rawDataSaver();

      // Directly include raw data with no transformations or checks
      const rawDataString = JSON.stringify(dataResult.raw_data);
      console.log(`RAW DATA LENGTH: ${rawDataString.length}`);
      console.log(`RAW DATA PREVIEW: ${rawDataString.substring(0, 300)}...`);

      const rawDataSection = !hasDataRetrievalError
        ? `Raw Survey Data:
\`\`\`json
${rawDataString}
\`\`\`
`
        : "NO RAW DATA AVAILABLE";

      // Prepare content for the assistant with safety checks
      const assistantPrompt = `
Query: ${questionText}

${
  hasDataRetrievalError
    ? `There was an error retrieving the data: ${
        dataResult.error || "Unknown error"
      }.
Please provide a general response about ${questionText} without specific data references.`
    : dataResult.analysis
    ? `Analysis summary:
${dataResult.analysis}`
    : "No relevant data was found. Please provide a general response."
}

${rawDataSection}

${
  hasDataRetrievalError
    ? "Please provide a helpful general response about this topic based on your knowledge."
    : "Please analyze the raw survey data and provide insights about the query. Focus on the percentage values in the data."
}
`;

      // Save the raw data for inspection (100% guaranteed method)
      try {
        // Write raw data directly to a file in the logs directory
        const rawDataTimestamp = Date.now();

        // Save the assistant prompt first
        fetch("/api/save-to-logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: `assistant-prompt-${rawDataTimestamp}.txt`,
            data: assistantPrompt,
          }),
        });

        // Then save just the raw data
        if (dataResult.raw_data) {
          fetch("/api/save-to-logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename: `raw-data-only-${rawDataTimestamp}.json`,
              data: JSON.stringify(dataResult.raw_data, null, 2),
            }),
          });

          console.log("=============== CONFIRMATION ===============");
          console.log(`Data saved in logs directory!`);
          console.log(`assistant-prompt-${rawDataTimestamp}.txt`);
          console.log(`raw-data-only-${rawDataTimestamp}.json`);
          console.log("===========================================");
        } else {
          console.error("CRITICAL ERROR: No raw_data to save!");
        }
      } catch (error) {
        console.error("Error saving data:", error);
      }

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

      console.log("Sending to assistant:", {
        assistantId,
        threadId,
        contentLength: assistantPrompt.length,
      });

      // Add timeout handling for the API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        throw new Error("Assistant API request timed out after 30 seconds");
      }, 30000); // 30 second timeout

      try {
        // Send request to API for assistant processing
        const response = await fetch("/api/chat-assistant", {
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

        console.log("API response status:", response.status);

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "No error text available");
          console.error("API error details:", {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
          throw new Error(
            `API responded with status: ${response.status} - ${errorText}`
          );
        }

        if (!response.body) {
          throw new Error("No response body received");
        }

        // Add more detailed logging
        console.log("Got response body, starting stream processing");

        // Use a manual event source approach instead of AssistantStream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Function to process SSE events
        const processEvents = (chunk) => {
          // Add the new chunk to our buffer
          buffer += chunk;

          // Process all complete events in the buffer
          const eventRegex = /event: ([^\n]+)\ndata: ({[^\n]+})\n\n/g;
          let match;

          while ((match = eventRegex.exec(buffer)) !== null) {
            const eventType = match[1];
            const eventData = JSON.parse(match[2]);

            console.log(`Received event: ${eventType}`, eventData);

            switch (eventType) {
              case "run":
                console.log("Run status update:", eventData.status);
                break;

              case "textDelta":
                if (eventData.value) {
                  setStreamingMessage((prev) => ({
                    ...prev,
                    content: parseResponse(eventData.value),
                  }));
                }
                break;

              case "messageDone":
                // Handle completed message
                messageId.current++;
                setMessages((prevMessages) => [
                  ...prevMessages,
                  {
                    id: messageId.current.toString(),
                    role: "assistant",
                    content: parseResponse(eventData.content),
                    createdAt: new Date(eventData.createdAt),
                  },
                ]);

                // Reset states
                setLoading(false);
                setStreamingMessage(null);

                // Clear loading interval if it's still running
                if (intervalRef.current) clearInterval(intervalRef.current);

                // Scroll to bottom
                setTimeout(scrollToBottom, 100);
                break;

              case "error":
                console.error("Stream error:", eventData.message);

                // Add friendly error message to chat
                messageId.current++;
                setMessages((prevMessages) => [
                  ...prevMessages,
                  {
                    id: messageId.current.toString(),
                    role: "assistant",
                    content: `I apologize, but I encountered an error: ${eventData.message}`,
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
                break;
            }
          }

          // Keep any incomplete event data in the buffer
          const lastEventIndex = buffer.lastIndexOf("\n\n");
          if (lastEventIndex > 0) {
            buffer = buffer.substring(lastEventIndex + 2);
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
            processEvents(decoder.decode(value, { stream: true }));
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
              className="inline-flex items-center bg-white hover:bg-gray-100 hover:text-secondary hover:border-secondary border border-transparent text-primary py-1.5 px-3 rounded-lg transition-all duration-200 shadow-md"
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
                                <h1
                                  {...props}
                                  className="font-bold text-primary"
                                />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2
                                  {...props}
                                  className="font-bold text-primary"
                                />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3
                                  {...props}
                                  className="font-semibold text-primary"
                                />
                              ),
                              h4: ({ node, ...props }) => (
                                <h4
                                  {...props}
                                  className="font-semibold text-primary"
                                />
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
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
                            <h3
                              {...props}
                              className="font-semibold text-primary"
                            />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4
                              {...props}
                              className="font-semibold text-primary"
                            />
                          ),
                        }}
                      >
                        {streamingMessage.content}
                      </ReactMarkdown>
                    )}

                    {!streamingMessage.content.includes(
                      "<span class='loading-message'>"
                    ) && (
                      <div className="flex h-4 items-end gap-2 mt-2">
                        <div className="bounce bounce1 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                        <div className="bounce bounce2 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                        <div className="bounce bounce3 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                      </div>
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
          <div className="w-full lg:w-auto lg:min-w-[300px]">
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
