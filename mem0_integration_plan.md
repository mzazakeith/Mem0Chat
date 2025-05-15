# Mem0.ai Integration Plan

## 1. Overview

Integrate Mem0.ai into the Next.js chat application to provide persistent, contextual memory for users. This involves UI changes for memory management, backend APIs to interact with Mem0.ai and a local IndexedDB cache, and modifications to the existing chat functionality to leverage these memories.

## 2. Phase 1: Setup & Configuration

### 2.1. Install `mem0ai` Package
-   **Action:** Add `mem0ai` (e.g., `^2.1.25` or latest stable) to `package.json` dependencies.
-   **Status:** Done. Ensure `npm install` or `yarn install` is run.

### 2.2. Environment Variable for API Key
-   **Action:** Add `MEM0_API_KEY=your_actual_mem0_api_key` to the `.env.local` file in the project root.
-   **Note:** The actual key needs to be obtained from the Mem0.ai platform.

### 2.3. `userId` Management (Client-Side)
-   **Location:** `app/chat/page.js`
-   **Logic:**
    -   On component mount, check `localStorage` for an existing `userId` (e.g., key `mem0_user_id`).
    -   If not found, generate a new UUID (using the `uuid` package) and store it in `localStorage`.
    -   Store this `userId` in the component's state for API calls.

### 2.4. Global "Memories Active" Setting (Client-Side)
-   **Purpose:** A master switch for the user to enable or disable Mem0.ai memory functionality across the app.
-   **Storage:** `localStorage` (e.g., key `mem0_global_active`, boolean).
-   **UI:** A toggle switch in a settings area or the main chat page layout.
-   **Default:** `false` (or `true`, to be decided).

## 3. Phase 2: Backend API Development (New Routes in `app/api/mem0/`)

### 3.1. Mem0 Client Initialization
-   **File:** `app/api/mem0/_utils.js` (or directly in each route)
-   **Logic:**
    ```javascript
    import { MemoryClient } from 'mem0ai';

    let mem0ClientInstance;

    export function getMem0Client() {
      if (!mem0ClientInstance) {
        if (!process.env.MEM0_API_KEY) {
          throw new Error("MEM0_API_KEY is not set in environment variables.");
        }
        // For Mem0 Platform (Cloud)
        mem0ClientInstance = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
        // For Mem0 Open Source (Self-Hosted) - if switching later
        // mem0ClientInstance = new Memory(); 
      }
      return mem0ClientInstance;
    }
    ```

### 3.2. Route: `POST /api/mem0/add`
-   **File:** `app/api/mem0/add/route.js`
-   **Request Body:** `{ userId: string, content: string }`
-   **Logic:**
    1.  Get `mem0Client` from `_utils.js`.
    2.  Call `await mem0Client.add(body.content, { userId: body.userId })`. Capture the result, especially any ID Mem0 returns for the memory.
    3.  **Trigger Full Refresh:** Fetch all memories for the user from Mem0.ai: `const allMemories = await mem0Client.getAll({ userId: body.userId });`
    4.  Replace all existing local memories for this `userId` in IndexedDB (`lib/db.js`) with `allMemories`.
    5.  Return success response (e.g., the newly added memory or all memories).

### 3.3. Route: `GET /api/mem0/list`
-   **File:** `app/api/mem0/list/route.js`
-   **Query Parameters:** `userId: string`, `globalMemoriesActive: boolean` (passed from client)
-   **Logic:**
    1.  Attempt to fetch memories from local IndexedDB (`lib/db.js`) for the `userId`.
    2.  **Initial Fetch Condition:** If `globalMemoriesActive` is true AND local IndexedDB is empty for this `userId`:
        a.  Get `mem0Client`.
        b.  Call `const freshMemories = await mem0Client.getAll({ userId });`
        c.  Populate IndexedDB with `freshMemories`.
        d.  Return `freshMemories`.
    3.  Else (local DB has memories, or global memories are not active):
        a.  Return memories from local IndexedDB. If global memories are not active, return an empty array or appropriate indicator.

