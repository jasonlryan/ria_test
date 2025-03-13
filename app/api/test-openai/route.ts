import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    // Create OpenAI client
    const openai = new OpenAI();
    
    // Try to list models as a simple API test
    const models = await openai.models.list();
    
    return NextResponse.json({ 
      success: true, 
      message: "OpenAI API connection successful",
      models_count: models.data.length,
      first_few_models: models.data.slice(0, 3).map(m => m.id)
    });
  } catch (error) {
    console.error("OpenAI API test error:", error);
    
    return NextResponse.json({ 
      success: false, 
      message: "OpenAI API connection failed",
      error: error.message
    }, { status: 500 });
  }
} 