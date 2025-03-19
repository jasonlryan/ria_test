# RIA25 Scripts - Survey Data Processing

## Overview

This directory contains scripts for processing survey data for the RIA25 project. The scripts handle the transformation of raw CSV data from different survey years into standardized JSON formats and individual question files for the web application.

## Streamlined Processing Pipeline

The processing pipeline has been streamlined to the following essential scripts:

### Core Scripts

1. **`process_survey_data.js`**

   - Main orchestrator script that handles the complete workflow
   - Converts CSV input to a global JSON format
   - Splits the global data into individual question files with metadata
   - Works with both 2024 and 2025 data with proper parameters

2. **`process_2025_data.js`**

   - Prepares 2025 data specifically (only needed for 2025 data)
   - Harmonizes the 2025 consolidated CSV format with the 2024 format
   - Converts percentage strings to decimal values
   - Standardizes column names across both datasets
   - Creates mapping documentation

3. **`update_canonical_mapping.js`**

   - Updates the canonical topic mapping used for organizing files
   - Helps maintain consistent file naming and categorization

4. **`split_to_files.js`**
   - Contains functionality used by process_survey_data.js
   - Splits global JSON data into individual question files

### Directory Structure

- **`data/`** - Contains input CSV and intermediate JSON files

  - `2024/` - 2024 survey data files
    - `2024_global_data.csv` - Standardized input CSV
  - `2025/` - 2025 survey data files
    - `2025_global_data.csv` - Standardized input CSV

- **`output/`** - Contains processed output files

  - `global_2024_data.json` - Processed global JSON for 2024 data
  - `global_2025_data.json` - Processed global JSON for 2025 data
  - `split_data/` - Individual question files with metadata

- **`reference files/`** - Contains reference data and mappings

- **`legacy/`** - Contains deprecated scripts that are no longer part of the main pipeline

## Usage Instructions

### Processing 2025 Data

1. First, prepare the 2025 data with the harmonization script:

   ```bash
   node process_2025_data.js
   ```

   This creates a standardized 2025_global_data.csv in the data/2025 directory.

2. Process the harmonized 2025 data:
   ```bash
   node process_survey_data.js --year=2025 --output=scripts/output
   ```

### Processing 2024 Data

1. Process the 2024 data directly:
   ```bash
   node process_survey_data.js --year=2024 --output=scripts/output
   ```

### Updating Canonical Mappings

If you need to update topic mappings:

```bash
node update_canonical_mapping.js
```

## Notes

- All redundant or single-purpose scripts have been moved to the `legacy/` directory
- The current pipeline represents a streamlined approach focused on maintainability
- Core scripts do not reference any of the legacy scripts
