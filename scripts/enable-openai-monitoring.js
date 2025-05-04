/**
 * Script to enable OpenAI feature flags for monitoring
 *
 * This script modifies the feature flags directly to enable OpenAI monitoring
 * without needing to edit .env files
 */

const fs = require("fs");
const path = require("path");

// Set environment variables for OpenAI monitoring
process.env.USE_RESPONSES_API = "true";
process.env.UNIFIED_OPENAI_SERVICE = "true";
process.env.MONITOR_MIGRATION = "true";

console.log("Feature flags set in environment:");
console.log("- USE_RESPONSES_API=true");
console.log("- UNIFIED_OPENAI_SERVICE=true");
console.log("- MONITOR_MIGRATION=true");
console.log("\nTo make these changes permanent, add them to your .env file:");
console.log(`
USE_RESPONSES_API=true
UNIFIED_OPENAI_SERVICE=true
MONITOR_MIGRATION=true
`);

// Create a .env.local file for Next.js to pick up the environment variables on restart
try {
  const envLocalPath = path.join(process.cwd(), ".env.local");
  console.log(`\nCreating .env.local file at ${envLocalPath}`);

  // Read existing .env.local if it exists
  let envContent = "";
  try {
    if (fs.existsSync(envLocalPath)) {
      envContent = fs.readFileSync(envLocalPath, "utf8");
    }
  } catch (err) {
    console.log("No existing .env.local file found, creating new one.");
  }

  // Add or update feature flag variables
  const flags = {
    USE_RESPONSES_API: "true",
    UNIFIED_OPENAI_SERVICE: "true",
    MONITOR_MIGRATION: "true",
  };

  Object.entries(flags).forEach(([key, value]) => {
    // Check if variable already exists in the file
    const regex = new RegExp(`^${key}=.*`, "m");
    if (regex.test(envContent)) {
      // Update existing variable
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new variable
      envContent += `\n${key}=${value}`;
    }
  });

  // Write updated content back to file
  fs.writeFileSync(envLocalPath, envContent.trim());
  console.log("Successfully updated .env.local file with feature flags");
  console.log(
    "\nFeature flags have been updated. You need to restart the application for changes to take effect."
  );
  console.log(
    "Once restarted, you can see OpenAI monitoring data in the dashboard at /admin/monitoring?tab=openai"
  );
} catch (err) {
  console.error("Error updating .env.local file:", err);
  console.log(
    "Please manually add the feature flags to your .env or .env.local file."
  );
}
