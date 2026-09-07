import { initialState, type AppState } from './domain.ts';
export interface LocalTrack {
  id: string;
  name: string;
  blob: Blob;
}
let database: Promise<IDBDatabase> | null = null;
export function openDB(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(Error('This browser cannot save local data.'));
        return;
      }
      const req = indexedDB.open('superfocus', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('state');
        req.result.createObjectStore('music', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          database = null;
        };
        resolve(req.result);
      };
      req.onerror = () => {
        database = null;
        reject(req.error);
      };
      req.onblocked = () => {
        database = null;
        reject(
          Error('Close older SuperFocus tabs and reload to open your data.'),
        );
      };
    });
  return database;
}
export async function readState(): Promise<AppState> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly'),
      r = tx.objectStore('state').get('app');
    r.onsuccess = () => resolve(r.result ?? initialState());
    r.onerror = () => reject(r.error);
  });
}
export async function updateState(
  change: (state: AppState) => AppState,
): Promise<AppState> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'),
      store = tx.objectStore('state'),
      r = store.get('app');
    let next: AppState;
    r.onsuccess = () => {
      try {
        next = change(r.result ?? initialState());
        store.put(next, 'app');
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? Error('Your changes could not be saved.'));
  });
}
export async function musicList(): Promise<LocalTrack[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = db.transaction('music').objectStore('music').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveMusic(track: LocalTrack): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('music', 'readwrite');
    tx.objectStore('music').put(track);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function deleteMusic(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('music', 'readwrite');
    tx.objectStore('music').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
