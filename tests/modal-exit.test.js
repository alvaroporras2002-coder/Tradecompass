import test from 'node:test';
import assert from 'node:assert/strict';
import {createModalExit} from '../src/modal-exit.js';
const deferred=()=>{let resolve;return {promise:new Promise(done=>{resolve=done;}),resolve:()=>resolve()};};
const flush=()=>new Promise(done=>setImmediate(done));
test('repeated close waits for one shared return and one native close',async()=>{
 const exit=deferred(),calls=[];const motion=createModalExit(options=>{calls.push(options);return {canceled:false};});
 motion.replace(()=>exit.promise);const a=motion.close(),b=motion.close();assert.equal(a,b);assert.equal(calls.length,0);
 exit.resolve();assert.deepEqual(await a,{canceled:false});assert.deepEqual(calls,[{immediate:true}]);
});
test('a new modal invalidates a returning old image without closing the new one',async()=>{
 const exit=deferred(),calls=[];const motion=createModalExit(options=>calls.push(options));motion.replace(()=>exit.promise);
 const previous=motion.close();motion.replace(()=>{});assert.deepEqual(await previous,{canceled:true});exit.resolve();await flush();assert.equal(calls.length,0);
 await motion.close();assert.equal(calls.length,1);
});
test('immediate navigation settles a pending return and cannot close a later dialog',async()=>{
 const exit=deferred(),calls=[];const motion=createModalExit(options=>{calls.push(options);return {canceled:false};});motion.replace(()=>exit.promise);
 const previous=motion.close();await motion.close({immediate:true,restoreFocus:false});motion.replace(()=>{});exit.resolve();await flush();
 assert.deepEqual(await previous,{canceled:true});assert.deepEqual(calls,[{immediate:true,restoreFocus:false}]);
});
test('failed visual return still closes and resets the hook',async()=>{
 let count=0;const motion=createModalExit(()=>{count++;return {canceled:false};});motion.replace(()=>{throw new Error('no animation');});
 assert.deepEqual(await motion.close(),{canceled:false});await motion.close();assert.equal(count,2);
});