### 3.4. Route: `DELETE /api/mem0/delete`
-   **File:** `app/api/mem0/delete/route.js`
-   **Request Body:** `{ userId: string, memoryId: string }` (`memoryId` is the ID from Mem0.ai)
-   **Logic:**
    1.  Get `mem0Client`.
    2.  Call `await mem0Client.delete({ memory_id: body.memoryId });` (or `await mem0Client.delete(body.memoryId);` - verify exact SDK method).
    3.  **Trigger Full Refresh:** Fetch all memories for the user from Mem0.ai: `const allMemories = await mem0Client.getAll({ userId: body.userId });`
    4.  Replace all existing local memories for this `userId` in IndexedDB with `allMemories`.
    5.  Return success response.

### 3.5. Route: `GET /api/mem0/search`
-   **File:** `app/api/mem0/search/route.js`
-   **Query Parameters:** `userId: string, query: string`
-   **Logic:**
    1.  Get `mem0Client`.
    2.  Call `const searchResults = await mem0Client.search(query, { userId });`
    3.  Return `searchResults` directly. (Should properly caching for semantic search results and return them when we have the same exact search again).

### 3.6. Route: `POST /api/mem0/sync` (for Manual Sync Button)
-   **File:** `app/api/mem0/sync/route.js`
-   **Request Body:** `{ userId: string }`
-   **Logic:**
    1.  Get `mem0Client`.
    2.  Fetch all memories: `const allMemories = await mem0Client.getAll({ userId: body.userId });`
    3.  Replace all local memories for this `userId` in IndexedDB with `allMemories`.
    4.  Return success response with all memories.


## 4. Phase 3: Local Database Enhancements (`lib/db.js`)

### 4.1. Update `db.js` Schema
-   In `onupgradeneeded` function for IndexedDB:
    ```javascript
    if (!db.objectStoreNames.contains('userMemories')) {
      const store = db.createObjectStore('userMemories', { keyPath: 'id' }); // 'id' from Mem0.ai
      store.createIndex('userId', 'userId', { unique: false });
      // Ensure 'id' from Mem0.ai is used as keyPath. If Mem0 doesn't guarantee unique IDs for getAll results
      // across different "memory items" (though it should), we might need a local UUID as keyPath and store mem0Id separately.
      // For now, assume mem0.id is the primary key.
    }
    ```
-   **Memory Object Structure (local):** `{ id: string (from Mem0.ai), userId: string, content: string, createdAt: string (from Mem0.ai), ...any_other_fields_from_mem0 }`

### 4.2. New DB Helper Functions
-   `addLocalMemory(memoryObject)`: (Might not be needed if all adds go through full refresh)
-   `getLocalMemoryById(id)`
-   `getAllLocalMemories(userId)`
-   `deleteLocalMemory(id)`: (Might not be needed if all deletes go through full refresh)
-   `deleteAllLocalMemoriesForUser(userId)`
-   `replaceAllLocalMemoriesForUser(userId, memoriesArray)`: Clears existing memories for the user and adds all from `memoriesArray`.

## 5. Phase 4: Frontend UI Development

### 5.1. New Component: `components/MemoriesPanel.jsx`
-   **Props:** `userId: string`, `globalMemoriesActive: boolean`
-   **State:** `memories: []`, `newMemoryInput: ""`, `searchInput: ""`, `isLoading: false`, `error: null`
-   **UI Structure:**
    -   Right-side panel, collapsible.
    -   Input field and "Add Memory" button.
    -   Input field for "Search Memories" and search button.
    -   Scrollable list to display memories (each with a delete icon).
        -   Display `memory.content` and `memory.createdAt`.
    -   "Sync with Mem0" button.
    -   Loading indicators and error messages.
