import fs from 'fs/promises';
import path from 'path';

let cachedMapping: any | null = null;
let cachedMtime = 0;
let loadingPromise: Promise<any> | null = null;

/**
 * Load the canonical topic mapping with a topic dictionary for quick lookup.
 * The mapping and dictionary are rebuilt only if the underlying file changes.
 */
export async function getCanonicalMapping(): Promise<any> {
  const mappingPath = path.join(
    process.cwd(),
    'scripts',
    'reference files',
    '2025',
    'canonical_topic_mapping.json'
  );

  const stat = await fs.stat(mappingPath);

  if (cachedMapping && cachedMtime === stat.mtimeMs) {
    return cachedMapping;
  }

  if (!loadingPromise) {
    loadingPromise = fs.readFile(mappingPath, 'utf8')
      .then((data) => {
        const mapping = JSON.parse(data);

        // Build topic dictionary for fast lookup
        const topicDict: Record<string, any> = {};
        for (const theme of mapping.themes || []) {
          for (const topic of theme.topics || []) {
            topicDict[topic.id] = topic;
          }
        }

        mapping.topicDict = topicDict;

        cachedMapping = mapping;
        cachedMtime = stat.mtimeMs;

        return mapping;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }

  return loadingPromise;
}
