const DB_NAME = 'tradecompass';
const STORAGE_KEY = 'tradecompass-state-v1';
let database;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB no disponible.'));
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error || new Error('No se pudo abrir el almacenamiento.')); };
    request.onblocked = () => { database = null; reject(new Error('Cierra otras pestañas de TradeCompass para actualizar el almacenamiento.')); };
  });
  return database;
}
export async function loadState() {
  // A fallback exists only after a failed IndexedDB write, so it is newer.
  let fallback, fallbackReadable = false;
  try { fallback = globalThis.localStorage?.getItem(STORAGE_KEY); fallbackReadable = Boolean(globalThis.localStorage); } catch {}
  if (fallback) {
    try { return JSON.parse(fallback); }
    catch { throw new Error('No se pudo leer el guardado local. Conserva una exportación de tus datos.'); }
  }
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction('state', 'readonly').objectStore('state').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    if (!globalThis.indexedDB && fallbackReadable) return null;
    throw new Error('No se pudo leer el almacenamiento. Reintenta sin borrar tus datos.');
  }
}
export async function saveState(state) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(state, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Guardado cancelado.'));
    });
    // Remove stale fallback only once the durable write has completed.
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return { storage: 'indexeddb' };
  } catch (error) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return { storage: 'localstorage' }; }
    catch { throw new Error('No se pudo guardar: el almacenamiento está lleno o bloqueado. Exporta una copia y libera espacio.'); }
  }
}