-   **Functionality:**
    -   `fetchMemories()`: Calls `/api/mem0/list?userId=...&globalMemoriesActive=...`. Updates `memories` state.
    -   `handleAddMemory()`: Calls `POST /api/mem0/add`. Refreshes `memories` state on success (response will contain all memories).
    -   `handleDeleteMemory(memoryId)`: Calls `DELETE /api/mem0/delete` (passing Mem0's memory ID). Refreshes `memories` state.
    -   `handleSearchMemories()`: Calls `GET /api/mem0/search`. Displays results.
    -   `handleSyncMemories()`: Calls `POST /api/mem0/sync`. Refreshes `memories` state.
    -   `useEffect` to call `fetchMemories()` when `userId` or `globalMemoriesActive` changes.

### 5.2. Integrate `MemoriesPanel` into `app/chat/page.js`
-   Add state for `mem0UserId` (from `localStorage`).
-   Add state for `globalMemoriesActive` (from `localStorage`, with a UI toggle).
-   Add state `useChatMemories: boolean` (default `false`, specific to the active chat session).
-   Render `<MemoriesPanel userId={mem0UserId} globalMemoriesActive={globalMemoriesActive} />`.
-   **UI Toggle for Global Memories:** Somewhere accessible (e.g., settings icon, sidebar).
-   **UI Toggle for Per-Chat Memories:** Within the main chat area header for the active chat. Store this preference in the `chatSessions` object in IndexedDB.

### 5.3. Modify Chat Submission Logic in `app/chat/page.js`
-   When sending a message (`handleFormSubmit`):
    -   If `useChatMemories` (for the current active chat) is true AND `globalMemoriesActive` is true:
        -   Include `userId: mem0UserId` and `activateMemories: true` in the payload to `POST /api/chat`.

## 6. Phase 5: Modify Existing Chat API (`app/api/chat/route.js`)

### 6.1. Update `POST` handler
-   **Destructure Payload:** Expect `messages` and `experimental_customTool` from `await req.json();`.
-   **Memory Activation Check:**
    -   Extract `activateMemories = experimental_customTool?.activateMemories` and `userId = experimental_customTool?.userId`.
-   **System Prompt Preparation:**
    -   Initialize `systemPromptContent` with a default (e.g., "You are a helpful AI.").
    -   Check the incoming `messages` array for an existing system message. If found, use its content as the base for `systemPromptContent`.
-   **If `activateMemories` is true and `userId` is provided:**
    1.  Get `mem0Client` from `app/api/mem0/_utils.js`.
    2.  Extract `lastUserMessageContent` from the last user message in the `messages` array.
    3.  **Search Mem0:** If `lastUserMessageContent` exists, call:
        `const relevantMemories = await mem0Client.search(lastUserMessageContent, { user_id: userId /*, limit: 3 */ });` (Consider adding a `limit` like 3-5).
    4.  **Format Memories:**
        -   If `relevantMemories.results` exist and have items:
            -   Slice the results to a manageable number (e.g., `slice(0, 3)`).
            -   Map results to a string: `const memoriesStr = relevantMemories.results.slice(0,3).map(entry => \`- ${entry.memory || entry.content}\`).join('\\n');` (Ensure field name `memory` or `content` matches SDK output).
            -   Append to `systemPromptContent`:
                ```
                ---
                Relevant User Memories:
                ${memoriesStr}
                ---
                Please use these memories to inform your response to the current query.
                Current Conversation:
                ```
        -   Else (no memories found):
            -   Append to `systemPromptContent`:
                ```
                ---
                No specific relevant user memories found for this query.
                ---
                Current Conversation:
                ```
    5.  **Error Handling (Mem0):** Wrap the Mem0 call in a try-catch. If an error occurs, log it and optionally append a note to `systemPromptContent` (e.g., "Error retrieving memories. Proceeding without them.") before the "Current Conversation:" line.
-   **Modify `messages` Array:**
    -   Create a mutable copy of the incoming `messages` (e.g., `finalMessages = [...messages]`).
    -   If an existing system message was found, update its `content` in `finalMessages` with the new `systemPromptContent`.
    -   Else (no existing system message), `unshift` a new system message `{ role: 'system', content: systemPromptContent }` to `finalMessages`.
-   **Call `streamText`:** Use the `finalMessages` array (which now includes the memory-enhanced system prompt) for the `streamText` call to the LLM.

## 7. Phase 6: Refinements & Advanced Features (Future Considerations)

-   **Performance:** Short-term caching for `mem0Client.search()` results in `/api/chat` if API calls are too frequent for similar queries.
-   **UX:**
    -   Clear loading states and error messages for all memory operations.
    -   UI to indicate to the user when memories are being fetched or used in a response.
    -   Debounce search inputs.
-   **Scalability:** Review local DB performance if a user has thousands of memories.
-   **Memory Linking to Chat:** Explore associating memories directly with chat sessions if Mem0.ai supports `run_id` or similar context tagging effectively with the OSS/chosen client. 