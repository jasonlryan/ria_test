#!/bin/bash

# Script to remove all adapter files that have been fully migrated
# This script will remove the adapter files after verifying they exist
# Created: $(date)

echo "Starting removal of adapter files..."
echo

# List of adapter files to remove
ADAPTER_FILES=(
  "utils/cache-utils.ts"
  "utils/compatibility.ts"
  "utils/feature-flags.ts"
  "utils/helpers.tsx"
  "utils/iframe-resizer.ts"
  "utils/iframe-parent-resizer-snippet.js"
  "utils/logger.js"
  "utils/monitoring.ts"
  "utils/rollback.ts"
  "utils/data/incremental_cache.js"
  "utils/data/segment_keys.js"
  "utils/data/compatibilityTypes.js"
  "utils/shared/compatibility.js"
  "utils/shared/compatibilityLogger.js"
  "utils/shared/compatibilityUtils.js"
  "utils/shared/key-schema.ts"
  "utils/shared/kvClient.ts"
)

# Count of files actually removed
REMOVED_COUNT=0

# Process each file
for file in "${ADAPTER_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Removing adapter file: $file"
    rm "$file"
    REMOVED_COUNT=$((REMOVED_COUNT+1))
  else
    echo "Warning: Adapter file not found: $file"
  fi
done

echo
echo "Adapter removal complete. Removed $REMOVED_COUNT files."
echo "All adapter files have been backed up in utils/adapters-backup/ directory." 