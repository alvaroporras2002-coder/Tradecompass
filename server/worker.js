import { validExtensions } from '../src/extensions.js';
// Identity headers are supplied by the Sites gateway, never by client state.
const MAX_BYTES = 8 * 1024 * 1024;
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, oai-authenticated-user-id' };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: jsonHeaders });
const problem = (code, message, status) => json({ error: { code, message } }, status);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, max = 500) => typeof value === 'string' && value.length > 0 && value.length <= max;
const finite = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const validDate = value => string(value, 100) && Number.isFinite(Date.parse(value));

function uniqueRecords(list, max) {
  if (!Array.isArray(list) || list.length > max) return false;
  const ids = new Set();
  return list.every(item => object(item) && string(item.id, 150) && !ids.has(item.id) && ids.add(item.id));
}

export function validState(state) {
  if (!object(state) || state.version !== 1 || !['demo', 'personal'].includes(state.mode)) return false;
  if (!object(state.settings) || !['es', 'en'].includes(state.settings.language)) return false;
  for (const [key, max] of Object.entries({ accounts: 100, trades: 20000, rules: 1000, reviews: 2000, imports: 2000, cashflows: 10000 })) {
    if (!uniqueRecords(state[key], max)) return false;
  }
  if (!validExtensions(state)) return false;
  const accounts = new Set(state.accounts.map(item => item.id));
  if (!state.accounts.every(item => string(item.name, 300) && /^[A-Z]{3}$/.test(item.currency) && finite(item.initialBalance))) return false;
  if (!state.trades.every(trade => {
    const quick = trade.captureMode === 'quick' && trade.source === 'manual';
    const supplied = value => value !== null && value !== undefined && value !== '';
    if (!accounts.has(trade.accountId) || !string(trade.symbol, 100) || !['buy', 'sell'].includes(trade.side) || !['open', 'closed'].includes(trade.status)) return false;
    if ((!quick || trade.status === 'open' || supplied(trade.openedAt)) && !validDate(trade.openedAt)) return false;
    if ((!quick || supplied(trade.entry)) && (!finite(trade.entry) || Number(trade.entry) <= 0)) return false;
    if ((!quick || supplied(trade.volume)) && (!finite(trade.volume) || Number(trade.volume) <= 0)) return false;
    if (trade.status === 'closed' && (!validDate(trade.closedAt) || (supplied(trade.openedAt) && Date.parse(trade.closedAt) < Date.parse(trade.openedAt)) || (!quick && !supplied(trade.exit)) || (supplied(trade.exit) && (!finite(trade.exit) || Number(trade.exit) <= 0)) || !['gross', 'commission', 'swap'].every(key => finite(trade[key])))) return false;
    if (quick && trade.status === 'open' && supplied(trade.exit) && (!finite(trade.exit) || Number(trade.exit) <= 0)) return false;
    if (trade.risk !== null && trade.risk !== undefined && trade.risk !== '' && (!finite(trade.risk) || Number(trade.risk) <= 0)) return false;
    if (!Array.isArray(trade.tags) || trade.tags.length > 100 || !trade.tags.every(tag => string(tag, 150))) return false;
    if (!Array.isArray(trade.attachments) || trade.attachments.length > 10 || !trade.attachments.every(attachment => object(attachment) && typeof attachment.data === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(attachment.data))) return false;
    if (trade.checklist !== undefined && (!object(trade.checklist) || !Object.values(trade.checklist).every(answer => ['yes', 'no', 'na', ''].includes(answer)))) return false;
    return true;
  })) return false;
  if (!state.rules.every(rule => string(rule.text, 2000))) return false;
  if (!state.reviews.every(review => accounts.has(review.accountId) && /^\d{4}-\d{2}-\d{2}$/.test(review.week) && validDate(review.week) && Array.isArray(review.answers) && review.answers.length <= 6 && review.answers.every(answer => typeof answer === 'string' && answer.length <= 3000) && string(review.action, 500))) return false;
  if (!state.imports.every(batch => accounts.has(batch.accountId) && string(batch.name, 1000) && validDate(batch.createdAt) && Number.isInteger(batch.count) && batch.count >= 0 && finite(batch.net))) return false;
  if (!state.cashflows.every(flow => accounts.has(flow.accountId) && finite(flow.amount) && validDate(flow.date))) return false;
  return true;
}

