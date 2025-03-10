# Data Processing Scripts

This directory contains scripts for processing survey data in different formats and configurations.

## Structure

```
scripts/
├── data/              # Source data files (CSV format)
├── output/           # Generated JSON output files
├── index.js          # Default data processor
├── index-country.js  # Country-specific processing
├── index-all.js      # Process all data
├── index-global.js   # Global data processing
└── README.md         # This file
```

## Running Scripts

Available scripts:

```bash
# Process data with default configuration
npm run scripts:dev

# Process country-specific data
npm run scripts:country

# Process all data
npm run scripts:all

# Process global data
npm run scripts:global

# Generate country-specific JSON
npm run scripts:country-json
```

## Data Flow

1. Source data is read from the `data/` directory
2. Scripts process the data according to their specific requirements
3. Results are saved to the `output/` directory in JSON format

## Input Data

Source files are stored in the `data/` directory:

- CSV files containing survey responses
- Each file should follow the standard survey data format

## Output Files

Results are saved in the `output/` directory:

- Format: JSON
- Files are organized by processing type (country, global, etc.)
- Each output preserves the relationship to its source data

## Environment Variables

Scripts use these environment variables from the root `.env` file:

- `OPENAI_API_KEY` - Required for OpenAI API access (if using AI processing)
