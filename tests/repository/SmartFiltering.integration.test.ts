/**
 * SmartFiltering Integration Test
 * 
 * Tests that the SmartFiltering implementation can correctly extract stats
 * from the JSON file format used in the actual data files.
 */

import { SmartFilteringProcessor } from "../../utils/data/repository/implementations/SmartFiltering";
import fs from "fs";
import path from "path";

describe('SmartFiltering', () => {
  test("extracting stats from actual 2025_1.json", async () => {
    // Read an actual data file to test with
    const filePath = path.join(process.cwd(), "scripts/output/split_data/2025_1.json");
    
    // Skip test if file doesn't exist (e.g., in CI environment)
    if (!fs.existsSync(filePath)) {
      console.warn(`Test file ${filePath} not found, skipping test`);
      return;
    }
    
    // Load the raw file that FileSystemRepository would return
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    
    // Simulate a DataFile structure
    const file = {
      id: "2025_1",
      filepath: filePath,
      metadata: raw.metadata || {},
      segments: {},
      responses: raw.responses || []
    };
    
    // Create the processor
    const processor = new SmartFilteringProcessor();
    
    // Filter by "region" segment
    const result = processor.filterDataBySegments([file], { 
      segments: ["region"] 
    } as any);
    
    // Verify we got stats
    expect(result.stats.length).toBeGreaterThan(0);
    expect(result.foundSegments).toContain("region");
    
    // Verify stats structure is correct
    const firstStat = result.stats[0];
    expect(firstStat).toHaveProperty('fileId', '2025_1');
    expect(firstStat).toHaveProperty('category', 'region');
    expect(firstStat).toHaveProperty('segment');
    expect(firstStat).toHaveProperty('value');
    expect(firstStat).toHaveProperty('stat');
    expect(firstStat).toHaveProperty('percentage');
    expect(firstStat).toHaveProperty('formatted');
    
    // Log some debugging info
    console.log(`Test extracted ${result.stats.length} stats from 2025_1.json`);
    console.log(`Found segments: ${result.foundSegments.join(', ')}`);
  });
}); 