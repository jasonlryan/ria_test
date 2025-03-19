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
 *   node add_to_vectorstore.js --config=path/to/config.json [options]
 *
 * Options:
 *   --file=<path>      Path to a specific file to upload (can be used multiple times)
 *   --dir=<path>       Directory containing files to upload
 *   --pattern=<glob>   File pattern to match when using --dir (e.g., *.json)
 *   --config=<path>    Path to a configuration file (default: scripts/vectorstore-config.json)
 *   --purpose=<str>    Purpose of the files (default: "assistants")
 *   --verbose          Show detailed output during processing
 *   --dryrun           Show which files would be uploaded without actually uploading
 *   --replace          Replace files if they already exist in the vector store
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
  node add_to_vectorstore.js --config=path/to/config.json [options]

OPTIONS
  --file=<path>      Path to a specific file to upload (can be used multiple times)
  --dir=<path>       Directory containing files to upload
  --pattern=<glob>   File pattern to match when using --dir (e.g., *.json)
  --config=<path>    Path to a configuration file (default: scripts/vectorstore-config.json)
  --purpose=<str>    Purpose of the files (default: "assistants")
  --verbose          Show detailed output during processing
  --dryrun           Show which files would be uploaded without actually uploading
  --replace          Replace files if they already exist in the vector store
  --help, -h         Display help message

EXAMPLES
  # Upload a single file
  node add_to_vectorstore.js --file=scripts/output/split_data/2025_1.json
  
  # Upload multiple specific files
  node add_to_vectorstore.js --file=scripts/output/split_data/2025_1.json --file=scripts/output/split_data/2025_2.json
  
  # Upload all 2025 JSON files from the split_data directory
  node add_to_vectorstore.js --dir=scripts/output/split_data --pattern=2025_*.json
  
  # Use a configuration file
  node add_to_vectorstore.js --config=scripts/vectorstore-config.json
  
  # Do a dry run to see which files would be uploaded
  node add_to_vectorstore.js --config=scripts/vectorstore-config.json --dryrun
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
  replace: args.replace || false,
  indexFile: path.join(__dirname, "vectorstore-index.json"),
};

// Override config with options from config file if provided
if (args.config) {
  try {
    const configPath = path.resolve(args.config);
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log(`Loaded configuration from ${configPath}`);

      // Apply options from config file
      if (configData.options) {
        if (configData.options.replaceExisting) {
          config.replace = true;
        }
        if (configData.options.trackUploads) {
          config.trackUploads = true;
        }
      }
    } else {
      console.warn(`Warning: Config file not found: ${configPath}`);
    }
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
  }
}

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

// Load or create the file tracking index if needed
let fileIndex = {};
if (config.trackUploads) {
  try {
    if (fs.existsSync(config.indexFile)) {
      fileIndex = JSON.parse(fs.readFileSync(config.indexFile, "utf8"));
      if (config.verbose) {
        console.log(
          `Loaded index with ${Object.keys(fileIndex).length} tracked files`
        );
      }
    }
  } catch (error) {
    console.error(`Error loading index file: ${error.message}`);
    console.log("Creating a new index file");
    fileIndex = {};
  }
}

// Collect files to upload
let filesToUpload = [];

