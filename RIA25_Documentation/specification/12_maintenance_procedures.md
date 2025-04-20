# RIA25 Maintenance Procedures

> **Last Updated:** Sat Apr 19 2025  
> **Target Audience:** System Administrators, Developers, DevOps Engineers  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 15_thread_data_management.md
> - 11_vercel_deployment_guide.md

## Overview

This document outlines the maintenance procedures, update processes, and troubleshooting guidelines for the RIA25 system. It serves as a reference for ongoing maintenance and support activities.

## Suggested Maintenance Tasks

### Regular System Check

Key tasks to maintain system health:

- Monitor system logs and error reports
- Review OpenAI API usage and costs
- Check response times periodically
- Verify cache integrity and performance

### Periodic Review

Recommended reviews on a regular basis:

- Analyze and categorize any system errors
- Review query patterns and system utilization
- Verify data accessibility and functionality
- Assess performance metrics against benchmarks

### Ongoing Improvements

Areas for continuous improvement:

- Review and refine system prompts based on usage
- Audit system security and access controls
- Update documentation as needed
- Verify backup procedures
- Optimize OpenAI API interaction patterns

## Update Procedures

### Survey Data Updates

When new survey data becomes available:

1. **Data Preparation**

   - Validate new CSV data format
   - Ensure consistent column structure with existing data
   - Place file in `/2025_DATA_PROCESSING/` directory

2. **Processing Script Execution**

   ```bash
   cd scripts
   node process_survey_data.js --input="../2025_DATA_PROCESSING/new_data.csv" --output="./output/split_data/"
   ```

3. **Output Verification**

   - Verify all expected JSON files are generated
   - Check JSON structure consistency
   - Validate metadata accuracy

4. **Data Integration**

   - Once JSON files are validated, they need to be integrated with the system
   - This would require updating any data references or configurations

5. **System Testing**
   - Test queries specific to new data
   - Verify retrieval accuracy
   - Check cross-referencing with existing data

### Prompt System Updates (Recommended Process)

When updating the system prompt:

1. **Prompt Development**

   - Draft updated prompt version
   - Document changes and rationale

2. **Test Environment Setup**

   - Create test assistant with new prompt
   - Maintain existing assistant during testing

3. **Testing**

   - Execute standard test scenarios
   - Test edge cases
   - Compare results with previous prompt version

4. **Deployment**

   - Update production assistant with new prompt
   - Document prompt version change
   - Monitor initial responses for quality

5. **Rollback Procedure**
   - If issues are detected, revert to previous prompt version
   - Document issues for further refinement

### Web Interface Updates

When updating the Next.js application:

1. **Development**

   - Implement changes in development environment
   - Test functionality thoroughly

2. **Staging Deployment**

   - Deploy to staging environment
   - Conduct user acceptance testing

3. **Production Deployment**

   ```bash
   git push vercel main
   ```

4. **Post-Deployment Verification**
   - Verify all features function correctly
   - Check mobile and desktop compatibility
   - Validate API integration

## OpenAI API Performance Optimization

The system has been optimized for OpenAI API performance based on the implementation of the OpenAI API Optimization Plan. The following procedures should be followed to maintain and further optimize API performance.

### Performance Monitoring

Regular monitoring should include:

1. **Response Time Metrics**

   - Average response time (target: <15 seconds)
   - Time to first token (target: <3 seconds)
   - Poll-to-completion delay
   - Thread creation time

2. **API Usage Statistics**

   - Number of API calls per query
   - Token consumption per query type
   - Polling frequency and patterns
   - Cache hit/miss ratios

3. **Automated Alerts**
   - Set up alerts for response times exceeding benchmarks
   - Monitor for abnormal polling patterns
   - Track API usage spikes or anomalies

### Key Optimization Techniques

The following optimizations have been implemented and should be maintained:

1. **Adaptive Polling with Exponential Backoff**

   ```javascript
   // Example implementation (from app/api/chat-assistant/route.ts)
   const initialInterval = 500;
   let currentInterval = initialInterval;
   const maxInterval = 3000;
   const backoffFactor = 1.5;

   // In polling loop
   await new Promise((resolve) => setTimeout(resolve, currentInterval));
   currentInterval = Math.min(currentInterval * backoffFactor, maxInterval);

   // Reset on state change
   if (previousStatus !== runStatus) {
     currentInterval = initialInterval;
     previousStatus = runStatus;
   }
   ```

   - Performance impact: 15-20% reduction in response time
   - Maintenance: Review and adjust parameters based on API response patterns

2. **Parallel Processing Operations**

   - Message prefetching while waiting for run completion
   - Concurrent tool call processing
   - Parallelized file retrieval

