# Shared Utilities

## Overview

This directory contains cross-cutting utility functions and modules used across multiple domains in the application. These utilities provide common functionality that isn't specific to a single domain.

## File Structure

- `cors.js` - CORS handling for API routes
- `errorHandler.js` - Error formatting and handling
- `feature-flags.ts` - Feature toggle system for gradual rollouts
- `helpers.tsx` - General helper utilities for response parsing and timing operations
- `logger.js` - Logging utilities
- `loggerHelpers.js` - Helper functions for logging
- `monitoring.ts` - Migration monitoring system
- `polling.js` and `polling-manager.ts` - Utilities for data polling
- `rollback.ts` - Rollback management for migrations
- `utils.js` - General utility functions

### Subdirectories

- `iframe/` - Utilities for iframe resizing and communication

### Migration Adapters

The following files are adapters pointing to their new canonical locations:

- `compatibility.js` → `/utils/compatibility/compatibility.js`
- `compatibilityLogger.js` → `/utils/compatibility/compatibilityLogger.js`
- `compatibilityUtils.js` → `/utils/compatibility/compatibilityUtils.js`
- `key-schema.ts` → `/utils/cache/key-schema.ts`
- `kvClient.ts` → `/utils/cache/kvClient.ts`

## Migration Status

The shared utilities directory serves as the default location for utility functions that don't clearly belong in a domain-specific folder. Several files have been migrated to domain-specific directories:

- Cache-related utilities: Moved to `/utils/cache/`
- Compatibility utilities: Moved to `/utils/compatibility/`

All moved files maintain adapter files in their original locations to ensure backward compatibility during the migration period.

## Usage Guidelines

- Use these utilities for cross-cutting concerns
- Add new utilities here only if they don't fit in domain-specific folders
- **DO NOT** directly modify adapter files
- For new development, import from the canonical locations

## Related Directories

- `/utils/cache/` - For caching and data persistence
- `/utils/compatibility/` - For data compatibility checking
- `/utils/data/` - For data processing utilities

_Last updated: Mon Apr 28 13:58:38 BST 2025_
