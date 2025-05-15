import Dexie from 'dexie';

const db = new Dexie('ChatAppDB');
db.version(3).stores({
  chatSessions: 'id, title, timestamp, useChatMemories, modelId',
  messages: 'id, chatId, role, content, createdAt',
  mem0Cache: 'userId, &[userId+memoryId], memoryId, content, created_at, updated_at, metadata',
});

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

// Helper to ensure chat session object has all fields, including new optional ones
const ensureChatSessionFields = (session) => {
  return {
    id: session.id,
    title: session.title || 'New Chat',
    timestamp: session.timestamp || Date.now(),
    useChatMemories: typeof session.useChatMemories === 'boolean' ? session.useChatMemories : false,
    modelId: session.modelId || null, // Default to null if not present
  };
};

export async function addChat(session) {
  const fullSession = ensureChatSessionFields(session);
  // Dexie's put will add or update based on the primary key 'id'
  return await db.chatSessions.put(fullSession);
}

export async function getAllChats() {
  const sessions = await db.chatSessions.orderBy('timestamp').reverse().toArray();
  return sessions.map(ensureChatSessionFields); // Ensure all retrieved sessions have the new fields
}

export async function getChatSession(id) {
  const session = await db.chatSessions.get(id);
  return session ? ensureChatSessionFields(session) : undefined;
}

export async function deleteChat(id) {
  // Also delete associated messages
  await db.messages.where('chatId').equals(id).delete();
  return await db.chatSessions.delete(id);
}

export async function addMessage(message) {
  if (!message.id || !message.chatId || !message.role || typeof message.content !== 'string') {
    console.error("Attempted to add invalid message:", message);
    throw new Error("Invalid message object. Required fields: id, chatId, role, content.");
  }
  if (!message.createdAt) {
    message.createdAt = new Date(); 
  }
  return await db.messages.put(message);
}

export async function getMessagesForChat(chatId) {
  return await db.messages.where('chatId').equals(chatId).sortBy('createdAt');
}

// --- Mem0 Local Cache Functions ---
export async function getLocalMemory(userId, memoryId) {
  return await db.mem0Cache.get({ userId, memoryId });
}

export async function getAllLocalMemoriesForUser(userId) {
  return await db.mem0Cache.where('userId').equals(userId).toArray();
}

export async function addLocalMemory(userId, memory) {
  const cacheEntry = {
    userId,
    memoryId: memory.id, // Assuming mem0 memory object has an 'id' field
    ...memory
  };
  return await db.mem0Cache.put(cacheEntry);
}

export async function addManyLocalMemories(userId, memories) {
  if (!memories || memories.length === 0) return;
  const cacheEntries = memories.map(memory => ({
    userId,
    memoryId: memory.id,
    ...memory
  }));
  return await db.mem0Cache.bulkPut(cacheEntries);
}

export async function deleteLocalMemory(userId, memoryId) {
  return await db.mem0Cache.delete({ userId, memoryId });
}

export async function clearLocalMemoriesForUser(userId) {
  return await db.mem0Cache.where('userId').equals(userId).delete();
}

// Replace all local memories for a user with a new set (e.g., after a sync)
export async function replaceAllLocalMemoriesForUser(userId, newMemories) {
  return db.transaction('rw', db.mem0Cache, async () => {
    await clearLocalMemoriesForUser(userId);
    await addManyLocalMemories(userId, newMemories);
  });
}

export default db; 