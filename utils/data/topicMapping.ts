import fs from 'fs/promises';
import path from 'path';

let cachedMapping: any | null = null;
let loadingPromise: Promise<any> | null = null;

export async function getCanonicalMapping(): Promise<any> {
  if (cachedMapping) {
    return cachedMapping;
  }

  if (!loadingPromise) {
    const mappingPath = path.join(
      process.cwd(),
      'scripts',
      'reference files',
      '2025',
      'canonical_topic_mapping.json'
    );
    loadingPromise = fs.readFile(mappingPath, 'utf8').then((data) => {
      cachedMapping = JSON.parse(data);
      return cachedMapping;
    });
  }

  return loadingPromise;
}
