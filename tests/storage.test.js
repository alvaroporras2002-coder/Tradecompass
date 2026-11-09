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
  let record=copy(initial),reads=0,opens=0;
  const db={objectStoreNames:{contains:()=>true},createObjectStore(){},transaction(store,mode){
    assert.equal(store,'state');
    const tx={error:null,objectStore(){return {
      get(key){assert.equal(key,'current');reads++;const request={result:undefined,error:null};queueMicrotask(()=>{if(options.readError){request.error=new Error('IndexedDB read failed');request.onerror?.();}else{request.result=copy(record);request.onsuccess?.();}});return request;},
      put(value,key){assert.equal(mode,'readwrite');assert.equal(key,'current');options.log?.push('put-request');queueMicrotask(()=>{if(options.writeError){tx.error=new Error('IndexedDB write failed');tx.onerror?.();}else{record=copy(value);options.log?.push('transaction-complete');tx.oncomplete?.();}});}
    };}};return tx;
  }};
  return {get record(){return copy(record);},get reads(){return reads;},get opens(){return opens;},open(){opens++;const request={result:db,error:null};queueMicrotask(()=>{if(options.openError){request.error=new Error('IndexedDB unavailable');request.onerror?.();}else request.onsuccess?.();});return request;}};
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
