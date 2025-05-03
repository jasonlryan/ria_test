import { describe, it, expect } from 'vitest';
import { QueryContext } from '../../utils/data/repository/implementations/QueryContext';

describe('QueryContext', () => {
  it('should create with string constructor', () => {
    const context = new QueryContext('test query', 'thread-123');
    
    expect(context.query).toBe('test query');
    expect(context.threadId).toBe('thread-123');
    expect(context.isFollowUp).toBe(false);
    expect(context.cachedFileIds).toEqual([]);
    expect(context.relevantFiles).toEqual([]);
    expect(context.processedData).toBeNull();
  });

  it('should create with object constructor', () => {
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

  it('should serialize to JSON and back', () => {
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

  it('should create a clone with independent properties', () => {
    // Initialize with simple properties
    const original = new QueryContext({
      query: 'test query',
      threadId: 'thread-123',
      cachedFileIds: ['file1', 'file2'],
      responseProperties: {
        enhancedMode: true
      }
    });
    
    // Create a clone
    const clone = original.clone();
    
    // Test the clone is a separate object
    expect(clone).not.toBe(original);
    
    // Test that clone has the same values
    expect(clone.query).toBe(original.query);
    expect(clone.threadId).toBe(original.threadId);
    expect(clone.cachedFileIds).toEqual(original.cachedFileIds);
    
    // Modify the clone and verify original is unchanged
    clone.query = 'modified query';
    clone.cachedFileIds = ['file3']; 
    
    expect(original.query).toBe('test query');
    expect(original.cachedFileIds).toEqual(['file1', 'file2']);
  });

  it('should merge updates correctly', () => {
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