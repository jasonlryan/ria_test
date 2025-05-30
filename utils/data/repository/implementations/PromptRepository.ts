import { FileRepository, DataFile, FileIdentificationResult, FileRetrievalOptions } from '../interfaces/FileRepository';
import { QueryContext } from '../interfaces/QueryContext';
import FileSystemRepository from './FileSystemRepository';
import { lookupFiles, FileMetadata } from '../../../compatibility/compatibility';
import fs from 'fs';
import path from 'path';
import logger from '../../../shared/logger';
import OpenAI from 'openai';
import kvClient from '../../../cache/kvClient';
import { getCanonicalMapping } from '../../topicMapping';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const PROMPTS_DIR = path.join(process.cwd(), "utils", "openai");

/**
 * PromptRepository
 *
 * A thin wrapper that keeps the Repository pattern intact while still
 * leveraging the original GPT-prompted identifyRelevantFiles logic
 * (1_data_retrieval.md). All heavy lifting for data-file loading is
 * delegated to an internal FileSystemRepository instance.
 */
export default class PromptRepository implements FileRepository {
  private fsRepo: FileSystemRepository;

  constructor(fsRepo?: FileSystemRepository) {
    // We reuse the provided FileSystemRepository if supplied (mainly for tests)
    // otherwise we create a default one that reads from scripts/output/split_data
    this.fsRepo = fsRepo ?? new FileSystemRepository({
      dataDirectory: process.cwd() + '/scripts/output/split_data'
    });
  }

  /**
   * Identify relevant files by using the OpenAI API directly with the 
   * 1_data_retrieval.md prompt.
   */
  async getFilesByQuery(context: QueryContext, _options?: FileRetrievalOptions): Promise<FileIdentificationResult> {
    try {
      // Use TypeScript-based implementation instead of legacy JS
      const result = await this.identifyRelevantFiles(
        context.query,
        context.threadId || 'default',
        context.isFollowUp,
        context.previousQuery || '',
        context.previousResponse || '',
        context.cachedFileIds || []
      );

      // Normalize file IDs by stripping any .json extension
      const fileIds = (result?.file_ids ?? []).map((id: string) => id.replace(/\.json$/i, ''));

      // Enrich the file IDs with compatibility metadata
      const fileMetadata = lookupFiles(fileIds);

      return {
        relevantFiles: fileIds,
        matchedTopics: result?.matched_topics ?? [],
        detectedSegments: result?.segments ?? [],
        fileMetadata: fileMetadata,
      };
    } catch (error) {
      logger.error('[PromptRepository] identifyRelevantFiles error:', error);
      return { relevantFiles: [] };
    }
  }

  /**
   * Identify relevant data files based on a user query using OpenAI
   * TypeScript implementation replacing the legacy JS code
   */
  private async identifyRelevantFiles(
    query: string,
    threadId: string = 'default',
    isFollowUp: boolean = false,
    previousQuery: string = "",
    previousAssistantResponse: string = "",
    cachedFileIdsFromContext: string[] = []
  ): Promise<any> {
    logger.debug('[PromptRepository_INPUTS] identifyRelevantFiles called with:', { query, threadId, isFollowUp, previousQuery, previousAssistantResponse, cachedFileIdsFromContext });
    try {
      // Get normalized query (or import query normalization)
      const normalizedQuery = query.toLowerCase().trim();
      
      // Load the canonical topic mapping
      const mapping = await getCanonicalMapping();

      // --- BEGIN CACHE AWARENESS LOGIC FOR FOLLOW-UPS ---
      let cachedInfoForPromptString = "{}"; // Default to empty JSON object string
      if (isFollowUp && cachedFileIdsFromContext && cachedFileIdsFromContext.length > 0) {
        const cachedInfoData: Record<string, { available_raw_segments?: string[] }> = {};
        for (const fileId of cachedFileIdsFromContext) {
          try {
            const rawSegmentsKey = `filemeta:${fileId}:available_raw_segments`;
            const rawSegmentsJson = await kvClient.get<string>(rawSegmentsKey);
            if (rawSegmentsJson) {
              const rawSegmentsArray = JSON.parse(rawSegmentsJson);
              if (!cachedInfoData[fileId]) {
                cachedInfoData[fileId] = {};
              }
              cachedInfoData[fileId].available_raw_segments = rawSegmentsArray;
              logger.info(`[PromptRepository_CACHE] Fetched available_raw_segments for file ${fileId}`);
            } else {
              logger.warn(`[PromptRepository_CACHE] No available_raw_segments found in cache for file ${fileId}`);
            }
            // TODO (Future): Add logic to fetch list of *already processed & cached stats segments* for this fileId
            // This might involve checking a manifest like `filemeta:${fileId}:cached_stats_segments`
          } catch (cacheError) {
            logger.error(`[PromptRepository_CACHE] Error fetching cache info for file ${fileId}: ${cacheError.message}`);
          }
        }
        if (Object.keys(cachedInfoData).length > 0) {
          cachedInfoForPromptString = JSON.stringify(cachedInfoData);
        }
      }
      // --- END CACHE AWARENESS LOGIC FOR FOLLOW-UPS ---

      // Build the system prompt
      const promptPath = path.join(PROMPTS_DIR, "1_data_retrieval.md");
      let systemPrompt = fs.readFileSync(promptPath, "utf8");
      
      // Build the user prompt with replacements
      const userPrompt = systemPrompt
        .replace("{{QUERY}}", normalizedQuery)
        .replace("{{MAPPING}}", JSON.stringify(mapping))
        .replace("{{IS_FOLLOWUP}}", isFollowUp ? "true" : "false")
        .replace("{{PREVIOUS_QUERY}}", previousQuery || "")
        .replace("{{PREVIOUS_ASSISTANT_RESPONSE}}", previousAssistantResponse || "")
        .replace("{{{CACHED_INFO}}}", cachedInfoForPromptString);

      // Call OpenAI API
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      // Extract the content
      const content = response.choices[0].message.content;
      const result = JSON.parse(content);
      logger.debug('[PromptRepository_LLM_RESULT] LLM output for 1_data_retrieval:', result);

      // Apply validations
      if (!result.file_ids || !Array.isArray(result.file_ids)) {
        result.file_ids = [];
      }

      if (!result.matched_topics || !Array.isArray(result.matched_topics)) {
        result.matched_topics = [];
      }

      if (!result.explanation) {
        result.explanation = "No explanation provided";
      }

      // ENFORCE: If isFollowUp is true, forcibly set out_of_scope to false
      if (isFollowUp === true) {
        result.out_of_scope = false;
        if ("out_of_scope_message" in result) {
          result.out_of_scope_message = "";
        }
      }

      return result;
    } catch (error) {
      logger.error(`[PromptRepository] Error in identifyRelevantFiles: ${error}`);
      throw error;
    }
  }

  /**
   * The following methods just proxy to FileSystemRepository.
   */
  async getFileById(fileId: string, options?: FileRetrievalOptions): Promise<DataFile | null> {
    return this.fsRepo.getFileById(fileId, options);
  }

  async getFilesByIds(fileIds: string[], options?: FileRetrievalOptions): Promise<DataFile[]> {
    return this.fsRepo.getFilesByIds(fileIds, options);
  }

  async loadSegments(fileId: string, segments: string[], options?: FileRetrievalOptions): Promise<DataFile> {
    return this.fsRepo.loadSegments(fileId, segments, options);
  }
} 