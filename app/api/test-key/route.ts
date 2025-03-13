import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    // Get the API key from environment
    const apiKey = process.env.OPENAI_API_KEY || '';
    
    // Create a safe version for logging
    const safeKey = {
      defined: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 7),
      suffix: apiKey.length > 4 ? apiKey.substring(apiKey.length - 4) : '',
      type: apiKey.startsWith('sk-') ? 'Standard' : apiKey.startsWith('sk-proj-') ? 'Project' : 'Unknown'
    };
    
    // Test the key with a simple fetch to OpenAI
    let openaiResponse = null;
    let error = null;
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        openaiResponse = {
          status: response.status,
          modelCount: data.data?.length || 0,
          firstFewModels: data.data?.slice(0, 3).map(m => m.id) || []
        };
      } else {
        const errorText = await response.text();
        error = {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        };
      }
    } catch (fetchError) {
      error = {
        message: fetchError.message,
        name: fetchError.name
      };
    }
    
    return NextResponse.json({
      apiKeyInfo: safeKey,
      openaiResponse,
      error,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_REGION: process.env.VERCEL_REGION
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      error: "Test failed", 
      message: error.message 
    }, { status: 500 });
  }
} 