# Implementation Plan: Changing Data Retrieval Approach

## Current Architecture

- User sends a query to our API
- We use `processQueryWithData` to:
  - Identify relevant files with `identifyRelevantFiles`
  - Retrieve and process the actual data files
  - Generate analysis of the data
- We send this pre-processed analysis to the assistant
- Assistant responds based on our analysis

## Target Architecture

- User sends a query to our API
- We identify relevant file IDs using `identifyRelevantFiles`
- We send only the prompt and file IDs to the assistant
- Assistant is responsible for retrieving and processing data directly
- Assistant generates its own analysis and response

## Forked Implementation Approach

To allow for testing and comparison between approaches, we'll implement a dual-mode system:

### Mode Selection Framework

- Support two modes of operation:

  - `standard`: Current approach - process data and send analysis (default for backward compatibility)
  - `direct`: New approach - send only file IDs for direct access

- Configure the mode through:
  - Environment variable: `FILE_ACCESS_MODE=direct|standard`
  - Query parameter support: `?accessMode=direct|standard`
  - Assistant-specific configuration in a mapping file

### Dual-Mode Architecture

```
                       ┌─────────────────────┐
                       │   identifyRelevantFiles  │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   Mode Selection    │
                       └──────────┬──────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
                  ▼                               ▼
    ┌───────────────────────┐         ┌───────────────────────┐
    │  Direct Access Mode   │         │   Standard Mode       │
    │  (File IDs only)      │         │  (Processed data)     │
    └───────────┬───────────┘         └───────────┬───────────┘
                │                                 │
                ▼                                 ▼
    ┌───────────────────────┐         ┌───────────────────────┐
    │ Assistant processes   │         │ Assistant uses         │
    │ raw data from files   │         │ pre-processed analysis │
    └───────────────────────┘         └───────────────────────┘
```

## Step-by-Step Plan

### 1. Setup Forked Implementation Framework

- Create configuration system for mode selection
- Implement assistant-to-mode mapping
- Add environment variables for default mode

### 2. Assess and Modify Assistant Configuration

- Update assistant tools definition to include file retrieval capabilities
- Create two sets of assistant instructions (one for each mode)
- Ensure assistant has proper permissions to access our data files

### 3. API Route Changes

- Modify both POST and PUT handlers to support both modes:
  - Extract common logic into shared functions
  - Implement forking based on selected mode
  - Keep thread/file tracking intact for both modes
  - Send appropriate data based on selected mode

### 4. File Tracking Mechanism

- Preserve thread continuity functionality for both modes:
  - Initial query: identify files, track in thread
  - Follow-up queries: detect if files are already tracked
  - Merge new files with existing tracked files

### 5. Performance Measurement and Comparison

- Add timing metrics for both modes:
  - File identification time (common)
  - Data processing time (standard mode only)
  - Response time for each approach
- Implement comparative metrics logging

### 6. Error Handling

- Add robust error handling for both modes
- Implement mode-specific fallbacks
- Handle assistant file access issues

### 7. Testing Strategy

- Test both modes separately and comparatively
- Implement A/B testing capabilities
- Test with various query types and edge cases

### 8. Documentation Updates

- Update documentation to reflect dual-mode architecture
- Document configuration options and recommended settings

## Transition Strategy

- Phase 1: Implement dual-mode support (both modes available)
- Phase 2: Run comparison tests and gather metrics
- Phase 3: Gradually shift traffic to preferred mode
- Phase 4: Consider deprecating the less effective mode

## Key Challenges and Considerations

1. **Mode Selection Logic**: Ensuring proper routing of requests to appropriate mode
2. **File Access**: Ensuring the assistant has proper permissions to access files (for direct mode)
3. **Performance**: Comparing efficiency of both approaches
4. **Thread Continuity**: Maintaining consistent thread context across both modes
5. **Response Quality**: Evaluating if assistant-driven analysis is comparable to pre-processed analysis
6. **Backward Compatibility**: Ensuring existing integrations continue to function

This forked approach provides the flexibility to compare both methods and gradually transition to the direct file access method if it proves more effective, while maintaining backward compatibility.
