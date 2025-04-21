/**
 * Performance analysis script
 * Analyzes the performance_metrics.log to track improvements from polling interval changes
 */

const fs = require("fs");
const path = require("path");

// Get the log file path
const logFilePath = path.join(process.cwd(), "logs", "performance_metrics.log");

// Check if the file exists
if (!fs.existsSync(logFilePath)) {
  console.error("Performance metrics log file not found:", logFilePath);
  process.exit(1);
}

// Read the file
const logContent = fs.readFileSync(logFilePath, "utf8");
const lines = logContent.trim().split("\n");

// Parse the metrics
const metrics = lines.map((line) => {
  const parts = line.split(" | ");
  return {
    query: parts[0]?.trim() || "",
    cachedFiles: parts[1] ? parts[1].split(",").filter(Boolean).length : 0,
    newFiles: parts[2] ? parts[2].split(",").filter(Boolean).length : 0,
    pollCount: parseInt(parts[3], 10) || 0,
    responseTime: parseInt(parts[4], 10) || 0,
    status: parseInt(parts[5], 10) || 0,
    timestamp: parts[6] || "",
  };
});

// Skip entries with zero response time (likely errors)
const validMetrics = metrics.filter((m) => m.responseTime > 0);

// Group results by days to track changes over time
const metricsByDay = {};
validMetrics.forEach((metric) => {
  // If we have a timestamp, use the date part
  const dateStr = metric.timestamp ? metric.timestamp.split("T")[0] : "unknown";

  if (!metricsByDay[dateStr]) {
    metricsByDay[dateStr] = [];
  }

  metricsByDay[dateStr].push(metric);
});

// Calculate statistics for different polling intervals
const pollingIntervalStats = {
  "1000ms": { count: 0, totalTime: 0, avgTime: 0 },
  "250ms": { count: 0, totalTime: 0, avgTime: 0 },
};

// The change date (when polling was changed from 1000ms to 250ms)
const changeDate = "2024-05-03";

// Categorize metrics based on the change date
Object.entries(metricsByDay).forEach(([date, dayMetrics]) => {
  const pollingInterval =
    new Date(date) >= new Date(changeDate) ? "250ms" : "1000ms";

  dayMetrics.forEach((metric) => {
    pollingIntervalStats[pollingInterval].count++;
    pollingIntervalStats[pollingInterval].totalTime += metric.responseTime;
  });
});

// Calculate averages
Object.keys(pollingIntervalStats).forEach((interval) => {
  const stats = pollingIntervalStats[interval];
  stats.avgTime =
    stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0;
});

// Calculate improvement percentage
let improvementPct = 0;
if (
  pollingIntervalStats["1000ms"].avgTime > 0 &&
  pollingIntervalStats["250ms"].avgTime > 0
) {
  const reduction =
    pollingIntervalStats["1000ms"].avgTime -
    pollingIntervalStats["250ms"].avgTime;
  improvementPct = Math.round(
    (reduction / pollingIntervalStats["1000ms"].avgTime) * 100
  );
}

// Print summary
console.log("=== PERFORMANCE ANALYSIS ===");
console.log(`Total entries analyzed: ${validMetrics.length}`);
console.log("\nPolling Interval Performance:");
console.log(
  `- Original (1000ms): ${pollingIntervalStats["1000ms"].avgTime}ms average (${pollingIntervalStats["1000ms"].count} samples)`
);
console.log(
  `- Optimized (250ms): ${pollingIntervalStats["250ms"].avgTime}ms average (${pollingIntervalStats["250ms"].count} samples)`
);

if (improvementPct > 0) {
  console.log(
    `\nPerformance improvement: ${improvementPct}% faster response time`
  );
} else if (improvementPct < 0) {
  console.log(
    `\nPerformance regression: ${Math.abs(
      improvementPct
    )}% slower response time`
  );
} else {
  console.log("\nNo significant performance change detected");
}

console.log("\nRecent performance metrics:");
const recentMetrics = validMetrics.slice(-5);
recentMetrics.forEach((metric, i) => {
  console.log(
    `${i + 1}. "${metric.query.substring(0, 50)}..." - ${metric.responseTime}ms`
  );
});

console.log("\n=== END ANALYSIS ===");
