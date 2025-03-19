#!/usr/bin/env node
/**
 * add_to_vectorstore.js
 *
 * A utility script for adding files to the OpenAI Vector Store
 * This script uploads specified files to the vector store defined in .env
 *
 * Usage:
 *   node add_to_vectorstore.js --file=path/to/file.json [--file=path/to/another.json] [options]
 *   node add_to_vectorstore.js --dir=path/to/directory --pattern=*.json [options]
 *
 * Options:
 *   --file=<path>      Path to a specific file to upload (can be used multiple times)
 *   --dir=<path>       Directory containing files to upload
 *   --pattern=<glob>   File pattern to match when using --dir (e.g., *.json)
 *   --purpose=<str>    Purpose of the files (default: "assistants")
 *   --verbose          Show detailed output during processing
 *   --dryrun           Show which files would be uploaded without actually uploading
 *   --help, -h         Display help message
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const glob = require("glob");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Command line argument parsing
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value === undefined) {
      // Handle boolean flags
      acc[key] = true;
    } else {
      // If the key already exists, convert it to an array or add to existing array
      if (acc[key]) {
        if (Array.isArray(acc[key])) {
          acc[key].push(value);
        } else {
          acc[key] = [acc[key], value];
        }
      } else {
        acc[key] = value;
      }
    }
  } else if (arg === "-h") {
    acc.help = true;
  }
  return acc;
}, {});

// Display help message if requested
if (args.help || args.h) {
  console.log(`
Vector Store File Upload Utility
===============================

DESCRIPTION
  This script uploads files to the OpenAI Vector Store defined in your .env file.
  It supports uploading individual files or entire directories of files.

USAGE
  node add_to_vectorstore.js --file=path/to/file.json [--file=path/to/another.json] [options]
  node add_to_vectorstore.js --dir=path/to/directory --pattern=*.json [options]

OPTIONS
  --file=<path>      Path to a specific file to upload (can be used multiple times)
  --dir=<path>       Directory containing files to upload
  --pattern=<glob>   File pattern to match when using --dir (e.g., *.json)
  --purpose=<str>    Purpose of the files (default: "assistants")
  --verbose          Show detailed output during processing
  --dryrun           Show which files would be uploaded without actually uploading
  --help, -h         Display help message

EXAMPLES
  # Upload a single file
  node add_to_vectorstore.js --file=scripts/output/split_data/2025_1.json
  
  # Upload multiple specific files
  node add_to_vectorstore.js --file=scripts/output/split_data/2025_1.json --file=scripts/output/split_data/2025_2.json
  
  # Upload all 2025 JSON files from the split_data directory
  node add_to_vectorstore.js --dir=scripts/output/split_data --pattern=2025_*.json
  
  # Do a dry run to see which files would be uploaded
  node add_to_vectorstore.js --dir=scripts/output/split_data --pattern=2025_*.json --dryrun
  `);
  process.exit(0);
}

// Configuration
const config = {
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID,
  apiKey: process.env.OPENAI_API_KEY,
  purpose: args.purpose || "assistants",
  verbose: args.verbose || false,
  dryrun: args.dryrun || false,
};

// Validate configuration
if (!config.vectorStoreId) {
  console.error(
    "Error: Vector Store ID not found in .env file (OPENAI_VECTOR_STORE_ID)"
  );
  process.exit(1);
}

if (!config.apiKey) {
  console.error(
    "Error: OpenAI API key not found in .env file (OPENAI_API_KEY)"
  );
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.apiKey,
});

// Collect files to upload
let filesToUpload = [];

if (args.file) {
  // Handle single file or multiple files
  const files = Array.isArray(args.file) ? args.file : [args.file];

  files.forEach((file) => {
    const filePath = path.resolve(file);
    if (fs.existsSync(filePath)) {
      filesToUpload.push(filePath);
    } else {
      console.warn(`Warning: File not found: ${filePath}`);
    }
  });
}

if (args.dir) {
  const directory = path.resolve(args.dir);

  if (!fs.existsSync(directory)) {
    console.error(`Error: Directory not found: ${directory}`);
    process.exit(1);
  }

  if (!args.pattern) {
    console.error("Error: When using --dir, you must also specify --pattern");
    process.exit(1);
  }

  // Find files matching the pattern
  const matchingFiles = glob.sync(path.join(directory, args.pattern));

  if (matchingFiles.length === 0) {
    console.warn(
      `Warning: No files matched pattern '${args.pattern}' in directory: ${directory}`
    );
  } else {
    filesToUpload = [...filesToUpload, ...matchingFiles];
  }
}

if (filesToUpload.length === 0) {
  console.error(
    "Error: No files to upload. Use --file or --dir with --pattern to specify files."
  );
  process.exit(1);
}

// Log the files to be uploaded
console.log(
  `\nFound ${filesToUpload.length} files to upload to Vector Store: ${config.vectorStoreId}`
);
if (config.verbose || config.dryrun) {
  console.log("\nFiles:");
  filesToUpload.forEach((file) => {
    console.log(
      `  - ${file} (${(fs.statSync(file).size / 1024).toFixed(2)} KB)`
    );
  });
}

// Get OpenAI's supported file types for assistants purpose
const SUPPORTED_EXTENSIONS = [
  ".c",
  ".cpp",
  ".csv",
  ".docx",
  ".html",
  ".java",
  ".json",
  ".md",
  ".pdf",
  ".php",
  ".pptx",
  ".py",
  ".rb",
  ".tex",
  ".txt",
  ".css",
  ".jpeg",
  ".jpg",
  ".js",
  ".gif",
  ".png",
];

// Filter files by supported extensions
const unsupportedFiles = filesToUpload.filter((file) => {
  const ext = path.extname(file).toLowerCase();
  return !SUPPORTED_EXTENSIONS.includes(ext);
});

if (unsupportedFiles.length > 0) {
  console.warn(
    "\nWarning: Some files have unsupported extensions and may not be processed correctly:"
  );
  unsupportedFiles.forEach((file) => {
    console.warn(`  - ${file}`);
  });
  console.warn("\nSupported extensions:", SUPPORTED_EXTENSIONS.join(", "));
}

// Early exit for dry run
if (config.dryrun) {
  console.log(
    "\nDRY RUN: No files were uploaded. Remove --dryrun to perform the actual upload."
  );
  process.exit(0);
}

// Upload files
async function uploadFiles() {
  console.log("\nUploading files to Vector Store...");

  const results = {
    success: [],
    failed: [],
  };

  for (const [index, filePath] of filesToUpload.entries()) {
    try {
      console.log(
        `\n[${index + 1}/${filesToUpload.length}] Uploading: ${filePath}...`
      );

      const fileStats = fs.statSync(filePath);
      const fileSize = (fileStats.size / 1024).toFixed(2);

      // Prepare file for upload
      const file = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: config.purpose,
      });

      // Add file to the vector store
      await openai.beta.vectorStores.addFile(config.vectorStoreId, {
        file_id: file.id,
      });

      results.success.push({
        path: filePath,
        id: file.id,
        size: fileSize,
      });

      console.log(
        `  ✅ Successfully uploaded (${fileSize} KB) - File ID: ${file.id}`
      );
    } catch (error) {
      console.error(`  ❌ Failed to upload ${filePath}: ${error.message}`);
      if (config.verbose && error.response) {
        console.error(
          "  Error details:",
          JSON.stringify(error.response.data, null, 2)
        );
      }

      results.failed.push({
        path: filePath,
        error: error.message,
      });
    }
  }

  // Summary
  console.log("\n======= UPLOAD SUMMARY =======");
  console.log(`Total files processed: ${filesToUpload.length}`);
  console.log(`Successfully uploaded: ${results.success.length}`);
  console.log(`Failed uploads: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log("\nFailed files:");
    results.failed.forEach((file) => {
      console.log(`  - ${file.path}`);
      console.log(`    Error: ${file.error}`);
    });
  }

  return results;
}

// Main function
async function main() {
  try {
    const results = await uploadFiles();

    if (results.success.length > 0) {
      console.log(
        "\nSuccessfully uploaded files are now being processed by OpenAI."
      );
      console.log(
        "The files will be available in the vector store once processing is complete."
      );
    }

    process.exit(results.failed.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("\nAn unexpected error occurred:", error.message);
    process.exit(1);
  }
}

// Run the main function
main();
