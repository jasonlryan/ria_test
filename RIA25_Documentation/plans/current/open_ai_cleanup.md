# OpenAI Service Cleanup Implementation Plan

## Overview

We need to clean up redundant files and consolidate OpenAI service functionality into the new unified service. This involves removing duplicate implementations, updating imports, and ensuring consistent patterns across the codebase.

## Phase 1: File Removal and Import Updates

1. **Remove Redundant Files**

   - Delete `app/api/services/openaiService.js`
   - Delete `app/api/services/threadService.js`
   - Keep `utils/shared/polling.js` for now (will be replaced by polling-manager.ts)

2. **Update Imports**
   - Search for all imports of the old services
   - Replace with imports from `unifiedOpenAIService.ts`
   - Update any direct OpenAI client usage to use the unified service

## Phase 2: Controller Updates

1. **Update chatAssistantController.ts**

   - Replace OpenAI client initialization with unified service
   - Update all method calls to use unified service methods
   - Consolidate error handling patterns
   - Update logging to use consistent patterns

2. **Update Other Controllers**
   - Identify any other controllers using the old services
   - Update them to use the unified service
   - Ensure consistent error handling

## Phase 3: Documentation Updates

1. **Update Function Reference**

   - Update `17_file_function_reference.md`
   - Remove references to old services
   - Add documentation for new unified service
   - Update any related documentation

2. **Update Type Definitions**
   - Consolidate all TypeScript types in unified service
   - Remove duplicate type definitions
   - Ensure consistent type usage

## Phase 4: Testing Updates

1. **Update Existing Tests**

   - Update test imports to use unified service
   - Update test cases to match new service patterns
   - Remove tests for old services

2. **Add New Tests**
   - Add comprehensive tests for unified service
   - Test all error handling paths
   - Test feature flag functionality

## Implementation Guidelines

1. **Error Handling**

   - Use consistent error response format
   - Implement proper error types
   - Add comprehensive error logging

2. **Logging**

   - Use consistent logging patterns
   - Add appropriate log levels
   - Include relevant context in logs

3. **Configuration**

   - Consolidate all OpenAI configuration
   - Use environment variables consistently
   - Document configuration options

4. **Type Safety**
   - Ensure all methods are properly typed
   - Use consistent interface definitions
   - Add proper TypeScript documentation

## Success Criteria

1. All OpenAI functionality uses unified service
2. No duplicate implementations remain
3. Consistent error handling and logging
4. All tests passing
5. Documentation updated
6. No TypeScript errors
7. No runtime errors in existing functionality

## Rollback Plan

1. Keep old service files in git history
2. Document all changes made
3. Create feature flags for gradual rollout
4. Maintain ability to switch back to old implementation

## Next Steps

1. Begin with Phase 1: File Removal and Import Updates
2. Move to Phase 2: Controller Updates
3. Proceed with Phase 3: Documentation Updates
4. Complete with Phase 4: Testing Updates

Would you like to proceed with implementing Phase 1 of this cleanup plan?