3. **Partial Content Processing**

   ```javascript
   // Stream content as it becomes available (every 3 polls)
   if (runStatus === "in_progress" && pollCount % 3 === 0) {
     const partialMessages = await openai.beta.threads.messages.list(threadId);
     if (partialMessages.data && partialMessages.data.length > 0) {
       // Stream new content to user
       streamPartialContent(latestMessage);
     }
   }
   ```

   - Performance impact: Improved perceived response time
   - Maintenance: Ensure streaming remains stable across browsers

4. **Thread Caching and Reuse**

   - Thread-level caching for file IDs and segments
   - Efficient follow-up query handling
   - Cached files for thread persistence

### Performance Tuning Guidelines

When performance issues are detected:

1. **API Interaction Optimization**

   - Review polling intervals in `app/api/chat-assistant/route.ts`
   - Check for unnecessary API calls or redundant operations
   - Verify parallel operations are functioning correctly

2. **Cache Efficiency Review**

   - Check thread cache hit/miss ratios
   - Verify cache update procedures are working
   - Review cache size and clean-up procedures

3. **Cold Start Mitigation**

   - Analyze first-query performance
   - Consider implementing thread pooling if cold start issues persist
   - Review pre-warming strategies if deployed on serverless platforms

## Thread and Cache Management

### Vercel KV Cache System

### Overview

The RIA25 application uses Vercel KV (Redis) for production caching and offers an in-memory fallback for local development. This approach provides persistent caching in production while enabling development without requiring a Redis instance.

### Environment Variables

The KV system uses the following environment variables:

| Variable            | Purpose                              | Required             | Default |
| ------------------- | ------------------------------------ | -------------------- | ------- |
| `KV_REST_API_URL`   | URL for the Vercel KV REST API       | Yes (for production) | None    |
| `KV_REST_API_TOKEN` | Authentication token for KV REST API | Yes (for production) | None    |
| `REDIS_URL`         | Alternative Redis connection string  | No (fallback)        | None    |
| `USE_KV`            | Enable/disable KV functionality      | No                   | `true`  |

Setting `USE_KV=false` explicitly disables KV functionality and forces the use of the in-memory fallback, regardless of whether KV credentials are present.

### Cache Structure

1. **Key Schema**

   - Thread metadata: `thread:{threadId}:meta`
   - File data: `thread:{threadId}:file:{fileId}`
   - Test keys: `test-redis-{timestamp}`

2. **TTL Settings**

   - Standard TTL: 90 days (60 _ 60 _ 24 \* 90 seconds)
   - TTL is refreshed on key access and updates

3. **Inspection**

   For debugging purposes, you can inspect cache contents using Vercel CLI or Dashboard:

   ```bash
   # Install Vercel CLI if not already installed
   npm i -g vercel

   # Login to Vercel if needed
   vercel login

   # Get value of a specific cache key
   vercel kv get "thread:thread_abc123:meta"

   # List all keys with a specific prefix
   vercel kv keys "thread:thread_abc123:*"
   ```

4. **Cache Cleanup**

   Unlike file-based caching that required manual cleanup, Vercel KV implements automatic TTL-based expiration:

   - All keys have a 90-day TTL set via `kv.expire(key, 60 * 60 * 24 * 90)`
   - TTL is refreshed on key access and updates
   - Manual cleanup for testing or maintenance:

   ```bash
   # Delete a specific key
   vercel kv del "thread:thread_abc123:meta"

   # Delete keys matching a pattern (use with caution)
   for key in $(vercel kv keys "thread:thread_abc123:*"); do
     vercel kv del "$key"
   done
   ```

### Local Development

When running in a local development environment:

1. **In-memory Fallback**

   - The system automatically uses an in-memory Map as a fallback when:
     - `USE_KV=false` is set in the environment
     - Required KV environment variables are missing
   - This allows for development without a Redis instance

2. **Enabling Local Storage**

   - Start the application with `USE_KV=false`: `cross-env USE_KV=false npm run dev`
   - The logs will show: `KV disabled by USE_KV=false, using in-memory fallback for KV client.`
   - All KV operations will use the in-memory store with log prefixes like `🧠 KV CACHE [MEMORY]`

3. **Limitations**
   - The in-memory store is cleared when the server restarts
   - Data is not shared between separate processes
   - TTL functionality is simulated but limited

### Testing KV Operations

1. **Redis Test Endpoint**

   The application includes a `/api/redis-test` endpoint that verifies KV operations:

   ```bash
   # Test KV operations through the endpoint
   curl http://localhost:3000/api/redis-test
   ```

   A successful response indicates the KV client is working correctly:

   ```json
   {
     "working": true,
     "testKey": "test-redis-1234567890",
     "original": { "timestamp": 1234567890, "test": "Redis connection test" },
     "retrieved": { "timestamp": 1234567890, "test": "Redis connection test" }
   }
   ```

