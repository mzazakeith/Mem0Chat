const DB_NAME = 'ChatAppDB';
const DB_VERSION = 1;
const CHATS_STORE_NAME = 'chats';
const MESSAGES_STORE_NAME = 'messages';

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