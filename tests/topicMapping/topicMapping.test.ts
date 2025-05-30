import { describe, it, expect } from 'vitest';
import { getCanonicalMapping } from '../../utils/data/topicMapping';
import { DataRetrievalService } from '../../app/api/services/dataRetrievalService';

describe('canonical mapping utilities', () => {
  it('builds topic dictionary', async () => {
    const mapping = await getCanonicalMapping();
    expect(mapping.topicDict).toBeDefined();
    expect(mapping.topicDict['Attraction_Factors']).toBeDefined();
    expect(mapping.topicDict['Attraction_Factors'].id).toBe('Attraction_Factors');
  });

  it('assesses compatibility using topic dictionary', async () => {
    const service = new DataRetrievalService();
    const result = await service.assessCompatibility(['Attraction_Factors'], []);
    expect(result.topicCompatibility['Attraction_Factors']).toBeDefined();
    expect(result.topicCompatibility['Attraction_Factors'].comparable).toBe(false);
  });
});
