# Cache System File Mapping & Migration Plan

## Current Structure Analysis

After a comprehensive analysis of the codebase, we've identified the following files related to the caching system:

```
utils/
├── cache-utils.ts                      # Main caching interface
├── compatibility.ts                    # Compatibility interface (relies on cache)
├── data/
│   ├── compatibilityTypes.js           # Type definitions for compatibility
│   ├── incremental_cache.js            # Legacy cache implementation (to be removed)
│   ├── segment_keys.js                 # Segment key definitions
│   ├── smart_filtering.js              # Filtering logic that uses cache
│   └── types.js                        # Type definitions
├── shared/
│   ├── compatibility.js                # Compatibility utilities
│   ├── compatibilityLogger.js          # Logging for compatibility
│   ├── compatibilityUtils.js           # Utilities for compatibility
│   ├── key-schema.ts                   # Key schema definitions
│   └── kvClient.ts                     # KV client implementation
```

## Ideal Structure Target (Preserving Filenames)

```
utils/
├── cache/                              # Consolidated cache directory
│   ├── cache-utils.ts                  # Main caching interface (moved from utils/)
│   ├── kvClient.ts                     # KV client (moved from shared/)
│   ├── key-schema.ts                   # Key schema (moved from shared/)
│   ├── segment_keys.js                 # Segment keys (moved from data/)
│   └── README.md                       # Documentation
│
├── compatibility/                      # Consolidated compatibility directory
│   ├── compatibility.ts                # Main interface (moved from utils/)
│   ├── compatibility.js                # Utilities (moved from shared/)
│   ├── compatibilityLogger.js          # Logging (moved from shared/)
│   ├── compatibilityUtils.js           # Utilities (moved from shared/)
│   └── compatibilityTypes.js           # Types (moved from data/)
│
├── shared/                             # Cross-cutting utilities (remaining files)
│   └── ... (other shared utilities)
│
└── data/                               # Remaining data utilities
    ├── smart_filtering.js              # Filtering logic
    └── types.js                        # Type definitions
```

## File Mapping Table (Preserving Original Filenames)

| Current Path                          | Future Path                                  | Dependencies         | Risk Level | Migration Priority |
| ------------------------------------- | -------------------------------------------- | -------------------- | ---------- | ------------------ |
| `utils/cache-utils.ts`                | `utils/cache/cache-utils.ts`                 | kvClient, key-schema | Medium     | 4                  |
| `utils/shared/kvClient.ts`            | `utils/cache/kvClient.ts`                    | None                 | Low        | 1                  |
| `utils/shared/key-schema.ts`          | `utils/cache/key-schema.ts`                  | None                 | Low        | 2                  |
| `utils/data/segment_keys.js`          | `utils/cache/segment_keys.js`                | None                 | Low        | 3                  |
| `utils/data/incremental_cache.js`     | N/A (Remove after migration)                 | None                 | High       | After migration    |
| `utils/compatibility.ts`              | `utils/compatibility/compatibility.ts`       | cache-utils          | High       | 5                  |
| `utils/shared/compatibility.js`       | `utils/compatibility/compatibility.js`       | None                 | Medium     | 6                  |
| `utils/shared/compatibilityLogger.js` | `utils/compatibility/compatibilityLogger.js` | None                 | Medium     | 7                  |
| `utils/shared/compatibilityUtils.js`  | `utils/compatibility/compatibilityUtils.js`  | None                 | Medium     | 8                  |
| `utils/data/compatibilityTypes.js`    | `utils/compatibility/compatibilityTypes.js`  | None                 | Low        | 9                  |

## Migration Strategy By Component

### 1. Cache System Migration (Lowest Risk First)

1. **Create Directory Structure**

   ```bash
   mkdir -p utils/cache
   mkdir -p utils/compatibility
   ```

2. **Move KV Client (Risk: Low)**

   - Copy `utils/shared/kvClient.ts` to `utils/cache/kvClient.ts`
   - Create adapter in original location:
     ```typescript
     // utils/shared/kvClient.ts (adapter)
     export * from "../cache/kvClient";
     export { default } from "../cache/kvClient";
     ```
   - Test thoroughly
   - 24-hour observation before proceeding

3. **Move Key Schema (Risk: Low)**

   - Copy `utils/shared/key-schema.ts` to `utils/cache/key-schema.ts`
   - Create adapter in original location
   - Test thoroughly
   - 24-hour observation before proceeding

4. **Move Segment Keys (Risk: Low)**

   - Copy `utils/data/segment_keys.js` to `utils/cache/segment_keys.js`
   - Create adapter in original location
   - Test thoroughly
   - 24-hour observation before proceeding

5. **Move Cache Utils (Risk: Medium)**
   - Copy `utils/cache-utils.ts` to `utils/cache/cache-utils.ts`
   - Create adapter in original location
   - Test thoroughly
   - Extended observation period (48 hours)

### 2. Compatibility System Migration

6. **Move Compatibility Files**
   - Move each compatibility file one at a time
   - Create adapters in original locations
   - Test thoroughly between each move
   - Extended observation period for each file

### 3. Update Imports in Application Code (Ongoing)

- Gradually update imports in application code to point to new locations
- Test thoroughly after each update
- Monitor for any issues
- This can happen in parallel with other migrations once adapters are stable

### 4. Cleanup (After Thorough Testing)

- Remove redundant legacy files (e.g., incremental_cache.js)
- Eventually remove adapters once all direct imports are updated
- Final testing to ensure system stability

## File-Specific Risk Analysis & Rollback Plans

### KV Client

**Risk Analysis:**

- Core infrastructure component
- Used by cache-utils.ts
- No internal dependencies

**Rollback Plan:**

```bash
# If issues occur:
rm utils/cache/kvClient.ts
# Restore original adapter file if modified
git checkout utils/shared/kvClient.ts
# Run tests to verify
```

### Key Schema

**Risk Analysis:**

- Used for key generation in cache system
- Used by cache-utils.ts
- No internal dependencies

**Rollback Plan:**

```bash
# If issues occur:
rm utils/cache/key-schema.ts
# Restore original adapter file if modified
git checkout utils/shared/key-schema.ts
# Run tests to verify
```

### Cache Utils

**Risk Analysis:**

- Core cache interface
- Has dependencies on kvClient and key-schema
- Complex functionality

**Rollback Plan:**

```bash
# If issues occur:
rm utils/cache/cache-utils.ts
# Restore original file if modified
git checkout utils/cache-utils.ts
# Run tests to verify
```

## Testing Requirements For Each Migration

1. **Unit Testing**

   - Run existing test suite
   - Add tests for adapter functionality
   - Verify all public methods work as expected

2. **Integration Testing**

   - Test interaction with dependent systems
   - Verify no regressions in application functionality

3. **Performance Testing**
   - Benchmark before and after migration
   - Verify no degradation in cache performance

## Migration Timeline (Cautious Approach)

| Component           | Migration | Testing | Observation | Total    |
| ------------------- | --------- | ------- | ----------- | -------- |
| KV Client           | 1 day     | 1 day   | 1 day       | 3 days   |
| Key Schema          | 1 day     | 1 day   | 1 day       | 3 days   |
| Segment Keys        | 1 day     | 1 day   | 1 day       | 3 days   |
| Cache Utils         | 2 days    | 2 days  | 2 days      | 6 days   |
| Compatibility Files | 3 days    | 3 days  | 3 days      | 9 days   |
| Import Updates      | Ongoing   | Ongoing | Ongoing     | Parallel |
| Cleanup             | 1 day     | 2 days  | 1 day       | 4 days   |

Total estimated time: ~4 weeks (with buffer for unexpected issues)
