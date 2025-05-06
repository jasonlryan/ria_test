/**
 * Phase 1 Service Import Tests
 *
 * These tests verify that the services, particularly dataRetrievalService.js,
 * are correctly importing from the retrieval adapter and not directly from legacy code.
 *
 * Last Updated: Mon May 06 2025
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 1 - Service Import Checks", () => {
  it("should import retrieval functions from the adapter in dataRetrievalService.js", () => {
    // Read the content of the service file
    const servicePath = path.join(
      process.cwd(),
      "app",
      "api",
      "services",
      "dataRetrievalService.js"
    );
    const content = fs.readFileSync(servicePath, "utf-8");

    // Check for correct imports from adapter
    expect(content).toContain("import {");
    expect(content).toContain("} from"); // Make sure it's a named import
    expect(content).toContain(
      "utils/data/repository/adapters/retrieval-adapter"
    );

    // Should NOT import directly from legacy implementations
    expect(content).not.toContain(
      'import { processQueryWithData } from "../../../utils/openai/retrieval"'
    );
    expect(content).not.toContain(
      'import * as retrieval from "../../../utils/openai/retrieval"'
    );

    // Check for named destructuring import that includes necessary functions
    const importRegex =
      /import\s+\{\s*([\s\S]*?)\s*\}\s+from\s+['"].*?retrieval-adapter['"]/;
    const match = content.match(importRegex);

    if (match && match[1]) {
      const importedFunctions = match[1].split(",").map((f) => f.trim());

      // Check that required functions are imported
      expect(
        importedFunctions.some((f) => f.includes("processQueryWithData"))
      ).toBe(true);
      expect(
        importedFunctions.some((f) => f.includes("identifyRelevantFiles"))
      ).toBe(true);
    } else {
      throw new Error("Could not find import statement from retrieval-adapter");
    }
  });

  it("should not have conditional logic based on repository feature flags", () => {
    // Read the content of the service file
    const servicePath = path.join(
      process.cwd(),
      "app",
      "api",
      "services",
      "dataRetrievalService.js"
    );
    const content = fs.readFileSync(servicePath, "utf-8");

    // Check that the code doesn't contain conditional imports or checks related to repository pattern
    expect(content).not.toContain("USE_REPOSITORY_PATTERN");
    expect(content).not.toContain("ENABLE_RETRIEVAL_ADAPTER");
    expect(content).not.toContain("process.env.USE_REPOSITORY");

    // Make sure there are no repository-related fallback conditions
    expect(content).not.toContain("if (useRepository)");
  });

  it("should use adapter for data processing in processQueryWithData", () => {
    // Read the content of the service file
    const servicePath = path.join(
      process.cwd(),
      "app",
      "api",
      "services",
      "dataRetrievalService.js"
    );
    const content = fs.readFileSync(servicePath, "utf-8");

    // Find the final call to the adapter in the processQueryWithData method
    const finalAdapterCallRegex =
      /return\s+await\s+retrievalProcessQueryWithData\s*\(/;
    expect(finalAdapterCallRegex.test(content)).toBe(true);

    // Check for renamed import of processQueryWithData
    const importRenameRegex =
      /processQueryWithData\s+as\s+retrievalProcessQueryWithData/;
    expect(importRenameRegex.test(content)).toBe(true);

    // Check that we're delegating to the adapter at the end of the method
    // by looking for the delegate comment and the function call
    expect(content).toContain(
      "// Delegate to the core retrieval implementation"
    );
    expect(content).toContain("return await retrievalProcessQueryWithData(");
  });
});
