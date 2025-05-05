/**
 * OpenAI Integration for Data Retrieval System - Legacy Shim
 *
 * This file serves as a compatibility layer that redirects all calls
 * to the new repository pattern implementation. This ensures backwards
 * compatibility with existing code that imports from this file.
 *
 * Part of Phase 2 of the Retrieval System Refactoring Plan.
 *
 * Last Updated: Mon May 5 10:02:26 BST 2025
 */

// Import functions specifically to avoid circular dependencies
import {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery,
} from "../data/repository/adapters/retrieval-adapter";

// Export individual functions - don't use export * to prevent circular dependencies
export {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery,
};

// Export specific functions as default
export default {
  identifyRelevantFiles,
  retrieveDataFiles,
  processQueryWithData,
  isStarterQuestion,
  getPrecompiledStarterData,
  detectComparisonQuery,
};
