/**
 * Unified OpenAI Service
 * Provides a centralized interface for interacting with OpenAI APIs
 * with consistent error handling, retries, and feature flag support.
 */

import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat';
import { isFeatureEnabled } from '../../../utils/feature-flags';
import { pollingManager } from '../../../utils/shared/polling-manager';
import logger from '../../../utils/logger';
import { formatErrorResponse } from '../../../utils/shared/errorHandler';

// OpenAI API configuration
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
};

// Polling configuration for async operations
const POLLING_CONFIG = {
  maxPollingTime: 60000,
  pollingInterval: 1000,
  maxRetries: 2,
  context: 'OPENAI',
};

/**
 * Response types for different OpenAI operations
 */
export interface OpenAIResponse<T = any> {
  data: T;
  error?: string;
}

/**
 * Helper function to format OpenAI errors
 */
function formatOpenAIError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
}

/**
 * Unified OpenAI Service class
 */
export class UnifiedOpenAIService {
  private static instance: UnifiedOpenAIService;
  private client: OpenAI;
  private isInitialized: boolean = false;

  private constructor() {
    this.client = new OpenAI(OPENAI_CONFIG);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UnifiedOpenAIService {
    if (!UnifiedOpenAIService.instance) {
      UnifiedOpenAIService.instance = new UnifiedOpenAIService();
    }
    return UnifiedOpenAIService.instance;
  }

  /**
   * Initialize the service
   */
  private async initialize() {
    if (this.isInitialized) return;

    try {
      // Test connection
      await this.client.models.list();
      this.isInitialized = true;
      logger.info('[OPENAI] Service initialized successfully');
    } catch (error) {
      logger.error('[OPENAI] Failed to initialize service:', error);
      throw error;
    }
  }

  /**
   * Create chat completion with retry and polling support
   */
  public async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAIResponse> {
    await this.initialize();

    try {
      const useResponsesApi = isFeatureEnabled('USE_RESPONSES_API');
      
      if (useResponsesApi) {
        // Use streaming with response API
        const stream = await this.client.chat.completions.create({
          messages,
          model: options.model || 'gpt-3.5-turbo',
          stream: true,
          ...options,
        });

        // Collect stream responses
        const chunks = [];
        for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
          chunks.push(chunk.choices[0]?.delta?.content || '');
        }

        return {
          data: {
            content: chunks.join(''),
            role: 'assistant',
          },
        };
      } else {
        // Use regular completion API
        const completion = await this.client.chat.completions.create({
          messages,
          model: options.model || 'gpt-3.5-turbo',
          ...options,
        }) as ChatCompletion;

        return {
          data: completion.choices[0]?.message || { role: 'assistant', content: '' },
        };
      }
    } catch (error) {
      logger.error('[OPENAI] Chat completion error:', error);
      return {
        data: null,
        error: formatOpenAIError(error),
      };
    }
  }

  /**
   * Create async completion with polling
   */
  public async createAsyncCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAIResponse> {
    await this.initialize();

    try {
      // Start async completion
      const completion = await this.client.chat.completions.create({
        messages,
        model: options.model || 'gpt-3.5-turbo',
        ...options,
      }) as ChatCompletion;

      // Poll for completion
      const result = await pollingManager.poll(
        async () => {
          const status = await this.client.chat.completions.retrieve(
            completion.id
          );
          return status.choices[0]?.message;
        },
        {
          ...POLLING_CONFIG,
          stopCondition: (result) => !!result?.content,
        }
      );

      return { data: result };
    } catch (error) {
      logger.error('[OPENAI] Async completion error:', error);
      return {
        data: null,
        error: formatOpenAIError(error),
      };
    }
  }

  /**
   * Create embeddings with retry support
   */
  public async createEmbeddings(
    input: string | string[],
    options: Partial<OpenAI.EmbeddingCreateParams> = {}
  ): Promise<OpenAIResponse<number[][]>> {
    await this.initialize();

    try {
      const response = await this.client.embeddings.create({
        input,
        model: options.model || 'text-embedding-ada-002',
        ...options,
      });

      return {
        data: response.data.map((embedding) => embedding.embedding),
      };
    } catch (error) {
      logger.error('[OPENAI] Embeddings error:', error);
      return {
        data: null,
        error: formatOpenAIError(error),
      };
    }
  }

  /**
   * Create image with retry support
   */
  public async createImage(
    prompt: string,
    options: Partial<OpenAI.Images.ImageGenerateParams> = {}
  ): Promise<OpenAIResponse<string[]>> {
    await this.initialize();

    try {
      const response = await this.client.images.generate({
        prompt,
        n: options.n || 1,
        size: options.size || '1024x1024',
        ...options,
      });

      return {
        data: response.data.map((image) => image.url),
      };
    } catch (error) {
      logger.error('[OPENAI] Image generation error:', error);
      return {
        data: null,
        error: formatOpenAIError(error),
      };
    }
  }
}

// Export singleton instance
export const unifiedOpenAIService = UnifiedOpenAIService.getInstance();

// Export convenience functions
export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>
): Promise<OpenAIResponse> {
  return unifiedOpenAIService.createChatCompletion(messages, options);
}

export async function createAsyncCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>
): Promise<OpenAIResponse> {
  return unifiedOpenAIService.createAsyncCompletion(messages, options);
}

export async function createEmbeddings(
  input: string | string[],
  options?: Partial<OpenAI.EmbeddingCreateParams>
): Promise<OpenAIResponse<number[][]>> {
  return unifiedOpenAIService.createEmbeddings(input, options);
}

export async function createImage(
  prompt: string,
  options?: Partial<OpenAI.Images.ImageGenerateParams>
): Promise<OpenAIResponse<string[]>> {
  return unifiedOpenAIService.createImage(prompt, options);
} 