/**
 * Segment Keys Configuration
 * Defines standard segment categories for data filtering and retrieval.
 * Provides default segments and canonical segment lists used throughout
 * the data pipeline for consistent filtering operations.
 */

/**
 * Default segments to use when no specific segments are requested
 * These are the most commonly used demographic segments
 */
export const DEFAULT_SEGMENTS: string[] = ["region", "age", "gender"];

/**
 * Complete list of all valid segment types available in the data files
 * Used for validation and segment availability checking
 */
export const CANONICAL_SEGMENTS: string[] = [
  "overall",
  "region",
  "age",
  "gender",
  "org_size",
  "sector",
  "job_level",
  "relationship_status",
  "education",
  "generation",
  "employment_status",
]; 