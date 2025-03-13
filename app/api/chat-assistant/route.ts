// I created this route to get my updates working, I left the others just in case - they're not being used in the embed page though.
// This repo got me started: https://github.com/Superexpert/openai-assistant-starter-kit

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// this enables Edge Functions in Vercel
// see https://vercel.com/blog/gpt-3-app-next-js-vercel-edge-functions
// and updated here: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const runtime = "edge";

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// post a new message and stream OpenAI Assistant response
export async function POST(request: NextRequest) {
  try {
    // parse message from post
    const newMessage = await request.json();
    
    console.log("API Request:", {
      threadId: newMessage.threadId,
      assistantId: newMessage.assistantId,
      contentLength: newMessage.content?.length
    });

    // create OpenAI client
    const openai = new OpenAI();

    // if no thread id then create a new openai thread
    if (newMessage.threadId == null) {
      try {
        const thread = await openai.beta.threads.create();
        newMessage.threadId = thread.id;
        console.log("Created new thread:", thread.id);
      } catch (threadError) {
        console.error("Error creating thread:", threadError);
        return new Response(JSON.stringify({ error: "Failed to create thread" }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
    }

    // add new message to thread
    try {
      await openai.beta.threads.messages.create(newMessage.threadId, {
        role: "user",
        content: newMessage.content,
      });
      console.log("Added message to thread:", newMessage.threadId);
    } catch (messageError) {
      console.error("Error adding message to thread:", messageError);
      return new Response(JSON.stringify({ error: "Failed to add message to thread" }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // create a run
    try {
      const stream = await openai.beta.threads.runs.create(newMessage.threadId, {
        assistant_id: newMessage.assistantId,
        stream: true,
      });
      console.log("Created run with assistant:", newMessage.assistantId);
      return new Response(stream.toReadableStream(), {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (runError) {
      console.error("Error creating run:", runError);
      return new Response(JSON.stringify({ error: "Failed to create run" }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  } catch (error) {
    console.error("General API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
