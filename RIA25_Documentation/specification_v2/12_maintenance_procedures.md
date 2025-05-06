# RIA25 Maintenance Procedures

**Last Updated:** Tue May 13 15:30:42 BST 2025

> **Target Audience:** System Administrators, Developers, DevOps Engineers  
> **Related Documents:**
>
> - 06_system_architecture.md
> - 15_thread_data_management.md
> - 11_vercel_deployment_guide.md
> - 18_vercel_kv_cache_reference.md

## Overview

This document outlines the maintenance procedures, update processes, and troubleshooting guidelines for the RIA25 system following the implementation of the repository pattern and Vercel KV caching. It serves as a reference for ongoing maintenance and support activities.

## Suggested Maintenance Tasks

### Regular System Check

Key tasks to maintain system health:

- Monitor system logs and error reports
- Review OpenAI API usage and costs
- Check response times periodically
- Verify Vercel KV cache integrity and performance
- Monitor repository pattern implementation through logging
- Check TypeScript type compatibility across interfaces

### Periodic Review

Recommended reviews on a regular basis:

- Analyze and categorize any system errors
- Review query patterns and system utilization
- Verify data accessibility and functionality
- Assess performance metrics against benchmarks
- Review repository implementation consistency
- Check for any TypeScript type violations or warnings

### Ongoing Improvements

Areas for continuous improvement:

- Review and refine system prompts based on usage
- Audit system security and access controls
- Update documentation as needed
- Verify backup procedures
- Optimize OpenAI API interaction patterns
- Improve repository implementation coverage
- Enhance Vercel KV caching strategies

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
   - Verify compatibility with repository interfaces

4. **Data Integration**

   - Once JSON files are validated, they need to be integrated with the system
   - Update repository implementation for any new data structure
   - Verify `FileRepository` can correctly load and filter the new data
   - Update compatibility metadata in `CompatibilityRepository` if needed

5. **System Testing**
   - Test queries specific to new data
   - Verify retrieval accuracy
   - Check cross-referencing with existing data
   - Validate repository pattern interfaces with new data

### Prompt System Updates (Recommended Process)

When updating the system prompt:

1. **Prompt Development**

   - Draft updated prompt version
   - Document changes and rationale
   - Store in the format required by `PromptRepository`

2. **Update Prompt Repository**

   - Add new prompt to the repository
   - Maintain version tracking in the prompt metadata
   - Update `renderPrompt` method if template changes are needed

3. **Test Environment Setup**

   - Create test assistant with new prompt
   - Maintain existing assistant during testing
   - Verify repository integration with the prompt

4. **Testing**

   - Execute standard test scenarios
   - Test edge cases
   - Compare results with previous prompt version

5. **Deployment**

   - Update production assistant with new prompt
   - Document prompt version change
   - Monitor initial responses for quality

6. **Rollback Procedure**
   - If issues are detected, revert to previous prompt version
   - Use the repository's versioning to restore the previous prompt
   - Document issues for further refinement

### Web Interface Updates

When updating the Next.js application:

1. **Development**

   - Implement changes in development environment
   - Test functionality thoroughly
   - Verify TypeScript type safety across components

2. **Repository Pattern Compliance**

   - Ensure new features follow the repository pattern
   - Update interfaces if new functionality requires it
   - Verify controllers, services, and repositories separation

3. **Staging Deployment**

   - Deploy to staging environment
   - Conduct user acceptance testing
   - Verify repository pattern and Vercel KV integration

4. **Production Deployment**

   ```bash
   git push vercel main
   ```

5. **Post-Deployment Verification**
   - Verify all features function correctly
   - Check mobile and desktop compatibility
   - Validate API integration
   - Confirm repository pattern implementation
   - Verify Vercel KV caching functionality

## Repository Pattern Maintenance

The repository pattern is now fully implemented across the codebase. Follow these guidelines to maintain the implementation:

### Repository Structure

The repository implementation follows this structure:

1. **Interfaces Directory**: `utils/data/repository/interfaces/`

   - Contains TypeScript interfaces for all repositories
   - Defines clear contracts for implementations

2. **Implementations Directory**: `utils/data/repository/implementations/`

   - Contains concrete implementations of repository interfaces
   - Implements business logic with proper separation of concerns

3. **Adapters Directory**: `utils/data/repository/adapters/`
   - Contains adapters for legacy code compatibility
   - Provides backward compatibility for older components

### Key Repositories

Maintain and monitor these key repositories:

1. **FileRepository**

   - Manages file access and loading
   - Contains file filtering and identification logic
   - Interacts with the file system and caching

2. **PromptRepository**

   - Manages prompt templates and rendering
   - Handles prompt versioning and substitution
   - Provides consistent access to prompt content

3. **CacheRepository**

   - Manages Vercel KV cache operations
   - Implements thread and file caching
   - Provides optimized access patterns for data

4. **CompatibilityRepository**
   - Manages file compatibility rules
   - Handles cross-year comparison validation
   - Provides metadata enrichment for file IDs

