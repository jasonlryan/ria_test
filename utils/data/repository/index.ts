/**
 * Data Repository
 * 
 * Central export for the data repository pattern implementation.
 * This module consolidates duplicated data retrieval functionality from:
 * - utils/openai/retrieval.js
 * - app/api/services/dataRetrievalService.js
 * 
 * The repository pattern provides a clean abstraction over data access
 * operations and centralizes file identification, loading, and processing.
 */

// Export interfaces
export * from './interfaces/index';

// This will later export implementations and the repository instance
// export * from './implementations';

// This will later export adapters for backward compatibility
// export * from './adapters'; 