"use client";

// Tracking in Analytics for the question asked
import { track } from "@vercel/analytics";

// This ended up being a big refactor, but its much more up to date now, and has less guff.
// Found this starting kit and used that as a reference: https://github.com/Superexpert/openai-assistant-starter-kit/tree/main
// api/chat-assistant/route.ts is where we call the OpenAI API to get the response, there we can stream the response.

// React
import { useState, useRef, useEffect, Suspense } from "react";
// Open AI
import { AssistantStream } from "openai/lib/AssistantStream";
// Markdown
import Markdown from "react-markdown";
// Components
import Nav from "../../../components/Nav";
import PromptInput from "../../../components/PromptInput";
// Helpers
import { parseResponse } from "../../../utils/helpers";
import chatConfig from "../../../config/chat.config.json";

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

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
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
        setTimeout(scroll, 100);
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
        setTimeout(scroll, 100);
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
      setTimeout(scroll, 100);
    }
  };

  // Auto scroll to bottom of message list. Scroll as message is being streamed.
  const messageListRef = useRef<HTMLDivElement>(null);
  const scroll = () => {
    // Grab the properties for the message list
    const { scrollHeight } = messageListRef.current as HTMLDivElement;
    messageListRef.current?.scrollTo(0, scrollHeight);
  };
  useEffect(() => {
    scroll();
  }, [streamingMessage]);

  const handleStarterQuestion = (question: string) => {
    if (loading) return;

    // Don't set prompt for starter questions, send directly
    sendPrompt(threadId, question);
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 lg:py-10 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base sm:text-lg md:text-xl text-white max-w-3xl mx-auto">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-6 lg:py-8 flex-1 flex flex-col">
        <Nav refreshChat={refreshChat} title={title} />

        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Chat and Input Section */}
          <div className="flex-1 flex flex-col">
            {/* Chat Container */}
            <div className="chat-container">
              <div
                className="chat-messages scroll"
                ref={messageListRef}
                style={{ scrollBehavior: "smooth" }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble ${
                      msg.role === "assistant"
                        ? "message-bubble-assistant"
                        : "message-bubble-user"
                    }`}
                  >
                    <Markdown className="prose max-w-none text-sm sm:text-base">
                      {msg.content}
                    </Markdown>
                  </div>
                ))}

                {loading && streamingMessage && (
                  <div className="message-bubble message-bubble-assistant">
                    <Markdown className="prose max-w-none text-sm sm:text-base">
                      {streamingMessage.content}
                    </Markdown>
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
            <div className="w-full">
              <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                sendPrompt={sendPrompt}
                threadId={threadId}
                loading={loading}
              />
            </div>
          </div>

          {/* Starter Questions Section */}
          <div className="lg:w-64 flex flex-col gap-2">
            <h2 className="font-medium text-sm text-gray-600 mb-1 hidden lg:block">
              Suggested Questions
            </h2>
            {chatConfig.starterQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleStarterQuestion(q.text)}
                disabled={loading}
                className="starter-question-btn"
              >
                {q.text}
              </button>
            ))}
          </div>
        </div>

        {/* Legal Text */}
        <div className="text-center text-xs text-gray-500 mt-4">
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
