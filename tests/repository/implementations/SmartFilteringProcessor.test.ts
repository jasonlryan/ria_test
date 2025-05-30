/**
 * Tests for SmartFilteringProcessor Implementation
 *
 * Verifies the functionality of the SmartFilteringProcessor implementation
 * of the FilterProcessor interface.
 *
 * Last Updated: Sun May 4 13:40:21 BST 2025
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SmartFilteringProcessor } from '../../../utils/data/repository/implementations/SmartFilteringProcessor';
import { QueryContext } from '../../../utils/data/repository/interfaces/QueryContext';
import { DataFile } from '../../../utils/data/repository/interfaces/FileRepository';

// Mock the canonical segments
vi.mock('../../../utils/cache/segment_keys', () => ({
  CANONICAL_SEGMENTS: ['overall', 'region', 'age', 'gender', 'org_size', 'sector', 'job_level']
}));

describe('SmartFilteringProcessor', () => {
  let processor: SmartFilteringProcessor;
  let mockDataFiles: DataFile[];
  let mockContext: QueryContext;

  beforeEach(() => {
    // Create a new processor for each test
    processor = new SmartFilteringProcessor();

    // Initialize mock context
    mockContext = {
      query: 'What is employee sentiment on AI in the UK?',
      segments: ['country', 'age', 'gender'],
      isFollowUp: false,
      threadId: 'test-thread-123',
      segmentTracking: {
        loadedSegments: {},
        currentSegments: ['country', 'age', 'gender'],
        requestedSegments: ['country', 'age', 'gender'],
        missingSegments: {}
      }
    };

    // Create mock data files
    mockDataFiles = [
      {
        id: 'file1',
        filepath: 'file1.json',
        metadata: { topic: 'AI_Confidence' },
        segments: {
          responses: [
            {
              response: 'Employees are confident',
              data: {
                overall: 0.75,
                region: {
                  united_kingdom: 0.8,
                  united_states: 0.7
                },
                age: {
                  '18-25': 0.65,
                  '26-35': 0.75,
                  '36-45': 0.8
                },
                gender: {
                  male: 0.78,
                  female: 0.72
                }
              }
            }
          ]
        }
      },
      {
        id: 'file2',
        filepath: 'file2.json',
        metadata: { topic: 'AI_Impact' },
        segments: {
          responses: [
            {
              response: 'AI has positive impact',
              data: {
                overall: 0.65,
                region: {
                  united_kingdom: 0.7,
                  united_states: 0.6
                },
                age: {
                  '18-25': 0.75,
                  '26-35': 0.65,
                  '36-45': 0.55
                }
              }
            }
          ]
        }
      }
    ];

    // Mock console logs to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('parseQueryIntent extracts correct information', () => {
    const result = processor.parseQueryIntent('What do employees in the UK think about AI in 2025?', mockContext);
    
    expect(result.intent).toBeDefined();
    expect(result.intent.topics).toContain('ai_impact');
    expect(result.intent.demographics).toContain('uk');
    expect(result.intent.years).toContain(2025);
    expect(result.intent.specificity).toBe('specific');
    expect(result.intent.isFollowUp).toBe(false);
  });

  test('getBaseData extracts stats from data files', () => {
    const result = processor.getBaseData(mockDataFiles, mockContext);
    
    expect(result.stats.length).toBeGreaterThan(0);
    expect(result.filteredData.length).toBeGreaterThan(0);
    expect(result.foundSegments).toContain('overall');
    expect(result.missingSegments.length).toBeGreaterThan(0);
    
    // Check format of a stats item
    const statItem = result.stats[0];
    expect(statItem.fileId).toBeDefined();
    expect(statItem.percentage).toBeGreaterThanOrEqual(0);
    expect(statItem.percentage).toBeLessThanOrEqual(100);
  });

  test('filterDataBySegments returns data filtered by segments', () => {
    // Set specific segments in the context
    const contextWithSegments: QueryContext = {
      ...mockContext,
      segments: ['country', 'age']
    };
    
    const result = processor.filterDataBySegments(mockDataFiles, contextWithSegments);
    
    expect(result.filteredData.length).toBeGreaterThan(0);
    expect(result.foundSegments).toContain('country');
    
    // Check that categories match our requested segments
    const categories = new Set(result.filteredData.map(item => item.category));
    expect(categories.has('region')).toBe(true); // 'country' maps to 'region'
    expect(categories.has('age')).toBe(true);
    
    // Verify UK data is included
    const ukData = result.filteredData.find(
      item => item.category === 'region' && item.value === 'united_kingdom'
    );
    expect(ukData).toBeDefined();
  });

  test('handles missing or empty data gracefully', () => {
    const emptyFiles: DataFile[] = [
      {
        id: 'empty',
        filepath: 'empty.json',
        metadata: {},
        segments: {}
      }
    ];
    
    const result = processor.filterDataBySegments(emptyFiles, mockContext);
    
    expect(result.filteredData).toEqual([]);
    expect(result.stats).toEqual([]);
    expect(result.foundSegments.length).toBe(0);
    expect(result.missingSegments.length).toBeGreaterThan(0);
  });
}); 