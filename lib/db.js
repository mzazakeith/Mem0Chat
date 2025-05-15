const DB_NAME = 'ChatAppDB';
const DB_VERSION = 2;
const CHATS_STORE_NAME = 'chats';
const MESSAGES_STORE_NAME = 'messages';
const USER_MEMORIES_STORE_NAME = 'userMemories';

let dbPromise = null;

function openDB() {
  if (typeof window === 'undefined') {
    return Promise.reject('IndexedDB can only be used in the browser.');
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(CHATS_STORE_NAME)) {
          const chatStore = db.createObjectStore(CHATS_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          chatStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(MESSAGES_STORE_NAME)) {
          const messageStore = db.createObjectStore(MESSAGES_STORE_NAME, { keyPath: 'id', autoIncrement: false });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(USER_MEMORIES_STORE_NAME)) {
          const userMemoriesStore = db.createObjectStore(USER_MEMORIES_STORE_NAME, { keyPath: 'id' });
          userMemoriesStore.createIndex('userId', 'userId', { unique: false });
          userMemoriesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function addChat(chat) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CHATS_STORE_NAME);
    const request = store.put({ ...chat, timestamp: chat.timestamp || Date.now() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function getAllChats() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHATS_STORE_NAME);
    const index = store.index('timestamp'); // Sort by timestamp
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result.reverse()); // Most recent first
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function getChat(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CHATS_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function addMessage(message) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MESSAGES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(MESSAGES_STORE_NAME);
    const request = store.put({ ...message, timestamp: message.timestamp || Date.now() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function getMessagesForChat(chatId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MESSAGES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(MESSAGES_STORE_NAME);
    const index = store.index('chatId');
    const request = index.getAll(chatId);
    request.onsuccess = () => {
      // Sort messages by timestamp before resolving
      const sortedMessages = request.result.sort((a, b) => a.timestamp - b.timestamp);
      resolve(sortedMessages);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function deleteChat(chatId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHATS_STORE_NAME, MESSAGES_STORE_NAME], 'readwrite');
    const chatStore = transaction.objectStore(CHATS_STORE_NAME);
    const messageStore = transaction.objectStore(MESSAGES_STORE_NAME);

    const deleteChatRequest = chatStore.delete(chatId);
    deleteChatRequest.onerror = (event) => reject(event.target.error);

    const messageIndex = messageStore.index('chatId');
    const messagesRequest = messageIndex.openCursor(IDBKeyRange.only(chatId));
    messagesRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    messagesRequest.onerror = (event) => reject(event.target.error);

    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(event.target.error);
  });
}

export async function getAllLocalMemories(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USER_MEMORIES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(USER_MEMORIES_STORE_NAME);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => {
      // Sort by createdAt, assuming it's a timestamp or ISO string that sorts chronologically
      const sortedMemories = request.result.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB; // Ascending, oldest first. For descending: dateB - dateA
      });
      resolve(sortedMemories);
    };
    request.onerror = (event) => {
      console.error("Error fetching local memories:", event.target.error);
      reject(event.target.error);
    };
  });
}

export async function replaceAllLocalMemoriesForUser(userId, memoriesArray) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(USER_MEMORIES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(USER_MEMORIES_STORE_NAME);

    // 1. Clear existing memories for the user
    const userIndex = store.index('userId');
    const clearRequest = userIndex.openCursor(IDBKeyRange.only(userId));
    let clearedCount = 0;

    clearRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        clearedCount++;
        cursor.continue();
      } else {
        // Finished clearing, now add new memories
        console.log(`Cleared ${clearedCount} old memories for userId: ${userId}`);
        let addedCount = 0;
        if (memoriesArray && memoriesArray.length > 0) {
          memoriesArray.forEach(memory => {
            // Ensure each memory object has the userId if not already present from source
            // and a valid `id` from Mem0 for keyPath
            if (!memory.id) {
              console.warn("Memory object missing id, skipping:", memory);
              return; // Skip if no id from Mem0
            }
            const memoryToStore = { ...memory, userId }; 
            const addRequest = store.put(memoryToStore);
            addRequest.onsuccess = () => {
              addedCount++;
              if (addedCount === memoriesArray.filter(m => m.id).length) { // Check against valid memories
                // This is tricky because put is async. Transaction.oncomplete is better.
              }
            };
            addRequest.onerror = (addEvent) => {
              console.error('Error adding memory during replace:', addEvent.target.error, memory);
              // Potentially reject or collect errors, but transaction.onerror will catch it broadly
            };
          });
        } else {
          // No new memories to add, resolve after clearing if needed
          // Covered by transaction.oncomplete
        }
      }
    };
    clearRequest.onerror = (event) => {
      console.error("Error clearing memories for user:", event.target.error);
      reject(event.target.error);
    };

    transaction.oncomplete = () => {
      console.log(`Replaced memories for userId: ${userId}. Added approx ${memoriesArray ? memoriesArray.filter(m=>m.id).length : 0} new memories.`);
      resolve();
    };
    transaction.onerror = (event) => {
      console.error("Transaction error in replaceAllLocalMemoriesForUser:", event.target.error);
      reject(event.target.error);
    };
  });
} 