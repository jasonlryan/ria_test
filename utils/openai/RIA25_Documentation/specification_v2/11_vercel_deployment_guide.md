# Deploying to Vercel

**Last Updated:** Tue May 6 11:28:33 BST 2025

> **Target Audience:** Developers, DevOps Engineers, System Administrators  
> **Related Documents:**
>
> - 15_thread_data_management.md
> - 06_system_architecture.md
> - 03_data_processing_workflow.md

## Overview

This guide outlines the steps to deploy RIA25 to Vercel, including setup for Vercel KV integration with the repository pattern implementation. This v2 document reflects the current TypeScript architecture and storage approach.

## Prerequisites

Before deploying to Vercel, make sure you have:

1. A Vercel account (create one at [vercel.com](https://vercel.com) if needed)
2. The Vercel CLI installed (optional, for local testing)
3. An OpenAI API key with access to the appropriate models
4. Access to Vercel KV for data storage

## Setup Steps

### 1. Vercel KV Configuration

Vercel KV provides the persistent storage layer for RIA25's repository pattern implementation:

1. **Create a KV Storage Instance**:

   - In your Vercel dashboard, navigate to "Storage"
   - Select "Create" and choose "KV Database"
   - Follow the prompts to create your KV instance
   - Note the region selection for compliance requirements

2. **Obtain KV Credentials**:

   - After creation, you'll receive a KV REST API URL and Token
   - These will be needed as environment variables

3. **Connect Your Project**:

   - Link the KV instance to your Vercel project
   - This can be done through the dashboard UI

4. **Implement Local Development Fallback**:
   - Update your local `.env` file with KV credentials for testing
   - Ensure the `kvClient.ts` implementation includes proper fallback mechanisms for local development as specified in the Vercel KV Implementation Standard

### 2. Prepare Environment Variables

You'll need to add the following secrets to your Vercel project:

1. Log in to your Vercel dashboard
2. Navigate to your project (or create a new one)
3. Go to "Settings" → "Environment Variables"
4. Add the following environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_API_MODEL`: The model to use (e.g., "gpt-4o")
   - `KV_REST_API_URL`: Your Vercel KV REST API URL
   - `KV_REST_API_TOKEN`: Your Vercel KV REST API authentication token
   - `USE_KV`: Set to "true" to enable Vercel KV functionality
   - `REPOSITORY_COMPATIBILITY_MODE`: Set to "true" during migration phase (optional)

These secrets should be added to all environments (Production, Preview, and Development).

### 3. Configure Deployment

There are two ways to deploy to Vercel:

#### Option A: Deploy via Vercel Dashboard

1. Connect your GitHub, GitLab, or Bitbucket repository to Vercel
2. Select the project repository
3. Vercel will automatically detect Next.js and use the appropriate build settings
4. Configure build settings to ensure TypeScript compilation
5. Click "Deploy"

#### Option B: Deploy via Vercel CLI

1. Install the Vercel CLI: `npm i -g vercel`
2. Navigate to your project directory in your terminal
3. Run: `vercel`
4. Follow the prompts to link your project and deploy

### 4. Verify Configuration

The deployment should automatically use the following configuration files:

- `vercel.json`: Vercel deployment configuration
- `next.config.js`: Next.js specific settings
- `package.json`: Project dependencies and scripts
- `tsconfig.json`: TypeScript configuration

### 5. Post-Deployment Steps

After successful deployment:

1. Run the data preparation scripts if you haven't already:

   - This can be done locally before deployment
   - Alternatively, you can consider adding these steps to your build process

2. Verify that your environment variables are properly set and recognized by the application

3. Run KV connectivity test via the admin panel to ensure repository implementation is functioning

4. Test the deployed application by sending a sample query

## Repository Pattern Integration

The RIA25 implementation uses a repository pattern integrated with Vercel KV:

### KV Client Implementation

Ensure your `lib/kvClient.ts` follows the Vercel KV Implementation Standard:

```typescript
// lib/kvClient.ts
import { kv } from "@vercel/kv";

// Simple in-memory fallback for local development
const memoryStore = new Map();
const localKv = {
  get: async (key) => memoryStore.get(key),
  set: async (key, value, opts) => memoryStore.set(key, value),
  hget: async (key, field) => {
    const hash = memoryStore.get(key) || {};
    return hash[field];
  },
  hset: async (key, fieldOrObj, value) => {
    const hash = memoryStore.get(key) || {};
    if (typeof fieldOrObj === "object") {
      Object.assign(hash, fieldOrObj);
    } else {
      hash[fieldOrObj] = value;
    }
    memoryStore.set(key, hash);
  },
  expire: async (key, seconds) => true,
  // Add other methods as needed
};

// Use real KV in production, fallback locally
const isKvConfigured =
  !!process.env.KV_REST_API_URL || !!process.env.KV_REST_API_TOKEN;
const kvClient = process.env.VERCEL && isKvConfigured ? kv : localKv;

export default kvClient;
```

### Repository Implementation

All data access through the repository layer will utilize the KV client:

```typescript
// Example repository implementation
import kvClient from "@/lib/kvClient";
import logger from "@/utils/logger";
import { cacheKey } from "@/utils/cache-utils";

export class SurveyDataRepository {
  async getSurveyData(year: string, region: string): Promise<SurveyData> {
    const key = cacheKey("survey", `${year}:${region}`);

    try {
      // Try to get from KV
      const cachedData = await kvClient.get<SurveyData>(key);
      if (cachedData) {
        logger.info(`Cache hit for survey data ${year}/${region}`);
        return cachedData;
      }

      // Fallback to file system if not in KV
      logger.info(
        `Cache miss for survey data ${year}/${region}, loading from filesystem`
      );
      const data = await this.loadFromFileSystem(year, region);

      // Store in KV for future requests (90 days TTL)
      await kvClient.set(key, data, { ex: 60 * 60 * 24 * 90 });

      return data;
    } catch (error) {
      logger.error(
        `Error retrieving survey data ${year}/${region}: ${error.message}`
      );
      // Always fallback to filesystem on KV errors
      return this.loadFromFileSystem(year, region);
    }
  }

  private async loadFromFileSystem(
    year: string,
    region: string
  ): Promise<SurveyData> {
    // Implementation details for filesystem access
    // ...
  }
}
```

## Troubleshooting

### Common Issues

1. **KV Connection Failures**: Verify that your KV credentials are correctly set in environment variables. Check that the KV instance is properly connected to your project.

2. **Repository Pattern Integration Issues**: If the repository pattern integration is failing, verify the compatibility mode settings and ensure the KV client is correctly implemented.

3. **API Timeout Errors**: If you encounter timeout errors, check the `functions` section in `vercel.json`. You may need to increase the `maxDuration` for API routes, especially for operations requiring KV access.

4. **Missing Environment Variables**: Verify that all required environment variables are set in the Vercel dashboard.

5. **Build Failures**: Check the build logs for TypeScript compilation errors or other build issues.

6. **API Routes Not Working**: Ensure that the API routes are correctly configured with the controller-service architecture.

### Logs and Debugging

- Access deployment logs from the Vercel dashboard under "Deployments" → select your deployment → "View Logs"
- Enable debug logging for KV operations by setting `DEBUG_MODE=true` in your environment variables
- For runtime logs, you can use Vercel's built-in logging system or integrate with a third-party logging service

## Performance Considerations

- Use Vercel KV's TTL settings to prevent unbounded growth of stored data
- Implement caching strategies for frequently accessed data
- Consider using Vercel's Edge Functions for faster response times
- Use Vercel's serverless functions for API routes that require longer processing times

## Scaling

As your application grows:

1. Consider implementing rate limiting to manage OpenAI API usage
2. Use Vercel's analytics to monitor usage patterns and optimize accordingly
3. Implement appropriate caching strategies for high-traffic scenarios
4. Monitor KV usage metrics and scale as needed

## Support

For issues related to Vercel deployment, refer to:

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)

## Environment Configuration

### Required Environment Variables

The following environment variables must be set for production deployment:

| Variable                        | Description                                | Example                                   |
| ------------------------------- | ------------------------------------------ | ----------------------------------------- |
| `OPENAI_API_KEY`                | OpenAI API key for accessing GPT models    | `sk-abcdef123456`                         |
| `OPENAI_API_MODEL`              | OpenAI model to use                        | `gpt-4o`                                  |
| `KV_REST_API_URL`               | Vercel KV REST API URL                     | `https://unique-id.kv.vercel-storage.com` |
| `KV_REST_API_TOKEN`             | Vercel KV REST API authentication token    | `AYBCTabc123def456==`                     |
| `USE_KV`                        | Enable Vercel KV functionality             | `true`                                    |
| `REPOSITORY_COMPATIBILITY_MODE` | Enable compatibility mode during migration | `true` or `false`                         |

### Optional Environment Variables

The following environment variables are optional and provide additional configuration options:

| Variable            | Description                           | Default   | Example       |
| ------------------- | ------------------------------------- | --------- | ------------- |
| `DEBUG_MODE`        | Enable additional debug logging       | `false`   | `true`        |
| `INCLUDE_RAW_DATA`  | Include raw JSON data in prompts      | `true`    | `false`       |
| `QUERY_MODEL`       | GPT model to use for query analysis   | `gpt-4o`  | `gpt-4-turbo` |
| `CACHE_TTL_SURVEY`  | TTL in seconds for survey data cache  | `7776000` | `2592000`     |
| `CACHE_TTL_SESSION` | TTL in seconds for session data       | `86400`   | `43200`       |
| `CACHE_TTL_GENERAL` | TTL in seconds for general cache data | `3600`    | `1800`        |

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

   ```tsx
   // In app/layout.tsx
   import { Analytics } from "@vercel/analytics/react";

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode;
   }) {
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

### Custom Event Tracking

For monitoring repository pattern operations and KV performance:

```typescript
import { track } from "@vercel/analytics";

// In repository methods
async getSurveyData(year: string, region: string): Promise<SurveyData> {
  const startTime = performance.now();
  try {
    const result = await this.kvClient.get<SurveyData>(key);
    const duration = performance.now() - startTime;

    // Track performance metrics
    track("repository_operation", {
      operation: "getSurveyData",
      cacheHit: !!result,
      duration: Math.round(duration),
      region
    });

    return result || this.fallbackLoad(year, region);
  } catch (error) {
    track("repository_error", {
      operation: "getSurveyData",
      error: error.message
    });
    throw error;
  }
}
```

### Privacy Considerations

Vercel Analytics is compliant with GDPR, CCPA, and other privacy regulations. To ensure compliance:

1. Update your privacy policy to disclose the use of analytics
2. Consider adding a cookie consent banner if required in your jurisdiction
3. Respect user privacy by not tracking personally identifiable information

_Last updated: Tue May 6 11:28:33 BST 2025_
