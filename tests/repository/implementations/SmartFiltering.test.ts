/**
 * SmartFiltering Tests
 * 
 * Tests for the smart filtering implementation.
 * Verifies the core functionality of filtering data by segments.
 * 
 * Last Updated: Sat May 25 2025
 */

import { describe, it, expect } from "vitest";
import { 
  parseQueryIntent,
  filterDataBySegments
} from "../../../utils/data/repository/implementations/SmartFiltering";
import { FilterResult } from "../../../utils/data/repository/interfaces/FilterProcessor";

describe("SmartFiltering", () => {
  describe("parseQueryIntent", () => {
    it("should extract demographics from query", () => {
      const query = "Show me data about job level and gender";
      const intent = parseQueryIntent(query);
      
      expect(intent.demographics).toContain("job_level");
      expect(intent.specificity).toBe("specific");
    });
    
    it("should detect follow-up queries", () => {
      const query = "What about by age?";
      const conversationHistory = [
        { role: "user", content: "Show me job satisfaction data" },
        { role: "assistant", content: "Here is job satisfaction data..." }
      ];
      
      const intent = parseQueryIntent(query, conversationHistory);
      
      expect(intent.isFollowUp).toBe(true);
      expect(intent.demographics).toContain("age");
    });
  });
  
  describe("filterDataBySegments", () => {
    it("should filter data by job_level segment", () => {
      // Sample data with job_level segment
      const data = {
        files: [
          {
            id: "test-file",
            data: {
              question: "How important is compensation?",
              responses: [
                {
                  response: "Very important",
                  data: {
                    overall: 0.85,
                    job_level: {
                      senior: 0.92,
                      mid: 0.85,
                      junior: 0.77
                    }
                  }
                }
              ]
            }
          }
        ]
      };
      
      const result = filterDataBySegments(data, ["job_level"]);
      
      // Verify filtering worked
      expect(result.stats.length).toBeGreaterThan(0);
      expect(result.foundSegments).toContain("job_level");
      expect(result.missingSegments.length).toBe(0);
      
      // Verify job_level data is included
      const jobLevelStats = result.stats.filter(stat => stat.category === "job_level");
      expect(jobLevelStats.length).toBeGreaterThan(0);
      
      // Verify specific values
      const seniorStat = jobLevelStats.find(stat => stat.value === "senior");
      expect(seniorStat).toBeDefined();
      expect(seniorStat?.percentage).toBe(92);
    });
    
    it("should handle missing segments gracefully", () => {
      // Sample data without requested segment
      const data = {
        files: [
          {
            id: "test-file",
            data: {
              question: "How important is compensation?",
              responses: [
                {
                  response: "Very important",
                  data: {
                    overall: 0.85,
                    gender: {
                      male: 0.83,
                      female: 0.87
                    }
                  }
                }
              ]
            }
          }
        ]
      };
      
      const result = filterDataBySegments(data, ["job_level"]);
      
      // Verify handling of missing segments
      expect(result.foundSegments).not.toContain("job_level");
      expect(result.missingSegments).toContain("job_level");
      
      // Should still include overall data
      expect(result.stats.some(stat => stat.category === "overall")).toBe(true);
    });
  });
}); 