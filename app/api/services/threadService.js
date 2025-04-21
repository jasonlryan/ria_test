/**
 * Thread Service
 * Manages OpenAI thread operations including creation, reuse,
 * run management, tool output submissions, and thread cache interactions.
 * Provides thread-specific utilities for the chat assistant.
 */

import OpenAI from "openai";
import { waitForNoActiveRuns } from "../../utils/shared/polling";
import {
  getCachedFilesForThread,
  updateThreadCache,
} from "../../utils/cache-utils";
import logger from "../../utils/logger";

const OPENAI_TIMEOUT_MS = 90000;

export class ThreadService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 2,
    });
  }

  async createThread() {
    const thread = await this.openai.beta.threads.create();
    logger.info(`[THREAD] Created new thread: ${thread.id}`);
    return thread.id;
  }

  async reuseThread(threadId) {
    // Optionally validate thread existence or status here
    logger.info(`[THREAD] Reusing existing thread: ${threadId}`);
    return threadId;
  }

  async waitForNoActiveRuns(threadId, pollInterval = 250, timeoutMs = 60000) {
    return waitForNoActiveRuns(this.openai, threadId, pollInterval, timeoutMs);
  }

  async createRun(threadId, assistantId, instructions) {
    const run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions,
    });
    logger.info(`[RUN] Created run ${run.id} on thread ${threadId}`);
    return run;
  }

  async pollRunStatus(threadId, runId, pollInterval = 250) {
    let runStatus = "queued";
    while (runStatus !== "completed" && runStatus !== "failed") {
      const currentRun = await this.openai.beta.threads.runs.retrieve(
        threadId,
        runId
      );
      runStatus = currentRun.status;
      if (runStatus === "completed" || runStatus === "failed") {
        return currentRun;
      }
      await new Promise((res) => setTimeout(res, pollInterval));
    }
  }

  async submitToolOutputs(threadId, runId, toolOutputs) {
    await this.openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
      tool_outputs: toolOutputs,
    });
    logger.info(
      `[RUN] Submitted tool outputs for run ${runId} on thread ${threadId}`
    );
  }

  async updateThreadCache(threadId, fileIds) {
    await updateThreadCache(threadId, fileIds);
    logger.info(
      `[CACHE] Updated thread cache for thread ${threadId} with ${fileIds.length} files`
    );
  }

  async getCachedFiles(threadId) {
    return getCachedFilesForThread(threadId);
  }
}

export default ThreadService;
