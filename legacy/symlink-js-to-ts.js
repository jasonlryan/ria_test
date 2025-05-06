/**
 * Symlink Helper Script
 *
 * This script creates symbolic links for TypeScript files to make
 * them compatible with JavaScript imports that don't specify extensions.
 *
 * It's particularly useful when migrating individual files from JS to TS
 * while maintaining compatibility with existing imports.
 */

const fs = require("fs");
const path = require("path");

// Files to symlink
const filesToSymlink = ["utils/shared/errorHandler.ts", "utils/shared/cors.ts"];

console.log("Creating symbolic links for JS compatibility...");

filesToSymlink.forEach((tsFile) => {
  const jsFile = tsFile.replace(".ts", ".js");

  try {
    if (fs.existsSync(jsFile)) {
      console.log(`Skipping ${jsFile}: file already exists`);
      return;
    }

    // Create a symlink to allow importing without extension
    fs.symlinkSync(path.basename(tsFile), jsFile, "file");
    console.log(`Created symlink: ${jsFile} -> ${tsFile}`);
  } catch (error) {
    console.error(`Error creating symlink for ${jsFile}:`, error.message);
  }
});

console.log("Symlink creation complete.");
