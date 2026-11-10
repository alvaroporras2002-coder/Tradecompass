import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportTask} from '../src/import-task.js';
import {parseMT5} from '../src/importer.js';

const csv='Ticket,Open Time,Close Time,Type,Symbol,Volume,Open Price,Close Price,Profit,Commission,Swap\n101,2026.11.09 15:00:00,2026.11.09 16:00:00,buy,EURUSD,0.1,1.1,1.2,100,-2,-1\n102,2026.11.10 15:00:00,2026.11.10 16:00:00,sell,XAUUSD,0.1,2600,2590,-40,-2,0';
const options={accountId:'personal',existing:[]};
const file={text:async()=>csv};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;return {promise:new Promise(done=>{resolve=done;}),get resolve(){return resolve;}};}

test('fallback import preserves exact records, duplicate reconciliation and real processing stages',async()=>{
 const stages=[];let paintCount=0;
 const task=createImportTask({createWorker:()=>null,yieldToPaint:async()=>{paintCount++;}});
 const result=await task.run(file,options,{onStage:stage=>stages.push(stage)});
 assert.deepEqual(result,parseMT5(csv,options));assert.equal(result.totals.net,55);
 assert.deepEqual(stages,['reading','reviewing','preparing']);assert.equal(paintCount,1);assert.equal(task.busy,false);
 const repeated=await task.run(file,{accountId:'personal',existing:result.trades});
 assert.equal(repeated.trades.length,0);assert.equal(repeated.duplicates.length,2);
});

test('a replacement file cancels pending reads and only the current file can reach parsing',async()=>{
 const firstRead=deferred(),parsed=[];
 const task=createImportTask({createWorker:()=>null,yieldToPaint:async()=>{},parse:(text,opts)=>{parsed.push(text);return parseMT5(text,opts);}});
 const first=task.run({text:()=>firstRead.promise},options);
 const rejected=assert.rejects(first,error=>error.name==='AbortError');
 const second=await task.run(file,options);await rejected;
 firstRead.resolve('obsolete');await tick();
 assert.equal(second.trades.length,2);assert.deepEqual(parsed,[csv]);assert.equal(task.busy,false);
});

test('changing the rendered account or screen invalidates work before parsing or delivery',async()=>{
 const read=deferred();let visible=true,parseCalls=0;
 const task=createImportTask({createWorker:()=>null,yieldToPaint:async()=>{},parse:()=>{parseCalls++;return {};}});
 const result=task.run({text:()=>read.promise},options,{isCurrent:()=>visible});
 visible=false;read.resolve(csv);
 await assert.rejects(result,error=>error.name==='AbortError');assert.equal(parseCalls,0);assert.equal(task.busy,false);
});

test('module worker result uses the same parser contract and the worker is released',async()=>{
 let worker,received;
 const task=createImportTask({createWorker:()=>worker={terminate(){this.terminated=true;},postMessage(message){received=message;queueMicrotask(()=>this.onmessage({data:{type:'result',result:parseMT5(message.text,message.options)}}));}},parse:()=>{throw new Error('Main thread parser should not run');}});
 const result=await task.run(file,options);
 assert.deepEqual(result,parseMT5(csv,options));assert.deepEqual(received.options,options);assert.equal(worker.terminated,true);assert.equal(task.busy,false);
});

test('unavailable worker falls back, while a parser error is reported without retrying on the UI thread',async()=>{
 let fallbackCalls=0;
 const worker=()=>({terminate(){},postMessage(){queueMicrotask(()=>this.onerror());}});
 const task=createImportTask({createWorker:worker,yieldToPaint:async()=>{},parse:(text,opts)=>{fallbackCalls++;return parseMT5(text,opts);}});
 assert.equal((await task.run(file,options)).trades.length,2);assert.equal(fallbackCalls,1);
 const failed=createImportTask({createWorker:()=>({terminate(){},postMessage(){queueMicrotask(()=>this.onmessage({data:{type:'error',message:'REPORT_INVALID'}}));}}),parse:()=>{fallbackCalls++;}});
 await assert.rejects(failed.run(file,options),/REPORT_INVALID/);assert.equal(fallbackCalls,1);assert.equal(failed.busy,false);
});

test('canceling a parsing worker releases it and late worker messages cannot deliver a preview',async()=>{
 let worker;
 const task=createImportTask({createWorker:()=>worker={terminate(){this.terminated=true;},postMessage(){}}});
 const promise=task.run(file,options);const rejected=assert.rejects(promise,error=>error.name==='AbortError');
 await tick();assert.equal(task.busy,true);task.cancel();await rejected;
 worker.onmessage({data:{type:'result',result:{trades:[{id:'late'}]}}});
 assert.equal(worker.terminated,true);assert.equal(task.busy,false);
});
