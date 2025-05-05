import { FileRepository, DataFile, FileIdentificationResult, FileRetrievalOptions } from '../interfaces/FileRepository';
import { QueryContext } from '../interfaces/QueryContext';
import FileSystemRepository from './FileSystemRepository';

/**
 * PromptRepository
 *
 * A thin wrapper that keeps the Repository pattern intact while still
 * leveraging the original GPT-prompted identifyRelevantFiles logic
 * (1_data_retrieval.md). All heavy lifting for data-file loading is
 * delegated to an internal FileSystemRepository instance.
 */
export default class PromptRepository implements FileRepository {
  private fsRepo: FileSystemRepository;

  constructor(fsRepo?: FileSystemRepository) {
    // We reuse the provided FileSystemRepository if supplied (mainly for tests)
    // otherwise we create a default one that reads from scripts/output/split_data
    this.fsRepo = fsRepo ?? new FileSystemRepository({
      dataDirectory: process.cwd() + '/scripts/output/split_data'
    });
  }

  /**
   * Identify relevant files by delegating to the original OpenAI helper that
   * applies the 1_data_retrieval.md prompt.
   */
  async getFilesByQuery(context: QueryContext, _options?: FileRetrievalOptions): Promise<FileIdentificationResult> {
    try {
      // Import the legacy implementation directly to avoid adapter recursion
      const { identifyRelevantFiles } = await import('../../../openai/retrieval.legacy.js');
      const options = { threadId: context.threadId || 'default' } as any;

      const result = await identifyRelevantFiles(
        context.query,
        options,
        context.isFollowUp,
        context.previousQuery || '',
        context.previousResponse || '',
        /* _isAdapterCall */ true
      );

      return {
        relevantFiles: result?.file_ids ?? [],
        matchedTopics: result?.matched_topics ?? [],
        detectedSegments: (result as any)?.segments ?? [],
        // Other optional properties can be extended later
      };
    } catch (error) {
      console.error('[PromptRepository] identifyRelevantFiles error:', error);
      return { relevantFiles: [] };
    }
  }

  /**
   * The following methods just proxy to FileSystemRepository.
   */
  async getFileById(fileId: string, options?: FileRetrievalOptions): Promise<DataFile | null> {
    return this.fsRepo.getFileById(fileId, options);
  }

  async getFilesByIds(fileIds: string[], options?: FileRetrievalOptions): Promise<DataFile[]> {
    return this.fsRepo.getFilesByIds(fileIds, options);
  }

  async loadSegments(fileId: string, segments: string[], options?: FileRetrievalOptions): Promise<DataFile> {
    return this.fsRepo.loadSegments(fileId, segments, options);
  }
} 