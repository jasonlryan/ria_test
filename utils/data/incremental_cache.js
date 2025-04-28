/**
 * Incremental Cache Module - Adapter File
 *
 * DEPRECATED MODULE - DO NOT USE
 *
 * This module has been deprecated and replaced by utils/cache/cache-utils.ts.
 * All functionality has been migrated to the UnifiedCache interface.
 *
 * This adapter is maintained temporarily for backward compatibility during migration.
 * New code should import directly from utils/cache/cache-utils.ts
 *
 * @deprecated Please import from utils/cache/cache-utils.ts instead
 */

const { UnifiedCache } = require("../cache-utils");
const logger = require("../logger");

// Adapter functions with deprecation warnings
async function getThreadCache(threadId) {
  logger.warn(
    "DEPRECATED: utils/data/incremental_cache:getThreadCache is deprecated. Use UnifiedCache.getThreadCache instead."
  );
  return UnifiedCache.getThreadCache(threadId);
}

async function updateThreadCache(threadId, data, scope) {
  logger.warn(
    "DEPRECATED: utils/data/incremental_cache:updateThreadCache is deprecated. Use UnifiedCache.updateThreadCache instead."
  );

  try {
    // Adapt legacy data format to new format
    const threadCache = {
      files: data && data.files ? data.files : [],
      lastUpdated: Date.now(),
      metadata: { legacyScope: scope || {} },
    };

    return await UnifiedCache.updateThreadCache(threadId, threadCache);
  } catch (error) {
    logger.error(`Error in incremental_cache adapter: ${error.message}`);
    return false;
  }
}

async function getDataScope(threadId) {
  logger.warn(
    "DEPRECATED: utils/data/incremental_cache:getDataScope is deprecated. Consider refactoring to use UnifiedCache."
  );

  try {
    const threadData = await UnifiedCache.getThreadCache(threadId);
    if (threadData && threadData.metadata && threadData.metadata.legacyScope) {
      return threadData.metadata.legacyScope;
    }
    return {};
  } catch (error) {
    logger.error(`Error in incremental_cache adapter: ${error.message}`);
    return {};
  }
}

function calculateMissingDataScope(queryIntent, cachedScope) {
  logger.warn(
    "DEPRECATED: utils/data/incremental_cache:calculateMissingDataScope is deprecated. Consider refactoring to use UnifiedCache."
  );

  // Simplified implementation that always returns empty scope
  // to encourage migration to new cache system
  return {
    topics: new Set(),
    demographics: new Set(),
    years: new Set(),
    fileIds: new Set(),
    isEmpty: () => true,
  };
}

async function getIncrementalData(queryIntent, threadId) {
  logger.warn(
    "DEPRECATED: utils/data/incremental_cache:getIncrementalData is deprecated. Consider refactoring to use UnifiedCache and dataRetrievalService."
  );

  try {
    // Just return the cached files using the new cache system
    const cachedFiles = await UnifiedCache.getCachedFilesForThread(threadId);
    return {
      data: { files: cachedFiles },
      cacheStatus: cachedFiles.length > 0 ? "HIT" : "MISS",
    };
  } catch (error) {
    logger.error(`Error in incremental_cache adapter: ${error.message}`);
    return { data: { files: [] }, cacheStatus: "MISS" };
  }
}

// Export the adapter functions
module.exports = {
  getThreadCache,
  updateThreadCache,
  getDataScope,
  calculateMissingDataScope,
  getIncrementalData,
};
