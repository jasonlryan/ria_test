# Cursor Prompt for Follow-Up Query Fix

Use this prompt with Cursor to implement the follow-up query fix effectively:

```
I need to fix a critical issue with follow-up query handling in our codebase. The system is failing to identify when a query is a follow-up to a previous question. The logs show that follow-up queries are being passed with formatting like "Query: {actual_query}\n\nAnalysis Summary: ..." instead of clean text. This is causing the LLM to be confused about what the actual query is.

Main issues:
1. Query formatting corruption (prefix and analysis sections added to query text)
2. Context loss between message retrievals
3. Inconsistent isFollowUp flag usage
4. Missing metadata in tool calls

Please help me implement the following changes:

1. Create a utility function to normalize queries in utils/shared/queryUtils.ts:
   - Remove "Query:" prefixes
   - Strip out analysis sections
   - Return clean query text

2. Update chatAssistantController.ts to:
   - Create a context object near the beginning of postHandler
   - Consolidate message retrieval
   - Normalize both current and previous queries
   - Pass properly normalized queries and context to all tool calls

3. Update tool handlers to:
   - Normalize any queries received from tool calls
   - Pass isFollowUp flags consistently
   - Ensure previous query context is available

The fix should be minimal and focused on the query normalization issue without changing other functionality.
```

## Key Changes Required

### 1. Create `utils/shared/queryUtils.ts`

This utility file should contain a function to normalize queries by removing "Query:" prefixes and analysis sections.

### 2. Update `app/api/controllers/chatAssistantController.ts`

The controller should be updated to:

- Create a context object for each request
- Normalize queries at input points
- Pass normalized queries to all functions
- Maintain proper context between message retrievals

### 3. Fix Tool Call Handling

Tool calls should consistently:

- Normalize any queries they receive
- Pass the isFollowUp flag correctly
- Include previous query context

## Implementation Approach

Use the Cursor prompt above to create a solution that:

1. Focuses solely on the query normalization problem
2. Makes minimal changes to the codebase
3. Preserves existing functionality
4. Addresses the root cause of the follow-up detection failure

The changes should maintain code style consistency and integrate smoothly with the existing architecture.

## Expected Outcome

After implementation, the system should:

- Correctly identify follow-up queries
- Maintain proper context between requests
- Display appropriate responses to follow-up questions
- Show improved file and topic identification in logs
