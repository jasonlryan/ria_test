# Data Compatibility Integration Plan

> **Last Updated:** Mon Apr 22 2025  
> **Target Audience:** Developers, System Architects, Technical Stakeholders  
> **Related Documents:**
>
> - 03_data_processing_workflow.md
> - 06_system_architecture.md
> - utils/openai/1_data_retrieval.md
> - prompts/assistant_prompt.md

## Overview

This document outlines the implementation plan for enhancing the data compatibility assessment, tracking, and handling across the RIA25 system. The goal is to ensure that compatibility information from the canonical mapping is properly retrieved, stored, transmitted, and utilized throughout the system, resulting in accurate and transparent analysis that respects data limitations.

## How This Works (Plain English Summary)

- **When you ask for data (for example, "What is the 2025 result for the UK?")**, the system will give you exactly what you asked for—just the 2025 UK data. It will not automatically include data from other years or groups unless you specifically ask for a comparison.

- **If you ask for a comparison (for example, "How did satisfaction change from 2024 to 2025 in the UK?")**, the system will check if a valid comparison is possible. If it is, it will show both years and explain the comparison. If not, it will show only the valid data and clearly explain why a comparison isn't possible.

- **Behind the scenes, the system always checks if comparisons are possible** for the topic and group you mentioned. It keeps track of which topics, countries, or groups can be compared across years, and which cannot.

- **If comparable data is available but you didn't ask for a comparison**, the system will not include extra data by default. However, it can optionally add a friendly note at the end of the answer, such as:  
  "Comparable data for previous years is available. If you'd like to see a comparison, just ask!"

- **If only some groups can be compared** (for example, UK and US can be compared, but Japan cannot), the answer will compare the groups that are valid, and for the others, it will show only the available data and explain why.

- **All limitations or special rules will be clearly explained** at the start of the answer, so you always know what you're seeing and why.

- **This approach keeps answers focused and avoids overwhelming you with extra information you didn't request.** It also makes it easy to follow up and ask for a comparison if you're interested, knowing that the data is available.

- **The system can be configured to always mention when comparable data is available, or to stay silent unless you ask.** This can be adjusted based on user or project preference.

---

## Current State Assessment

### Identified Gaps

1. **Incomplete Data Flow**: While the data retrieval prompt (`1_data_retrieval.md`) has been enhanced to assess compatibility, the compatibility information may not be properly preserved through the system pipeline.

2. **Storage Limitation**: The compatibility assessment is not consistently stored with thread context for reference in follow-up questions.

3. **Assistant Handling**: The assistant prompt lacks specific instructions on how to handle compatibility information.

4. **Code Implementation**: Current implementation in `utils/openai/retrieval.js` and related files may not fully support the enhanced compatibility requirements.

## Implementation Plan

### 1. Compatibility Data Structure

We will define a standardized compatibility metadata schema to be passed through the system:

```typescript
interface CompatibilityMetadata {
  // Top-level compatibility assessment
  isFullyCompatible: boolean;

  // Per-topic compatibility information
  topicCompatibility: {
    [topicId: string]: {
      comparable: boolean;
      availableYears: string[];
      availableMarkets: string[];
      userMessage: string;
    };
  };

  // Per-segment compatibility information
  segmentCompatibility: {
    [segmentType: string]: {
      comparable: boolean;
      comparableValues: string[];
      userMessage: string;
    };
  };

  // Version information for cache invalidation
  mappingVersion: string;

  // Compatibility assessment timestamp
  assessedAt: number;
}
```

### 2. Enhanced Data Retrieval Service

#### 2.1 Update Data Retrieval Service

Modify `app/api/services/dataRetrievalService.js` to extract and process compatibility information:

```javascript
async function identifyRelevantFiles(
  query,
  context,
  isFollowUp,
  previousQuery,
  previousResponse
) {
  // Existing implementation...

  // Extract compatibility information from canonical mapping
  const compatibilityMetadata = assessCompatibility(
    relevantTopics,
    requestedSegments
  );

  return {
    fileIds,
    matchedTopics,
    segments,
    outOfScope,
    conversationState,
    explanation,
    compatibilityMetadata, // Add this new field
  };
}

function assessCompatibility(topics, segments) {
  // Implementation to check compatibility information
  // Based on canonical mapping data
  // Return structured compatibility metadata
}
```

#### 2.2 Error Handling for Compatibility Assessment

Enhance error handling to distinguish between technical errors and actual data limitations:

```javascript
function assessCompatibility(topics, segments) {
  try {
    // Normal compatibility assessment
  } catch (error) {
    logger.error(`Compatibility assessment error: ${error.message}`);
    return {
      isFullyCompatible: false,
      error: {
        type: "TECHNICAL",
        message: "Unable to assess compatibility due to a technical issue",
        details: error.message,
      },
      // Default restrictive compatibility settings
      topicCompatibility: {},
      segmentCompatibility: {},
    };
  }
}
```

