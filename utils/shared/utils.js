/**
 * Shared Helper Utilities
 */

/**
 * Sanitizes the output from OpenAI to remove embedded citation markers
 * @param {string} text - The text to sanitize
 * @returns {string} - The sanitized text
 */
export function sanitizeOutput(text) {
  // Remove [[n](#source)] style citations to avoid collapsing whitespace
  return String(text || "").replace(/\[\[(\d+)\]\(#.*?\)\]/g, "");
}

/**
 * Determines if the message content is likely a valid JSON string
 * @param {string} content - The content to check
 * @returns {boolean} - True if content is valid JSON string, else false
 */
export function isJsonContent(content) {
  if (typeof content !== "string") return false;
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object";
  } catch {
    return false;
  }
}
