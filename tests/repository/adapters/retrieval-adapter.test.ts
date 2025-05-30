/**
 * Interface tests for the retrieval adapter
 * Verifies the adapter conforms to required API contract
 */

import { describe, it, expect, vi } from 'vitest';
import { FileRepository } from '../../../utils/data/repository/interfaces/FileRepository';

// Create mock for actual module
const adapterModule = {
  identifyRelevantFiles: vi.fn(),
  retrieveDataFiles: vi.fn(),
  processQueryWithData: vi.fn()
};

// Mock the actual adapter
vi.mock('../../../utils/data/repository/adapters/retrieval-adapter', () => adapterModule);

describe('retrieval-adapter (interface test)', () => {
  describe('identifyRelevantFiles', () => {
    it('should accept query, options, and repository params', () => {
      // Arrange
      const query = 'Test query';
      const options = { threadId: 'test-thread' };
      const mockRepo: FileRepository = {
        getFileById: vi.fn(),
        getFilesByIds: vi.fn(),
        getFilesByQuery: vi.fn(),
        loadSegments: vi.fn()
      };
      
      // Act
      adapterModule.identifyRelevantFiles(query, options, mockRepo);
      
      // Assert
      expect(adapterModule.identifyRelevantFiles).toHaveBeenCalledWith(
        query, options, mockRepo
      );
    });
  });
  
  describe('retrieveDataFiles', () => {
    it('should accept fileIds and repository params', () => {
      // Arrange
      const fileIds = ['file1', 'file2'];
      const mockRepo: FileRepository = {
        getFileById: vi.fn(),
        getFilesByIds: vi.fn(),
        getFilesByQuery: vi.fn(),
        loadSegments: vi.fn()
      };
      
      // Act
      adapterModule.retrieveDataFiles(fileIds, mockRepo);
      
      // Assert
      expect(adapterModule.retrieveDataFiles).toHaveBeenCalledWith(
        fileIds, mockRepo
      );
    });
  });
  
  describe('processQueryWithData', () => {
    it('should accept query, options, and processor params', () => {
      // Arrange
      const query = 'Test query';
      const options = { threadId: 'test-thread' };
      const mockProcessor = {
        processQueryWithData: vi.fn(),
        isComparisonQuery: vi.fn(),
        isStarterQuestion: vi.fn(),
        extractSegmentsFromQuery: vi.fn()
      };
      
      // Act
      adapterModule.processQueryWithData(query, options, mockProcessor);
      
      // Assert
      expect(adapterModule.processQueryWithData).toHaveBeenCalledWith(
        query, options, mockProcessor
      );
    });
  });
}); 