/**
 * Phase 1 Adapter Flags Tests
 *
 * These tests verify that the retrieval-adapter.ts has been properly modified
 * to force the repository pattern by hardcoding the appropriate flags.
 *
 * Last Updated: Mon May 06 2025
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 1 - Repository Adapter Flags", () => {
  it("should have hardcoded flags in the retrieval-adapter.ts file", () => {
    // Read the content of the adapter file
    const adapterPath = path.join(
      process.cwd(),
      "utils",
      "data",
      "repository",
      "adapters",
      "retrieval-adapter.ts"
    );
    const content = fs.readFileSync(adapterPath, "utf-8");

    // Check for hardcoded flags
    expect(content).toContain("const USE_REPOSITORY_PATTERN = true;");
    expect(content).toContain("const SHADOW_MODE = false;");
    expect(content).toContain("const TRAFFIC_PERCENTAGE = 100;");
    expect(content).toContain("const ENABLE_RETRIEVAL_ADAPTER = true;");

    // Verify shouldUseRepositoryImplementation always returns true
    expect(content).toContain("function shouldUseRepositoryImplementation(");
    expect(content).toContain("return true;");

    // Look for legacy fallback paths that should have been removed
    expect(content).not.toContain("fallback to legacy");
    expect(content).not.toContain('if (USE_REPOSITORY_PATTERN !== "true")');
    expect(content).not.toContain("if (!ENABLE_RETRIEVAL_ADAPTER)");
  });

  it("should extract individual flag values from the adapter module", () => {
    // This requires using a special approach to extract flags from the module
    // without executing the entire module

    // Read the file and extract the values using regex
    const adapterPath = path.join(
      process.cwd(),
      "utils",
      "data",
      "repository",
      "adapters",
      "retrieval-adapter.ts"
    );
    const content = fs.readFileSync(adapterPath, "utf-8");

    // Extract flag values using regex
    let useRepositoryPattern = false;
    let shadowMode = true;
    let trafficPercentage = 0;
    let enableAdapter = false;

    // Parse the file content to extract flag values
    const useRepoMatch = content.match(
      /const\s+USE_REPOSITORY_PATTERN\s*=\s*(true|false|"true"|"false"|[0-9]+)/
    );
    if (useRepoMatch) {
      useRepositoryPattern =
        useRepoMatch[1] === "true" || useRepoMatch[1] === '"true"';
    }

    const shadowMatch = content.match(
      /const\s+SHADOW_MODE\s*=\s*(true|false|"true"|"false"|[0-9]+)/
    );
    if (shadowMatch) {
      shadowMode = shadowMatch[1] === "true" || shadowMatch[1] === '"true"';
    }

    const trafficMatch = content.match(
      /const\s+TRAFFIC_PERCENTAGE\s*=\s*([0-9]+)/
    );
    if (trafficMatch) {
      trafficPercentage = parseInt(trafficMatch[1], 10);
    }

    const enableMatch = content.match(
      /const\s+ENABLE_RETRIEVAL_ADAPTER\s*=\s*(true|false|"true"|"false"|[0-9]+)/
    );
    if (enableMatch) {
      enableAdapter = enableMatch[1] === "true" || enableMatch[1] === '"true"';
    }

    // Assert the extracted values
    expect(useRepositoryPattern).toBe(true);
    expect(shadowMode).toBe(false);
    expect(trafficPercentage).toBe(100);
    expect(enableAdapter).toBe(true);
  });

  it("should check for determineIfShouldUseRepository always returning true", () => {
    // This is a safer alternative to importing the actual module
    // We just check the implementation in the file text
    const adapterPath = path.join(
      process.cwd(),
      "utils",
      "data",
      "repository",
      "adapters",
      "retrieval-adapter.ts"
    );
    const content = fs.readFileSync(adapterPath, "utf-8");

    // Find the function in the content
    const functionRegex =
      /function\s+determineIfShouldUseRepository\s*\([^)]*\)\s*\{([^}]*)\}/;
    const match = content.match(functionRegex);

    if (!match) {
      throw new Error("Could not find determineIfShouldUseRepository function");
    }

    const functionBody = match[1];

    // Check that it only returns true
    expect(functionBody.trim()).toContain("return true");
    // The function should be very simple - just returning true
    expect(functionBody.trim().split("\n").length).toBeLessThan(5);
  });
});
