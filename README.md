<h1 align="center" style="font-weight: bold">
  Open Custom GPT
  <br>
    <h3 align="center">The no-code platform for building Custom GPT using Assistant api</h3>
  <br>
  
</h1>

**Open Custom GPT** provides a user-friendly solution to quickly setup a custom GPT and add to your site.

### Youtube Tutorial -> https://www.youtube.com/watch?v=2S38vkMubrg

## Key Features 🎯

- **Fast and Efficient**: Designed with speed and efficiency at its core. Open Custom GPT ensures rapid speed of building a GPT.
- **Secure**: Your data, your control. Always. Self-hosted and never shared with others
- **Open Source**: Open source and free to use.
- **Share/Embed**: Share/Embed your project with your users directly and give access to your information
- **Monetization**: Gate your Custom GPT behind a paywall and earn money

## Convert your existing Custom GPT to host on your site

To convert your existing Custom GPT to host on your site,

- Copy the instructions from the Configure Tab
- Paste them in the Open Custom GPT instructions section
- Enable Code Interpreter, Dall E or File retrieval similar to your Custom GPT
- Upload any files you added to Custom GPT
- Setup any custom functions you added in your Custom GPT in Open Custom GPT

### Stack

- Next.js
- OpenAI
- Tailwind

### Run the project locally

Minimum requirements to run the projects locally

- Node.js v18
- OpenAI API Key

```shell
npm install

npm run build

npm run dev

# visit http://localhost:3000
```

### Hosted version of Open Custom GPT

If you don't want to setup locally and wish to use a hosted version, you can start from https://customgpt.thesamur.ai/

Streaming support now added in hosted version

## Contribute 🤝

Did you get a pull request? Open it, and we'll review it as soon as possible.

- [Open Issues](https://github.com/SamurAIGPT/Open-Custom-GPT/issues)
- [Open Pull Requests](https://github.com/SamurAIGPT/Open-Custom-GPT/pulls)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Community

Join the discord community https://discord.gg/3sbpBxVZyH to get support with setting up your Custom GPT

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

# Workforce 2025 RIA Survey Tool

Interactive assistant for exploring the 2025 Workforce Survey data.

_Updated: April 7, 2024 - Latest deployment with streaming improvements_

## Operation Modes

The application can run in two different modes for handling survey data:

### 1. Standard Mode (`npm run dev`)

- Uses `FILE_ACCESS_MODE=standard`
- Data is sent along with each request to the assistant
- Better for testing and development
- Requires more bandwidth due to data transfer

### 2. Light Mode (`npm run dev:light`)

- Uses `FILE_ACCESS_MODE=direct`
- Assistant retrieves data directly from files
- More efficient for production use
- Requires proper data file setup in `scripts/data/` directory

### Data File Requirements

For the assistant to work properly, ensure these files are present:

- `scripts/data/2024/2024_global_data.csv`
- `scripts/data/2025/2025_global_data.csv`

## Features
