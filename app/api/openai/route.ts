import fsPromises from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * DEPRECATION NOTICE
 * 
 * This route is scheduled for refactoring or removal.
 * It contains significant code duplication with chat-assistant/route.ts.
 * 
 * For new development:
 * - Use chat-assistant/route.ts for assistant-related functionality
 * - This route will eventually be refactored to only handle non-assistant OpenAI operations
 *   or be completely replaced by a more modular approach
 * 
 * See documentation in app/api/documentation/api_documentation.md for more details
 * about the proposed refactoring plan.
 */

export async function POST(req) {
  // Initialize OpenAI client inside the request handler
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const { threadId, runId, method, action, role, content, assistantId } =
    await req.json();
  //   console.log("body", {
  //     threadId,
  //     runId,
  //     method,
  //     action,
  //     role,
  //     content,
  //     assistantId,
  //   });

  // Log deprecation warning
  console.warn("DEPRECATED: Using /api/openai route which is scheduled for refactoring or removal");

  switch (action) {
    case "GET_LIST":
      const list = await openai.beta.assistants.list();

      return NextResponse.json(list.data);
    case "retrieve":
      const getRun = await openai.beta.threads[method].retrieve(
        threadId,
        runId
      );
      return NextResponse.json({
        ...getRun,
      });

    case "list":
      const listMessages = await openai.beta.threads[method].list(threadId);
      return NextResponse.json({
        ...listMessages,
      });

    case "create":
      switch (method) {
        case "threads":
          const getThread = await openai.beta.threads.create();
          console.log("getThread", getThread);
          return NextResponse.json({
            ...getThread,
          });
        case "messages":
          const getMessages = await openai.beta.threads[method].create(
            threadId,
            {
              role,
              content,
            }
          );
          return NextResponse.json({
            ...getMessages,
          });
        case "runs":
          const getRun = await openai.beta.threads[method].create(threadId, {
            assistant_id: assistantId,
          });
          return NextResponse.json({
            ...getRun,
          });
      }

    default:
      break;
  }

  return NextResponse.json({
    error: "No call returned",
  });
}
