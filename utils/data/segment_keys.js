/**
 * Segment key configuration for data filtering and retrieval.
 *
 * DEFAULT_SEGMENTS: Used as fallback when LLM does not return segments.
 * CANONICAL_SEGMENTS: Full set of valid segment keys in split files.
 */

const DEFAULT_SEGMENTS = ["region", "age", "gender"];

const CANONICAL_SEGMENTS = [
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

module.exports = {
  DEFAULT_SEGMENTS,
  CANONICAL_SEGMENTS,
};
