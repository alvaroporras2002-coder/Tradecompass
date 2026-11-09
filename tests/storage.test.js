import test from 'node:test';
import assert from 'node:assert/strict';

const KEY='tradecompass-state-v1';
let instance=0;
const freshStorage=()=>import(`../src/storage.js?storage-test=${++instance}`);
const copy=value=>value===undefined?undefined:structuredClone(value);

function memoryStorage(initial={},options={}) {
  const map=new Map(Object.entries(initial));
  return {map,
    getItem(key){if(options.blockRead)throw new Error('Storage read blocked');return map.get(key)??null;},
    setItem(key,value){if(options.blockWrite)throw new Error('Storage write blocked');map.set(key,String(value));},
    removeItem(key){options.log?.push('remove-fallback');map.delete(key);}
  };
}
function indexedDatabase(initial,options={}) {
  const records=new Map();
  if(initial!==undefined)records.set('current',copy(initial));
  let reads=0,opens=0;
  const writes=[];
  const db={objectStoreNames:{contains:()=>true},createObjectStore(){},transaction(store,mode){
    assert.equal(store,'state');
    let pending=0,finished=false;
    const finish=()=>queueMicrotask(()=>{if(!finished&&pending===0){finished=true;if(mode==='readwrite')options.log?.push('transaction-complete');tx.oncomplete?.();}});
    const tx={error:null,abort(){if(finished)return;finished=true;tx.onabort?.();},objectStore(){return {
      get(key){
        reads++;pending++;const request={result:undefined,error:null};
        queueMicrotask(()=>{
          if(finished)return;
          if(options.readError){request.error=new Error('IndexedDB read failed');request.onerror?.();}
          else{request.result=copy(records.get(key));request.onsuccess?.();}
          pending--;finish();
        });
        return request;
      },
      put(value,key){
        assert.equal(mode,'readwrite');writes.push(key);pending++;options.log?.push('put-request');
        queueMicrotask(()=>{
          if(finished)return;
          if(options.writeError||options.writeErrorKey===key){tx.error=new Error('IndexedDB write failed');finished=true;tx.onerror?.();}
          else{records.set(key,copy(value));pending--;finish();}
        });
      }
    };}};
    return tx;
  }};
  return {get record(){return copy(records.get('current'));},recordFor(key){return copy(records.get(key));},get writes(){return [...writes];},get reads(){return reads;},get opens(){return opens;},open(){opens++;const request={result:db,error:null};queueMicrotask(()=>{if(options.openError){request.error=new Error('IndexedDB unavailable');request.onerror?.();}else request.onsuccess?.();});return request;}};
}
async function environment(globals,run) {
  const originals=new Map(Object.keys(globals).map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  try {
    for(const [name,value] of Object.entries(globals))Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
    await run(await freshStorage());
  } finally {
    for(const [name,descriptor] of originals) {if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
}

test('a newer fallback after an IndexedDB write failure takes precedence over its stale record',async()=>{
  const stale={version:1,revision:'old'},newer={version:1,revision:'new'};
  const idb=indexedDatabase(stale,{writeError:true}),local=memoryStorage();
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    assert.deepEqual(await storage.saveState(newer),{storage:'localstorage'});
    assert.deepEqual(idb.record,stale);
    assert.deepEqual(await storage.loadState(),newer);
    assert.equal(idb.reads,0,'The stale IndexedDB record must not replace a newer fallback');
  });
});

test('blocked localStorage does not prevent reading an existing IndexedDB journal',async()=>{
  const journal={version:1,revision:'durable'};
  const idb=indexedDatabase(journal),local=memoryStorage({}, {blockRead:true,blockWrite:true});
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    assert.deepEqual(await storage.loadState(),journal);
    assert.equal(idb.reads,1);
  });
});

test('a malformed fallback rejects and leaves both saved copies untouched',async()=>{
  const raw='{"version":1,"trades":';
  const journal={version:1,revision:'old'};
  const idb=indexedDatabase(journal),local=memoryStorage({[KEY]:raw});
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    await assert.rejects(storage.loadState(),/No se pudo leer el guardado local/);
    assert.equal(local.map.get(KEY),raw);
    assert.deepEqual(idb.record,journal);
    assert.equal(idb.opens,0,'Malformed fallback must not be hidden by an older IndexedDB copy');
  });
});

test('when IndexedDB is absent, a journal can be saved and loaded through localStorage',async()=>{
  const journal={version:1,revision:'fallback-only'},local=memoryStorage();
  await environment({indexedDB:undefined,localStorage:local},async storage=>{
    assert.equal(await storage.loadState(),null);
    assert.deepEqual(await storage.saveState(journal),{storage:'localstorage'});
    assert.deepEqual(await storage.loadState(),journal);
  });
});

test('when both storage providers are unavailable, writes and reads reject explicitly',async()=>{
  const idb=indexedDatabase(null,{openError:true}),local=memoryStorage({}, {blockRead:true,blockWrite:true});
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    await assert.rejects(storage.saveState({version:1}),/No se pudo guardar/);
    await assert.rejects(storage.loadState(),/No se pudo leer el almacenamiento/);
    assert.equal(local.map.size,0);
  });
});

