import type { HistoryItem, NoteItem } from '../types';

const DB_NAME = 'ASR-Cache';
const DB_VERSION = 3;
const TRANSCRIPTIONS_STORE = 'transcriptions';
const RECORDINGS_STORE = 'recordings';
const HISTORY_STORE = 'history';
const NOTES_STORE = 'notes';
const RECORDING_KEY = 'last-recording';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject('Error opening IndexedDB.');
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(TRANSCRIPTIONS_STORE)) {
          db.createObjectStore(TRANSCRIPTIONS_STORE);
        }
        if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
          db.createObjectStore(RECORDINGS_STORE);
        }
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
}

// Hashing utility
export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Transcription Cache
interface CachedTranscription {
  transcription: string;
  detectedLanguage: string;
}

export async function getCachedTranscription(hash: string): Promise<CachedTranscription | null> {
  const db = await getDb();
  return new Promise((resolve) => {
    const transaction = db.transaction(TRANSCRIPTIONS_STORE, 'readonly');
    const store = transaction.objectStore(TRANSCRIPTIONS_STORE);
    const request = store.get(hash);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => {
      console.error('Failed to get cached transcription:', request.error);
      resolve(null);
    };
  });
}

export async function setCachedTranscription(hash: string, data: CachedTranscription): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRANSCRIPTIONS_STORE, 'readwrite');
    const store = transaction.objectStore(TRANSCRIPTIONS_STORE);
    const request = store.put(data, hash);
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Failed to set cached transcription:', request.error);
        reject(request.error);
    }
  });
}

// Recording Cache
export async function getCachedRecording(): Promise<File | null> {
    const db = await getDb();
    return new Promise((resolve) => {
        const transaction = db.transaction(RECORDINGS_STORE, 'readonly');
        const store = transaction.objectStore(RECORDINGS_STORE);
        const request = store.get(RECORDING_KEY);
        request.onsuccess = () => {
            if (request.result && request.result instanceof File) {
                resolve(request.result);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => {
            console.error('Failed to get cached recording:', request.error);
            resolve(null);
        };
    });
}

export async function setCachedRecording(file: File): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
        const store = transaction.objectStore(RECORDINGS_STORE);
        const request = store.put(file, RECORDING_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to set cached recording:', request.error);
            reject(request.error);
        }
    });
}

export async function clearCachedRecording(): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(RECORDINGS_STORE, 'readwrite');
        const store = transaction.objectStore(RECORDINGS_STORE);
        const request = store.delete(RECORDING_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear cached recording:', request.error);
            reject(request.error);
        }
    });
}

// --- History Functions ---

export async function addHistoryItem(item: HistoryItem): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Failed to add history item:', request.error);
        reject(request.error);
    }
  });
}

export async function getHistory(): Promise<HistoryItem[]> {
  const db = await getDb();
  return new Promise((resolve) => {
    const transaction = db.transaction(HISTORY_STORE, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve((request.result || []).sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => {
      console.error('Failed to get history:', request.error);
      resolve([]);
    };
  });
}

export async function deleteHistoryItem(id: number): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE, 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to delete history item:', request.error);
            reject(request.error);
        }
    });
}

export async function clearHistory(): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(HISTORY_STORE, 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to clear history:', request.error);
            reject(request.error);
        }
    });
}

// --- Notes Functions ---

export async function addNoteItem(item: NoteItem): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(NOTES_STORE, 'readwrite');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Failed to add note item:', request.error);
        reject(request.error);
    }
  });
}

export async function getNotes(): Promise<NoteItem[]> {
  const db = await getDb();
  return new Promise((resolve) => {
    const transaction = db.transaction(NOTES_STORE, 'readonly');
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve((request.result || []).sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => {
      console.error('Failed to get notes:', request.error);
      resolve([]);
    };
  });
}

export async function deleteNoteItem(id: number): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(NOTES_STORE, 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Failed to delete note item:', request.error);
            reject(request.error);
        }
    });
}