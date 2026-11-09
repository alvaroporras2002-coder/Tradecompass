import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, validState } from '../server/worker.js';
import { createEmptyState, createDemoState } from '../src/demo.js';

class MemoryBucket {
  constructor() { this.records = new Map(); this.sequence = 0; this.writes = 0; }
  async get(key) {
    const found = this.records.get(key);
    return found ? { etag: found.etag, json: async () => JSON.parse(found.body) } : null;
  }
  async put(key, body, options) {
    const current = this.records.get(key);
    assert.ok(options.onlyIf instanceof Headers);
    if (options.onlyIf.get('If-None-Match') === '*' && current) return null;
    const match = options.onlyIf.get('If-Match')?.replaceAll('"', '');
    if (match && match !== current?.etag) return null;
    const etag = `etag-${++this.sequence}`;
    this.records.set(key, { etag, body }); this.writes++;
    return { etag };
  }
}
const worker = createWorker({
  '/index.html': { body: btoa('<!doctype html><title>TradeCompass</title>'), type: 'text/html; charset=utf-8' },
  '/icon.png': { body: btoa(String.fromCharCode(0, 128, 255)), type: 'image/png' }
});
function request(path = '/api/state', { method = 'GET', user = 'alice', origin = 'https://trade.example', etag, create = false, body, headers = {} } = {}) {
  const extra = { ...headers };
  if (user) extra['oai-authenticated-user-id'] = user;
  if (method !== 'GET') {
    if (origin) extra.Origin = origin;
    if (create) extra['If-None-Match'] = '*';
    if (etag) extra['If-Match'] = etag;
    if (body !== undefined) extra['Content-Type'] = 'application/json';
  }
  return new Request(`https://trade.example${path}`, { method, headers: extra, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
}

test('the actual personal and demonstration schemas are accepted', () => {
  assert.equal(validState(createEmptyState()), true);
  assert.equal(validState(createDemoState()), true);
});

test('anonymous session is explicit and user data requires identity', async () => {
  const bucket = new MemoryBucket();
  const session = await worker.fetch(request('/api/session', { user: null }), { BUCKET: bucket });
  assert.deepEqual(await session.json(), { authenticated: false, user: null, cloud: true });
  assert.equal(session.headers.get('cache-control'), 'no-store');
  assert.equal((await worker.fetch(request('/api/state', { user: null }), { BUCKET: bucket })).status, 401);
  assert.equal(bucket.writes, 0);
});

test('session decodes gateway name without exposing internal user id', async () => {
  const response = await worker.fetch(request('/api/session', { headers: {
    'oai-authenticated-user-full-name': 'Alvaro%20Porr%C3%A1s',
    'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
    'oai-authenticated-user-email': 'alvaro@example.com'
  } }), { BUCKET: new MemoryBucket() });
  const data = await response.json();
  assert.equal(data.user.name, 'Alvaro Porrás');
  assert.equal(data.user.email, 'alvaro@example.com');
  assert.match(data.user.id, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(data).includes('alice'), false);
});

test('state is isolated by gateway identity even if client claims another user', async () => {
  const bucket = new MemoryBucket();
  const state = { ...createEmptyState(), userId: 'bob' };
  const saved = await worker.fetch(request('/api/state', { method: 'PUT', create: true, body: state }), { BUCKET: bucket });
  assert.equal(saved.status, 200);
  const bob = await worker.fetch(request('/api/state', { user: 'bob' }), { BUCKET: bucket });
  assert.deepEqual(await bob.json(), { state: null, etag: null });
  const alice = await (await worker.fetch(request(), { BUCKET: bucket })).json();
  assert.equal(alice.state.accounts[0].name, 'Mi cuenta');
  assert.match([...bucket.records.keys()][0], /^journal\/v1\/[a-f0-9]{64}\.json$/);
});

test('cross-origin and missing Origin writes fail before storage mutation', async () => {
  const bucket = new MemoryBucket();
  for (const origin of ['https://attacker.example', null]) {
    const response = await worker.fetch(request('/api/state', { method: 'PUT', origin, create: true, body: createEmptyState() }), { BUCKET: bucket });
    assert.equal(response.status, 403);
  }
  assert.equal(bucket.writes, 0);
});

test('atomic conditional writes reject stale updates and duplicate first writes', async () => {
  const bucket = new MemoryBucket();
  const initial = await (await worker.fetch(request('/api/state', { method: 'PUT', create: true, body: createEmptyState() }), { BUCKET: bucket })).json();
  assert.equal((await worker.fetch(request('/api/state', { method: 'PUT', create: true, body: createEmptyState() }), { BUCKET: bucket })).status, 409);
  const state = createEmptyState(); state.settings.name = 'Dispositivo B';
  assert.equal((await worker.fetch(request('/api/state', { method: 'PUT', etag: initial.etag, body: state }), { BUCKET: bucket })).status, 200);
  assert.equal((await worker.fetch(request('/api/state', { method: 'PUT', etag: initial.etag, body: createEmptyState() }), { BUCKET: bucket })).status, 409);
  assert.equal((await (await worker.fetch(request(), { BUCKET: bucket })).json()).state.settings.name, 'Dispositivo B');
});

test('deletion erases personal payload atomically and stale devices cannot resurrect it', async () => {
  const bucket = new MemoryBucket();
  const saved = await (await worker.fetch(request('/api/state', { method: 'PUT', create: true, body: createDemoState() }), { BUCKET: bucket })).json();
  const response = await worker.fetch(request('/api/state', { method: 'DELETE', etag: saved.etag }), { BUCKET: bucket });
  assert.equal(response.status, 200);
  const deleted = await response.json(); assert.equal(deleted.state, null); assert.notEqual(deleted.etag, saved.etag);
  assert.deepEqual(JSON.parse([...bucket.records.values()][0].body), { deleted: true, version: 1 });
  assert.deepEqual(await (await worker.fetch(request(), { BUCKET: bucket })).json(), deleted);
  assert.equal((await worker.fetch(request('/api/state', { method: 'PUT', etag: saved.etag, body: createEmptyState() }), { BUCKET: bucket })).status, 409);
  assert.equal((await worker.fetch(request('/api/state', { method: 'PUT', etag: deleted.etag, body: createEmptyState() }), { BUCKET: bucket })).status, 200);
});

test('invalid schema, JSON, missing preconditions and oversized body never write', async () => {
  const bucket = new MemoryBucket();
  const cases = [
    [request('/api/state', { method: 'PUT', create: true, body: { version: 1 } }), 400],
    [request('/api/state', { method: 'PUT', create: true, body: '{' }), 400],
    [request('/api/state', { method: 'PUT', body: createEmptyState() }), 428],
    [request('/api/state', { method: 'PUT', create: true, body: ' '.repeat(8 * 1024 * 1024 + 1) }), 413]
  ];
  for (const [req, status] of cases) assert.equal((await worker.fetch(req, { BUCKET: bucket })).status, status);
  assert.equal(bucket.writes, 0);
});

test('invalid account ownership, chronology and executable image types are rejected', () => {
  const base = createDemoState();
  const invalid = field => { const state = structuredClone(base); field(state); return validState(state); };
  assert.equal(invalid(s => { s.trades[0].accountId = 'unknown'; }), false);
  assert.equal(invalid(s => { s.trades[0].closedAt = '2000-01-01T00:00:00Z'; }), false);
  assert.equal(invalid(s => { s.trades[0].attachments = [{ data: 'data:image/svg+xml;base64,PHN2Zz4=' }]; }), false);
});

test('imported commission rebates retain their positive sign', () => {
  const state = createDemoState(); state.trades[0].commission = 2.5;
  assert.equal(validState(state), true);
});

test('saved reviews, import batches and transfers retain a valid shape', () => {
  const state = createEmptyState(), accountId = state.accounts[0].id;
  state.reviews.push({ id: 'review-1', accountId, week: '2026-11-09', answers: ['', 'Respeté el plan'], action: 'Registrar el riesgo antes de entrar.' });
  state.imports.push({ id: 'batch-1', accountId, name: 'MT5.csv', createdAt: '2026-11-09T12:00:00Z', count: 1, net: 20 });
  state.cashflows.push({ id: 'flow-1', accountId, date: '2026-11-09T11:00:00Z', amount: 100 });
  assert.equal(validState(state), true);
  state.reviews[0].week = 'ayer'; assert.equal(validState(state), false);
});

test('storage errors expose a recoverable generic response', async () => {
  const response = await worker.fetch(request(), { BUCKET: { get() { throw new Error('secret: infrastructure details'); } } });
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('secret'), false);
});

test('embedded assets support deep links, exact binary content and secure headers', async () => {
  const index = await worker.fetch(request('/journal/one'), {});
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-security-policy'), /object-src 'none'/);
  assert.equal(index.headers.get('cache-control'), 'no-cache');
  const image = await worker.fetch(request('/icon.png'), {});
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [0, 128, 255]);
  assert.equal((await worker.fetch(request('/missing.js'), {})).status, 404);
});
