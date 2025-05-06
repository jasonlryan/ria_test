/**
 * Shared Polling Utilities
 * Provides functions to manage polling for OpenAI thread runs.
 */

/**
 * Waits until there are no active runs on the thread.
 * Active statuses: "queued", "in_progress", "requires_action"
 * @param {object} openai - OpenAI client instance
 * @param {string} threadId - Thread ID to poll
 * @param {number} pollInterval - Polling interval in milliseconds (default 250)
 * @param {number} timeoutMs - Timeout in milliseconds (default 60000)
 */
export async function waitForNoActiveRuns(
  openai,
  threadId,
  pollInterval = 250,
  timeoutMs = 60000
) {
  const activeStatuses = new Set(["queued", "in_progress", "requires_action"]);
  const start = Date.now();
  while (true) {
    const runs = await openai.beta.threads.runs.list(threadId, { limit: 10 });
    const activeRun = runs.data.find((run) => activeStatuses.has(run.status));
    if (!activeRun) break;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        "Timeout waiting for previous run to complete on thread " + threadId
      );
    }
    await new Promise((res) => setTimeout(res, pollInterval));
  }
}
