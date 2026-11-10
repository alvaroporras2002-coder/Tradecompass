import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPhoneJournal} from '../src/views/iphone.js';
const rows=[{id:'1',symbol:'EURUSD',strategy:'Pullback',notes:'Esperé confirmación',side:'buy',status:'closed',closedAt:'2026-11-03',tags:['Londres']},{id:'2',symbol:'XAUUSD',strategy:'Range',side:'sell',status:'open',openedAt:'2026-11-04',tags:[]}];
test('phone journal combines text, direction, strategy and status without mutating records',()=>{
 const before=structuredClone(rows);
 assert.deepEqual(filterPhoneJournal(rows,{search:'londres',side:'buy',status:'closed',strategy:'Pullback'}).map(x=>x.id),['1']);
 assert.deepEqual(filterPhoneJournal(rows,{status:'open'}).map(x=>x.id),['2']);
 assert.deepEqual(filterPhoneJournal(rows,{search:'USD',side:'all'}).map(x=>x.id),['2','1']);
 assert.deepEqual(filterPhoneJournal(rows,{side:'sell',strategy:'Pullback'}),[]);assert.deepEqual(rows,before);
});