function identity(request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id || id.length > 1024) return null;
  const email = request.headers.get('oai-authenticated-user-email') || '';
  let name = request.headers.get('oai-authenticated-user-full-name') || '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(name); } catch { name = ''; }
  }
  return { id, email, name: name || email || 'Trader' };
}

async function userKey(id) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return 'journal/v1/' + [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('') + '.json';
}

function conditions(request) {
  const match = request.headers.get('If-Match');
  const none = request.headers.get('If-None-Match');
  if (match && none) return null;
  if (none === '*') return new Headers({ 'If-None-Match': '*' });
  if (match && /^"?[a-zA-Z0-9_-]{1,128}"?$/.test(match)) return new Headers({ 'If-Match': '"' + match.replaceAll('"', '') + '"' });
  return null;
}

async function limitedText(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new RangeError('size');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) { await reader.cancel(); throw new RangeError('size'); }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) { result.set(part, offset); offset += part.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(result);
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin && !['cross-site', 'none'].includes(request.headers.get('Sec-Fetch-Site'));
}

async function api(request, env, url) {
  const method = request.method;
  if (['PUT', 'DELETE', 'POST', 'PATCH'].includes(method) && !sameOrigin(request)) return problem('origin', 'La solicitud debe venir de esta aplicación.', 403);
  const user = identity(request);
  if (url.pathname === '/api/session') {
    if (method !== 'GET') return problem('method', 'Método no disponible.', 405);
    return json({ authenticated: Boolean(user), user: user ? { id: (await userKey(user.id)).split('/').pop().replace('.json', ''), name: user.name, email: user.email } : null, cloud: Boolean(env.BUCKET) });
  }
  if (url.pathname !== '/api/state') return problem('not_found', 'Ruta no disponible.', 404);
  if (!user) return problem('unauthorized', 'Inicia sesión para sincronizar tu diario.', 401);
  if (!env.BUCKET) return problem('unavailable', 'La sincronización no está disponible en este alojamiento.', 503);
  if (!['GET', 'PUT', 'DELETE'].includes(method)) return problem('method', 'Método no disponible.', 405);
  const key = await userKey(user.id);
  if (method === 'GET') {
    const record = await env.BUCKET.get(key);
    if (!record) return json({ state: null, etag: null });
    const saved = await record.json();
    return json({ state: saved?.deleted === true ? null : saved, etag: record.etag });
  }
  const onlyIf = conditions(request);
  if (!onlyIf) return problem('precondition', 'Actualiza la copia de la nube antes de guardar.', 428);
  let state = null;
  if (method === 'PUT') {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return problem('content_type', 'Se requiere un documento JSON.', 415);
    try { state = JSON.parse(await limitedText(request)); }
    catch (error) { return error instanceof RangeError ? problem('size', 'El diario supera el límite de 8 MiB.', 413) : problem('json', 'El documento JSON no es válido.', 400); }
    if (!validState(state)) return problem('validation', 'El diario contiene datos no compatibles con la versión 1.', 400);
  }
  // R2 lacks conditional delete. A conditional tombstone replaces all personal
  // payload atomically, preventing a stale device from deleting a newer edit.
  const stored = method === 'DELETE' ? { deleted: true, version: 1 } : state;
  const result = await env.BUCKET.put(key, JSON.stringify(stored), { onlyIf, httpMetadata: { contentType: 'application/json' } });
  if (!result) return problem('conflict', 'Hay cambios más recientes en la nube. Descárgalos o conserva una copia antes de resolver el conflicto.', 409);
  return json({ state, etag: result.etag });
}

function assetResponse(request, url, assets) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Método no disponible.', { status: 405, headers: { 'Allow': 'GET, HEAD' } });
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return new Response('Ruta no válida.', { status: 400 }); }
  let asset = assets[path === '/' ? '/index.html' : path];
  if (!asset && !path.split('/').pop().includes('.')) asset = assets['/index.html'];
  if (!asset) return new Response('No encontrado.', { status: 404 });
  const headers = {
    'Content-Type': asset.type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
  };
  const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
  return new Response(body, { headers });
}

export function createWorker(assets = {}) {
  return { async fetch(request, env = {}) {
    const url = new URL(request.url);
    try {
      return url.pathname.startsWith('/api/') ? await api(request, env, url) : assetResponse(request, url, assets);
    } catch {
      return problem('unavailable', 'No se pudo completar la solicitud. Inténtalo de nuevo.', 503);
    }
  } };
}
