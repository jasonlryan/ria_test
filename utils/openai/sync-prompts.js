/**
 * Prompt Synchronization Utility
 * Ensures all prompt files across the codebase are synchronized with the master versions.
 *
 * Usage:
 * - node utils/openai/sync-prompts.js [--check]
 * - Add --check flag to only verify without making changes
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Configuration for prompt files to sync
const PROMPT_FILES = [
  { name: "1_data_retrieval.md" },
  // Add other prompt files as needed
];

// Command line args
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");

/**
 * Calculate MD5 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {string} MD5 hash
 */
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("md5").update(content).digest("hex");
  } catch (error) {
    return null;
  }
}

/**
 * Synchronize a single prompt file to all target locations
 * @param {string} fileName - Name of the prompt file
 * @returns {boolean} Success status
 */
function syncPromptFile(fileName) {
  const sourcePath = path.join(process.cwd(), "utils", "openai", fileName);
  const targetPaths = [
    path.join(process.cwd(), "public", "prompts", fileName),
    path.join(process.cwd(), "public", "prompt_files", fileName),
  ];

  // Ensure source exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source file not found: ${sourcePath}`);
    return false;
  }

  // Get source content and hash
  const sourceContent = fs.readFileSync(sourcePath, "utf8");
  const sourceHash = crypto
    .createHash("md5")
    .update(sourceContent)
    .digest("hex");

  let allSynced = true;
  let changes = 0;

  // Check each target
  for (const targetPath of targetPaths) {
    const targetDir = path.dirname(targetPath);

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      if (!checkOnly) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`📁 Created directory: ${targetDir}`);
      }
    }

    const targetExists = fs.existsSync(targetPath);
    const targetHash = targetExists ? getFileHash(targetPath) : null;

    if (!targetExists) {
      console.log(`❗ Target file missing: ${targetPath}`);
      if (!checkOnly) {
        fs.writeFileSync(targetPath, sourceContent, "utf8");
        console.log(`✅ Created: ${targetPath}`);
        changes++;
      } else {
        console.log(`   Would create: ${targetPath}`);
        allSynced = false;
      }
    } else if (targetHash !== sourceHash) {
      console.log(`❗ Files differ: ${targetPath}`);
      if (!checkOnly) {
        fs.writeFileSync(targetPath, sourceContent, "utf8");
        console.log(`✅ Updated: ${targetPath}`);
        changes++;
      } else {
        console.log(`   Would update: ${targetPath}`);
        allSynced = false;
      }
    } else {
      console.log(`✓ Already in sync: ${targetPath}`);
    }
  }

  return checkOnly
    ? allSynced
    : changes === 0 || changes === targetPaths.length;
}

/**
 * Main function to synchronize all prompt files
 */
function syncAllPrompts() {
  console.log(
    `🔄 ${checkOnly ? "Checking" : "Synchronizing"} prompt files...\n`
  );

  let allSucceeded = true;
  let filesInSync = 0;

  for (const promptFile of PROMPT_FILES) {
    console.log(`\n📄 Processing: ${promptFile.name}`);
    const result = syncPromptFile(promptFile.name);
    if (result) {
      filesInSync++;
    } else {
      allSucceeded = false;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total files: ${PROMPT_FILES.length}`);
  console.log(`Files in sync: ${filesInSync}`);

  if (checkOnly) {
    console.log(
      `\n${
        allSucceeded ? "✅ All files in sync!" : "❌ Some files need updating!"
      }`
    );
    process.exit(allSucceeded ? 0 : 1);
  } else {
    console.log(
      `\n${
        allSucceeded
          ? "✅ Sync completed successfully!"
          : "⚠️ Some files may not have been synced properly."
      }`
    );
  }
}

// Run the sync process
syncAllPrompts();
