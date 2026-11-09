import { validateBackup } from './domain.js';
const KEY = 'tradecompass-sync-v1';

export function createSync({ getState, applyRemote, onStatus }) {
  let meta = { etag: null, dirty: false, owner: null };
  let version = 0, timer, busy = false, connecting = false, remoteConflict = null;
  let metadataAvailable = true, metadataKnown = false;
  try { const raw = localStorage.getItem(KEY); metadataKnown = Boolean(raw); meta = { ...meta, ...JSON.parse(raw || '{}') }; } catch { metadataAvailable = false; }
  const sync = { status: navigator.onLine ? 'local' : 'offline', available: false, user: null, conflict: null };
  const demo = () => getState().mode === 'demo';
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(meta)); metadataKnown = true; } catch { metadataAvailable = false; } };
  const status = value => { sync.status = value; onStatus(sync); };

  async function request(path, options = {}) {
    const response = await fetch(new URL(path, location.href), { ...options, cache: 'no-store', credentials: 'same-origin' });
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Cloud unavailable');
    const data = await response.json();
    if (response.status === 409 || response.status === 412) {
      const error = new Error('conflict'); error.conflict = true; throw error;
    }
    if (!response.ok) throw new Error(data.error?.message || data.error || 'Sync failed');
    return data;
  }
  async function read() {
    const result = await request('./api/state');
    if (result.state) validateBackup(result.state);
    return result;
  }
  function conflict(data, reason = 'version') {
    remoteConflict = data; sync.conflict = reason; status('conflict');
  }
  async function connect() {
    if (connecting) return;
    connecting = true;
    try {
      const session = await request('./api/session');
      sync.available = Boolean(session.authenticated && session.cloud);
      sync.user = session.user;
      if (!sync.available) { status('local'); return; }
      const attempt = version;
      const data = await read();
      if (meta.owner && meta.owner !== session.user?.id) { conflict(data, 'owner'); return; }
      meta.owner = session.user?.id || null;
      // Demonstration edits stay on the device. Loading a cloud journal is explicit.
      if (demo()) { meta.dirty = false; persist(); status('ready'); return; }
      if (data.state && (!metadataAvailable || (!metadataKnown && (getState().trades.length || getState().reviews.length || getState().imports.length)))) { conflict(data, 'metadata'); return; }
      if (meta.dirty && data.etag !== meta.etag) { conflict(data); return; }
      if (data.state && !meta.dirty && attempt === version) {
        const applied = await applyRemote(data.state, () => attempt === version && !meta.dirty);
        if (applied === false) { status('pending'); return; }
        meta.etag = data.etag; persist(); status('saved');
      } else {
        if (!meta.dirty) meta.etag = data.etag;
        persist(); status(meta.dirty ? 'pending' : 'ready');
        if (meta.dirty) schedule();
      }
    } catch { status(navigator.onLine ? 'local' : 'offline'); }
    finally { connecting = false; if (meta.dirty) schedule(); }
  }
  function markDirty() {
    version++;
    if (demo()) { meta.dirty = false; persist(); status(navigator.onLine ? 'local' : 'offline'); return; }
    meta.dirty = true; persist();
    if (sync.conflict) { status('conflict'); return; }
    status(navigator.onLine ? sync.available ? 'pending' : 'local' : 'offline'); schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (sync.available && navigator.onLine && !sync.conflict && !demo() && !connecting) timer = setTimeout(() => syncNow(), 1500);
  }
  async function syncNow() {
    clearTimeout(timer);
    if (busy || connecting) return;
    if (sync.conflict) { status('conflict'); return; }
    if (!navigator.onLine) { status('offline'); return; }
    if (!sync.available) { await connect(); return; }
    busy = true;
    try {
      if (!meta.dirty || demo()) {
        const attempt = version;
        const data = await read();
        // An edit made during a network read must never be replaced by that read.
        if (attempt !== version || (meta.dirty && !demo())) {
          if (data.etag !== meta.etag) conflict(data);
          else { status('pending'); schedule(); }
          return;
        }
        if (data.state) {
          const applied = await applyRemote(data.state, () => attempt === version && (!meta.dirty || demo()));
          if (applied === false) { if (data.etag !== meta.etag) conflict(data); else { status('pending'); schedule(); } return; }
        }
        meta.etag = data.etag; meta.dirty = false; meta.owner = sync.user?.id || null; persist();
        status(data.state ? 'saved' : demo() ? 'ready' : 'pending');
        if (!data.state && !demo()) { meta.dirty = true; persist(); schedule(); }
        return;
      }
      const attempt = version;
      status('syncing');
      const result = await request('./api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(meta.etag ? { 'If-Match': meta.etag } : { 'If-None-Match': '*' }) },
        body: JSON.stringify(getState())
      });
      meta.etag = result.etag;
      if (attempt === version) meta.dirty = false;
      persist(); status(demo() ? 'local' : meta.dirty ? 'pending' : 'saved');
      if (meta.dirty) schedule();
    } catch (error) {
      if (error.conflict) {
        try { remoteConflict = await read(); } catch {}
        sync.conflict = 'version'; status('conflict');
      } else status(navigator.onLine ? 'error' : 'offline');
    } finally { busy = false; }
  }
  async function resolve(choice) {
    if (choice === 'remote') {
      if (!remoteConflict?.state) return false;
      await applyRemote(remoteConflict.state); meta.dirty = false;
    } else {
      if (sync.conflict === 'owner') return false;
      meta.dirty = !demo();
    }
    meta.etag = remoteConflict?.etag || null; meta.owner = sync.user?.id || null;
    sync.conflict = null; remoteConflict = null; persist();
    status(meta.dirty ? 'pending' : 'saved');
    if (meta.dirty) await syncNow();
    return true;
  }
  window.addEventListener('online', () => { if (sync.conflict) status('conflict'); else syncNow(); });
  window.addEventListener('offline', () => status(sync.conflict ? 'conflict' : 'offline'));
  return { sync, connect, markDirty, syncNow, resolve, hasRemote: () => Boolean(remoteConflict?.state) };
}
