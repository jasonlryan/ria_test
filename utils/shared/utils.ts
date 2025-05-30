/**
 * Shared Helper Utilities
 * Provides common utility functions used across the application.
 */

/**
 * Sanitizes the output from OpenAI to remove embedded citation markers
 * @param text - The text to sanitize
 * @returns The sanitized text with citation markers removed
 */
export function sanitizeOutput(text: string | null | undefined): string {
  // Remove [[n](#source)] style citations to avoid collapsing whitespace
  return String(text || "").replace(/\[\[(\d+)\]\(#.*?\)\]/g, "");
}

/**
 * Determines if the message content is likely a valid JSON string
 * @param content - The content to check
 * @returns True if content is valid JSON string that parses to an object, else false
 */
export function isJsonContent(content: unknown): boolean {
  if (typeof content !== "string") return false;
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
} 