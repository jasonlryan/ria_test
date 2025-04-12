// Parse the response to remove the citations.
const parseResponse = (content) => {
  return content.replace(/\【.*?\】/g, "");
};

import fs from "fs";
import path from "path";

// Helper functions
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Get the latest performance metrics from the log file
export function getLatestPerformanceMetrics(count = 5) {
  try {
    const logFile = path.join(process.cwd(), "logs", "performance_metrics.log");

    if (!fs.existsSync(logFile)) {
      return { error: "No performance log file found" };
    }

    // Read the last few lines
    const data = fs.readFileSync(logFile, "utf8");
    const lines = data.trim().split("\n");

    // Get the most recent entries
    const recent = lines.slice(-count);

    // Parse and calculate average response time
    const parsedMetrics = recent.map((line) => {
      const parts = line.split(" | ");
      return {
        query: parts[0],
        responseTime: parseInt(parts[4], 10) || 0,
        pollCount: parseInt(parts[3], 10) || 0,
        timestamp: parts[6] || new Date().toISOString(),
      };
    });

    // Calculate average
    const validTimes = parsedMetrics.filter((m) => m.responseTime > 0);
    const avgTime =
      validTimes.length > 0
        ? validTimes.reduce((sum, m) => sum + m.responseTime, 0) /
          validTimes.length
        : 0;

    return {
      recentEntries: parsedMetrics,
      averageResponseTime: Math.round(avgTime),
      entryCount: parsedMetrics.length,
    };
  } catch (error) {
    console.error("Error reading performance log:", error);
    return { error: error.message };
  }
}

// Performance tracking log for RIA changes
export const PERFORMANCE_LOG = [
  // Initial baseline measurements
  {
    date: "2024-05-01",
    change: "Baseline measurement",
    responseTime: 26676,
    pollingInterval: 1000,
    notes: "Original implementation with 1000ms polling",
  },
  // First optimization
  {
    date: "2024-05-03",
    change: "Reduced polling interval",
    responseTime: null, // To be filled after testing
    pollingInterval: 250,
    notes: "Reduced OpenAI status check interval from 1000ms to 250ms",
  },
];

export { parseResponse };
