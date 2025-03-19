# Survey Data Processing Scripts

This directory contains scripts for processing survey data from CSV files into individual JSON files with appropriate metadata.

## Main Script: `process_survey_data.js`

This is the **primary script** for all survey data processing. It handles the complete workflow:

1. Reading CSV data
2. Converting to a global JSON file
3. Splitting the global JSON into individual files with proper metadata
4. Creating a file index

### Usage

```bash
# Process 2025 data with default settings
node process_survey_data.js --year=2025 --verbose

# Process 2024 data
node process_survey_data.js --year=2024 --verbose

# Process with custom input file
node process_survey_data.js --year=2025 --input=./custom/input.csv

# Skip certain steps
node process_survey_data.js --year=2024 --skip-global
```

### Command Line Options

| Option          | Description                                  |
| --------------- | -------------------------------------------- |
| `--year=YYYY`   | Survey year to process (2024, 2025)          |
| `--input=path`  | Path to the input CSV file                   |
| `--output=path` | Output directory for all generated files     |
| `--skip-global` | Skip generating the global JSON file         |
| `--skip-split`  | Skip splitting into individual files         |
| `--force`       | Override existing files without confirmation |
| `--verbose`     | Show detailed output during processing       |
| `--help`, `-h`  | Display help message                         |

## Vector Store Integration: `add_to_vectorstore.js`

This script enables uploading processed JSON files to the OpenAI Vector Store, allowing the data to be used with OpenAI Assistants.

### Features

- Upload individual files or entire directories of files
- Smart file replacement to update changed files
- File tracking to manage what's in the vector store
- Configurable through a JSON configuration file
- Built-in duplicate detection and cleanup

### Usage

```bash
# Use the configuration file to upload all configured files
node add_to_vectorstore.js --config=vectorstore-config.json

# Do a dry run first to see what would be uploaded
node add_to_vectorstore.js --config=vectorstore-config.json --dryrun

# Upload with detailed output
node add_to_vectorstore.js --config=vectorstore-config.json --verbose

# Upload specific files
node add_to_vectorstore.js --file=output/split_data/2025_1.json

# Upload files matching a pattern in a directory
node add_to_vectorstore.js --dir=output/split_data --pattern=2025_*.json
```

### Command Line Options

| Option           | Description                                  |
| ---------------- | -------------------------------------------- |
| `--config=path`  | Path to a configuration file                 |
| `--file=path`    | Path to a specific file to upload            |
| `--dir=path`     | Directory containing files to upload         |
| `--pattern=glob` | File pattern to match when using --dir       |
| `--purpose=str`  | Purpose of the files (default: "assistants") |
| `--replace`      | Replace files if they already exist          |
| `--verbose`      | Show detailed output during processing       |
| `--dryrun`       | Preview without uploading                    |
| `--help`, `-h`   | Display help message                         |

### Vector Store Configuration

The `vectorstore-config.json` file defines which files should be uploaded to the vector store. Example:

```json
{
  "fileCollections": [
    {
      "name": "Canonical Mapping",
      "files": ["reference files/canonical_topic_mapping.json"]
    },
    {
      "name": "2024 Split Files",
      "pattern": "output/split_data/2024_*.json"
    },
    {
      "name": "2025 Split Files",
      "pattern": "output/split_data/2025_*.json"
    }
  ],
  "options": {
    "replaceExisting": true,
    "trackUploads": true
  }
}
```

## Legacy Scripts

Older scripts that are no longer part of the main workflow have been moved to the `legacy/` directory to keep the main directory clean and focused.

### `legacy/split_to_files.js`

> ⚠️ **DEPRECATED**: This script has been replaced by `process_survey_data.js`

`split_to_files.js` was previously used for splitting global JSON data into individual files. It has been deprecated in favor of the more comprehensive `process_survey_data.js`. The script now serves as a wrapper that redirects to the new script with appropriate warnings.

If you need to run the legacy script for compatibility reasons, you can use the `--force` flag:

```bash
node legacy/split_to_files.js --force
```

However, this is not recommended as it will not provide the enhanced question identification and metadata handling available in the primary script.

## Directory Structure

- `data/` - Contains input CSV files by year
- `output/` - Contains processed JSON files
  - `global_YYYY_data.json` - Consolidated global JSON data
  - `split_data/` - Individual question files with metadata
  - `split_data/YYYY_file_index.json` - Index of all generated files
- `reference files/` - Contains mapping files for question identification
  - `canonical_topic_mapping.json` - Maps questions to topics and themes
- `legacy/` - Contains deprecated scripts that are no longer part of the main workflow
- `vectorstore-config.json` - Configuration file for vector store uploads
- `vectorstore-index.json` - Tracking file for uploaded vector store files

## Processing Workflow

1. The CSV file is read and processed into a global JSON file
2. The global JSON is split into individual files based on question IDs
3. Metadata is added to each file using the canonical topic mapping
4. Files are named according to the year and question ID (e.g., `2025_5_1.json`)
5. A file index is created to catalog all generated files
6. (Optional) Files are uploaded to the OpenAI Vector Store for use with Assistants

## Recent Optimizations

The `process_survey_data.js` script has been optimized to include:

- Enhanced question ID detection with multiple pattern matching approaches
- Improved metadata structure that maintains consistency across files
- Better error handling with detailed logging for unmapped questions
- Performance optimizations for file generation and indexing
- Consolidated functionality for a streamlined workflow

The new `add_to_vectorstore.js` script adds the ability to upload processed files to OpenAI's Vector Store, enabling integration with AI assistants that can access and query the survey data.