### 3. Thread Context & Storage

#### 3.1 Thread Cache Enhancement

Extend the thread cache schema to include compatibility metadata:

```javascript
// In utils/cache-utils.ts
export interface ThreadCache {
  fileIds: string[];
  requestTimestamp: number;
  compatibilityMetadata?: CompatibilityMetadata;
}

export function updateThreadCache(
  threadId,
  { fileIds, compatibilityMetadata }
) {
  const key = threadFileKey(threadId, "cache");
  return kv
    .hset(key, {
      fileIds: JSON.stringify(fileIds),
      compatibilityMetadata: compatibilityMetadata
        ? JSON.stringify(compatibilityMetadata)
        : null,
      requestTimestamp: Date.now(),
    })
    .then(() => {
      return kv.expire(key, 60 * 60 * 24 * 90); // 90 days TTL (matching thread TTL)
    });
}
```

#### 3.2 Cache Invalidation Strategy

Implement version-based cache invalidation for compatibility metadata:

```javascript
export async function isCompatibilityMetadataValid(
  threadId,
  currentMappingVersion
) {
  const cache = await getThreadCache(threadId);

  if (!cache || !cache.compatibilityMetadata) {
    return false;
  }

  try {
    const metadata = JSON.parse(cache.compatibilityMetadata);
    // Check if mapping version matches and assessment is recent enough
    return (
      metadata.mappingVersion === currentMappingVersion &&
      Date.now() - metadata.assessedAt < 7 * 24 * 60 * 60 * 1000
    ); // 7 days max age
  } catch (error) {
    logger.error(`Error validating compatibility metadata: ${error.message}`);
    return false;
  }
}
```

#### 3.3 Race Condition Prevention

Implement locking mechanism for concurrent modifications to the same thread:

```javascript
// In utils/shared/locking.js
export async function withThreadLock(threadId, operation) {
  const lockKey = `lock:thread:${threadId}`;
  const lockId = uuidv4();

  try {
    // Acquire lock with 30s expiry (prevent deadlocks)
    const acquired = await kv.set(lockKey, lockId, {
      nx: true, // Only set if not exists
      ex: 30, // 30 second expiry
    });

    if (!acquired) {
      throw new Error("Thread is currently locked by another operation");
    }

    // Perform the operation
    return await operation();
  } finally {
    // Release lock if we own it
    const currentLock = await kv.get(lockKey);
    if (currentLock === lockId) {
      await kv.del(lockKey);
    }
  }
}
```

### 4. Integration with Data Processing Pipeline

#### 4.1 Update retrieval.js

Modify `utils/openai/retrieval.js` to process and pass compatibility information:

```javascript
async function processQueryWithData(
  query,
  context,
  cachedFileIds,
  threadId,
  isFollowUpContext,
  previousQueryContext,
  previousAssistantResponseContext
) {
  // Existing implementation...

  // Add compatibility metadata to the context
  const compatibilityInformation =
    fileIdentificationResult.compatibilityMetadata;
  context.compatibilityMetadata = compatibilityInformation;

  // Build prompts with compatibility information
  const prompt = buildPromptWithFilteredData(query, filteredData, {
    compatibilityMetadata: compatibilityInformation,
    // other options...
  });

  // Rest of implementation...
}
```

#### 4.2 Update Prompt Utils

Enhance `utils/openai/promptUtils.js` to include compatibility information in prompts:

```javascript
function buildPromptWithFilteredData(query, filteredData, options) {
  // Existing implementation...

  // Add compatibility section to prompt if present
  if (options.compatibilityMetadata) {
    const compatibilitySection = formatCompatibilityMetadataForPrompt(
      options.compatibilityMetadata,
      options.compatibilityVerbosity || "standard"
    );
    // Insert compatibility section into prompt
    promptTemplate = promptTemplate.replace(
      "{{COMPATIBILITY_INFORMATION}}",
      compatibilitySection
    );
  } else {
    promptTemplate = promptTemplate.replace(
      "{{COMPATIBILITY_INFORMATION}}",
      ""
    );
  }

  // Rest of implementation...
}

function formatCompatibilityMetadataForPrompt(metadata, verbosity) {
  // Format compatibility metadata based on verbosity level
  // Returns formatted string for prompt insertion
}
```

### 5. Assistant Prompt Enhancements

Update `prompts/assistant_prompt.md` to include specific instructions for handling compatibility information:

