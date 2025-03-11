/**
 * API Route Example: pages/api/assistant.js
 *
 * This is a sample API route for integrating the OpenAI Assistant with a Next.js frontend.
 * It handles sending messages to the assistant and streaming the response back to the client.
 */

import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID from the OpenAI platform
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, threadId: previousThreadId } = await req.json();

    // Get the latest user message
    const userMessage = messages[messages.length - 1];

    // Use existing thread or create a new one
    let threadId = previousThreadId;
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage.content,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });

    // Create a response object that includes the threadId for future use
    const responseObj = {
      threadId: threadId,
      runId: run.id,
    };

    // Poll for response
    const response = await pollForResponse(threadId, run.id);

    // Add assistant messages to the response
    responseObj.messages = response.map((message) => ({
      role: "assistant",
      content: message.content[0].text.value,
    }));

    // Return the response
    return res.status(200).json(responseObj);
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: "Error processing request" });
  }
}

// Function to poll for assistant response
async function pollForResponse(threadId, runId) {
  // Maximum number of attempts before giving up
  const MAX_ATTEMPTS = 60;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    // Get the run status
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);

    if (runStatus.status === "completed") {
      // Get all messages from the thread
      const messages = await openai.beta.threads.messages.list(threadId);

      // Filter for only assistant messages and sort by created time
      const assistantMessages = messages.data
        .filter((message) => message.role === "assistant")
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      return assistantMessages;
    } else if (runStatus.status === "failed") {
      throw new Error(`Assistant run failed: ${runStatus.last_error}`);
    } else if (runStatus.status === "requires_action") {
      // Handle required actions if needed
      throw new Error(
        "Assistant requires action - not implemented in this example"
      );
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Polling timed out");
}

// Streaming version (optional for better UX)
export async function POST(req) {
  const { messages, threadId: previousThreadId } = await req.json();

  // Get the latest user message
  const userMessage = messages[messages.length - 1];

  // Use existing thread or create a new one
  let threadId = previousThreadId;
  if (!threadId) {
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
  }

  // Add the user message to the thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: userMessage.content,
  });

  // Create a response stream
  const stream = new ReadableStream({
    async start(controller) {
      // Run the assistant
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: ASSISTANT_ID,
        stream: true,
      });

      // Stream the response
      run.on("textDelta", (delta) => {
        controller.enqueue(delta.value);
      });

      run.on("error", (error) => {
        controller.error(error);
      });

      run.on("end", () => {
        controller.close();
      });
    },
  });

  // Return the stream with metadata
  return new StreamingTextResponse(stream, {
    headers: {
      "X-Thread-Id": threadId,
    },
  });
}
