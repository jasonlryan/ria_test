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

## Environment Configuration

### Required Environment Variables

The following environment variables must be set for production deployment:

| Variable              | Description                             | Example                                   |
| --------------------- | --------------------------------------- | ----------------------------------------- |
| `OPENAI_API_KEY`      | OpenAI API key for accessing GPT models | `sk-abcdef123456`                         |
| `OPENAI_ASSISTANT_ID` | Default OpenAI Assistant ID             | `asst_abc123def456`                       |
| `KV_REST_API_URL`     | Vercel KV REST API URL                  | `https://unique-id.kv.vercel-storage.com` |
| `KV_REST_API_TOKEN`   | Vercel KV REST API authentication token | `AYBCTabc123def456==`                     |

### Optional Environment Variables

The following environment variables are optional and provide additional configuration options:

| Variable            | Description                                                         | Default    | Example       |
| ------------------- | ------------------------------------------------------------------- | ---------- | ------------- |
| `FILE_ACCESS_MODE`  | Controls how the assistant accesses data files (standard or direct) | `standard` | `direct`      |
| `USE_STARTER_CACHE` | Enable caching of starter question results                          | `true`     | `false`       |
| `DEBUG_MODE`        | Enable additional debug logging                                     | `false`    | `true`        |
| `INCLUDE_RAW_DATA`  | Include raw JSON data in assistant prompts                          | `true`     | `false`       |
| `QUERY_MODEL`       | GPT model to use for query analysis                                 | `gpt-4o`   | `gpt-4-turbo` |
| `USE_KV`            | Enable/disable Vercel KV functionality                              | `true`     | `false`       |

### Setting Environment Variables

Environment variables can be set in the Vercel project settings:

1. Navigate to your project in the Vercel dashboard
2. Go to "Settings" > "Environment Variables"
3. Add each required and optional variable
4. Specify which environments (Production, Preview, Development) each variable applies to

## Vercel Analytics Integration

Vercel Analytics provides insights into visitor traffic, page views, and user engagement for your deployed application. This section outlines the setup, configuration, and usage of Vercel Analytics with RIA25.

### Installation and Setup

1. **Install the Vercel Analytics package**:

   ```bash
   npm install @vercel/analytics
   ```

2. **Add the Analytics component to your application layout**:

   ```jsx
   // In app/layout.tsx
   import { Analytics } from "@vercel/analytics/react";

   export default function RootLayout({ children }) {
     return (
       <html lang="en">
         <body>
           <MainComponent>{children}</MainComponent>
           <Analytics />
         </body>
       </html>
     );
   }
   ```

3. **Deploy your application** to Vercel to start collecting analytics data.

### Configuration Options

The Analytics component supports several configuration options:

```jsx
<Analytics
  debug={process.env.NODE_ENV === "development"} // Enable logs in development
  beforeSend={(event) => {
    // Optional: Modify events before they're sent
    return event;
  }}
/>
```

| Option       | Description                                          | Default     |
| ------------ | ---------------------------------------------------- | ----------- |
| `debug`      | Logs events to console instead of sending to Vercel  | `false`     |
| `beforeSend` | Function to modify events before sending             | `undefined` |
| `mode`       | Analytics mode ('auto', 'development', 'production') | `'auto'`    |

### Environment Behavior

By default, Vercel Analytics operates differently depending on the environment:

- **Production**: Analytics events are collected and sent to Vercel
- **Preview Deployments**: Analytics events are collected and sent to Vercel
- **Development**: Analytics events are not collected

To enable analytics in development mode, use the `debug` flag:

```jsx
<Analytics debug={process.env.NODE_ENV === "development"} />
```

This will log events to the console instead of sending them to Vercel.

### Accessing Analytics Data

1. **View Analytics Dashboard**:

   - Log in to your Vercel account
   - Select your project
   - Click on "Analytics" in the top navigation

2. **Available Metrics**:

   - Visitors: Unique visitors to your application
   - Page Views: Total number of page views
   - Bounce Rate: Percentage of visitors who navigate away after viewing only one page
   - Geography: Visitor distribution by country/region
   - Referrers: Sources of traffic to your application

3. **Custom Events**:

   - For advanced usage, you can track custom events using the `track` function:

   ```jsx
   import { track } from "@vercel/analytics";

   // Track a custom event
   track("question_asked", { questionType: "starter" });
   ```

### Troubleshooting

If analytics data is not appearing in your dashboard:

1. Verify the `<Analytics />` component is correctly implemented in your layout
2. Ensure your application is correctly deployed to Vercel
3. Visit your deployed application to generate page views
4. Allow 15-30 minutes for data to appear in the dashboard
5. Check if ad blockers are preventing analytics tracking

### Privacy Considerations

Vercel Analytics is compliant with GDPR, CCPA, and other privacy regulations. To ensure compliance:

1. Update your privacy policy to disclose the use of analytics
2. Consider adding a cookie consent banner if required in your jurisdiction
3. Respect user privacy by not tracking personally identifiable information

### Performance Impact

Vercel Analytics is designed for minimal performance impact:

- Script size is approximately 3KB gzipped
- Automatically respects user preferences (Do Not Track setting)
- Uses a lightweight, non-blocking implementation