```markdown
## Data Compatibility Rules

- If the query requests a comparison, but the data is not comparable, clearly state this limitation at the beginning of your response.
- When presenting incomparable data, explain why the comparison is not possible using the provided userMessage.
- For partially comparable data (e.g., some segments can be compared but others cannot), clearly indicate which comparisons are valid.
- If data is comparable but the user has not requested a comparison, only mention the availability of comparable data after providing the primary answer.
- Use the following template for compatibility notices:
```

**Compatibility Note:** [Insert relevant message from compatibilityMetadata]

```
- Never invent compatibility where it doesn't exist or make unauthorized comparisons.
```

### 6. User Experience Enhancements

#### 6.1 Tiered Messaging System

Implement configurable verbosity levels for compatibility explanations:

```javascript
// In utils/openai/promptUtils.js
function formatCompatibilityMetadataForPrompt(metadata, verbosity) {
  switch (verbosity) {
    case "minimal":
      // Brief compatibility message, 1-2 sentences
      return formatMinimalCompatibilityMessage(metadata);

    case "standard":
      // Standard explanation with basic reasoning
      return formatStandardCompatibilityMessage(metadata);

    case "detailed":
      // Comprehensive explanation with specific limitations
      return formatDetailedCompatibilityMessage(metadata);

    default:
      return formatStandardCompatibilityMessage(metadata);
  }
}
```

#### 6.2 Feature Flagging

Implement feature flags for gradual rollout:

```javascript
// In utils/config.js
export const featureFlags = {
  enableCompatibilityChecks: true,
  enableCompatibilityStorage: true,
  compatibilityVerbosity: "standard", // 'minimal', 'standard', 'detailed'
  alwaysMentionComparability: false, // Whether to always mention when data is comparable
};
```

### 7. Testing Strategy

#### 7.1 Test Scenarios

Define specific test scenarios to validate compatibility logic:

1. **Full Compatibility Test**: Verify system correctly identifies and handles fully comparable topics
2. **Incompatible Data Test**: Verify system properly explains when comparisons cannot be made
3. **Partial Compatibility Test**: Test handling of mixed compatibility (some segments comparable, others not)
4. **Year Mismatch Test**: Test behavior when requesting comparison between incompatible years
5. **Market Compatibility Test**: Test behavior for markets with different compatibility profiles
6. **Error Recovery Test**: Verify system handles technical errors in compatibility assessment gracefully
7. **Thread Persistence Test**: Verify compatibility metadata persists correctly across multiple interactions
8. **Cache Invalidation Test**: Test that outdated compatibility assessments are properly refreshed

#### 7.2 Validation Metrics

Define metrics for assessing implementation success:

1. **Compatibility Assessment Accuracy**: % of correctly identified compatibility scenarios
2. **User Message Accuracy**: % of appropriate userMessages included in responses
3. **Storage Reliability**: % of thread interactions with correctly persisted compatibility data
4. **Performance Impact**: Average latency increase due to compatibility processing

### 8. Monitoring and Observability

#### 8.1 Logging Enhancement

Implement enhanced logging for compatibility assessment:

```javascript
// In utils/logger.js
function logCompatibilityAssessment(queryId, metadata, duration) {
  logger.info(`Compatibility assessment completed`, {
    queryId,
    isFullyCompatible: metadata.isFullyCompatible,
    topicCount: Object.keys(metadata.topicCompatibility).length,
    segmentCount: Object.keys(metadata.segmentCompatibility).length,
    duration,
    timestamp: new Date().toISOString(),
  });
}
```

#### 8.2 Monitoring Metrics

Define metrics to track in production:

1. Compatibility assessment execution time
2. Cache hit/miss rate for compatibility data
3. Rate of compatibility-related errors
4. Distribution of compatibility scenarios (fully compatible, incompatible, partially compatible)
5. User follow-up rate after compatibility information display

### 9. Documentation and Training

#### 9.1 Internal API Documentation

Update API documentation to reflect new parameters and return values:

```javascript
/**
 * Process a query with available data
 * @param {string} query - User query
 * @param {object} context - Processing context
 * @param {string[]} cachedFileIds - Previously cached file IDs
 * @param {string} threadId - Thread identifier
 * @param {boolean} isFollowUpContext - Whether this is a follow-up query
 * @param {string} previousQueryContext - Previous query text
 * @param {string} previousAssistantResponseContext - Previous assistant response
 * @returns {object} Processing result including:
 *   - answer: The generated answer
 *   - fileIds: File IDs used for the answer
 *   - compatibilityMetadata: Data compatibility information
 *   - performance: Performance metrics
 */
```

#### 9.2 Client Implementation Guide

Create documentation for clients on handling compatibility information:

- How to display compatibility messages to end users
- Handling of follow-up queries related to comparability
- Interpreting and utilizing the compatibility metadata

### 10. Implementation Phases and Timeline

#### Phase 1: Core Infrastructure (Week 1-2)

