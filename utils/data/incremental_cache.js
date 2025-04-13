/**
 * Incremental cache module for thread-based data caching
 *
 * Functions:
 * - getThreadCache
 * - updateThreadCache
 * - getDataScope
 * - getIncrementalData
 */

const threadCaches = new Map();

/**
 * Get the cache entry for a thread.
 * @param {string} threadId
 * @returns {import("./types").CacheEntry}
 */
function getThreadCache(threadId) {
  return threadCaches.get(threadId) || { data: null, scope: {}, timestamp: 0 };
}

/**
 * Update the cache entry for a thread.
 * @param {string} threadId
 * @param {any} data
 * @param {import("./types").DataScope} scope
 */
function updateThreadCache(threadId, data, scope) {
  threadCaches.set(threadId, { data, scope, timestamp: Date.now() });
}

/**
 * Get the data scope for a thread.
 * @param {string} threadId
 * @returns {import("./types").DataScope}
 */
function getDataScope(threadId) {
  const entry = threadCaches.get(threadId);
  return entry ? entry.scope : {};
}

/**
 * Calculate missing data scope (placeholder).
 * @param {import("./types").QueryIntent} queryIntent
 * @param {import("./types").DataScope} cachedScope
 * @returns {import("./types").DataScope}
 */
function calculateMissingDataScope(queryIntent, cachedScope) {
  // Compare requested scope (from queryIntent) with cachedScope
  // Return sets of topics, demographics, years, fileIds that are missing from cache

  // Helper to get Set from possibly undefined
  const safeSet = (val) => (val instanceof Set ? val : new Set(val || []));

  const missingTopics = new Set(
    (queryIntent.topics || []).filter(
      (t) => !safeSet(cachedScope.topics).has(t)
    )
  );
  const missingDemographics = new Set(
    (queryIntent.demographics || []).filter(
      (d) => !safeSet(cachedScope.demographics).has(d)
    )
  );
  const missingYears = new Set(
    (queryIntent.years || []).filter((y) => !safeSet(cachedScope.years).has(y))
  );
  // fileIds may be mapped from intent elsewhere; for now, treat as empty
  const missingFileIds = new Set();

  const isEmpty = () =>
    missingTopics.size === 0 &&
    missingDemographics.size === 0 &&
    missingYears.size === 0 &&
    missingFileIds.size === 0;

  return {
    topics: missingTopics,
    demographics: missingDemographics,
    years: missingYears,
    fileIds: missingFileIds,
    isEmpty,
  };
}

/**
 * Get only missing data not already in cache.
 * @param {import("./types").QueryIntent} queryIntent
 * @param {string} threadId
 * @returns {Promise<{data: any, cacheStatus: string}>}
 */
async function getIncrementalData(queryIntent, threadId) {
  const cache = getThreadCache(threadId);
  const missingScope = calculateMissingDataScope(queryIntent, cache.scope);

  if (missingScope.isEmpty()) {
    return { data: cache.data, cacheStatus: "HIT" };
  }

  // Fetch only missing data based on missingScope
  // Use canonical mapping to select relevant files for the query
  const fs = require("fs");
  const path = require("path");
  const dataDir = path.join(process.cwd(), "scripts", "output", "split_data");
  const canonicalPath = path.join(
    process.cwd(),
    "scripts",
    "reference files",
    "2025",
    "canonical_topic_mapping.json"
  );

  // Load canonical mapping
  let canonicalMapping = null;
  try {
    canonicalMapping = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  } catch (e) {
    console.error("Could not load canonical mapping:", e);
    canonicalMapping = null;
  }

  // Determine relevant files from canonical mapping and query intent topics
  let relevantFiles = new Set();
  if (canonicalMapping && queryIntent.topics && queryIntent.topics.length > 0) {
    for (const theme of canonicalMapping.themes || []) {
      for (const topic of theme.topics || []) {
        if (
          queryIntent.topics.some(
            (t) =>
              topic.id.toLowerCase() === t.toLowerCase() ||
              (topic.canonicalQuestion &&
                topic.canonicalQuestion.toLowerCase().includes(t.toLowerCase()))
          )
        ) {
          // Add all mapped files for 2025 for this topic
          if (topic.mapping && topic.mapping["2025"]) {
            for (const m of topic.mapping["2025"]) {
              if (m.file) relevantFiles.add(m.file.replace(/\.json$/, ""));
            }
          }
        }
      }
    }
  }

  // If no topics matched, fallback to all files (for generic queries)
  let fileNames = [];
  try {
    fileNames = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  } catch (e) {
    fileNames = [];
  }
  let files = [];
  const filesToLoad =
    relevantFiles.size > 0
      ? Array.from(relevantFiles).map((f) =>
          f.endsWith(".json") ? f : f + ".json"
        )
      : fileNames;

  for (const fileName of filesToLoad) {
    const filePath = path.join(dataDir, fileName);
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const jsonData = JSON.parse(fileContent);
      files.push({
        id: fileName.replace(/\.json$/, ""),
        data: jsonData,
      });
    } catch (e) {
      // Skip unreadable files
      continue;
    }
  }

  // Structure for downstream filtering
  const fetchedData = { files };

  // Merge fetchedData with cache.data (for now, just use fetchedData)
  const mergedData = fetchedData;

  // Update cache with merged data and expanded scope
  const newScope = {
    topics: new Set([...(cache.scope?.topics || []), ...missingScope.topics]),
    demographics: new Set([
      ...(cache.scope?.demographics || []),
      ...missingScope.demographics,
    ]),
    years: new Set([...(cache.scope?.years || []), ...missingScope.years]),
    fileIds: new Set([
      ...(cache.scope?.fileIds || []),
      ...missingScope.fileIds,
    ]),
  };
  updateThreadCache(threadId, mergedData, newScope);

  return { data: mergedData, cacheStatus: "PARTIAL_MISS" };
}

module.exports = {
  getThreadCache,
  updateThreadCache,
  getDataScope,
  getIncrementalData,
  calculateMissingDataScope,
};
