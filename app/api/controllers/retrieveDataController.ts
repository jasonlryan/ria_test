/**
 * Controller for retrieve-data API endpoint.
 * Handles request validation, file retrieval from filesystem,
 * response formatting, and error handling.
 * Uses the unified OpenAI service for data processing and enrichment.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import fs from "fs/promises";
import path from "path";
import logger from "../../../utils/shared/logger";
import { unifiedOpenAIService } from "../services/unifiedOpenAIService";
import { isFeatureEnabled } from "../../../utils/shared/feature-flags";
import { getTopicForFileId } from "../../../utils/data/topicMapping";

export async function postHandler(request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { file_ids, enrichData = false } = body;

    if (!file_ids || !Array.isArray(file_ids)) {
      return formatBadRequestResponse("Invalid or missing 'file_ids' array");
    }

    logger.info(`[RETRIEVE] Processing request for ${file_ids.length} files, enrichData=${enrichData}`);
    
    const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
    const topics = new Set();

    const files = await Promise.all(
      file_ids.map(async (file_id) => {
        try {
          const normalizedId = file_id.endsWith(".json") ? file_id : `${file_id}.json`;
          const filePath = path.join(dataDir, normalizedId);

          try {
            await fs.stat(filePath);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              logger.warn(`[RETRIEVE] File not found: ${filePath}`);
              return { id: file_id, error: `File not found: ${filePath}` };
            }
            throw err;
          }

          const fileContent = await fs.readFile(filePath, "utf8");
          const jsonData = JSON.parse(fileContent);

          const topic = getTopicForFileId(file_id);

          topics.add(topic);
          
          // If data enrichment is requested, use unified OpenAI service
          if (enrichData && isFeatureEnabled('USE_RESPONSES_API')) {
            await enrichFileDataWithAI(jsonData, topic, file_id);
          }

          return { id: file_id, topic, data: jsonData };
        } catch (error) {
          logger.error(`[RETRIEVE] Error retrieving file ${file_id}: ${error.message}`);
          return { id: file_id, error: error.message };
        }
      })
    );

    const totalDataPoints = files.reduce((acc, file) => {
      if (file.data && Array.isArray(file.data)) return acc + file.data.length;
      if (file.data && typeof file.data === "object") return acc + 1;
      return acc;
    }, 0);
    
    const processingTime = Date.now() - startTime;

    const result = {
      files,
      topics: Array.from(topics),
      totalDataPoints,
      metadata: {
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
        processing_time_ms: processingTime,
        retrieved_at: new Date().toISOString(),
        used_unified_service: isFeatureEnabled('USE_RESPONSES_API')
      },
    };
    
    logger.info(`[RETRIEVE] Successfully processed ${result.metadata.succeeded}/${files.length} files in ${processingTime}ms`);

    return NextResponse.json(result);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[RETRIEVE] Controller error: ${error.message}`, { 
      duration: processingTime,
      error 
    });
    return formatErrorResponse(error);
  }
}

/**
 * Enriches file data with AI-generated insights
 * @param {object} fileData - The data from the file
 * @param {string} topic - The topic of the file
 * @param {string} fileId - The ID of the file
 */
async function enrichFileDataWithAI(fileData, topic, fileId) {
  try {
    // Skip if there's no data to enrich
    if (!fileData || !fileData.question) return;
    
    // Create a prompt for the unified service
    const prompt = `
      Please provide a brief analysis of the following survey data:
      
      Topic: ${topic}
      Question: ${fileData.question}
      Number of responses: ${fileData.responses?.length || 0}
      
      Summarize the key insights in about 50 words.
    `;
    
    // Process with unified service
    const startTime = Date.now();
    const result = await unifiedOpenAIService.createChatCompletion([
      { role: "system", content: "You are a data analyst providing brief insights on survey data." },
      { role: "user", content: prompt }
    ], {
      model: "gpt-3.5-turbo",
      max_tokens: 100,
      temperature: 0.3
    });
    
    // Add the analysis to the file data
    if (result && result.data && result.data.content) {
      fileData.aiAnalysis = {
        summary: result.data.content,
        generated_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
      };
      
      logger.info(`[RETRIEVE] Added AI analysis to file ${fileId}`);
    }
    
  } catch (error) {
    logger.error(`[RETRIEVE] Error enriching data with AI for file ${fileId}: ${error.message}`);
    // Continue without failing the entire operation
  }
}
