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

function Embed({ params: { assistantId } }) {
  // assistantId = "asst_0rwtZ6opRArKCMavVqIxU2na";

  // Magnus LIVE ID
  if (assistantId === "asst_MgRnSzOzQxrR3KNSjMczF3mY") {
    assistantId = "asst_QlWfgko8ESiJS9qiOlfNjDCK";
  }

  const [loading, setLoading] = useState(false);
  // Message being streamed
  const [streamingMessage, setStreamingMessage] = useState(null);
  // Whole chat
  const [messages, setMessages] = useState([]);
  const messageId = useRef(0);
  // User prompt
  const [prompt, setPrompt] = useState("");
  // Get the thread id from the response, and then can pass it back to the next request to continue the conversation.
  const [threadId, setThreadId] = useState(null);

  // Reset chat
  const refreshChat = () => {
    setMessages(() => []);
    setThreadId(() => null);
  };

  // TODO: Move this into a helper function.
  const sendPrompt = async (threadId?: string) => {
    track("Question", { question: prompt });

    // Clear streaming message, need to do this or it will show the previous message before the new one. We can add to the content if we want to show a thinking message.
    setStreamingMessage({
      id: "Thinking...",
      role: "assistant",
      content: "",
      createdAt: new Date(),
    });

    // Set loading to show bubbles / wait for response to come in.
    setLoading(true);

    // add user message to list of messages.
    messageId.current++;
    setMessages([
      ...messages,
      {
        id: messageId.current.toString(),
        role: "user",
        content: prompt,
        createdAt: new Date(),
      },
    ]);

    // Reset the prompt.
    setPrompt("");

    // post new message to server and stream OpenAI Assistant response.
    const response = await fetch("/api/chat-assistant", {
      method: "POST",
      body: JSON.stringify({
        assistantId: assistantId,
        threadId: threadId,
        content: prompt,
      }),
    });

    // If no response body, return early.
    if (!response.body) {
      return;
    }

    // Using the AssistantStream to stream the response from the OpenAI API. Updated the openai package to v4.53.0 (latest) for this.
    // https://platform.openai.com/docs/api-reference/assistants-streaming
    // https://github.com/openai/openai-node/blob/master/helpers.md#assistant-events

    const runner = AssistantStream.fromReadableStream(response.body);

    runner.on("messageCreated", (message) => {
      setThreadId(message.thread_id);
    });

    runner.on("textDelta", (_delta, contentSnapshot) => {
      const newStreamingMessage = {
        ...streamingMessage,
        content: parseResponse(contentSnapshot.value),
      };
      setStreamingMessage(newStreamingMessage);
    });

    runner.on("messageDone", (message) => {
      // get final message content
      const finalContent =
        message.content[0].type == "text" ? message.content[0].text.value : "";

      // add assistant message to list of messages
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

      // When message is done, remove streaming message / loading.
      setLoading(false);
    });

    // Will need to do something more with the error, but for now just console log it, show error message in chat.
    runner.on("error", (error) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          id: messageId.current.toString(),
          role: "assistant",
          content: "Sorry, an error occurred!",
          createdAt: new Date(),
        },
      ]);
      console.error(error);
      setLoading(false);
    });
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

  return (
    <div className="h-screen w-screen p-4 flex flex-col bg-white">
      <Nav refreshChat={refreshChat} />
      <div
        className="flex flex-col gap-6 w-full h-full overflow-y-auto scroll-smooth py-4"
        ref={messageListRef}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`${
              msg.role == "assistant" ? "chatbot" : "user"
            } chat-bubble`}
          >
            <Markdown>{msg.content}</Markdown>
          </div>
        ))}

        {loading && (
          <div className={`chatbot chat-bubble`}>
            {/* Show streaming response */}
            <Markdown>{streamingMessage?.content}</Markdown>

            {/* Show bubbles while stream starts coming in */}
            <div className="flex h-4 items-end justify-end w-full gap-2">
              <div className="bounce bounce1 rounded bg-white h-2 w-2" />
              <div className="bounce bounce2 rounded bg-white h-2 w-2" />
              <div className="bounce bounce3 rounded bg-white h-2 w-2" />
            </div>
          </div>
        )}
      </div>

      <Suspense>
        <PromptInput
          prompt={prompt}
          setPrompt={setPrompt}
          sendPrompt={sendPrompt}
          threadId={threadId}
          loading={loading}
        />
      </Suspense>
    </div>
  );
}

export default Embed;
