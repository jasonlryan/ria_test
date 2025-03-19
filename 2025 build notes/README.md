# 2025 Global Workforce Survey AI Assistant

This directory contains all necessary files and instructions to build and deploy the 2025 Global Workforce Survey AI Assistant. The assistant provides insights from the Global Workforce Survey 2025 data and enables year-over-year comparisons with 2024 data where applicable.

## Directory Contents

### Documentation

- `README.md` - This file
- `implementation_plan.md` - Detailed plan for implementing the assistant
- `reference_guide.md` - Technical reference for data structure and comparison rules

### Configuration

- `system_prompt_2025.json` - System prompt for the OpenAI assistant
- `assistant_config.json` - Configuration file for the OpenAI assistant

### Scripts

- `prepare_vector_data.js` - Script to prepare data for the vector store
- `create_question_mapping.js` - Script to generate question ID mappings
- `api_route_example.js` - Example API route for Next.js integration

## Setup Instructions

### Prerequisites

- Node.js v16 or higher
- OpenAI API key with access to Assistants API
- Access to 2025 Global Workforce Survey data
- Access to 2024 Global Workforce Survey data (for comparisons)

### Step 1: Install Dependencies

```bash
npm install fs path
```

### Step 2: Prepare Data

1. Run the data preparation script to create vector store documents:

```bash
node prepare_vector_data.js
```

2. Generate question mapping:

```bash
node create_question_mapping.js
```

### Step 3: Configure OpenAI Assistant

1. Log in to the OpenAI platform
2. Create a new assistant using the configuration in `assistant_config.json`
3. Upload the following files to the assistant:
   - `vector_data/vector_documents.json` (or split files if generated)
   - `reference_guide.md`
   - `system_prompt_2025.json`
   - `vector_data/question_mapping.json`
   - The comparable data index file from the 'prompts' directory

### Step 4: Integrate with Frontend

1. Create an API route in your Next.js application using `api_route_example.js` as a reference
2. Update the frontend components to handle the assistant's responses
3. Set environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `OPENAI_ASSISTANT_ID` - The ID of the assistant you created

## Usage Notes

### Comparison Rules

The assistant will only compare questions and markets that are comparable between 2024 and 2025 surveys. The comparable data index file contains the rules for valid comparisons.

### Data Structure

The 2025 Global Workforce Survey data is structured as JSON with questions as keys and response options with percentages as values. The data has been optimized for the vector store in separate documents for efficient retrieval.

### Troubleshooting

- If the assistant cannot find certain data, ensure all files were properly uploaded to the OpenAI platform
- If comparisons are not working correctly, check that the comparable data index file is properly formatted
- For performance issues, consider splitting vector documents into smaller chunks

## Additional Resources

- OpenAI Assistants API Documentation: https://platform.openai.com/docs/assistants/overview
- Next.js API Routes Documentation: https://nextjs.org/docs/api-routes/introduction

## Contact

For support or questions about this implementation, please contact the project team.
