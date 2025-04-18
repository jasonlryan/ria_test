# Prompt File Synchronization System

## Overview

This system ensures that the prompt files used by the application are consistent across all environments, including Vercel deployments. It synchronizes the master prompt files in the `utils/openai/` directory to the public directories that are accessible in production.

## File Structure

The prompt files are maintained in three locations:

1. **Master Files**: `utils/openai/*.md`

   - Source of truth for all prompts
   - Used in development environment

2. **Public Copies**:
   - `public/prompts/*.md`: First fallback location
   - `public/prompt_files/*.md`: Second fallback location
   - Both are accessible in production (Vercel)

## Synchronization Tool

The `sync-prompts.js` script ensures all copies stay in sync with the master files:

```bash
# To check if files are in sync without making changes
npm run check-prompts

# To synchronize all files
npm run sync-prompts
```

### How it Works

1. The script reads each master prompt file
2. It calculates an MD5 hash of the content
3. It checks each target location:
   - If the file doesn't exist, it creates it
   - If the file exists but has different content, it updates it
   - If the file exists and matches, it leaves it unchanged
4. It provides a summary of any changes made

## Production Deployment

The synchronization is automatically run as part of the build process:

```json
"build": "npm run sync-prompts && next build"
```

This ensures that the latest version of each prompt is always deployed to production.

## Fallback Mechanism

The application uses a robust fallback system to find prompt files:

1. First tries to read from `utils/openai/`
2. If that fails, tries `public/prompts/`
3. If that also fails, tries `public/prompt_files/`

This ensures the application works in any environment, even if one path is not accessible.

## Adding New Prompts

To add a new prompt file to the synchronization system:

1. Create the master file in `utils/openai/`
2. Add it to the `PROMPT_FILES` array in `sync-prompts.js`:

```javascript
const PROMPT_FILES = [
  { name: "1_data_retrieval.md" },
  { name: "your_new_prompt.md" },
  // Add other prompt files as needed
];
```

3. Run `npm run sync-prompts` to create copies in the public directories

## Vercel Environment Considerations

In Vercel's serverless environment:

- The `utils/` directory may not be accessible
- Files in `public/` are guaranteed to be accessible
- The application will automatically use the files from `public/` in production
