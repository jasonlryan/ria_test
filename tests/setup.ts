import { expect, afterEach, vi } from "vitest";

// Any global test setup like mocks
global.console.error = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
}); 