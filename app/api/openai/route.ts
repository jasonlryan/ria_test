import fsPromises from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

export async function POST(req) {
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
