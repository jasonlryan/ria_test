/**
 * Repository Pattern Toggle Script
 *
 * Configures and updates environment variables for repository pattern rollout.
 * This script helps manage the different phases of the rollout strategy.
 *
 * Usage:
 *   node scripts/repository-toggle.js [mode]
 *
 * Modes:
 *   - test5: Test mode with 5% traffic
 *   - test10: Test mode with 10% traffic
 *   - test25: Test mode with 25% traffic
 *   - test50: Test mode with 50% traffic
 *   - full: Full implementation (100%)
 *   - off: Turn off repository pattern
 *   - retrieval_only: Only enable retrieval adapter
 *   - service_only: Only enable service adapter
 *
 * Last Updated: Sat May 3 2025
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Define environment file path
const ENV_FILE = path.resolve(process.cwd(), ".env");

// Load current environment variables
const currentEnv = fs.existsSync(ENV_FILE)
  ? dotenv.parse(fs.readFileSync(ENV_FILE))
  : {};

// Available modes with their settings
const modes = {
  test5: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "5",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "true",
  },
  test10: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "10",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "true",
  },
  test25: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "25",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "true",
  },
  test50: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "50",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "true",
  },
  full: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "100",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "true",
  },
  off: {
    USE_REPOSITORY_PATTERN: "false",
    REPOSITORY_TRAFFIC_PERCENTAGE: "0",
    ENABLE_RETRIEVAL_ADAPTER: "false",
    ENABLE_SERVICE_ADAPTER: "false",
  },
  retrieval_only: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "100",
    ENABLE_RETRIEVAL_ADAPTER: "true",
    ENABLE_SERVICE_ADAPTER: "false",
  },
  service_only: {
    USE_REPOSITORY_PATTERN: "true",
    REPOSITORY_TRAFFIC_PERCENTAGE: "100",
    ENABLE_RETRIEVAL_ADAPTER: "false",
    ENABLE_SERVICE_ADAPTER: "true",
  },
};

/**
 * Update environment variables file
 *
 * @param {Object} variables - Variables to update
 */
function updateEnvFile(variables) {
  // Merge with current environment
  const newEnv = { ...currentEnv, ...variables };

  // Convert to string format
  const envString = Object.entries(newEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Write to file
  fs.writeFileSync(ENV_FILE, envString);

  console.log("Environment variables updated:");
  Object.entries(variables).forEach(([key, value]) => {
    console.log(`  ${key}=${value}`);
  });
}

/**
 * Get current mode from environment
 */
function getCurrentMode() {
  if (currentEnv.USE_REPOSITORY_PATTERN !== "true") {
    return "off";
  }


  // Check for adapter-specific modes
  const retrievalEnabled = currentEnv.ENABLE_RETRIEVAL_ADAPTER === "true";
  const serviceEnabled = currentEnv.ENABLE_SERVICE_ADAPTER === "true";

  if (retrievalEnabled && !serviceEnabled) {
    return "retrieval_only";
  }

  if (!retrievalEnabled && serviceEnabled) {
    return "service_only";
  }

  const percentage = parseInt(
    currentEnv.REPOSITORY_TRAFFIC_PERCENTAGE || "0",
    10
  );

  if (percentage >= 100) return "full";
  if (percentage >= 50) return "test50";
  if (percentage >= 25) return "test25";
  if (percentage >= 10) return "test10";
  if (percentage >= 5) return "test5";

  return "off";
}

/**
 * Main function
 */
function main() {
  // Get requested mode
  const requestedMode = process.argv[2];
  const currentMode = getCurrentMode();

  if (!requestedMode) {
    console.log(`Current repository pattern mode: ${currentMode}`);
    console.log("Available modes:");
    Object.keys(modes).forEach((mode) => {
      console.log(`  - ${mode}${mode === currentMode ? " (current)" : ""}`);
    });
    console.log("\nUsage: node scripts/repository-toggle.js [mode]");
    return;
  }

  // Validate mode
  if (!modes[requestedMode]) {
    console.error(
      `Error: Invalid mode "${requestedMode}". Available modes: ${Object.keys(
        modes
      ).join(", ")}`
    );
    process.exit(1);
  }

  // Update environment variables
  updateEnvFile(modes[requestedMode]);
  console.log(
    `Repository pattern mode changed from ${currentMode} to ${requestedMode}`
  );

  // Remind to restart the server
  console.log("\nIMPORTANT: Restart the server for changes to take effect.");
}

// Run main function
main();
