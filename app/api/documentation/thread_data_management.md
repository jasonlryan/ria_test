# Thread ID and Data File Cache Management

This document explains how the RIA25 application manages conversation threads and caches data files for efficient follow-up queries.

## Thread ID Management

The system manages conversation threads through a persistent `threadId` that's stored in localStorage:

1. **Initial Creation**:

   - When a user first starts a conversation, `/api/chat-assistant/route.ts` creates a new thread:

   ```typescript
   const thread = await openai.beta.threads.create();
   finalThreadId = thread.id;
   ```

2. **Persistence**:

   - In `page.tsx`, the threadId is saved to localStorage:

   ```javascript
   useEffect(() => {
     if (threadId) {
       localStorage.setItem("chatThreadId", threadId);
     }
   }, [threadId]);
   ```

3. **Retrieval on Page Load**:
   - When the app loads, it checks localStorage:
   ```javascript
   const [threadId, setThreadId] = useState(() => {
     if (typeof window !== "undefined") {
       const savedThreadId = localStorage.getItem("chatThreadId");
       return savedThreadId || null;
     }
     return null;
   });
   ```

## Data File Cache Structure

The data file cache tracks which files have been loaded for each thread:

1. **Cache Structure**:

   ```javascript
   {
     "thread_123ABC": {
       fileIds: ["2025_1", "2025_2", "2025_3"],
       data: { /* raw data from these files */ }
     },
     "thread_456XYZ": {
       fileIds: ["2025_6", "2025_7"],
       data: { /* raw data from these files */ }
     }
   }
   ```

2. **Cache Initialization**:
   ```javascript
   const [threadDataCache, setThreadDataCache] = useState(() => {
     if (typeof window !== "undefined") {
       const savedCache = localStorage.getItem("threadDataCache");
       return savedCache ? JSON.parse(savedCache) : {};
     }
     return {};
   });
   ```

## Cache Update Process

When new data is retrieved, it's added to the thread's cache:

1. **Update Function**:

   ```javascript
   const updateThreadCache = useCallback((threadId, newFileIds, newData) => {
     setThreadDataCache((prevCache) => {
       const updatedCache = { ...prevCache };

       // Initialize if needed
       if (!updatedCache[threadId]) {
         updatedCache[threadId] = { fileIds: [], data: {} };
       }

       // Add new file IDs without duplicates
       const existingIds = updatedCache[threadId].fileIds || [];
       const allFileIds = [...existingIds];

       newFileIds.forEach((id) => {
         if (!allFileIds.includes(id)) {
           allFileIds.push(id);
         }
       });

       updatedCache[threadId].fileIds = allFileIds;

       // Update data
       updatedCache[threadId].data = {
         ...(updatedCache[threadId].data || {}),
         ...newData,
       };

       // Save to localStorage
       if (typeof window !== "undefined") {
         localStorage.setItem("threadDataCache", JSON.stringify(updatedCache));
       }

       return updatedCache;
     });
   }, []);
   ```

2. **When Updates Happen**:
   After successful data retrieval in `sendPrompt()`:
   ```javascript
   if (threadId && dataResult?.file_ids && dataResult.file_ids.length > 0) {
     const newFileIds = dataResult.file_ids;
     const newData = { raw_data: dataResult.raw_data };

     // Update the cache
     updateThreadCache(threadId, newFileIds, newData);
   }
   ```

## Cache Usage for Follow-up Queries

When a follow-up query is detected:

1. **Retrieval**:

   ```javascript
   const getCachedFilesForThread = useCallback(
     (threadId) => {
       return threadDataCache[threadId] || { fileIds: [], data: {} };
     },
     [threadDataCache]
   );
   ```

2. **Usage in API Call**:

   ```javascript
   const dataRetrievalResponse = await fetch("/api/query", {
     method: "POST",
     body: JSON.stringify({
       query: questionText,
       context: "all-sector",
       cachedFileIds: cachedFiles.fileIds, // Pass cached IDs
     }),
   });
   ```

3. **Optimization in retrieval.js**:
   ```javascript
   if (cachedFileIds && cachedFileIds.length > 0) {
     // Thread has cached files

     if (isLikelyFollowUp) {
       // For follow-ups, use cached data
       return {
         file_ids: cachedFileIds,
         status: "follow_up",
         ...
       };
     }
   }
   ```

## Clearing the Cache

When a user resets the conversation:

```javascript
const refreshChat = () => {
  // Reset thread ID
  setThreadId(null);
  localStorage.removeItem("chatThreadId");

  // Clear thread data cache
  if (threadId) {
    setThreadDataCache((prevCache) => {
      const updatedCache = { ...prevCache };
      delete updatedCache[threadId];
      localStorage.setItem("threadDataCache", JSON.stringify(updatedCache));
      return updatedCache;
    });
  }
};
```

## Benefits and Design Philosophy

1. **Performance Optimization**:

   - Avoids redundant data retrieval for follow-up questions
   - Reduces API calls and processing time

2. **Conversation Continuity**:

   - Maintains context across sessions using localStorage
   - Allows users to continue conversations after browser refresh

3. **Smart Follow-up Detection**:

   - Uses a combination of thread presence and query analysis
   - Distinguishes between follow-ups and new topics

4. **Incremental Data Collection**:
   - Only adds new file IDs that weren't previously cached
   - Builds up a comprehensive data context as the conversation progresses