- Compatibility metadata schema definition
- Data retrieval service enhancement
- Thread cache storage implementation
- Basic error handling

#### Phase 2: Integration (Week 3-4)

- Prompt template updates
- Assistant prompt enhancement
- Pipeline integration
- Basic testing

#### Phase 3: Enhanced Features (Week 5-6)

- Tiered messaging implementation
- Feature flagging
- Advanced error handling
- Race condition prevention

#### Phase 4: Testing and Validation (Week 7-8)

- Comprehensive test execution
- Metric validation
- Performance optimization
- Documentation completion

#### Phase 5: Rollout (Week 9-10)

- Gradual production deployment
- Monitoring implementation
- Client guidance
- Training and support

### 11. Backward Compatibility

To maintain backward compatibility:

1. Implement fallback behavior when compatibility metadata is not available
2. Ensure old client interfaces continue to function (omitting new metadata if not requested)
3. Add version headers to API responses to indicate compatibility feature support
4. Provide migration path for existing threads (on-demand compatibility assessment)

### 12. Performance Optimization

To minimize impact on response times:

1. Implement caching of compatibility assessments
2. Perform compatibility checks asynchronously where possible
3. Optimize canonical mapping access for compatibility checks
4. Batch compatibility assessments for related topics
5. Set acceptable performance thresholds (max 50ms overhead for compatibility processing)

---

## Implementation Progress Report

> **Last Updated:** Sat Jul 13 2025
> **Status:** Phase 3 - In Progress

### Completed Components

✅ **Compatibility Metadata Schema**

- Complete implementation of standardized compatibility metadata structure
- Schema integrated throughout the data processing pipeline

✅ **Data Retrieval Service**

- Successfully implemented `assessCompatibility` function in `dataRetrievalService.js`
- Added robust error handling for compatibility assessment
- Enhanced query processing to extract and evaluate compatibility information

✅ **Thread Cache**

- Extended thread cache to store compatibility metadata
- Implemented cache validation and invalidation logic
- Added compatibility metadata to thread context

✅ **Data Processing Pipeline**

- Updated `retrieval.js` to process and pass compatibility information
- Enhanced `promptUtils.js` with compatibility formatting functions
- Implemented tiered verbosity levels (minimal, standard, detailed)

✅ **Comparison Query Detection**

- Added robust detection of comparison requests in user queries
- Implemented regex pattern matching for various comparison phrasings
- Added automatic verbosity escalation for comparison queries

✅ **Assistant Prompt Integration**

- Updated assistant prompt with specific instructions for handling compatibility data
- Added visual warning indicators and standardized formatting
- Implemented special handling for non-comparable topics
- Added explicit requirement to include canonical mapping messages verbatim

### In Progress Components

🔄 **Enhanced User Experience**

- Completed: Tiered messaging system implementation
- Completed: Automatic verbosity adjustment based on query type
- In progress: Feature flag implementation for gradual rollout

🔄 **Testing and Validation**

- Completed: Core test scripts for comparison detection
- Completed: Basic integration tests for compatibility assessment
- In progress: Comprehensive test coverage for all compatibility scenarios
- Pending: Final validation on production-like environment

🔄 **Monitoring and Observability**

- Completed: Basic compatibility assessment logging
- Completed: Thread cache monitoring
- In progress: Enhanced metrics tracking for production deployment
- Pending: Dashboard implementation for compatibility statistics

🔄 **Documentation**

- Completed: Internal code documentation
- In progress: Client implementation guide
- Pending: Training materials for content team

### Implementation Phase Status

| Phase | Description            | Status      | Progress |
| ----- | ---------------------- | ----------- | -------- |
| 1     | Core Infrastructure    | Completed   | 100%     |
| 2     | Integration            | Completed   | 100%     |
| 3     | Enhanced Features      | In Progress | 75%      |
| 4     | Testing and Validation | In Progress | 50%      |
| 5     | Rollout                | Not Started | 0%       |

### Next Steps

1. Complete feature flag implementation for controlling compatibility features
2. Finish comprehensive test suite covering all compatibility scenarios
3. Finalize client implementation guide and documentation
4. Implement enhanced monitoring for production deployment
5. Begin phased rollout to production environment

### Known Issues

1. Extended processing time observed for queries with many topics (~15-20ms overhead)
2. Occasional false positives in comparison query detection for complex queries
3. Need to update some older test scripts to work with new compatibility structures

---

## Conclusion

This comprehensive implementation plan addresses the data compatibility integration requirements for RIA25. By following this plan, we will create a robust system that properly handles data compatibility throughout the user experience, ensuring accurate and transparent analysis while maintaining system performance and reliability.

The phased implementation approach allows for incremental delivery of value while managing risks and validating our approach at each stage. Regular checkpoints will be established to assess progress and adjust the plan as needed based on findings during implementation.
