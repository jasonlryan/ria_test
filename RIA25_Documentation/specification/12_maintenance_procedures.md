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

### Vercel KV Cache Management

With the migration from file-based caching to Vercel KV, cache management procedures have been updated:

1. **KV Cache Monitoring**

   - Access the Vercel KV dashboard through the Vercel project interface
   - Monitor key metrics: memory usage, command count, and response time
   - Set up alerts for memory usage >80% or command count >75% of plan limits

2. **Cache Structure**

   - Thread metadata stored at keys with pattern: `thread:{threadId}:meta`
   - File data stored at keys with pattern: `thread:{threadId}:file:{fileId}`
   - All keys use standardized 90-day TTL

3. **Cache Inspection**

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

### Thread Management

1. **Thread Cleanup**

   - OpenAI threads persist indefinitely
   - Consider implementing a thread cleanup process for inactive threads:

   ```javascript
   // Example thread cleanup function
   async function cleanupInactiveThreads(olderThanDays = 30) {
     const threadList = await openai.beta.threads.list();
     const cutoffDate = new Date();
     cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

     for (const thread of threadList.data) {
       const lastActive = new Date(thread.last_active_at || thread.created_at);
       if (lastActive < cutoffDate) {
         await openai.beta.threads.del(thread.id);
         console.log(`Deleted inactive thread: ${thread.id}`);

         // Also clean up associated KV cache entries
         const metaKey = `thread:${thread.id}:meta`;
         await kvClient.del(metaKey);

         // Get and delete all file keys for this thread
         const filePattern = `thread:${thread.id}:file:*`;
         const fileKeys = await listKeys(filePattern); // Implement listKeys function
         for (const fileKey of fileKeys) {
           await kvClient.del(fileKey);
         }
       }
     }
   }
   ```

2. **Thread Usage Monitoring**

   - Track thread creation rates
   - Monitor thread retention and reuse rates
   - Analyze thread lifecycle patterns

## Suggested Backup Procedures

### Data Backup

1. **Export Assistant Configuration**

   - Document assistant ID and configuration settings
   - Store configuration information securely

2. **JSON Data Backup**

   - Maintain copies of all processed JSON files
   - Store original CSV data securely
   - Document backup locations

3. **Recommended Backup Schedule**

   - Configuration documentation: When changed
   - JSON data backup: After processing
   - Code repository backup: Regular intervals

4. **Backup Storage Recommendations**

   - Primary: Secure cloud storage
   - Secondary: Local storage
   - Consider encryption for sensitive data

## Troubleshooting

### Suggested Diagnostic Approaches

#### API Connectivity Issues

1. Verify API key validity and environment variable configuration
2. Check API status at OpenAI status page
3. Test basic API connectivity with curl command
4. Review API response logs for error messages

#### Data Retrieval Issues

1. Verify assistant configuration
2. Check file accessibility and integrity
3. Validate data formats and structures
4. Review retrieval mechanisms

#### Response Quality Issues

1. Analyze prompt configuration
2. Test with simplified queries
3. Review context being provided to the model
4. Check for changes in underlying data

#### Performance Issues

1. Analyze response time logs
2. Check polling patterns
3. Verify thread and cache operations
4. Review concurrent request handling
5. Check for any API quota limitations

#### Vercel KV Issues

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

1. Set the environment variable `DISABLE_KV=1` to force fallback to file-based caching
2. Verify the system falls back correctly to file operations
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
