/** Guarda os áudios da cápsula no próprio aparelho (IndexedDB), sem servidor. */
const DB = 'miller-minute';
const STORE = 'capsules';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb'));
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb'));
    tx.oncomplete = () => db.close();
  });
}

export function saveRecording(id: string, blob: Blob): Promise<IDBValidKey> {
  return run('readwrite', (s) => s.put(blob, id));
}

export function loadRecording(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export function deleteRecording(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id));
}
