import fs from 'fs';
import path from 'path';
import logger from '../shared/logger';

interface TopicMapping {
  themes: Array<{
    topics: Array<{
      id: string;
      mapping: Record<string, Array<{ file: string }>>;
    }>;
  }>;
}

let cachedMapping: TopicMapping | null = null;

function loadMapping(): TopicMapping {
  if (cachedMapping) {
    return cachedMapping;
  }
  try {
    const mappingPath = path.join(
      process.cwd(),
      'scripts',
      'reference files',
      '2025',
      'canonical_topic_mapping.json'
    );
    const raw = fs.readFileSync(mappingPath, 'utf8');
    cachedMapping = JSON.parse(raw);
    logger.info(`[TOPIC_MAPPING] Loaded mapping from ${mappingPath}`);
    return cachedMapping as TopicMapping;
  } catch (error) {
    logger.error(`[TOPIC_MAPPING] Failed to load mapping: ${(error as Error).message}`);
    throw error;
  }
}

export function getTopicForFileId(fileId: string): string {
  const mapping = loadMapping();
  const normalized = fileId.endsWith('.json') ? fileId : `${fileId}.json`;

  for (const theme of mapping.themes || []) {
    for (const topic of theme.topics || []) {
      for (const year of Object.keys(topic.mapping || {})) {
        const entries = topic.mapping[year] || [];
        for (const entry of entries) {
          if (entry.file === normalized) {
            return topic.id;
          }
        }
      }
    }
  }
  return 'Unknown';
}
