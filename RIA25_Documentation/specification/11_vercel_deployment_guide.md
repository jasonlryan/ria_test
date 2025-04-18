# Deploying to Vercel

This guide outlines the steps to deploy the 2025 Global Workforce Survey AI Assistant to Vercel.

## Prerequisites

Before deploying to Vercel, make sure you have:

1. A Vercel account (create one at [vercel.com](https://vercel.com) if needed)
2. The Vercel CLI installed (optional, for local testing)
3. An OpenAI API key with access to the Assistants API
4. Created and configured your OpenAI Assistant

## Setup Steps

### 1. Prepare Secrets in Vercel

You'll need to add the following secrets to your Vercel project:

1. Log in to your Vercel dashboard
2. Navigate to your project (or create a new one)
3. Go to "Settings" → "Environment Variables"
4. Add the following environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_ASSISTANT_ID`: The ID of your configured assistant

These secrets should be added to all environments (Production, Preview, and Development).

### 2. Configure Deployment

There are two ways to deploy to Vercel:

#### Option A: Deploy via Vercel Dashboard

1. Connect your GitHub, GitLab, or Bitbucket repository to Vercel
2. Select the project repository
3. Vercel will automatically detect Next.js and use the appropriate build settings
4. Click "Deploy"

#### Option B: Deploy via Vercel CLI

1. Install the Vercel CLI: `npm i -g vercel`
2. Navigate to your project directory in your terminal
3. Run: `vercel`
4. Follow the prompts to link your project and deploy

### 3. Verify Configuration

The deployment should automatically use the following configuration files:

- `vercel.json`: Vercel deployment configuration
- `next.config.js`: Next.js specific settings
- `package.json`: Project dependencies and scripts

### 4. Post-Deployment Steps

After successful deployment:

1. Run the data preparation scripts if you haven't already:

   - This can be done locally before deployment
   - Alternatively, you can consider adding these steps to your build process

2. Verify that your environment variables are properly set and recognized by the application

3. Test the deployed application by sending a sample query to ensure the connection to your OpenAI Assistant is working

## Troubleshooting

### Common Issues

1. **API Timeout Errors**: If you encounter timeout errors, check the `functions` section in `vercel.json`. You may need to increase the `maxDuration` for API routes.

2. **Missing Environment Variables**: Verify that all required environment variables are set in the Vercel dashboard.

3. **Build Failures**: Check the build logs for specific errors. Most commonly, this is related to dependencies or Node.js version issues.

4. **API Routes Not Working**: Ensure that the API routes are correctly configured and that the `api` directory is properly structured.

### Logs and Debugging

- Access deployment logs from the Vercel dashboard under "Deployments" → select your deployment → "View Logs"
- For runtime logs, you can use Vercel's built-in logging system or integrate with a third-party logging service

## Performance Considerations

- Consider using Vercel's Edge Functions for faster response times
- Use Vercel's serverless functions for API routes that require longer processing times
- Implement caching for frequently requested data to reduce API calls to OpenAI

## Scaling

As your application grows:

1. Consider implementing rate limiting to manage OpenAI API usage
2. Use Vercel's analytics to monitor usage patterns and optimize accordingly
3. For high-traffic scenarios, implement appropriate caching strategies

## Support

For issues related to Vercel deployment, refer to:

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
