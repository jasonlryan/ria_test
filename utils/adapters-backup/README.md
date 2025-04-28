# Adapter Files Backup

This directory contains backups of adapter files that were used during the codebase reorganization process. These files were created on April 28, 2025 to preserve the original adapter implementations before they were fully migrated.

## Purpose

The adapter files served as backward compatibility layers during our migration to a more modular codebase structure. They allowed us to:

1. Gradually migrate imports across the codebase
2. Maintain functionality while updating import paths
3. Provide deprecation warnings to developers
4. Track migration progress systematically

## File Format

Each file follows the naming convention:

```
{original_filename}.bak
```

For example, `cache-utils.ts.bak` is a backup of the `utils/cache-utils.ts` adapter that redirected imports to `utils/cache/cache-utils.ts`.

## Migration Status

All adapter files have been fully migrated with all code now using canonical import paths. See `../adapter_log.md` for the complete migration status.

## Retention Policy

These backup files are retained for historical reference and should not be deleted without approval. They may be useful for:

- Understanding the migration history
- Resolving any issues that might arise from the migration
- Providing context for future code organization efforts

## Do Not Use in Code

⚠️ **Important**: These backup files should never be imported or used in actual code. All application code should import from the canonical locations documented in `../adapter_log.md`.
