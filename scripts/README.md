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

## Processing Workflow

1. The CSV file is read and processed into a global JSON file
2. The global JSON is split into individual files based on question IDs
3. Metadata is added to each file using the canonical topic mapping
4. Files are named according to the year and question ID (e.g., `2025_5_1.json`)
5. A file index is created to catalog all generated files

## Recent Optimizations

The `process_survey_data.js` script has been optimized to include:

- Enhanced question ID detection with multiple pattern matching approaches
- Improved metadata structure that maintains consistency across files
- Better error handling with detailed logging for unmapped questions
- Performance optimizations for file generation and indexing
- Consolidated functionality for a streamlined workflow
