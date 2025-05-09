/**
 * Unified OpenAI Service
 * 
 * Provides a centralized interface for interacting with OpenAI APIs with:
 * - Direct integration of both legacy and Responses API implementations
 * - Comprehensive error handling with type-specific recovery strategies
 * - Intelligent retry logic and fallback mechanisms
 * - Feature flag-controlled API path selection
 * - Performance monitoring and error tracking
 * - Timeout protection and resource management
 * - Graceful degradation for error conditions
 * 
 * This service implements a direct integration approach rather than using
 * a separate adapter pattern, allowing for simpler code flow and unified
 * error handling across both API implementations.
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
import path from 'path';
import fs from 'fs';

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
 * OpenAI API error types with appropriate handling strategies
 */
export enum OpenAIErrorType {
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  SERVER = 'server_error',
  TIMEOUT = 'timeout',
  INVALID_REQUEST = 'invalid_request',
  MODEL_OVERLOADED = 'model_overloaded',
  STREAMING = 'streaming_error',
  UNKNOWN = 'unknown'
}

/**
 * Options for executeWithMonitoring
 */
interface ExecuteOptions {
  retryCount?: number;
  maxRetries?: number;
  fallbackFn?: () => Promise<any>;
  timeoutMs?: number;
}

export type RunStatus = Run['status'];

/**
 * Response types for different OpenAI operations
 */
export interface OpenAIResponse<T = any> {
  data: T;
  error?: string;
}

// Define proper interfaces for Responses API
export interface ResponseOptionsBase {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: Array<{
    type: string;
    [key: string]: any;
  }>;
  store?: boolean;
}

export interface ResponseCreateParamsNonStreaming extends ResponseOptionsBase {
  model: string;
  input: string;
  stream: false;
}

export interface ResponseCreateParamsStreaming extends ResponseOptionsBase {
  model: string;
  input: string;
  stream: true;
}

export interface ResponseContinueParamsNonStreaming extends ResponseOptionsBase {
  model: string;
  previous_response_id: string;
  input: string;
  stream: false;
}

export interface ResponseContinueParamsStreaming extends ResponseOptionsBase {
  model: string;
  previous_response_id: string;
  input: string;
  stream: true;
}

export interface ResponseToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ResponseResult {
  id: string;
  output_text: string;
  tool_calls?: ResponseToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
   * Determine error type from OpenAI error response
   */
  private getErrorType(error: any): OpenAIErrorType {
    if (!error) return OpenAIErrorType.UNKNOWN;
    
    // Check for rate limit errors (429)
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return OpenAIErrorType.RATE_LIMIT;
    }
    
    // Check for authentication errors (401)
    if (error.status === 401 || error.message?.includes('auth') || error.message?.includes('key')) {
      return OpenAIErrorType.AUTHENTICATION;
    }
    
    // Check for server errors (5xx)
    if (error.status >= 500 || error.message?.includes('server error')) {
      return OpenAIErrorType.SERVER;
    }
    