### Repository Maintenance Guidelines

1. **Interface Stability**

   - Maintain backward compatibility when updating interfaces
   - Document all interface changes thoroughly
   - Create new interfaces rather than modifying existing ones when possible

2. **Implementation Updates**

   - Update implementations without changing interfaces
   - Follow singleton pattern for repository instances
   - Maintain comprehensive error handling and logging

3. **Testing**

   - Run repository tests after any changes: `npm run test:repository`
   - Verify behavior tests pass after implementation changes
   - Maintain high test coverage for repository implementations

4. **Monitoring**

   - Monitor repository performance through logging
   - Track cache hit/miss ratios
   - Watch for any TypeScript type errors in the logs

5. **Rollback Procedure**
   - In case of critical issues, use the emergency rollback flag:
     ```bash
     # Set the rollback flag in environment
     REPOSITORY_ROLLBACK=true npm run dev
     ```
   - This will force the system to use adapter fallbacks
   - Fix issues and then remove the rollback flag

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
   - Cache hit/miss ratios via `cacheMonitor`

3. **Automated Alerts**
   - Set up alerts for response times exceeding benchmarks
   - Monitor for abnormal polling patterns
   - Track API usage spikes or anomalies
   - Watch for repository implementation issues in logs

### Key Optimization Techniques

The following optimizations have been implemented and should be maintained:

