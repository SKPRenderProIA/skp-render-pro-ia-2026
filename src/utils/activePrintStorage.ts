// Utilitário de persistência robusta para o último Print ativo (IndexedDB + fallback em localStorage)

const DB_NAME = 'skp_render_pro_db';
const STORE_NAME = 'active_prints';
const DB_VERSION = 1;

interface ActivePrintData {
  id: string;
  dataUrl: string;
  name?: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveActivePrint(dataUrl: string, name?: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: ActivePrintData = {
        id: 'latest',
        dataUrl,
        name: name || 'Cena 3D SketchUp',
        timestamp: Date.now()
      };
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {
    try {
      localStorage.setItem('skp_active_print_name', name || 'Cena 3D SketchUp');
      // If small enough, save in localStorage
      if (dataUrl && dataUrl.length < 2000000) {
        localStorage.setItem('skp_active_print_data', dataUrl);
      }
    } catch (_) {}
  }
}

export async function getActivePrint(): Promise<{ dataUrl?: string; name?: string } | null> {
  try {
    const db = await openDB();
    const result = await new Promise<ActivePrintData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('latest');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (result && result.dataUrl) {
      return { dataUrl: result.dataUrl, name: result.name };
    }
  } catch (_) {}

  // Fallback para localStorage
  try {
    const dataUrl = localStorage.getItem('skp_active_print_data');
    const name = localStorage.getItem('skp_active_print_name') || undefined;
    if (dataUrl) {
      return { dataUrl, name };
    }
  } catch (_) {}

  return null;
}
