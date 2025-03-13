import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    // Create OpenAI client
    const openai = new OpenAI();
    
    // Get the assistant ID from environment variable
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    
    // Try to retrieve the assistant
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    return NextResponse.json({ 
      success: true, 
      message: "Assistant API connection successful",
      assistant_id: assistant.id,
      assistant_name: assistant.name,
      assistant_model: assistant.model
    });
  } catch (error) {
    console.error("Assistant API test error:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "Assistant API connection failed",
      error: error.message,
      assistant_id: process.env.OPENAI_ASSISTANT_ID
    }, { status: 500 });
  }
} 