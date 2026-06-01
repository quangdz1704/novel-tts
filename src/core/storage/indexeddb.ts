const DB_NAME = 'novel_tts_db';
const DB_VERSION = 1;
const META_STORE = 'novels';
const PROGRESS_STORE = 'progress';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE))
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PROGRESS_STORE))
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'novelId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveNovelMetadata(novelId: string, meta: any) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    store.put({ id: novelId, ...meta });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getNovelMetadata(novelId: string) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.get(novelId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listNovelsMetadata() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReadingProgress(novelId: string, progress: any) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readwrite');
    const store = tx.objectStore(PROGRESS_STORE);
    store.put({ novelId, ...progress });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getReadingProgress(novelId: string) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readonly');
    const store = tx.objectStore(PROGRESS_STORE);
    const req = store.get(novelId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listReadingProgress() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readonly');
    const store = tx.objectStore(PROGRESS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
