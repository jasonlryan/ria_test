# 2025 Survey Data Processing Guide

## Overview

The 2025 survey data is delivered as individual question CSV files (e.g., `q1_global.csv`, `q2_global.csv`, etc.) rather than a single consolidated file like in 2024. This guide explains how to process these files into a format compatible with the main RIA25 processing script.

**Primary Purpose**: The main purpose of this directory is to create the consolidated `2025_global_data.csv` file that contains all survey question data in a standardized format.

## File Structure

### Input Files

- **Standard Question Files**: CSV files for each question (e.g., `q1_global.csv` through `q17_global.csv`)
- **Special Cases**:
  - `q4a_global.csv` and `q4b_global.csv` for question 4 with two parts
  - `q10_global.csv` and `q10b_global.csv` for question 10 with two parts

### Processing Scripts

- **generate_consolidated_csv.js**: The consolidated script that processes all question files, including special cases, and outputs `2025_global_data.csv`
- **process_2025_data.js**: Script that harmonizes the 2025 data format with the 2024 format, implementing a "best of both worlds" approach (located in main `scripts` directory)

### Legacy Scripts (Redundant - Can be removed)

- ~~**process_all_questions.js**~~: Original script to combine all question files into one CSV (superseded by the consolidated script)
- ~~**fix_q10.js**~~: Special script to handle Q10 data (integrated into the consolidated script)
- ~~**process_single_question.js**~~: Appears to be unused
- ~~**question_mapping_script.js**~~: Appears to be redundant with process_all_questions.js

### Output Files

- **2025_global_data.csv**: The main consolidated output with all questions including special cases (previously named `all_questions_mapped.csv` or `all_questions_mapped_consolidated.csv`)
- **data_mapping_documentation.md**: Generated documentation that explains the data harmonization approach and column mappings

## Streamlined Processing Workflow

1. **Run the Consolidated Processing Script**:

   - Use `generate_consolidated_csv.js` to process all files including special cases
   - This produces `2025_global_data.csv` with all questions correctly formatted

2. **Harmonize Data Formats**:
   - Use `process_2025_data.js` to implement the "best of both worlds" approach
   - Preserves detailed question text from 2025 while using the decimal format from 2024
   - Standardizes column names for consistent analysis
   - This enables seamless processing with the existing RIA25 processing script

## Step-by-Step Instructions

### 1. Process All Questions with the Consolidated Script

```bash
node generate_consolidated_csv.js
```

This script:

- Collects all standard question CSV files
- Processes special cases for Q4 and Q10 automatically
- Formats all data into a standardized CSV structure
- Outputs a single consolidated file named `2025_global_data.csv`

### 2. Harmonize Data Formats

```bash
node ../scripts/process_2025_data.js
```

This script:

- Reads the consolidated CSV from the 2025_DATA directory
- Converts percentage values to decimals (e.g., "75%" → 0.75)
- Standardizes column names across both 2024 and 2025 datasets
- Preserves the detailed question text from 2025
- Organizes questions by section for better categorization
- Creates a mapping documentation file explaining all transformations
- Outputs a file that can be processed with `process_survey_data.js`

### 3. Process with the Main RIA25 Script

```bash
node ../scripts/process_survey_data.js --input="data/2025/Global- Table 1.csv" --year=2025 --output=scripts/output
```

## Column Mapping

The processing scripts map data from the original CSV format to a standardized structure with these breakdowns:

- **Countries**: US, United Kingdom, India, France, Germany, Japan, UAE, Brazil, Saudi Arabia, Australia
- **Age Groups**: 18-24, 25-34, 35-44, 45-54, 55-65, 65+
- **Generations**: Gen Z, Millennials, Gen X, Baby Boomers
- **Gender**: Female, Male
- **Organization Size**: <10, 10-49, 50-99, 100-500, 501-1000, 1000+
- **Employment Status**: Full Time, Part Time, Contract, Freelance
- **Sectors**: Automotive, Technology, Education, etc.
- **Job Levels**: CEO, Senior Executive, etc.
- **Marital Status**: Single, Co-habiting, Married, etc.
- **Education**: Secondary, Tertiary, Professional, etc.

A detailed mapping reference is available in the generated `data_mapping_documentation.md` file.

## Understanding the CSV Format

### Individual Question CSV Structure

- **Row 1**: Contains the question text
- **Row 2**: Contains sub-question text (for special cases like Q4, Q10)
- **Row 16+**: Contains data rows with responses and demographic breakdowns

### Consolidated CSV Structure

- Each row represents a question-response pair with demographic breakdowns
- Standardized column names with prefixes (e.g., "country*", "age*")
- Special cases like Q10 have their sub-questions properly formatted

### Harmonized Output Format

- Maintains detailed question text from 2025 (e.g., "Q1 - If you were to look for a new job...")
- Uses decimal values for all percentages (e.g., 0.75 instead of "75%")
- Standardizes column names to be consistent across both years
- Organizes questions by section for better categorization and analysis

## Special Case Handling

The consolidated script handles the following special cases automatically:

1. **Q4** with two parts:

   - Both `q4a_global.csv` and `q4b_global.csv` are processed
   - Sub-questions are preserved in the Response column

2. **Q10** with two parts:
   - Both `q10_global.csv` and `q10b_global.csv` are processed
   - Each sub-question's responses are properly formatted
   - The data is inserted in the correct order between Q9 and Q11

## Files that Can be Removed

The following files are now redundant and can be removed:

1. **process_all_questions.js**: Functionality is included in the consolidated script
2. **fix_q10.js**: Q10 handling is integrated into the consolidated script
3. **process_single_question.js**: Not used in the workflow
4. **question_mapping_script.js**: Redundant functionality
5. **all_questions_mapped.csv**: Replaced by 2025_global_data.csv
6. **all_questions_mapped_fixed.csv**: No longer needed with the consolidated approach
7. **process_2025_data_consolidated.js**: Renamed to generate_consolidated_csv.js

You can run the `cleanup.js` script to safely remove these redundant files:

```bash
node cleanup.js
```

The script will only remove files if the consolidated output file (2025_global_data.csv) already exists.

## Troubleshooting

- **Missing Data**: If demographic breakdowns are missing, check that the column mappings in the consolidated script match the actual CSV layout
- **Format Issues**: If the output doesn't match the expected format, check the sort order and special case handling in the consolidated script

## Next Steps

After preparing the consolidated CSV file:

1. Use `process_2025_data.js` to harmonize the file format with the 2024 data
2. Review the generated mapping documentation to understand the transformations
3. Process the data with `process_survey_data.js` as usual
