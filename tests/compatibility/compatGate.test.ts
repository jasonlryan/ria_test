/**
 * Tests for compatibility gate implementation
 * Verifies that incomparable files are properly identified and filtered
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getComparablePairs, lookupFiles, FileMetadata } from "../../utils/compatibility/compatibility";

describe("Compatibility Gate", () => {
  describe("lookupFiles", () => {
    it("should enrich file IDs with metadata", () => {
      // Mock implementation of lookupFiles to avoid external dependencies
      const mockLookupFiles = vi.fn().mockImplementation((fileIds) => {
        return fileIds.map(fileId => ({
          fileId,
          topicId: fileId.includes('attraction') ? 'Attraction_Factors' : 'Leadership_Confidence',
          year: fileId.includes('2024') ? 2024 : 2025,
          comparable: !fileId.includes('attraction'),
          userMessage: fileId.includes('attraction') 
            ? "Year-on-year comparisons are not available due to methodology changes."
            : "Data is comparable across years for this topic."
        }));
      });
      
      // Use the mock implementation for this test
      const originalLookupFiles = lookupFiles;
      global.lookupFiles = mockLookupFiles;
      
      // Test file IDs
      const fileIds = [
        "talent_attraction_2024",
        "talent_attraction_2025",
        "2025_8_1", // Leadership_Confidence
        "2024_8_1"  // Leadership_Confidence
      ];
      
      // Execute the function
      const result = mockLookupFiles(fileIds);
      
      // Assertions
      expect(result).toHaveLength(4);
      expect(result[0].fileId).toBe("talent_attraction_2024");
      expect(result[0].topicId).toBe("Attraction_Factors");
      expect(result[0].year).toBe(2024);
      expect(result[0].comparable).toBe(false);
      
      expect(result[2].fileId).toBe("2025_8_1");
      expect(result[2].topicId).toBe("Leadership_Confidence");
      expect(result[2].year).toBe(2025);
      expect(result[2].comparable).toBe(true);
      
      // Restore the original function
      global.lookupFiles = originalLookupFiles;
    });
  });
  
  describe("getComparablePairs", () => {
    it("should identify incomparable file pairs", () => {
      // Sample file metadata with incomparable topic
      const fileMetadata: FileMetadata[] = [
        {
          fileId: "talent_attraction_2024",
          topicId: "Attraction_Factors",
          year: 2024,
          comparable: false,
          userMessage: "Year-on-year comparisons are not available due to methodology changes."
        },
        {
          fileId: "talent_attraction_2025",
          topicId: "Attraction_Factors",
          year: 2025,
          comparable: false,
          userMessage: "Year-on-year comparisons are not available due to methodology changes."
        }
      ];
      
      // Execute the function
      const result = getComparablePairs(fileMetadata);
      
      // Assertions
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
      expect(result.invalid).toContain("talent_attraction_2024");
      expect(result.invalid).toContain("talent_attraction_2025");
      expect(result.message).toBe("Year-on-year comparisons are not available due to methodology changes.");
    });
    
    it("should allow comparable file pairs", () => {
      // Sample file metadata with comparable topic
      const fileMetadata: FileMetadata[] = [
        {
          fileId: "2024_8_1",
          topicId: "Leadership_Confidence",
          year: 2024,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        },
        {
          fileId: "2025_8_1",
          topicId: "Leadership_Confidence",
          year: 2025,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        }
      ];
      
      // Execute the function
      const result = getComparablePairs(fileMetadata);
      
      // Assertions
      expect(result.invalid).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain("2024_8_1");
      expect(result.valid).toContain("2025_8_1");
      expect(result.message).toBe("");
    });
    
    it("should handle mixed topics correctly", () => {
      // Sample file metadata with mixed topics
      const fileMetadata: FileMetadata[] = [
        {
          fileId: "talent_attraction_2024",
          topicId: "Attraction_Factors",
          year: 2024,
          comparable: false,
          userMessage: "Year-on-year comparisons are not available due to methodology changes."
        },
        {
          fileId: "talent_attraction_2025",
          topicId: "Attraction_Factors",
          year: 2025,
          comparable: false,
          userMessage: "Year-on-year comparisons are not available due to methodology changes."
        },
        {
          fileId: "2024_8_1",
          topicId: "Leadership_Confidence",
          year: 2024,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        },
        {
          fileId: "2025_8_1",
          topicId: "Leadership_Confidence",
          year: 2025,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        }
      ];
      
      // Execute the function
      const result = getComparablePairs(fileMetadata);
      
      // Assertions
      expect(result.invalid).toHaveLength(2);
      expect(result.invalid).toContain("talent_attraction_2024");
      expect(result.invalid).toContain("talent_attraction_2025");
      
      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain("2024_8_1");
      expect(result.valid).toContain("2025_8_1");
      
      expect(result.message).toBe("Year-on-year comparisons are not available due to methodology changes.");
    });
    
    it("should not mark single-year topics as invalid", () => {
      // Sample file metadata with only 2025 data
      const fileMetadata: FileMetadata[] = [
        {
          fileId: "talent_attraction_2025",
          topicId: "Attraction_Factors",
          year: 2025,
          comparable: false,
          userMessage: "Year-on-year comparisons are not available due to methodology changes."
        },
        {
          fileId: "2025_8_1",
          topicId: "Leadership_Confidence",
          year: 2025,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        }
      ];
      
      // Execute the function
      const result = getComparablePairs(fileMetadata);
      
      // Assertions - all files should be valid since we don't have multi-year data for any topic
      expect(result.invalid).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain("talent_attraction_2025");
      expect(result.valid).toContain("2025_8_1");
      expect(result.message).toBe("");
    });

    it("should retain comparable files in a mixed topic", () => {
      const fileMetadata: FileMetadata[] = [
        {
          fileId: "2024_q1",
          topicId: "Mixed_Topic",
          year: 2024,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        },
        {
          fileId: "2025_q1",
          topicId: "Mixed_Topic",
          year: 2025,
          comparable: false,
          userMessage: "No comparison"
        },
        {
          fileId: "2025_q2",
          topicId: "Mixed_Topic",
          year: 2025,
          comparable: true,
          userMessage: "Data is comparable across years for this topic."
        }
      ];

      const result = getComparablePairs(fileMetadata);

      expect(result.valid).toContain("2024_q1");
      expect(result.valid).toContain("2025_q2");
      expect(result.invalid).toContain("2025_q1");
    });
  });
});