test('a successful durable commit removes a prior fallback only after completion',async()=>{
  const events=[],old={version:1,revision:'fallback'},next={version:1,revision:'committed'};
  const idb=indexedDatabase({version:1,revision:'stale'},{log:events});
  const local=memoryStorage({[KEY]:JSON.stringify(old)},{log:events});
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    assert.deepEqual(await storage.saveState(next),{storage:'indexeddb'});
    assert.deepEqual(events,['put-request','transaction-complete','remove-fallback']);
    assert.equal(local.map.has(KEY),false);
    assert.deepEqual(await storage.loadState(),next);
  });
});

test('a transient IndexedDB read error never looks like an empty workspace',async()=>{
  const journal={version:1,revision:'must-survive'};
  const idb=indexedDatabase(journal,{readError:true}),local=memoryStorage();
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    await assert.rejects(storage.loadState(),/No se pudo leer el almacenamiento/);
    assert.deepEqual(idb.record,journal);
    assert.equal(local.map.size,0,'A read failure must not create a replacement workspace');
  });
});


const SNAPSHOT_KEY='tradecompass-before-empty-start-v1';
const SNAPSHOT_RECORD='before-empty-start-v1';

test('migration snapshots retain the first durable copy without replacing the active journal',async()=>{
  const active={version:1,revision:'active-personal',trades:[{id:'own-trade'}]};
  const first={version:1,revision:'before-cleanup',trades:[{id:'original-sample',notes:'Keep the original copy'}]};
  const expected=copy(first),second={version:1,revision:'later-attempt',trades:[]};
  const idb=indexedDatabase(active),local=memoryStorage();
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    assert.equal(await storage.loadMigrationSnapshot(),null);
    await storage.saveMigrationSnapshot(first);
    first.trades[0].notes='Changed after the snapshot was saved';
    await storage.saveMigrationSnapshot(second);
    assert.deepEqual(await storage.loadMigrationSnapshot(),expected);
    assert.deepEqual(idb.recordFor(SNAPSHOT_RECORD),expected);
    assert.deepEqual(await storage.loadState(),active);
    assert.deepEqual(idb.record,active,'Saving a snapshot must never put its data in the active current record');
    assert.deepEqual(idb.writes,[SNAPSHOT_RECORD],'An existing snapshot is preserved instead of overwritten');
    assert.equal(local.map.has(SNAPSHOT_KEY),false,'A successful durable snapshot needs no fallback');
  });
});

test('migration snapshots use localStorage when IndexedDB is absent and leave the active fallback intact',async()=>{
  const active={version:1,revision:'current-fallback'},first={version:1,revision:'original-snapshot'},later={version:1,revision:'later-snapshot'};
  const local=memoryStorage({[KEY]:JSON.stringify(active)});
  await environment({indexedDB:undefined,localStorage:local},async storage=>{
    assert.equal(await storage.loadMigrationSnapshot(),null);
    await storage.saveMigrationSnapshot(first);
    await storage.saveMigrationSnapshot(later);
    assert.deepEqual(await storage.loadMigrationSnapshot(),first);
    assert.equal(local.map.get(SNAPSHOT_KEY),JSON.stringify(first));
    assert.equal(local.map.get(KEY),JSON.stringify(active));
    assert.deepEqual(await storage.loadState(),active);
  });
});

test('failed writes to both snapshot providers reject before cleanup can replace a functional active journal',async()=>{
  const active={version:1,revision:'must-survive'},cleaned={version:1,revision:'cleaned'},updated={version:1,revision:'normal-save-still-works'};
  const idb=indexedDatabase(active,{writeErrorKey:SNAPSHOT_RECORD});
  const local=memoryStorage({}, {blockWrite:true});
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    await assert.rejects(async()=>{
      await storage.saveMigrationSnapshot(active);
      await storage.saveState(cleaned);
    },/No se pudo respaldar/);
    assert.deepEqual(await storage.loadState(),active);
    assert.deepEqual(idb.record,active);
    assert.equal(await storage.loadMigrationSnapshot(),null);
    assert.deepEqual(idb.writes,[SNAPSHOT_RECORD],'The failed precondition prevents attempting the cleanup write');
    assert.equal(local.map.has(SNAPSHOT_KEY),false);
    assert.deepEqual(await storage.saveState(updated),{storage:'indexeddb'});
    assert.deepEqual(await storage.loadState(),updated,'The active journal remains writable independently of a blocked snapshot record');
  });
});


test('a transient snapshot read error cannot hide the first durable copy behind a newer fallback',async()=>{
  const active={version:1,revision:'active'},first={version:1,revision:'first-durable-snapshot'},later={version:1,revision:'must-not-replace-first'};
  const options={},idb=indexedDatabase(active,options),local=memoryStorage();
  await environment({indexedDB:idb,localStorage:local},async storage=>{
    await storage.saveMigrationSnapshot(first);
    options.readError=true;
    await assert.rejects(storage.saveMigrationSnapshot(later),/IndexedDB read failed|respaldo anterior/);
    assert.equal(local.map.has(SNAPSHOT_KEY),false,'An unreadable durable snapshot must not be shadowed by a newer fallback');
    assert.deepEqual(idb.recordFor(SNAPSHOT_RECORD),first);
    assert.deepEqual(idb.record,active);
    assert.deepEqual(idb.writes,[SNAPSHOT_RECORD]);
    options.readError=false;
    assert.deepEqual(await storage.loadMigrationSnapshot(),first);
    assert.deepEqual(await storage.loadState(),active);
  });
});