    // Check for timeout errors
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return OpenAIErrorType.TIMEOUT;
    }
    
    // Check for model overloaded errors
    if (error.message?.includes('overloaded') || error.message?.includes('capacity')) {
      return OpenAIErrorType.MODEL_OVERLOADED;
    }

    // Check for streaming errors
    if (error.message?.includes('stream') || error.message?.includes('chunk')) {
      return OpenAIErrorType.STREAMING;
    }
    
    // Check for invalid request errors (400)
    if (error.status === 400 || error.message?.includes('invalid')) {
      return OpenAIErrorType.INVALID_REQUEST;
    }
    
    return OpenAIErrorType.UNKNOWN;
  }

  /**
   * Handle errors based on type with appropriate strategies
   */
  private async handleApiError(
    error: any, 
    method: string, 
    options: { retryCount: number; maxRetries: number }
  ): Promise<never> {
    const { retryCount, maxRetries } = options;
    const errorType = this.getErrorType(error);
    
    // Enhanced error logging with context
    logger.error(`[OPENAI] ${method} error (${errorType}): ${error.message}`, {
      method,
      errorType,
      status: error.status,
      retryCount,
      requestId: error.headers?.['x-request-id'],
      modelUsed: error.request?.body?.model
    });
    
    // Record error in monitoring system for trending analysis
    migrationMonitor.trackError('unified', method, error as Error);
    
    // Implement recovery strategies based on error type
    switch (errorType) {
      case OpenAIErrorType.RATE_LIMIT:
      case OpenAIErrorType.SERVER:
      case OpenAIErrorType.TIMEOUT:
        // These error types can be retried with backoff
        if (retryCount < maxRetries) {
          // Exponential backoff with jitter to prevent thundering herd
          const baseDelay = Math.pow(2, retryCount) * 1000;
          const jitter = Math.random() * 500;
          const delay = baseDelay + jitter;
          
          logger.info(`[OPENAI] ${errorType} error. Retrying ${method} after ${delay.toFixed(0)}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Return to allow retry from calling function
          return Promise.reject({ 
            shouldRetry: true, 
            retryCount: retryCount + 1,
            originalError: error 
          });
        }
        break;
        
      case OpenAIErrorType.MODEL_OVERLOADED:
        // Fall back to a less capable model
        if (isFeatureEnabled('USE_RESPONSES_API') && retryCount < 1) {
          logger.info(`[OPENAI] Model overloaded. Falling back to simpler model`);
          return Promise.reject({ 
            shouldFallback: true, 
            originalError: error 
          });
        }
        break;
        
      case OpenAIErrorType.AUTHENTICATION:
        // Authentication errors are critical and should not be retried
        logger.error(`[OPENAI] Authentication error in ${method}. Check API key configuration.`);
        // Alert operations team about API key issues
        await rollbackManager.checkAndRollbackIfNeeded();
        break;

      case OpenAIErrorType.STREAMING:
        // For streaming errors, we can try without streaming
        if (retryCount < 1) {
          logger.info(`[OPENAI] Streaming error. Retrying without streaming.`);
          return Promise.reject({
            shouldTryWithoutStreaming: true,
            originalError: error
          });
        }
        break;
        
      case OpenAIErrorType.INVALID_REQUEST:
        // Some invalid requests can be retried with modified parameters
        if (
          error.message?.includes('content filter') && 
          retryCount < 1 && 
          isFeatureEnabled('USE_RESPONSES_API')
        ) {
          logger.info(`[OPENAI] Content filter triggered. Retrying with modified content.`);
          return Promise.reject({
            shouldModifyContent: true,
            originalError: error
          });
        }
        break;
    }
    
    // If we reach here, we couldn't recover
    if (errorType === OpenAIErrorType.SERVER && isFeatureEnabled('USE_RESPONSES_API')) {
      // For server errors, consider rolling back to legacy implementation
      await rollbackManager.checkAndRollbackIfNeeded();
    }
    
    throw {
      message: `OpenAI ${method} failed: ${error.message}`,
      status: error.status || 500,
      type: errorType,
      originalError: error,
      requestDetails: {
        method,
        retryAttempts: retryCount
      }
    };
  }

  /**
   * Execute a method with monitoring, retry logic, and fallback
   */
  private async executeWithMonitoring<T>(
    method: string,
    fn: () => Promise<T>,
    options: ExecuteOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const { 
      retryCount = 0, 
      maxRetries = 3, 
      fallbackFn,
      timeoutMs = 60000 
    } = options;
    
    // Set up timeout protection
    let timeoutId: NodeJS.Timeout | undefined;
    let hasTimedOut = false;
    let abortController: AbortController | undefined;

    try {
      // Create AbortController for request cancellation if supported
      if (typeof AbortController !== 'undefined') {
        abortController = new AbortController();
      }
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            hasTimedOut = true;
            // Abort the request if possible
            if (abortController) {
              abortController.abort();
            }
            reject({
              message: `Operation timed out after ${timeoutMs}ms`,
              type: OpenAIErrorType.TIMEOUT
            });
          }, timeoutMs);
        }
      });
      
      // Execute function with timeout
      const resultPromise = fn();
      const result = await Promise.race([resultPromise, timeoutPromise]);
      
      // Clear timeout if set
      if (timeoutId) clearTimeout(timeoutId);
      
      // Track successful call
      const duration = Date.now() - startTime;
      migrationMonitor.trackCall('unified', method, startTime);
      
      // Log performance for slow operations
      if (duration > 5000) {
        logger.warn(`[OPENAI] Slow operation: ${method} took ${duration}ms to complete`);
      }
      
      return result;
    } catch (error) {
      // Clear timeout if set
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle timeout errors specially
      if (hasTimedOut) {
        logger.error(`[OPENAI] Operation timeout: ${method} exceeded ${timeoutMs}ms limit`);
        
        if (fallbackFn && isFeatureEnabled('USE_RESPONSES_API')) {
          logger.info(`[OPENAI] Attempting fallback after timeout on ${method}`);
          try {
            return await fallbackFn();
          } catch (fallbackError) {
            logger.error(`[OPENAI] Fallback also failed for ${method}: ${fallbackError.message}`);
            throw {
              message: `OpenAI ${method} timed out and fallback failed`,
              type: OpenAIErrorType.TIMEOUT,
              originalError: error,
              fallbackError
            };
          }
        }
        
        throw {
          message: `OpenAI ${method} timed out after ${timeoutMs}ms`,
          type: OpenAIErrorType.TIMEOUT,
          originalError: error
        };
      }
      
      // Check for retry or fallback signals from error handler
      try {
        // Handle API-specific errors
        await this.handleApiError(error, method, { retryCount, maxRetries });
        // If handleApiError doesn't throw, something went wrong
        throw error;
      } catch (handledError) {
        if (handledError.shouldRetry) {
          // Retry with backoff
          return this.executeWithMonitoring(method, fn, { 
            retryCount: handledError.retryCount,
            maxRetries,
            fallbackFn,
            timeoutMs
          });
        }
        
        if (handledError.shouldFallback && fallbackFn) {
          // Try fallback implementation
          logger.info(`[OPENAI] Falling back to alternative implementation for ${method}`);
          try {
            return await fallbackFn();
          } catch (fallbackError) {
            logger.error(`[OPENAI] Fallback also failed for ${method}: ${fallbackError.message}`);
            throw {
              message: `OpenAI ${method} failed and fallback failed: ${handledError.originalError.message}`,
              type: handledError.originalError.type || OpenAIErrorType.UNKNOWN,
              originalError: handledError.originalError,
              fallbackError
            };
          }
        }

        if (handledError.shouldTryWithoutStreaming) {
          // Special case for streaming errors - handled by the caller
          throw handledError;
        }
        
        if (handledError.shouldModifyContent) {
          // Special case for content filter issues - handled by the caller
          throw handledError;
        }
        
        // We couldn't recover, pass along the error
        throw handledError;
      }
    }
  }

  /**
   * Loads the assistant prompt from the file system
   * @returns The content of the assistant prompt file
   */
  private loadAssistantPrompt(): string {
    try {
      const promptPath = path.join(process.cwd(), 'utils', 'openai', 'assistant_prompt.md');
      return fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
      logger.error(`[OPENAI] Error loading assistant prompt: ${error.message}`);
      // Return a minimal fallback prompt if file can't be loaded
      return 'You are an expert analyst and narrative synthesizer for workforce trends. Your primary function is to transform structured data and statistics into a compelling, insightful, and human-readable narrative.';
    }
  }

  /**
   * Create chat completion with enhanced error handling and fallbacks
   */
  public async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAIResponse> {
    await this.initialize();

    // Define fallback function for model overload
    const fallbackFn = async () => {
      // Try with a less capable but more available model
      const fallbackOptions = {
        ...options,
        model: 'gpt-3.5-turbo',
      };
      
      // Regular completion with fallback model
      const completion = await this.client.chat.completions.create({
        messages,
        ...fallbackOptions,
      }) as ChatCompletion;

      return {
        data: completion.choices[0]?.message || { role: 'assistant', content: '' },
      };
    };

    // Helper function to create non-streaming completion
    const createNonStreamingCompletion = async () => {
      const completion = await this.client.chat.completions.create({
        messages,
        model: options.model || 'gpt-3.5-turbo',
        ...options,
        stream: false
      }) as ChatCompletion;

      return {
        data: completion.choices[0]?.message || { role: 'assistant', content: '' },
      };
    };

    return this.executeWithMonitoring('createChatCompletion', async () => {
      const useResponsesApi = isFeatureEnabled('USE_RESPONSES_API');
      
      if (useResponsesApi) {
        try {
          // Use streaming with response API
          const stream = await this.client.chat.completions.create({
            messages,
            model: options.model || 'gpt-3.5-turbo',
            stream: true,
            ...options,
          });

          // Enhanced stream handling with timeout
          const chunks: string[] = [];
          try {
            for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
              chunks.push(chunk.choices[0]?.delta?.content || '');
            }
            
            return {
              data: {
                content: chunks.join(''),
                role: 'assistant',
              },
            };
          } catch (streamError) {
            // If stream fails partway through but we have content
            if (chunks.length > 0) {
              logger.warn(`[OPENAI] Streaming interrupted but partial content available: ${streamError.message}`);
              return {
                data: {
                  content: chunks.join(''),
                  role: 'assistant',
                },
                error: `Streaming error: ${streamError.message}`
              };
            }
            
            // If stream fails with no content, try without streaming
            logger.warn(`[OPENAI] Streaming failed, falling back to non-streaming: ${streamError.message}`);
            throw { shouldTryWithoutStreaming: true, originalError: streamError };
          }
        } catch (apiError) {
          // If streaming fails completely or we get shouldTryWithoutStreaming
          if (apiError.shouldTryWithoutStreaming) {
            return await createNonStreamingCompletion();
          }
          // Other errors are handled by executeWithMonitoring
          throw apiError;
        }
      } else {
        // Use regular completion API
        return await createNonStreamingCompletion();
      }
    }, { fallbackFn });
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
  public async createThread(): Promise<OpenAIResponse<string>> {
    await this.initialize();
    return this.executeWithMonitoring('createThread', async () => {
      // Use Responses API to create a new response session
      const response = await this.client.responses.create({
        model: 'gpt-4o',
        input: '',
        stream: false,
      });
      // The response ID acts as the thread ID
      return {
        data: response.id,
      };
    });
  }

  /**
   * Create a response using OpenAI's Responses API
   */
  public async createResponse(
    input: string,
    options: any = {}
  ): Promise<OpenAIResponse<any>> {
    await this.initialize();
    return this.executeWithMonitoring('createResponse', async () => {
      const requestOptions = {
        model: options.model || 'gpt-4o',
        input,
        ...options,
        stream: Boolean(options.stream)
      };
      const response = await (this.client.responses as any).create(requestOptions);
      return { data: response };
    });
  }

  /**
   * Continue a conversation using a previous response ID
   */
  public async continueConversation(
    previousResponseId: string,
    input: string,
    options: any = {}
  ): Promise<OpenAIResponse<any>> {
    await this.initialize();
    return this.executeWithMonitoring('continueConversation', async () => {
      const requestOptions = {
        model: options.model || 'gpt-4o',
        previous_response_id: previousResponseId,
        input,
        ...options,
        stream: Boolean(options.stream)
      };
      const response = await (this.client.responses as any).create(requestOptions);
      return { data: response };
    });
  }

  /**
   * List messages in a response session
   */
  public async listMessages(threadId: string, options: { limit?: number } = {}): Promise<OpenAIResponse<any[]>> {
    await this.initialize();
    return this.executeWithMonitoring('listMessages', async () => {
      // Use legacy threads API for listing messages
      const response = await this.client.beta.threads.messages.list(threadId);
      const messages = response.data || [];
      if (options.limit) {
        return { data: messages.slice(-options.limit) };
      }
      return { data: messages };
    });
  }

  /**
   * Create a message in a response session
   */
  public async createMessage(
    threadId: string,
    message: { role: 'user' | 'assistant'; content: string }
  ): Promise<OpenAIResponse<any>> {
    await this.initialize();
    return this.executeWithMonitoring('createMessage', async () => {
      // Use legacy threads API to create a message
      const result = await this.client.beta.threads.messages.create(threadId, message);
      return { data: result };
    });
  }

  /**
   * Create a run in a response session
   */
  public async createRun(threadId: string, options: { instructions?: string }): Promise<OpenAIResponse<any>> {
    await this.initialize();
    return this.executeWithMonitoring('createRun', async () => {
      // Combine instructions with default prompt into input for Responses API
      const systemInstruction = options.instructions as string | undefined;
      delete options.instructions;
      const defaultInstruction = 'Please analyze the context of our conversation and provide your response.';
      const promptInput = systemInstruction
        ? `${systemInstruction}\n\n${defaultInstruction}`
        : defaultInstruction;
      // Don't add assistant prompt here - it should be added by the controller
      const response = await this.client.responses.create({
        model: 'gpt-4o',
        input: promptInput,
        previous_response_id: threadId,
        stream: false,
        ...options
      } as any);

      return {
        data: response,
      };
    });
  }

  /**
   * Retrieve a response by ID
   */
  public async retrieveRun(responseId: string): Promise<OpenAIResponse<any>> {
    await this.initialize();
    return this.executeWithMonitoring('retrieveRun', async () => {
      const response = await (this.client.responses as any).retrieve(responseId);
      return { data: response };
    });
  }

  /**
   * Wait for no active runs on a response session
   * NOTE: With the Responses API, there are no separate "runs" to wait for,
   * so this method is now just a compatibility layer that immediately resolves
   */
  public async waitForNoActiveRuns(): Promise<void> {
    // This method is now just a no-op that immediately resolves
    logger.info('[OPENAI] waitForNoActiveRuns: No-op with Responses API');
    return Promise.resolve();
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