// Process configuration file if provided
if (args.config) {
  try {
    const configPath = path.resolve(args.config);
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

      if (
        configData.fileCollections &&
        Array.isArray(configData.fileCollections)
      ) {
        for (const collection of configData.fileCollections) {
          if (collection.files) {
            // Handle explicit file list
            const files = Array.isArray(collection.files)
              ? collection.files
              : [collection.files];
            files.forEach((file) => {
              const filePath = path.resolve(path.join(__dirname, file));
              if (fs.existsSync(filePath)) {
                filesToUpload.push(filePath);
              } else {
                console.warn(`Warning: File not found: ${filePath}`);
              }
            });
          }

          if (collection.pattern) {
            // Handle glob patterns
            const pattern = collection.pattern;
            const matchingFiles = glob.sync(path.join(__dirname, pattern));

            if (matchingFiles.length === 0) {
              console.warn(
                `Warning: No files matched pattern '${pattern}' in collection: ${collection.name}`
              );
            } else {
              filesToUpload = [...filesToUpload, ...matchingFiles];
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error processing config file: ${error.message}`);
  }
}

// Process command line arguments for files
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

// Deduplicate files
filesToUpload = [...new Set(filesToUpload)];

if (filesToUpload.length === 0) {
  console.error(
    "Error: No files to upload. Use --file, --dir with --pattern, or --config to specify files."
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

// Calculate file hash for change detection
function getFileHash(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return `${stats.size}_${stats.mtimeMs}`;
  } catch (error) {
    console.error(`Error getting file hash for ${filePath}: ${error.message}`);
    return null;
  }
}

// Get all files from the Vector Store
async function getVectorStoreFiles() {
  try {
    console.log("Fetching current files from Vector Store...");
    const files = await openai.beta.vectorStores.files.list(
      config.vectorStoreId
    );
    console.log(`Found ${files.data.length} existing files in Vector Store`);
    return files.data;
  } catch (error) {
    console.error(`Error fetching Vector Store files: ${error.message}`);
    return [];
  }
}

// Delete a file from the Vector Store
async function deleteFileFromVectorStore(fileId) {
  try {
    console.log(`Deleting file ID: ${fileId} from Vector Store...`);
    await openai.beta.vectorStores.files.delete(config.vectorStoreId, fileId);
    console.log(`Successfully deleted file ID: ${fileId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting file ID ${fileId}: ${error.message}`);
    return false;
  }
}

// Upload files with duplicate checking
async function uploadFiles() {
  console.log("\nUploading files to Vector Store...");

  let vectorStoreFiles = [];
  if (config.replace) {
    vectorStoreFiles = await getVectorStoreFiles();
  }

  const results = {
    success: [],
    failed: [],
    skipped: [],
  };

  for (const [index, filePath] of filesToUpload.entries()) {
    try {
      console.log(
        `\n[${index + 1}/${filesToUpload.length}] Processing: ${filePath}...`
      );

      const fileStats = fs.statSync(filePath);
      const fileSize = (fileStats.size / 1024).toFixed(2);
      const relativePath = path.relative(process.cwd(), filePath);

      // Check if file needs to be replaced
      const existingFileInfo = fileIndex[filePath];
      let shouldUpload = true;

      if (config.replace && existingFileInfo && existingFileInfo.id) {
        console.log(
          `File ${relativePath} already exists in Vector Store with ID: ${existingFileInfo.id}`
        );
        console.log(`Removing existing file before uploading new version...`);

        // Delete the existing file
        const deleteResult = await deleteFileFromVectorStore(
          existingFileInfo.id
        );
        if (!deleteResult) {
          console.warn(
            `Warning: Could not delete existing file, continuing with upload anyway`
          );
        }
      }

      if (shouldUpload) {
        // Prepare file for upload
        const file = await openai.files.create({
          file: fs.createReadStream(filePath),
          purpose: config.purpose,
        });

        // Add file to the vector store
        await openai.beta.vectorStores.addFile(config.vectorStoreId, {
          file_id: file.id,
        });

        // Update tracking index if enabled
        if (config.trackUploads) {
          fileIndex[filePath] = {
            id: file.id,
            hash: getFileHash(filePath),
            lastUpdated: new Date().toISOString(),
          };
        }

        results.success.push({
          path: filePath,
          id: file.id,
          size: fileSize,
        });

        console.log(
          `  ✅ Successfully uploaded (${fileSize} KB) - File ID: ${file.id}`
        );
      } else {
        results.skipped.push({
          path: filePath,
          reason: "Already up to date",
        });

        console.log(`  ⏭️ Skipped: Already up to date`);
      }
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

  // Save the index file if tracking is enabled
  if (config.trackUploads && results.success.length > 0) {
    try {
      fs.writeFileSync(config.indexFile, JSON.stringify(fileIndex, null, 2));
      console.log(`\nUpdated file tracking index: ${config.indexFile}`);
    } catch (error) {
      console.error(`Error saving index file: ${error.message}`);
    }
  }

  // Summary
  console.log("\n======= UPLOAD SUMMARY =======");
  console.log(`Total files processed: ${filesToUpload.length}`);
  console.log(`Successfully uploaded: ${results.success.length}`);
  console.log(`Files skipped: ${results.skipped.length}`);
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
