/**
 * Unit tests for query normalization 
 */

import { describe, it, expect } from 'vitest';
import { normalizeQueryText } from '../../utils/shared/queryUtils';

describe('normalizeQueryText', () => {
  it('should leave basic queries unchanged', () => {
    const input = "how does this compare with 2024?";
    expect(normalizeQueryText(input)).toBe(input);
  });

  it('should extract the query from a query with Analysis Summary', () => {
    const input = "Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected for year-on-year comparison";
    const expected = "how does this compare to 2024 data?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  it('should extract the query from a query with file identification', () => {
    const input = "Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification and smart filtering with 3 topics";
    const expected = "What factors related to job choice, staying with a company?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  it('should handle Query prefix in the middle of text', () => {
    const input = "I want to know Query: what is the level of trust employees have?";
    expect(normalizeQueryText(input)).toBe(input);
  });

  it('should extract the query from a multi-line query with nested structure', () => {
    const input = `Query: What factors affect retention?

Analysis Summary: 
- Found 3 topics
- Used 5 files
- Processing time: 450ms`;
    const expected = "What factors affect retention?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  it('should extract the query from a query with multiple analysis sections', () => {
    const input = `Query: how have attitudes changed?
  
Analysis: First analysis

Summary: Additional summary`;
    const expected = "how have attitudes changed?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  it('should extract the query from a real query example', () => {
    const input = `
Query: What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?

Analysis Summary: LLM-driven file identification and smart filtering completed successfully in 127ms.`;
    const expected = "What factors related to job choice, staying with a company, and leaving an organization are most important to employees amid market turbulence?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  it('should extract the query from a real follow-up query', () => {
    const input = `
Query: how does this compare to 2024?

Analysis Summary: Incomparable data detected for year-on-year comparison`;
    const expected = "how does this compare to 2024?";
    expect(normalizeQueryText(input)).toBe(expected);
  });

  // Edge cases
  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizeQueryText('')).toBe('');
    });

    it('should handle whitespace', () => {
      expect(normalizeQueryText('   ')).toBe('   ');
    });

    it('should handle null safely', () => {
      expect(normalizeQueryText(null as unknown as string)).toBe('');
    });

    it('should handle undefined safely', () => {
      expect(normalizeQueryText(undefined as unknown as string)).toBe('');
    });

    it('should handle Query prefix with no content', () => {
      expect(normalizeQueryText('Query:')).toBe('');
    });

    it('should handle query prefix with whitespace', () => {
      expect(normalizeQueryText('query:   ')).toBe('');
    });

    it('should handle different case for query prefix', () => {
      expect(normalizeQueryText('QUERY: text')).toBe('text');
    });

    it('should handle query with newlines', () => {
      expect(normalizeQueryText('query: text\n\n')).toBe('text');
    });

    it('should handle query with multi-line content', () => {
      expect(normalizeQueryText('Query: multi\nline\ntext')).toBe('multi\nline\ntext');
    });
  });
}); 