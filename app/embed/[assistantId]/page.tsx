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
    setMessages(() => [
      {
        id: "welcome",
        role: "assistant",
        content: chatConfig.welcomeMessage,
        createdAt: new Date(),
      },
    ]);
    setThreadId(() => null);
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

    // Clear streaming message
    setStreamingMessage({
      id: "Thinking...",
      role: "assistant",
      content: "",
      createdAt: new Date(),
    });

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
      console.log("Sending request to API:", {
        assistantId,
        threadId,
        contentLength: questionText.length,
      });

      // Send request to API
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: assistantId,
          threadId: threadId,
          content: questionText,
        }),
      });

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

      // Process streaming response
      const runner = AssistantStream.fromReadableStream(response.body);

      runner.on("messageCreated", (message) => {
        if (message.thread_id) {
          setThreadId(message.thread_id);
        }
      });

      runner.on("textDelta", (_delta, contentSnapshot) => {
        if (contentSnapshot && contentSnapshot.value) {
          setStreamingMessage((prev) => ({
            ...prev,
            content: parseResponse(contentSnapshot.value),
          }));
        }
      });

      runner.on("messageDone", (message) => {
        let finalContent = "";

        if (
          message.content &&
          message.content.length > 0 &&
          message.content[0].type === "text"
        ) {
          finalContent = message.content[0].text.value;
        }

        // Add assistant message to chat
        messageId.current++;
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: messageId.current.toString(),
            role: "assistant",
            content: parseResponse(finalContent),
            createdAt: new Date(),
          },
        ]);

        // Reset states
        setLoading(false);
        setStreamingMessage(null);

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      });

      runner.on("error", (error) => {
        console.error("Stream error:", error);

        // Add error message to chat
        messageId.current++;
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: messageId.current.toString(),
            role: "assistant",
            content: "Sorry, an error occurred while processing your request.",
            createdAt: new Date(),
          },
        ]);

        // Reset states
        setLoading(false);
        setStreamingMessage(null);

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      });
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

  // Simple, direct scrolling function - no conditions to block scrolling
  const scrollToBottom = useCallback(() => {
    if (!messageListRef.current) return;

    // Log for debugging
    console.log(
      "Scrolling to bottom, height:",
      messageListRef.current.scrollHeight
    );

    // Method 1: Direct property assignment - most reliable
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;

    // Method 2: Also try smooth scrolling as backup
    messageListRef.current.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "auto", // Changed from smooth to ensure it happens immediately
    });
  }, []);

  // Aggressive approach: Use both immediate and delayed scrolling
  const forceScrollToBottom = useCallback(() => {
    // Immediate scroll
    scrollToBottom();

    // Delayed scrolls at increasing intervals to catch any late content renders
    setTimeout(scrollToBottom, 50);
    setTimeout(scrollToBottom, 150);
    setTimeout(scrollToBottom, 300);
  }, [scrollToBottom]);

  // Scroll when messages change or during streaming
  useEffect(() => {
    forceScrollToBottom();
  }, [messages, streamingMessage, forceScrollToBottom]);

  // Also set up a mutation observer to catch content changes
  useEffect(() => {
    if (!messageListRef.current) return;

    // Create mutation observer to watch for content changes during streaming
    const observer = new MutationObserver(() => {
      // When streaming is active, always scroll to keep up with new content
      if (loading && streamingMessage) {
        scrollToBottom();
      }
    });

    // Start observing the message container with more detailed options
    observer.observe(messageListRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
      attributeOldValue: false,
    });

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom, loading, streamingMessage]);

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
              className="inline-flex items-center bg-white hover:bg-gray-100 text-primary py-1.5 px-3 rounded-lg transition-colors shadow-md"
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
      <div className="w-full max-w-7xl mx-auto px-4 pt-1 flex-1 flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">
          {/* Chat and Input Section */}
          <div
            className="flex-1 flex flex-col"
            style={{
              height: "calc(100vh - 90px)",
              minHeight: "400px",
              maxHeight: "100%",
            }}
          >
            {/* Chat Container */}
            <div className="chat-container flex-1 overflow-hidden flex flex-col">
              <div
                className="chat-messages flex-1"
                ref={messageListRef}
                style={{
                  scrollBehavior: "smooth",
                  overflowY: "auto",
                  paddingBottom: "0.5rem",
                  minHeight: "100px",
                  maxHeight: "calc(100vh - 260px)",
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
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  );
                })}

                {loading && streamingMessage && (
                  <div
                    className="message-bubble message-bubble-assistant"
                    ref={lastMessageRef}
                    id="streaming-message"
                  >
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
                    <div className="flex h-4 items-end gap-2 mt-2">
                      <div className="bounce bounce1 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                      <div className="bounce bounce2 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                      <div className="bounce bounce3 rounded bg-primary h-1.5 w-1.5 sm:h-2 sm:w-2" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Container */}
            <div className="w-full sticky bottom-0 z-10 bg-white py-3 flex-shrink-0">
              <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                sendPrompt={sendPrompt}
                threadId={threadId}
                loading={loading}
              />

              {/* Assistant Selector - placed underneath input box */}
              <div className="flex justify-start mt-2 ml-1">
                <AssistantSelector currentAssistantId={assistantId} />
              </div>
            </div>
          </div>

          {/* Collapsible Content Section */}
          <CollapsibleContent
            handleStarterQuestion={handleStarterQuestion}
            loading={loading}
          />
        </div>

        {/* Legal Text */}
        <div className="text-center text-xs text-gray-500 mt-4 mb-8 pb-6">
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
  );
}

export default Embed;
