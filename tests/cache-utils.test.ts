import { jest } from '@jest/globals';
import kvClient from '../utils/shared/kvClient';
import { getCachedFilesForThread, updateThreadCache, CachedFile } from '../utils/cache-utils';

// Simple mock approach
jest.mock('../utils/shared/kvClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    hset: jest.fn(),
    expire: jest.fn(),
    hgetall: jest.fn(),
  },
}));

describe('cache-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCachedFilesForThread', () => {
    it('returns empty array if no meta found', async () => {
      jest.spyOn(kvClient, 'get').mockResolvedValue(null);
      const result = await getCachedFilesForThread('thread1');
      expect(result).toEqual([]);
      expect(kvClient.get).toHaveBeenCalledWith('thread:thread1:meta');
    });

    it('returns files with loadedSegments and availableSegments as Sets', async () => {
      const mockMeta = {
        files: [
          {
            id: 'file1',
            loadedSegments: ['seg1', 'seg2'],
            availableSegments: ['seg1', 'seg2', 'seg3'],
            data: {},
          },
        ],
      };
      jest.spyOn(kvClient, 'get').mockResolvedValue(mockMeta);
      const result = await getCachedFilesForThread('thread1');
      expect(result.length).toBe(1);
      expect(result[0].loadedSegments).toBeInstanceOf(Set);
      expect(result[0].availableSegments).toBeInstanceOf(Set);
      expect(result[0].loadedSegments.has('seg1')).toBe(true);
      expect(result[0].availableSegments.has('seg3')).toBe(true);
    });

    it('returns empty array on error', async () => {
      jest.spyOn(kvClient, 'get').mockRejectedValue(new Error('fail'));
      const result = await getCachedFilesForThread('thread1');
      expect(result).toEqual([]);
    });
  });

  describe('updateThreadCache', () => {
    it('writes new files and merges segments correctly', async () => {
      const existingMeta = {
        files: [
          {
            id: 'file1',
            loadedSegments: ['seg1'],
            availableSegments: ['seg1', 'seg2'],
            data: { seg1: 'data1' },
          },
        ],
        scope: {},
      };
      jest.spyOn(kvClient, 'get').mockResolvedValue(existingMeta);
      jest.spyOn(kvClient, 'set').mockResolvedValue(true);
      jest.spyOn(kvClient, 'hset').mockResolvedValue(1);
      jest.spyOn(kvClient, 'expire').mockResolvedValue(1);

      const newFiles: CachedFile[] = [
        {
          id: 'file1',
          loadedSegments: new Set(['seg2']),
          availableSegments: new Set(['seg1', 'seg2']),
          data: { seg2: 'data2' },
        },
        {
          id: 'file2',
          loadedSegments: new Set(['seg1']),
          availableSegments: new Set(['seg1']),
          data: { seg1: 'data3' },
        },
      ];

      await updateThreadCache('thread1', newFiles);

      expect(kvClient.set).toHaveBeenCalled();
      expect(kvClient.hset).toHaveBeenCalledTimes(2);
      expect(kvClient.expire).toHaveBeenCalledTimes(2);
    });

    it('logs error on failure', async () => {
      jest.spyOn(kvClient, 'get').mockRejectedValue(new Error('fail'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await updateThreadCache('thread1', []);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