2. **Manual Testing**

   For more extensive testing, you can use the Vercel CLI:

   ```bash
   # Set a test value
   vercel kv set test:my-key '{"value": "test-data"}' --json

   # Get the test value
   vercel kv get test:my-key
   ```

3. **Common Issues**
   - Connection failures: Check environment variables and network connectivity
   - Authorization errors: Verify `KV_REST_API_TOKEN` is correct and not expired
   - Command execution failures: Ensure the Redis command syntax is correct

### Troubleshooting

1. **Connection Issues**

   - Verify environment variables: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
   - Check Vercel KV dashboard for service status
   - Verify network connectivity from deployment region
   - Check for connection timeouts in logs

2. **Performance Issues**

   - Review response time metrics in Vercel dashboard
   - Check for key hotspots (frequently accessed keys)
   - Verify appropriate TTL settings
   - Consider data structure optimizations (e.g., using HSET for related data)

3. **Consistency Issues**

   - Verify thread context persistence across sessions
   - Check for race conditions in concurrent updates
   - Review key naming patterns for consistency
   - Ensure all operations have proper error handling

4. **Quota Issues**

   - Monitor daily command usage
   - Check memory usage against plan limits
   - Review access patterns for optimization opportunities
   - Consider upgrading plan if consistently near limits

5. **Local Development Issues**
   - Ensure the local fallback is working correctly with `inMemoryStore`
   - Verify environment variables are not set in local `.env` files
   - Check browser console for KV-related warnings
   - Verify consistent behavior between local and production environments

### KV Rollback Procedure

In case of critical issues with the Vercel KV implementation:

1. Set the environment variable `USE_KV=false` to force fallback to in-memory caching
2. Verify the system falls back correctly to in-memory operations
3. Address the KV issues identified in logs and monitoring
4. Remove the environment variable when ready to re-enable KV
5. Monitor the system closely during the transition back to KV

## Monitoring Recommendations

### Performance Monitoring

- **Response Time**: Track average and peak response times
- **API Usage**: Monitor token consumption and request volume
- **Error Rate**: Track frequency and types of errors
- **Time to First Token**: Monitor latency before initial response

### Usage Monitoring

- **Query Patterns**: Review common query types
- **User Sessions**: Monitor session activity
- **Feature Utilization**: Note which capabilities are most used
- **Cache Efficiency**: Track cache hit/miss rates

### Analytics Monitoring

- **Traffic Trends**: Review visitor patterns and page view trends in Vercel Analytics
- **Engagement Metrics**: Monitor bounce rates and session duration
- **Usage Patterns**: Track which parts of the application receive the most traffic
- **Geographic Distribution**: Monitor user location patterns for regional optimization
- **Device Types**: Analyze desktop vs. mobile usage to optimize responsive design

#### Analytics Maintenance Tasks

1. **Regular Review**

   - Schedule weekly or monthly reviews of analytics data
   - Create dashboards for key metrics
   - Document significant changes in usage patterns

2. **Event Tracking Hygiene**

   - Verify custom events are properly categorized
   - Ensure event naming conventions are consistent
   - Document all tracked events for team reference

3. **Analytics Script Updates**

   - Keep `@vercel/analytics` package updated
   - Review analytics implementation when upgrading Next.js
   - Test analytics functionality after major deployments

4. **Data Quality Assurance**
   - Check for unexpected traffic spikes or drops
   - Verify that traffic sources are correctly attributed
   - Investigate any analytics gaps or inconsistencies

### Alert Thresholds

Consider setting up alerts for:

- Extended response times (e.g., >15 seconds average)
- Elevated error rates (e.g., >5% of requests)
- High API usage (e.g., >80% of quota)
- Any system downtime
- Abnormal polling patterns

## System Recovery Guidelines

### Critical Failure Recovery

1. **Assessment**

   - Identify failure point
   - Determine impact scope
   - Establish recovery priority

2. **Containment**

   - Limit system access if necessary
   - Implement temporary workarounds
   - Communicate status to stakeholders

3. **Recovery Steps**

   - Restore data if corruption occurred
   - Redeploy application if web interface failed
   - Reconfigure API connections if integration issues

4. **Verification**

   - Test system functionality
   - Verify data integrity
   - Confirm normal operation

5. **Documentation**
   - Record incident details
   - Document recovery process
   - Update procedures based on lessons learned

## Contact Roles

Key roles for system maintenance and support:

- System Administrator: Responsible for day-to-day maintenance
- Developer: Handles technical issues and code updates
- Prompt Engineer: Manages prompt system refinements
- Project Manager: Coordinates overall system management

---

_Last updated: Sat Apr 19 2025_
