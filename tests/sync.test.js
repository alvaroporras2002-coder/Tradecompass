import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync } from '../src/sync.js';
import { createEmptyState, createDemoState } from '../src/demo.js';
import { migrateWorkspace } from '../src/workspace.js';

const KEY = 'tradecompass-sync-v1';
const originals = new Map();
let values, online, requests, listeners, timers, responder;
const install = (name, value) => {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const session = (id = 'user-a', cloud = true) => json({authenticated: true, cloud, user: {id, email: `${id}@example.test`}});
const state = name => {
  const result = createEmptyState();
  result.settings.testMarker = name;
  return result;
};
const metadata = () => JSON.parse(values.get(KEY) || '{}');
const deferred = () => {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};};
const flush = async () => {for (let i = 0; i < 30; i++) await Promise.resolve();};
const fire = event => (listeners.get(event) || []).forEach(listener => listener());
const setMeta = meta => values.set(KEY, JSON.stringify({etag: null, dirty: false, owner: null, ...meta}));
const setup = (initial = state('local'), { prepareRemote } = {}) => {
  let current = initial;
  const applied = [], statuses = [];
  const client = createSync({
    getState: () => current,
    applyRemote: async remote => {
      const prepared = prepareRemote ? prepareRemote(remote) : {state: remote};
      if (prepared === false) return false;
      applied.push(structuredClone(prepared.state)); current = structuredClone(prepared.state);
      return prepared.result;
    },
    onStatus: value => statuses.push({status: value.status, conflict: value.conflict, available: value.available}),
  });
  return {...client, applied, statuses, get current() {return current;}, edit(name) {current = state(name); client.markDirty();}};
};

test.beforeEach(() => {
  values = new Map(); online = true; requests = []; listeners = new Map(); timers = new Map();
  let nextTimer = 1;
  install('localStorage', {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))});
  install('navigator', {get onLine() {return online;}});
  install('location', {href: 'https://tradecompass.example.test/'});
  install('window', {addEventListener: (name, handler) => listeners.set(name, [...(listeners.get(name) || []), handler])});
  install('setTimeout', callback => {const id = nextTimer++; timers.set(id, callback); return id;});
  install('clearTimeout', id => timers.delete(id));
  install('fetch', async (input, init = {}) => {
    const request = {url: String(input), path: new URL(input).pathname, method: init.method || 'GET', ...init};
    requests.push(request);
    if (!responder) throw new Error('Unexpected fetch');
    return responder(request);
  });
});

test.afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  originals.clear();
});

test('connect applies a validated remote journal and records its identity and version', async () => {
  const remote = state('cloud');
  responder = req => req.path.endsWith('/session') ? session() : json({state: remote, etag: 'v1'});
  const client = setup();
  await client.connect();
  assert.equal(client.current.settings.testMarker, 'cloud');
  assert.equal(client.applied.length, 1);
  assert.equal(client.sync.status, 'saved');
  assert.deepEqual(metadata(), {etag: 'v1', dirty: false, owner: 'user-a'});
  assert.ok(requests.every(req => req.credentials === 'same-origin' && req.cache === 'no-store'));
});

test('offline edits retain persisted dirty state and make no network requests', async () => {
  online = false;
  const client = setup();
  client.edit('offline-edit');
  await client.syncNow();
  assert.equal(client.sync.status, 'offline');
  assert.equal(metadata().dirty, true);
  assert.equal(client.current.settings.testMarker, 'offline-edit');
  assert.equal(requests.length, 0);
  assert.equal(timers.size, 0);
});

test('cloud unavailable keeps local edits pending without reporting a cloud save', async () => {
  responder = () => session('user-a', false);
  const client = setup();
  client.edit('pending');
  await client.connect();
  assert.equal(client.sync.available, false);
  assert.equal(client.sync.status, 'local');
  assert.equal(metadata().dirty, true);
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
  assert.equal(client.applied.length, 0);
});

