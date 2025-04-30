import { describe, test, expect } from '@jest/globals';
import { QueryContext } from '../../utils/data/repository/implementations/QueryContext';

describe('QueryContext', () => {
  test('should create with string constructor', () => {
    const context = new QueryContext('test query', 'thread-123');
    
    expect(context.query).toBe('test query');
    expect(context.threadId).toBe('thread-123');
    expect(context.isFollowUp).toBe(false);
    expect(context.cachedFileIds).toEqual([]);
    expect(context.relevantFiles).toEqual([]);
    expect(context.processedData).toBeNull();
  });

  test('should create with object constructor', () => {
    const contextData = {
      query: 'test query',
      threadId: 'thread-123',
      isFollowUp: true,
      cachedFileIds: ['file1', 'file2'],
      relevantFiles: ['file1']
    };
    
    const context = new QueryContext(contextData);
    
    expect(context.query).toBe('test query');
    expect(context.threadId).toBe('thread-123');
    expect(context.isFollowUp).toBe(true);
    expect(context.cachedFileIds).toEqual(['file1', 'file2']);
  });

  test('should serialize to JSON and back', () => {
    const original = new QueryContext({
      query: 'test query',
      threadId: 'thread-123',
      isFollowUp: true,
      cachedFileIds: ['file1', 'file2']
    });
    
    const json = original.toJSON();
    const recreated = QueryContext.fromJSON(json);
    
    expect(recreated.query).toBe(original.query);
    expect(recreated.threadId).toBe(original.threadId);
    expect(recreated.isFollowUp).toBe(original.isFollowUp);
    expect(recreated.cachedFileIds).toEqual(original.cachedFileIds);
  });

  test('should create deep clone', () => {
    const original = new QueryContext({
      query: 'test query',
      threadId: 'thread-123',
      cachedFileIds: ['file1', 'file2'],
      relevantFiles: ['file1']
    });
    
    const clone = original.clone();
    
    // Verify it's a deep clone by modifying the original
    original.cachedFileIds.push('file3');
    
    // Clone should not be affected
    expect(clone.cachedFileIds).toEqual(['file1', 'file2']);
  });

  test('should merge updates correctly', () => {
    const original = new QueryContext({
      query: 'original query',
      threadId: 'thread-123',
      isFollowUp: false,
      cachedFileIds: ['file1']
    });
    
    const merged = original.merge({
      query: 'updated query',
      isFollowUp: true,
      cachedFileIds: ['file1', 'file2'],
      responseProperties: {
        enhancedMode: true
      }
    });
    
    // Original should be unchanged
    expect(original.query).toBe('original query');
    expect(original.isFollowUp).toBe(false);
    
    // Merged should have updates
    expect(merged.query).toBe('updated query');
    expect(merged.isFollowUp).toBe(true);
    expect(merged.threadId).toBe('thread-123');
    expect(merged.cachedFileIds).toEqual(['file1', 'file2']);
    expect(merged.responseProperties).toEqual({ enhancedMode: true });
  });
}); 