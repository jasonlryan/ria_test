/**
 * Unified OpenAI Service
 * Provides a centralized interface for interacting with OpenAI APIs
 * with consistent error handling, retries, and feature flag support.
 */

import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionChunk } from 'openai/resources/chat';
import { Thread } from 'openai/resources/beta/threads/threads';
import { Message, MessageContent } from 'openai/resources/beta/threads/messages';
import { Run } from 'openai/resources/beta/threads/runs';
import { isFeatureEnabled } from '../../../utils/shared/feature-flags';
import { pollingManager } from '../../../utils/shared/polling-manager';
import logger from '../../../utils/shared/logger';
import { migrationMonitor } from '../../../utils/shared/monitoring';
import { rollbackManager } from '../../../utils/shared/rollback';

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

export type RunStatus = Run['status'];

/**
 * Response types for different OpenAI operations
 */
export interface OpenAIResponse<T = any> {
  data: T;
  error?: string;
}

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
   * Execute a method with monitoring and fallback
   */
  private async executeWithMonitoring<T>(
    method: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      migrationMonitor.trackCall('unified', method, startTime);
      return result;
    } catch (error) {
      migrationMonitor.trackError('unified', method, error as Error);
      
      // Check if we should rollback
      await rollbackManager.checkAndRollbackIfNeeded();
      
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

    return this.executeWithMonitoring('createChatCompletion', async () => {
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
    });
  }

  /**
   * Create async completion with polling
   */
  public async createAsyncCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAIResponse> {
    await this.initialize();

    return this.executeWithMonitoring('createAsyncCompletion', async () => {
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
    });
  }

  /**
   * Create embeddings with retry support
   */
  public async createEmbeddings(
    input: string | string[],
    options: Partial<OpenAI.EmbeddingCreateParams> = {}
  ): Promise<OpenAIResponse<number[][]>> {
    await this.initialize();

    return this.executeWithMonitoring('createEmbeddings', async () => {
      const response = await this.client.embeddings.create({
        input,
        model: options.model || 'text-embedding-ada-002',
        ...options,
      });

      return {
        data: response.data.map((embedding) => embedding.embedding),
      };
    });
  }

  /**
   * Create image with retry support
   */
  public async createImage(
    prompt: string,
    options: Partial<OpenAI.Images.ImageGenerateParams> = {}
  ): Promise<OpenAIResponse<string[]>> {
    await this.initialize();

    return this.executeWithMonitoring('createImage', async () => {
      const response = await this.client.images.generate({
        prompt,
        n: options.n || 1,
        size: options.size || '1024x1024',
        ...options,
      });

      return {
        data: response.data.map((image) => image.url),
      };
    });
  }

  /**
   * Create a new thread
   */
  public async createThread(): Promise<OpenAIResponse<Thread>> {
    await this.initialize();
    return this.executeWithMonitoring('createThread', async () => {
      const thread = await this.client.beta.threads.create();
      return {
        data: thread
      };
    });
  }

  /**
   * List messages in a thread
   */
  public async listMessages(threadId: string, options: { limit?: number } = {}): Promise<OpenAIResponse<{ data: Message[] }>> {
    await this.initialize();
    return this.executeWithMonitoring('listMessages', async () => {
      const messages = await this.client.beta.threads.messages.list(threadId, options);
      return {
        data: messages
      };
    });
  }

  /**
   * Create a message in a thread
   */
  public async createMessage(threadId: string, message: { role: 'user' | 'assistant'; content: string }): Promise<OpenAIResponse<Message>> {
    await this.initialize();
    return this.executeWithMonitoring('createMessage', async () => {
      const result = await this.client.beta.threads.messages.create(threadId, message);
      return {
        data: result
      };
    });
  }

  /**
   * Create a run in a thread
   */
  public async createRun(threadId: string, options: { assistant_id: string; instructions?: string }): Promise<OpenAIResponse<Run>> {
    await this.initialize();
    return this.executeWithMonitoring('createRun', async () => {
      const run = await this.client.beta.threads.runs.create(threadId, options);
      return {
        data: run
      };
    });
  }

  /**
   * Retrieve a run's status
   */
  public async retrieveRun(threadId: string, runId: string): Promise<OpenAIResponse<Run>> {
    await this.initialize();
    return this.executeWithMonitoring('retrieveRun', async () => {
      const run = await this.client.beta.threads.runs.retrieve(threadId, runId);
      return {
        data: run
      };
    });
  }

  /**
   * Submit tool outputs for a run
   */
  public async submitToolOutputs(threadId: string, runId: string, toolOutputs: { tool_outputs: Array<{ tool_call_id: string; output: string }> }): Promise<OpenAIResponse<Run>> {
    await this.initialize();
    return this.executeWithMonitoring('submitToolOutputs', async () => {
      const result = await this.client.beta.threads.runs.submitToolOutputs(threadId, runId, toolOutputs);
      return {
        data: result
      };
    });
  }

  /**
   * Wait for no active runs on a thread
   */
  public async waitForNoActiveRuns(threadId: string, pollInterval: number = 250, timeoutMs: number = 60000): Promise<void> {
    await this.initialize();
    return this.executeWithMonitoring('waitForNoActiveRuns', async () => {
      const activeStatuses = new Set(["queued", "in_progress", "requires_action"]);
      const start = Date.now();
      
      while (true) {
        const runs = await this.client.beta.threads.runs.list(threadId, { limit: 10 });
        const activeRun = runs.data.find((run) => activeStatuses.has(run.status));
        
        if (!activeRun) break;
        
        if (Date.now() - start > timeoutMs) {
          throw new Error(`Timeout waiting for previous run to complete on thread ${threadId}`);
        }
        
        await new Promise((res) => setTimeout(res, pollInterval));
      }
    });
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