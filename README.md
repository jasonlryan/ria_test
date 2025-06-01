<h1 align="center" style="font-weight: bold">
  Workforce 2025 RIA Survey Tool
  <br>
    <h3 align="center">An interactive assistant for exploring and analyzing the 2025 Workforce Survey data.</h3>
  <br>
</h1>

**Workforce 2025 RIA Survey Tool** provides a user-friendly interface to interact with and gain insights from the 2025 Workforce Survey data, with comparative data from 2024.

## About This Project

This application is designed to:

- Allow users to ask natural language questions about the survey data.
- Provide analysis based on different demographic segments and responses.
- Offer different operational modes for data handling, suitable for development and production.

### Stack

- Next.js
- OpenAI
- Tailwind

_(Please verify if this stack is accurate for the RIA Survey Tool)_

### Run the project locally

Minimum requirements to run the projects locally:

- Node.js v18
- OpenAI API Key

```shell
npm install
npm run build
npm run dev
# visit http://localhost:3000
```

---

## Workforce 2025 RIA Survey Tool Details

Interactive assistant for exploring the 2025 Workforce Survey data.

_Updated: April 7, 2024 - Latest deployment with streaming improvements_
_(Note: This timestamp should be updated as per the "Documentation Timestamp Standard")_

### Operation Modes

The application can run in two different modes for handling survey data:

#### 1. Standard Mode (`npm run dev`)

- Uses `FILE_ACCESS_MODE=standard`
- Data is sent along with each request to the assistant
- Better for testing and development
- Requires more bandwidth due to data transfer

#### 2. Light Mode (`npm run dev:light`)

- Uses `FILE_ACCESS_MODE=direct`
- Assistant retrieves data directly from files
- More efficient for production use
- Requires proper data file setup in `scripts/data/` directory

### Data File Requirements

For the assistant to work properly, ensure these files are present:

- `scripts/data/2024/2024_global_data.csv`
- `scripts/data/2025/2025_global_data.csv`

---

## Data Processing Scripts 📊

The project includes scripts for processing survey data located in the `scripts/` directory:

### Data Processing Workflow

1. **Initial Setup**

   - Place 2024 data in `scripts/data/2024/2024_global_data.csv`
   - Place 2025 data in `scripts/data/2025/2025_global_data.csv`

2. **Processing Script**
   `process_survey_data.js` handles data transformation:

   - Converts CSV to JSON format
   - Harmonizes data between years
   - Splits into individual question files
   - Adds metadata and categorization

3. **Running the Processing**

   ```bash
   # Process 2024 data
   node process_survey_data.js --year=2024

   # Process 2025 data
   node process_survey_data.js --year=2025
   ```

### Directory Structure

```
scripts/
├── data/                           # Survey data files
│   ├── 2024/                      # 2024 survey data
│   │   └── 2024_global_data.csv   # Global dataset for 2024
│   └── 2025/                      # 2025 survey data
│       └── 2025_global_data.csv   # Global dataset for 2025
└── output/                         # Generated JSON files
    └── split_data/                # Individual question files
```

---

_This README was last updated to reflect the project's focus on the Workforce 2025 RIA Survey Tool._
// Vercel deployment trigger: Sat Jun 1 13:00:00 2025 //
