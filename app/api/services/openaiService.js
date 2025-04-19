/**
 * OpenAI Service
 * Manages OpenAI API interactions including client initialization,
 * message sending, run creation, polling, and tool call processing.
 */

import OpenAI from "openai";
import logger from "../../../utils/logger";
import { waitForNoActiveRuns } from "../../../utils/shared/polling";

const OPENAI_TIMEOUT_MS = 90000;

export class OpenAIService {
  constructor(apiKey) {
    // VERCEL_BUILD_FIX: Commented out to prevent OpenAI client initialization during build time
    // this.openai = new OpenAI({
    //   apiKey,
    //   timeout: OPENAI_TIMEOUT_MS,
    //   maxRetries: 2,
    // });

    // Store API key for later initialization
    this.apiKey = apiKey;
  }

  // Helper method to get OpenAI client instance when needed
  _getOpenAIClient() {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: 2,
      });
    }
    return this.openai;
  }

  /**
   * Send a message to a thread.
   * @param {string} threadId
   * @param {object} message - { role: string, content: string }
   * @returns {Promise<object>} message response
   */
  async sendMessage(threadId, message) {
    const openai = this._getOpenAIClient();
    return openai.beta.threads.messages.create(threadId, message);
  }

  /**
   * Create a new run on a thread.
   * @param {string} threadId
   * @param {string} assistantId
   * @param {string} instructions
   * @returns {Promise<object>} run object
   */
  async createRun(threadId, assistantId, instructions) {
    const openai = this._getOpenAIClient();
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions,
    });
    logger.info(`[RUN] Created run ${run.id} on thread ${threadId}`);
    return run;
  }

  /**
   * Poll the status of a run until completion or failure.
   * @param {string} threadId
   * @param {string} runId
   * @param {number} pollInterval
   * @returns {Promise<object>} final run status
   */
  async pollRunStatus(threadId, runId, pollInterval = 250) {
    const openai = this._getOpenAIClient();
    let runStatus = "queued";
    while (runStatus !== "completed" && runStatus !== "failed") {
      const currentRun = await openai.beta.threads.runs.retrieve(
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

  /**
   * Submit tool call outputs to a run.
   * @param {string} threadId
   * @param {string} runId
   * @param {Array} toolOutputs
   * @returns {Promise<void>}
   */
  async submitToolOutputs(threadId, runId, toolOutputs) {
    const openai = this._getOpenAIClient();
    await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
      tool_outputs: toolOutputs,
    });
    logger.info(
      `[RUN] Submitted tool outputs for run ${runId} on thread ${threadId}`
    );
  }

  /**
   * Wait until there are no active runs on a thread.
   * @param {string} threadId
   * @param {number} pollInterval
   * @param {number} timeoutMs
   * @returns {Promise<void>}
   */
  async waitForNoActiveRuns(threadId, pollInterval = 250, timeoutMs = 60000) {
    const openai = this._getOpenAIClient();
    return waitForNoActiveRuns(openai, threadId, pollInterval, timeoutMs);
  }
}

export default OpenAIService;
