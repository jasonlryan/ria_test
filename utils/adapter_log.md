# Adapter Files in Utils Directory - Migration Progress

This document tracks the adapter files in the utils directory that redirect imports to their new canonical locations. These adapters were maintained for backward compatibility during the codebase migration.

## Migration Status

All adapters have been backed up to `utils/adapters-backup/` on Apr 28, 2025. The codebase migration has been completed with the following final status:

| Status         | Description                                   |
| -------------- | --------------------------------------------- |
| ✅ MIGRATED    | All imports updated to new canonical location |
| ⚠️ IN PROGRESS | Some imports have been updated                |
| ❌ NOT STARTED | No imports have been updated                  |

## Root Utils Directory Adapters

| Original Location (Adapter)              | Target Location                                 | Status      |
| ---------------------------------------- | ----------------------------------------------- | ----------- |
| `utils/cache-utils.ts`                   | `utils/cache/cache-utils.ts`                    | ✅ MIGRATED |
| `utils/compatibility.ts`                 | `utils/compatibility/compatibility.ts`          | ✅ MIGRATED |
| `utils/feature-flags.ts`                 | `utils/shared/feature-flags.ts`                 | ✅ MIGRATED |
| `utils/helpers.tsx`                      | `utils/shared/helpers.tsx`                      | ✅ MIGRATED |
| `utils/iframe-resizer.ts`                | `utils/shared/iframe/iframe-resizer.ts`         | ✅ MIGRATED |
| `utils/iframe-parent-resizer-snippet.js` | `utils/shared/iframe/parent-resizer-snippet.js` | ✅ MIGRATED |
| `utils/logger.js`                        | `utils/shared/logger.js`                        | ✅ MIGRATED |
| `utils/monitoring.ts`                    | `utils/shared/monitoring.ts`                    | ✅ MIGRATED |
| `utils/rollback.ts`                      | `utils/shared/rollback.ts`                      | ✅ MIGRATED |

## Data Directory Adapters

| Original Location (Adapter)        | Target Location                             | Status      |
| ---------------------------------- | ------------------------------------------- | ----------- |
| `utils/data/incremental_cache.js`  | `utils/cache/incremental_cache.js`          | ✅ MIGRATED |
| `utils/data/segment_keys.js`       | `utils/cache/segment_keys.js`               | ✅ MIGRATED |
| `utils/data/compatibilityTypes.js` | `utils/compatibility/compatibilityTypes.js` | ✅ MIGRATED |

## Shared Directory Adapters

| Original Location (Adapter)           | Target Location                              | Status      |
| ------------------------------------- | -------------------------------------------- | ----------- |
| `utils/shared/compatibility.js`       | `utils/compatibility/compatibility.js`       | ✅ MIGRATED |
| `utils/shared/compatibilityLogger.js` | `utils/compatibility/compatibilityLogger.js` | ✅ MIGRATED |
| `utils/shared/compatibilityUtils.js`  | `utils/compatibility/compatibilityUtils.js`  | ✅ MIGRATED |
| `utils/shared/key-schema.ts`          | `utils/cache/key-schema.ts`                  | ✅ MIGRATED |
| `utils/shared/kvClient.ts`            | `utils/cache/kvClient.ts`                    | ✅ MIGRATED |

## Cleanup Status

All adapter files have been **removed** from the codebase on May 1, 2025, after verifying that all imports have been updated to use the new canonical paths.

- ✅ All adapters were backed up to `utils/adapters-backup/` directory before removal
- ✅ All application code now uses the canonical import paths directly
- ✅ Documentation files (.md, .mdc) may still reference old import paths for historical context

## Final Notes

- Original adapter files have been backed up to `utils/adapters-backup/` directory with `.bak` extension
- All application code now imports directly from canonical locations
- Future work should include automated linting to enforce the new import patterns
