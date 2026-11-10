import test from 'node:test';
import assert from 'node:assert/strict';
import {createSheetMotion} from '../src/sheet-motion.js';
function fixture(){
 const classes=new Set(),listeners=new Map(),timers=new Map();let next=0;
 const dialog={open:false,offsetWidth:350,classList:{add:(...x)=>x.forEach(v=>classes.add(v)),remove:(...x)=>x.forEach(v=>classes.delete(v))},showModal(){this.open=true;},close(){this.open=false;},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const schedule=fn=>{timers.set(++next,fn);return next;},unschedule=id=>timers.delete(id);
 return {dialog,classes,timers,schedule,unschedule,end:name=>listeners.get('animationend')?.({target:dialog,animationName:name})};
}
test('sheets keep the native focus trap open until their own exit completes',async()=>{
 const f=fixture(),closed=[],m=createSheetMotion(f.dialog,{...f,onClosed:v=>closed.push(v)});m.open();f.end('tc-sheet-open');
 const job=m.close();assert.equal(f.dialog.open,true);assert.ok(f.classes.has('tc-sheet-closing'));
 f.end('tc-backdrop-close');assert.equal(f.dialog.open,true);f.end('tc-sheet-close');assert.deepEqual(await job,{canceled:false});assert.equal(f.dialog.open,false);assert.equal(closed.length,1);assert.equal(f.timers.size,0);
});
test('opening a replacement sheet cancels an older exit and its stale timer',async()=>{
 const f=fixture(),closed=[],m=createSheetMotion(f.dialog,{...f,onClosed:()=>closed.push(true)});m.open();const old=m.close(),stale=[...f.timers.values()][0];
 m.open();assert.deepEqual(await old,{canceled:true});stale();assert.equal(f.dialog.open,true);assert.equal(m.phase,'open');assert.equal(closed.length,0);
});
test('repeated close requests settle once and navigation can close immediately',async()=>{
 const f=fixture(),closed=[],m=createSheetMotion(f.dialog,{...f,onClosed:v=>closed.push(v)});m.open();const first=m.close();assert.equal(m.close(),first);
 const final=m.close({immediate:true,restoreFocus:false});assert.deepEqual(await first,{canceled:true});await final;assert.equal(f.dialog.open,false);assert.deepEqual(closed,[{restoreFocus:false}]);assert.equal(f.timers.size,0);
});
test('reduced motion and absent animation events never leave a sheet stuck',async()=>{
 const f=fixture();let reduced=true;const m=createSheetMotion(f.dialog,{...f,reduced:()=>reduced});m.open();await m.close();assert.equal(f.dialog.open,false);assert.equal(f.classes.size,0);
 reduced=false;m.open();const job=m.close();for(const fn of [...f.timers.values()])fn();await job;assert.equal(f.dialog.open,false);
 m.open();const closing=m.close();reduced=true;m.settle();await closing;assert.equal(f.dialog.open,false);assert.equal(f.timers.size,0);
});
