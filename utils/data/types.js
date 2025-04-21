/**
 * Data Pipeline Type Definitions
 * Provides TypeScript interface and type definitions for
 * the data retrieval pipeline components, ensuring type safety
 * across the smart filtering and caching systems.
 */

/**
 * @typedef {Object} QueryIntent
 * @property {string[]} topics
 * @property {string[]} demographics
 * @property {number[]} years
 * @property {"general"|"specific"} specificity
 * @property {boolean} isFollowUp
 */

/**
 * @typedef {Object} DataScope
 * @property {Set<string>} topics
 * @property {Set<string>} demographics
 * @property {Set<number>} years
 * @property {Set<string>} fileIds
 */

/**
 * @typedef {Object} CacheEntry
 * @property {any} data
 * @property {DataScope} scope
 * @property {number} timestamp
 */

// For TypeScript, you could use:
// export interface QueryIntent { ... }
// export interface DataScope { ... }
// export interface CacheEntry { ... }