test('dirty journal with a changed remote version requires conflict resolution', async () => {
  setMeta({etag: 'v1', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('other-device'), etag: 'v2'});
  const client = setup(state('unsynced'));
  await client.connect();
  await client.syncNow();
  assert.equal(client.sync.status, 'conflict');
  assert.equal(client.sync.conflict, 'version');
  assert.equal(client.current.settings.testMarker, 'unsynced');
  assert.equal(metadata().dirty, true);
  assert.equal(client.applied.length, 0);
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

test('shared-device user mismatch never uploads the previous user journal after reconnect', async () => {
  setMeta({etag: 'same-etag', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session('user-b') : json({state: state('user-b-journal'), etag: 'same-etag'});
  const client = setup(state('private-user-a-edit'));
  await client.connect();
  assert.equal(client.sync.conflict, 'owner');
  online = false; fire('offline');
  online = true; fire('online');
  await flush();
  await client.syncNow();
  assert.ok(!requests.some(req => req.method === 'PUT'), 'a network change must not bypass the owner conflict');
  assert.equal(client.current.settings.testMarker, 'private-user-a-edit');
  assert.equal(client.applied.length, 0);
  assert.equal(metadata().dirty, true);
});

test('a second mutation during PUT remains dirty and is sent on the next version', async () => {
  setMeta({etag: 'v1', dirty: false, owner: 'user-a'});
  const firstUpload = deferred(); let uploads = 0;
  responder = req => {
    if (req.path.endsWith('/session')) return session();
    if (req.method === 'GET') return json({state: state('cloud'), etag: 'v1'});
    uploads++;
    return uploads === 1 ? firstUpload.promise : json({etag: 'v3'});
  };
  const client = setup(); await client.connect();
  client.edit('first-edit');
  const upload = client.syncNow();
  await flush();
  client.edit('second-edit');
  firstUpload.resolve(json({etag: 'v2'}));
  await upload;
  assert.equal(metadata().dirty, true);
  assert.equal(client.sync.status, 'pending');
  assert.equal(client.current.settings.testMarker, 'second-edit');
  const first = requests.find(req => req.method === 'PUT');
  assert.equal(JSON.parse(first.body).settings.testMarker, 'first-edit');
  await client.syncNow();
  const last = requests.filter(req => req.method === 'PUT').at(-1);
  assert.equal(JSON.parse(last.body).settings.testMarker, 'second-edit');
  assert.equal(last.headers['If-Match'], 'v2');
  assert.equal(metadata().dirty, false);
  assert.equal(client.sync.status, 'saved');
});

test('a delayed clean GET cannot overwrite an edit created while it was in flight', async () => {
  setMeta({etag: 'v1', dirty: false, owner: 'user-a'});
  const delayed = deferred(); let reads = 0;
  responder = req => {
    if (req.path.endsWith('/session')) return session();
    reads++;
    return reads === 1 ? json({state: state('cloud-v1'), etag: 'v1'}) : delayed.promise;
  };
  const client = setup(); await client.connect();
  const polling = client.syncNow();
  await flush();
  client.edit('new-local-edit');
  delayed.resolve(json({state: state('cloud-v2'), etag: 'v2'}));
  await polling;
  assert.equal(client.current.settings.testMarker, 'new-local-edit');
  assert.equal(client.applied.length, 1, 'only the initial remote journal should have been applied');
  assert.equal(metadata().dirty, true);
  assert.notEqual(client.sync.status, 'saved');
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

test('failed PUT retains the dirty journal and reports an error', async () => {
  setMeta({etag: 'v1', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session() : req.method === 'PUT' ? json({error: 'Storage temporarily unavailable'}, 503) : json({state: state('old-cloud'), etag: 'v1'});
  const client = setup(state('unsynced')); await client.connect();
  await client.syncNow();
  assert.equal(client.sync.status, 'error');
  assert.equal(client.current.settings.testMarker, 'unsynced');
  assert.equal(metadata().dirty, true);
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
});

test('non-JSON cloud responses never claim synchronization succeeded', async () => {
  responder = () => new Response('<html>Sign in</html>', {status: 200, headers: {'Content-Type': 'text/html'}});
  const client = setup(); client.edit('local-only'); await client.connect();
  assert.equal(client.sync.status, 'local');
  assert.equal(metadata().dirty, true);
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
});

test('conditional PUT conflict loads the newer remote state without replacing local edits', async () => {
  setMeta({etag: 'v1', dirty: true, owner: 'user-a'});
  let reads = 0;
  responder = req => {
    if (req.path.endsWith('/session')) return session();
    if (req.method === 'PUT') return json({error: 'Version conflict'}, 412);
    reads++;
    return json({state: state(reads === 1 ? 'old-cloud' : 'new-cloud'), etag: reads === 1 ? 'v1' : 'v2'});
  };
  const client = setup(state('my-unsynced-work')); await client.connect(); await client.syncNow();
  assert.equal(client.sync.conflict, 'version');
  assert.equal(client.current.settings.testMarker, 'my-unsynced-work');
  assert.equal(client.applied.length, 0);
  assert.equal(client.hasRemote(), true);
  assert.equal(metadata().dirty, true);
  const resolved = await client.resolve('remote');
  assert.equal(resolved, true);
  assert.equal(client.current.settings.testMarker, 'new-cloud');
  assert.deepEqual(metadata(), {etag: 'v2', dirty: false, owner: 'user-a'});
  assert.equal(client.sync.status, 'saved');
});

test('choosing the local conflict version uses the latest remote precondition', async () => {
  setMeta({etag: 'v1', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session() : req.method === 'PUT' ? json({etag: 'v3'}) : json({state: state('remote-work'), etag: 'v2'});
  const client = setup(state('my-local-work')); await client.connect();
  const resolved = await client.resolve('local');
  assert.equal(resolved, true);
  const put = requests.find(req => req.method === 'PUT');
  assert.equal(put.headers['If-Match'], 'v2');
  assert.equal(JSON.parse(put.body).settings.testMarker, 'my-local-work');
  assert.equal(client.applied.length, 0);
  assert.equal(metadata().dirty, false);
  assert.equal(client.sync.status, 'saved');
});

test('invalid remote backup is rejected before it can replace the local journal', async () => {
  responder = req => req.path.endsWith('/session') ? session() : json({state: {version: 99}, etag: 'invalid'});
  const client = setup(state('valid-local')); await client.connect();
  assert.equal(client.current.settings.testMarker, 'valid-local');
  assert.equal(client.applied.length, 0);
  assert.notEqual(client.sync.status, 'saved');
});

test('an empty personal workspace schedules its first upload without falsely reporting saved', async () => {
  responder = req => req.path.endsWith('/session') ? session() : json({state: null, etag: null});
  const client = setup(); await client.connect();
  assert.equal(client.sync.status, 'ready');
  await client.syncNow();
  assert.equal(client.sync.status, 'pending');
  assert.equal(metadata().dirty, true);
  assert.equal(timers.size, 1);
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
});


test('demonstration changes stay local and never schedule uploads', async () => {
  responder = req => req.path.endsWith('/session') ? session() : json({state: null, etag: null});
  const demo = createDemoState();
  const client = setup(demo); await client.connect();
  demo.settings.testMarker = 'demo-edit'; client.markDirty();
  assert.equal(metadata().dirty, false);
  assert.equal(timers.size, 0);
  assert.equal(client.sync.status, 'local');
  await client.syncNow();
  assert.equal(client.sync.status, 'ready');
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

test('a demonstration journal loads a cloud journal only on explicit synchronization', async () => {
  const remote = state('personal-cloud');
  responder = req => req.path.endsWith('/session') ? session() : json({state: remote, etag: 'v1'});
  const client = setup(createDemoState()); await client.connect();
  assert.equal(client.current.mode, 'demo');
  assert.equal(client.applied.length, 0);
  assert.equal(client.sync.status, 'ready');
  await client.syncNow();
  assert.equal(client.current.mode, 'personal');
  assert.equal(client.current.settings.testMarker, 'personal-cloud');
  assert.equal(client.sync.status, 'saved');
});

test('an owner conflict cannot be resolved by uploading the previous user journal', async () => {
  setMeta({etag: 'v1', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session('user-b') : json({state: state('user-b'), etag: 'v2'});
  const client = setup(state('private-user-a')); await client.connect();
  assert.equal(await client.resolve('local'), false);
  assert.equal(client.sync.conflict, 'owner');
  assert.ok(!requests.some(req => req.method === 'PUT'));
  assert.equal(metadata().owner, 'user-a');
});

test('connection initialization preserves a local mutation created during its GET', async () => {
  setMeta({etag: 'v1', dirty: false, owner: 'user-a'});
  const waiting = deferred();
  responder = req => req.path.endsWith('/session') ? session() : waiting.promise;
  const client = setup(state('before'));
  const connecting = client.connect(); await flush();
  client.edit('created-during-connect');
  waiting.resolve(json({state: state('other-device'), etag: 'v2'}));
  await connecting;
  assert.equal(client.current.settings.testMarker, 'created-during-connect');
  assert.equal(client.applied.length, 0);
  assert.equal(client.sync.conflict, 'version');
  assert.equal(metadata().dirty, true);
});

test('pending initialization never uploads before the remote owner check finishes', async () => {
  setMeta({etag: 'v1', dirty: false, owner: 'user-a'});
  const pendingRead = deferred();
  responder = req => req.path.endsWith('/session') ? session('user-b') : pendingRead.promise;
  const client = setup(state('previous-user'));
  const connecting = client.connect(); await flush();
  client.edit('previous-user-new-edit');
  await client.syncNow();
  assert.ok(!requests.some(req => req.method === 'PUT'));
  assert.equal(timers.size, 0);
  pendingRead.resolve(json({state: state('current-user'), etag: 'v1'}));
  await connecting;
  assert.equal(client.sync.conflict, 'owner');
  assert.equal(client.current.settings.testMarker, 'previous-user-new-edit');
  assert.equal(timers.size, 0);
});

test('remote apply guard rejects a queued replacement after a new local mutation', async () => {
  setMeta({etag: 'v1', dirty: false, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote'), etag: 'v1'});
  const waiting = deferred();
  let current = state('before'), applied = false;
  const client = createSync({
    getState: () => current,
    onStatus: () => {},
    applyRemote: async (remote, guard) => {
      await waiting.promise;
      if (guard && !guard()) return false;
      current = remote; applied = true; return true;
    },
  });
  const connecting = client.connect(); await flush();
  current = state('edit-before-queued-apply'); client.markDirty();
  waiting.resolve(); await connecting;
  assert.equal(applied, false);
  assert.equal(current.settings.testMarker, 'edit-before-queued-apply');
  assert.equal(metadata().dirty, true);
  assert.equal(client.sync.status, 'pending');
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

test('blocked metadata reads fail closed before applying an existing cloud journal', async () => {
  install('localStorage', {getItem() {throw new Error('Blocked');}, setItem() {throw new Error('Blocked');}});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote'), etag: 'v1'});
  const client = setup(state('keep-local')); await client.connect();
  assert.equal(client.sync.conflict, 'metadata');
  assert.equal(client.sync.status, 'conflict');
  assert.equal(client.applied.length, 0);
  assert.equal(client.current.settings.testMarker, 'keep-local');
  await client.syncNow();
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

test('metadata write failure preserves the journal for explicit conflict resolution', async () => {
  install('localStorage', {getItem: key => values.get(key) ?? null, setItem() {throw new Error('Quota exceeded');}});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote'), etag: 'v1'});
  const client = setup(state('original')); client.edit('unsynced-despite-metadata-failure');
  await client.connect();
  assert.equal(client.sync.conflict, 'metadata');
  assert.equal(client.current.settings.testMarker, 'unsynced-despite-metadata-failure');
  assert.equal(client.applied.length, 0);
  assert.equal(client.hasRemote(), true);
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
});

for (const recordType of ['trades', 'reviews', 'imports']) {
  test(`missing metadata cannot automatically replace local personal ${recordType}`, async () => {
    const local = state(`personal-${recordType}`);
    local[recordType].push({id: `retained-${recordType}`});
    responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote'), etag: 'v1'});
    const client = setup(local); await client.connect();
    assert.equal(client.sync.conflict, 'metadata');
    assert.equal(client.applied.length, 0);
    assert.equal(client.current[recordType][0].id, `retained-${recordType}`);
    assert.ok(!requests.some(req => req.method === 'PUT'));
  });
}

test('malformed persisted synchronization metadata never authorizes replacement', async () => {
  values.set(KEY, '{not valid json');
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote'), etag: 'v1'});
  const client = setup(state('retained')); await client.connect();
  assert.equal(client.sync.conflict, 'metadata');
  assert.equal(client.applied.length, 0);
  assert.equal(client.current.settings.testMarker, 'retained');
});

test('explicit remote resolution can recover from unavailable metadata without uploading local data', async () => {
  install('localStorage', {getItem() {throw new Error('Blocked');}, setItem() {throw new Error('Blocked');}});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('chosen-cloud'), etag: 'v1'});
  const client = setup(state('local')); await client.connect();
  assert.equal(client.sync.conflict, 'metadata');
  assert.equal(await client.resolve('remote'), true);
  assert.equal(client.current.settings.testMarker, 'chosen-cloud');
  assert.equal(client.sync.conflict, null);
  assert.ok(!requests.some(req => req.method === 'PUT'));
});

const prepareMigratedRemote = remote => {
  const cleaned = migrateWorkspace(remote);
  return {state: cleaned.state, result: {needsSync: cleaned.changed}};
};
const legacyDemo = () => createDemoState(new Date('2026-11-09T14:00:00.000Z'));

test('initial cloud migration remains pending until the cleaned journal uploads with its original ETag', async () => {
  const remote = legacyDemo();
  responder = req => req.path.endsWith('/session') ? session() : req.method === 'PUT' ? json({etag: 'clean-v2'}) : json({state: remote, etag: 'legacy-v1'});
  const client = setup(state('empty-local'), {prepareRemote: prepareMigratedRemote});
  await client.connect();
  assert.equal(client.current.mode, 'personal');
  assert.deepEqual(client.current.trades, []);
  assert.deepEqual(client.current.rules, []);
  assert.ok(client.current.accounts.every(account => account.initialBalance === 0));
  assert.equal(client.sync.status, 'pending');
  assert.deepEqual(metadata(), {etag: 'legacy-v1', dirty: true, owner: 'user-a'});
  assert.ok(!client.statuses.some(value => value.status === 'saved'));
  assert.ok(!requests.some(req => req.method === 'PUT'));
  assert.equal(timers.size, 1);

  await client.syncNow();
  const put = requests.find(req => req.method === 'PUT');
  assert.equal(put.headers['If-Match'], 'legacy-v1');
  assert.deepEqual(JSON.parse(put.body), client.current);
  assert.deepEqual(metadata(), {etag: 'clean-v2', dirty: false, owner: 'user-a'});
  assert.equal(client.sync.status, 'saved');
});

test('a manual cloud read retains migration dirtiness and uploads against the newly read ETag', async () => {
  setMeta({etag: 'clean-v1', dirty: false, owner: 'user-a'});
  let reads = 0;
  responder = req => {
    if (req.path.endsWith('/session')) return session();
    if (req.method === 'PUT') return json({etag: 'clean-v3'});
    reads++;
    return reads === 1 ? json({state: state('already-personal'), etag: 'clean-v1'}) : json({state: legacyDemo(), etag: 'legacy-v2'});
  };
  const client = setup(state('local'), {prepareRemote: prepareMigratedRemote});
  await client.connect();
  assert.equal(client.sync.status, 'saved');
  const previousStatuses = client.statuses.length;

  await client.syncNow();
  assert.equal(client.current.mode, 'personal');
  assert.deepEqual(client.current.trades, []);
  assert.equal(client.sync.status, 'pending');
  assert.deepEqual(metadata(), {etag: 'legacy-v2', dirty: true, owner: 'user-a'});
  assert.ok(!client.statuses.slice(previousStatuses).some(value => value.status === 'saved'));
  assert.ok(!requests.some(req => req.method === 'PUT'));
  assert.equal(timers.size, 1);

  await client.syncNow();
  const put = requests.find(req => req.method === 'PUT');
  assert.equal(put.headers['If-Match'], 'legacy-v2');
  assert.deepEqual(JSON.parse(put.body), client.current);
  assert.deepEqual(metadata(), {etag: 'clean-v3', dirty: false, owner: 'user-a'});
  assert.equal(client.sync.status, 'saved');
});

test('choosing a migrated remote conflict version preserves personal notes and writes with the conflict ETag', async () => {
  setMeta({etag: 'old-v1', dirty: true, owner: 'user-a'});
  const remote = legacyDemo();
  remote.trades[0].notes = 'Esta anotación personal debe sobrevivir a la limpieza.';
  responder = req => req.path.endsWith('/session') ? session() : req.method === 'PUT' ? json({etag: 'clean-v3'}) : json({state: remote, etag: 'conflict-v2'});
  const client = setup(state('local-unsynced'), {prepareRemote: prepareMigratedRemote});
  await client.connect();
  assert.equal(client.sync.conflict, 'version');
  assert.ok(!requests.some(req => req.method === 'PUT'));

  assert.equal(await client.resolve('remote'), true);
  const put = requests.find(req => req.method === 'PUT');
  assert.equal(put.headers['If-Match'], 'conflict-v2');
  const uploaded = JSON.parse(put.body);
  assert.equal(uploaded.mode, 'personal');
  assert.equal(uploaded.trades.length, 1);
  assert.equal(uploaded.trades[0].notes, remote.trades[0].notes);
  assert.ok(client.statuses.some(value => value.status === 'pending'));
  assert.equal(client.sync.conflict, null);
  assert.equal(client.sync.status, 'saved');
  assert.deepEqual(metadata(), {etag: 'clean-v3', dirty: false, owner: 'user-a'});
});

test('a rejected remote application keeps the conflict and its recoverable local journal', async () => {
  setMeta({etag: 'local-v1', dirty: true, owner: 'user-a'});
  responder = req => req.path.endsWith('/session') ? session() : json({state: state('remote-v2'), etag: 'remote-v2'});
  const client = setup(state('keep-local'), {prepareRemote: () => false});
  await client.connect();
  const previousMetadata = metadata();
  assert.equal(client.sync.conflict, 'version');
  assert.equal(await client.resolve('remote'), false);
  assert.equal(client.current.settings.testMarker, 'keep-local');
  assert.deepEqual(client.applied, []);
  assert.equal(client.sync.conflict, 'version');
  assert.equal(client.sync.status, 'conflict');
  assert.equal(client.hasRemote(), true);
  assert.deepEqual(metadata(), previousMetadata);
  assert.ok(!requests.some(req => req.method === 'PUT'));
});
