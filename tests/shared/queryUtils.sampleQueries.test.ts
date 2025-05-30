import { describe, it, expect } from 'vitest';
import { normalizeQueryText } from '../../utils/shared/queryUtils';

describe('sample queries from logs', () => {
  const cases: Array<[string, string]> = [
    [
      'how does this compare with 2024?',
      'how does this compare with 2024?'
    ],
    [
      'Query: how does this compare to 2024 data?\n\nAnalysis Summary: Incomparable data detected',
      'how does this compare to 2024 data?'
    ],
    [
      'Query: What factors related to job choice, staying with a company?\n\nAnalysis: LLM-driven file identification',
      'What factors related to job choice, staying with a company?'
    ],
    [
      'what is the level of trust employees have in their direct managers?',
      'what is the level of trust employees have in their direct managers?'
    ],
    [
      '\nQuery: What are the primary reasons employees may be resistant to returning to the office full-time?\n\nAnalysis Summary: LLM-driven file identification',
      'What are the primary reasons employees may be resistant to returning to the office full-time?'
    ],
    [
      '\n\nQuery: How does this compare to 2024?\n\nAnalysis Summary: Incomparable data detected for year-on-year comparison',
      'How does this compare to 2024?'
    ]
  ];

  cases.forEach(([input, expected]) => {
    it(`normalizes \"${input.substring(0, 30).replace(/\n/g, ' ')}...\"`, () => {
      expect(normalizeQueryText(input)).toBe(expected);
    });
  });
});