1. **Adaptive Polling with Exponential Backoff**

   ```typescript
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
   - Parallelized file retrieval through repository pattern

3. **Partial Content Processing**

   ```typescript
   // Stream content as it becomes available (every 3 polls)
   if (runStatus === "in_progress" && pollCount % 3 === 0) {
     const partialMessages = await unifiedOpenAIService.listMessages(threadId);
     if (partialMessages.data && partialMessages.data.length > 0) {
       // Stream new content to user
       streamPartialContent(latestMessage);
     }
   }
   ```

   - Performance impact: Improved perceived response time
   - Maintenance: Ensure streaming remains stable across browsers

4. **Thread Caching with Vercel KV**

   - Thread-level caching for file IDs and segments via CacheRepository
   - Efficient follow-up query handling
   - Cached files for thread persistence with proper TTL management

### Performance Tuning Guidelines

When performance issues are detected:

1. **API Interaction Optimization**

   - Review polling intervals in `app/api/chat-assistant/route.ts`
   - Check for unnecessary API calls or redundant operations
   - Verify parallel operations are functioning correctly

2. **Cache Efficiency Review**

   - Check thread cache hit/miss ratios via CacheMonitor
   - Verify cache update procedures are working
   - Review cache TTL settings in key-schema.ts
   - Optimize hash operations for partial updates

3. **Cold Start Mitigation**

   - Analyze first-query performance
   - Consider implementing thread pooling if cold start issues persist
   - Review pre-warming strategies if deployed on serverless platforms
   - Optimize repository initialization time

## Vercel KV Cache Management

The RIA25 application now uses Vercel KV (Redis) for production caching with an in-memory fallback for local development. This section provides maintenance procedures specific to the Vercel KV implementation.

### Environment Variables

The KV system uses the following environment variables:

| Variable            | Purpose                              | Required             | Default |
| ------------------- | ------------------------------------ | -------------------- | ------- |
| `KV_REST_API_URL`   | URL for the Vercel KV REST API       | Yes (for production) | None    |
| `KV_REST_API_TOKEN` | Authentication token for KV REST API | Yes (for production) | None    |
| `REDIS_URL`         | Alternative Redis connection string  | No (fallback)        | None    |
| `USE_KV`            | Enable/disable KV functionality      | No                   | `true`  |

Setting `USE_KV=false` explicitly disables KV functionality and forces the use of the in-memory fallback, regardless of whether KV credentials are present.

### Key Schema and TTL

The Vercel KV implementation uses a standardized key schema defined in `utils/shared/key-schema.ts`:

1. **Key Schema**

   - Thread metadata: `thread:{threadId}:meta`
   - Thread file data: `thread:{threadId}:file:{fileId}`
   - Analytics data: `analytics:{metric}:{date}`
   - General cache data: `cache:{category}:{id}`
   - Temporary data: `temp:{type}:{id}`

2. **TTL Settings**

   - Thread data: 90 days (60 _ 60 _ 24 \* 90 seconds)
   - User sessions: 24 hours (60 _ 60 _ 24 seconds)
   - Cache data: 1 hour (60 \* 60 seconds)
   - Analytics data: 30 days (60 _ 60 _ 24 \* 30 seconds)
   - TTL is refreshed on key access and updates

3. **Key Schema Management**

   - All key generation should use the functions in `key-schema.ts`
   - Do not create ad-hoc key formats outside the key schema
   - When adding new key types, update the `key-schema.ts` file

### Inspection and Monitoring

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

Monitor cache performance through the CacheMonitor:

```typescript
// Get cache performance metrics
import { cacheMonitor } from "utils/shared/monitoring";
const metrics = cacheMonitor.getMetrics();
console.log(
  `Cache hit ratio: ${(metrics.hits / metrics.totalOperations) * 100}%`
);
console.log(`Average latency: ${metrics.avgLatencyMs}ms`);
```

### Cache Maintenance

Vercel KV implements automatic TTL-based expiration but some manual maintenance may be needed:

1. **Cache Cleanup**

   - All keys have TTL values set via `kv.expire(key, TTL.THREAD_DATA)`
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

2. **Cache Reset**

   If cache data becomes corrupted or needs resetting:

   ```typescript
   // Reset specific thread cache
   await cacheRepository.clearCache(threadId);

   // Reset cache monitor metrics
   cacheMonitor.resetMetrics();
   ```

3. **Cache Verification**

   To verify cache integrity after updates:

   ```bash
   # Run the diagnostic endpoint
   curl https://your-app-url.vercel.app/api/redis-test/diagnostic
   ```

### Local Development

When running in a local development environment:

1. **In-memory Fallback**

   - The system automatically uses an in-memory Map as a fallback when:
     - Required KV environment variables are missing
     - `USE_KV=false` is set in the environment
   - This allows for development without a Redis instance

2. **Enabling Local Storage**

   - Start the application with `USE_KV=false`: `cross-env USE_KV=false npm run dev`
   - The logs will show: `KV client initialized in DEVELOPMENT mode`
   - All KV operations will use the in-memory store

3. **Limitations**
   - The in-memory store is cleared when the server restarts
   - Data is not shared between separate processes
   - TTL functionality is simulated but limited

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
   - Consider using hash operations for related data (HSET/HGET)

3. **Consistency Issues**

   - Verify thread context persistence across sessions
   - Check for race conditions in concurrent updates
   - Review key naming patterns for consistency
   - Ensure all operations have proper error handling

4. **Quota Issues**

   - Monitor daily command usage in Vercel dashboard
   - Check memory usage against plan limits
   - Review access patterns for optimization opportunities
   - Consider upgrading plan if consistently near limits

5. **Local Development Issues**
   - Ensure the local fallback is working correctly with `inMemoryStore`
   - Verify environment variables are not set in local `.env` files
   - Check browser console for KV-related warnings
   - Verify consistent behavior between local and production environments

### Rollback Procedure

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
- **Cache Performance**: Monitor cache hit/miss ratios via CacheMonitor
- **Repository Operations**: Track repository method calls and timing

### Usage Monitoring

- **Query Patterns**: Review common query types
- **User Sessions**: Monitor session activity
- **Feature Utilization**: Note which capabilities are most used
- **Cache Efficiency**: Track cache hit/miss rates
- **Repository Usage**: Monitor which repositories are most active

### Analytics Monitoring

- **Traffic Trends**: Review visitor patterns and page view trends in Vercel Analytics
- **Engagement Metrics**: Monitor bounce rates and session duration
- **Usage Patterns**: Track which parts of the application receive the most traffic
- **Geographic Distribution**: Monitor user location patterns for regional optimization
- **Device Types**: Analyze desktop vs. mobile usage to optimize responsive design
- **Repository Performance**: Track repository method execution times

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

4. **Repository Performance Analysis**
   - Review repository method call patterns
   - Identify optimization opportunities in hot repositories
   - Document repository performance metrics

### Alert Thresholds

Consider setting up alerts for:

- Extended response times (e.g., >15 seconds average)
- Elevated error rates (e.g., >5% of requests)
- High API usage (e.g., >80% of quota)
- Any system downtime
- Abnormal polling patterns
- Cache hit ratio dropping below 70%
- Repository pattern exceptions

## System Recovery Guidelines

### Critical Failure Recovery

1. **Assessment**

   - Identify failure point
   - Determine impact scope
   - Establish recovery priority
   - Check repository implementation logs

2. **Containment**

   - Limit system access if necessary
   - Implement temporary workarounds
   - Communicate status to stakeholders
   - Consider enabling repository rollback flag if appropriate

3. **Recovery Steps**

   - Restore data if corruption occurred
   - Redeploy application if web interface failed
   - Reconfigure API connections if integration issues
   - Reset repository implementation if required

4. **Verification**

   - Test system functionality
   - Verify data integrity
   - Confirm normal operation
   - Verify repository pattern operation

5. **Documentation**
   - Record incident details
   - Document recovery process
   - Update procedures based on lessons learned
   - Note any repository implementation issues

## Contact Roles

Key roles for system maintenance and support:

- System Administrator: Responsible for day-to-day maintenance
- Developer: Handles technical issues and code updates
- Prompt Engineer: Manages prompt system refinements
- Project Manager: Coordinates overall system management
- Repository Pattern Specialist: Maintains repository implementation
- Vercel KV Administrator: Manages cache infrastructure

---

_Last updated: Tue May 13 15:30:42 BST 2025_
