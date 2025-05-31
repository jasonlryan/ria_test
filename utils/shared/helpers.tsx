/**
 * General Helper Utilities
 * Provides utility functions for response parsing, timing operations,
 * and performance metric tracking and analysis.
 * Contains various helper functions used throughout the application.
 */

// Parse the response to remove the citations.
const parseResponse = (content) => {
  return content.replace(/\【.*?\】/g, "");
};

// Helper functions
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export { parseResponse };
