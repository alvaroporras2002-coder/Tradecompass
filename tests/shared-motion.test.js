import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMotionOrigin,animateFromOrigin,animateToOrigin,cancelSharedMotion,flashSelection} from '../src/shared-motion.js';

function fixture(rect={left:100,top:200,width:400,height:300}){
 const calls=[],style={transform:'rotate(0deg)',borderRadius:'12px'};
 const target={isConnected:true,style,getBoundingClientRect:()=>rect,ownerDocument:{defaultView:{getComputedStyle:()=>({borderRadius:'12px'})}},animate(frames,options){
  let resolve,reject;
  const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const animation={finished,cancelCount:0,cancel(){this.cancelCount++;reject(new Error('Canceled'));}};
  calls.push({frames,options,animation,complete:resolve,reject});
  return animation;
 }};
 return {target,calls,style,rect};
}
const origin={rect:{left:20,top:50,width:80,height:60},radius:'8px'};

test('capture stores detached geometry without DOM or private form content',()=>{
 const f=fixture();f.target.value='private';f.target.innerHTML='<input value="private">';
 const result=captureMotionOrigin(f.target);
 assert.deepEqual(result,{rect:{left:100,top:200,width:400,height:300},radius:'12px'});
 f.rect.left=999;
 assert.equal(result.rect.left,100);
 assert.doesNotThrow(()=>JSON.stringify(result));
});

test('opening maps the source corners to the destination and restores existing styles',async()=>{
 const f=fixture(),before={...f.style};
 const promise=animateFromOrigin(f.target,origin);
 const {frames,options}=f.calls[0];
 assert.equal(frames[0].transform,'translate(-80px, -150px) scale(0.2, 0.2)');
 assert.equal(frames[0].transformOrigin,'0 0');
 assert.equal(frames[0].borderRadius,'8px');
 assert.equal(frames[1].transform,'translate(0px, 0px) scale(1, 1)');
 assert.equal(frames[1].borderRadius,'12px');
 assert.equal(options.duration,380);
 f.calls[0].complete();
 assert.deepEqual(await promise,{animated:true,canceled:false});
 assert.equal(f.calls[0].animation.cancelCount,1);
 assert.deepEqual(f.style,before);
});

test('closing retains the actual target until the reverse motion finishes',async()=>{
 const f=fixture();let closed=false;
 const promise=animateToOrigin(f.target,origin).then(result=>{closed=true;return result;});
 assert.equal(closed,false);
 assert.equal(f.calls[0].frames[0].transform,'translate(0px, 0px) scale(1, 1)');
 assert.equal(f.calls[0].frames[1].transform,'translate(-80px, -150px) scale(0.2, 0.2)');
 f.calls[0].complete();
 assert.deepEqual(await promise,{animated:true,canceled:false});
 assert.equal(closed,true);
});

test('replacing or canceling motion settles pending callers without affecting the replacement',async()=>{
 const f=fixture(),first=animateFromOrigin(f.target,origin);
 const second=animateToOrigin(f.target,origin);
 assert.deepEqual(await first,{animated:true,canceled:true});
 assert.equal(f.calls[0].animation.cancelCount,1);
 assert.equal(f.calls[1].animation.cancelCount,0);
 // A late completion from the replaced animation must not cancel the new one.
 f.calls[0].complete();await Promise.resolve();
 assert.equal(f.calls[1].animation.cancelCount,0);
 cancelSharedMotion(f.target);
 assert.deepEqual(await second,{animated:true,canceled:true});
 assert.equal(f.calls[1].animation.cancelCount,1);
 cancelSharedMotion(f.target);
 assert.equal(f.calls[1].animation.cancelCount,1);
});

test('invalid, unavailable and reduced-motion paths resolve without animating',async()=>{
 const f=fixture();
 for(const snapshot of [null,{}, {rect:{left:0,top:0,width:0,height:10}}, {rect:{left:NaN,top:0,width:10,height:10}}]){
  assert.deepEqual(await animateFromOrigin(f.target,snapshot),{animated:false,canceled:false});
 }
 assert.deepEqual(await animateFromOrigin(f.target,origin,{reduced:true}),{animated:false,canceled:false});
 assert.deepEqual(await animateToOrigin(f.target,origin,{duration:0}),{animated:false,canceled:false});
 assert.equal(f.calls.length,0);
 f.target.isConnected=false;
 assert.equal(captureMotionOrigin(f.target),null);
 assert.deepEqual(await animateFromOrigin(f.target,origin),{animated:false,canceled:false});
 f.target.isConnected=true;delete f.target.animate;
 assert.deepEqual(await animateFromOrigin(f.target,origin),{animated:false,canceled:false});
 assert.equal(captureMotionOrigin(null),null);
 assert.deepEqual(await animateToOrigin(null,origin),{animated:false,canceled:false});
});

test('switching to reduced motion immediately releases an in-flight transition',async()=>{
 const f=fixture(),pending=animateFromOrigin(f.target,origin);
 await animateToOrigin(f.target,origin,{reduced:true});
 assert.deepEqual(await pending,{animated:true,canceled:true});
 assert.equal(f.calls.length,1);
});

test('missing WAAPI completion cannot leave a modal closing forever',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture(),promise=animateToOrigin(f.target,origin,{duration:200});
 t.mock.timers.tick(301);
 assert.deepEqual(await promise,{animated:true,canceled:false});
 assert.equal(f.calls[0].animation.cancelCount,1);
});

test('external WAAPI cancellation resolves and selection glow leaves no inline styles',async()=>{
 const f=fixture(),before={...f.style};
 const canceled=animateFromOrigin(f.target,origin);
 f.calls[0].reject(new Error('Detached'));
 assert.deepEqual(await canceled,{animated:true,canceled:true});
 const flash=flashSelection(f.target);
 assert.equal(f.calls[1].frames.length,3);
 assert.ok(f.calls[1].frames[1].boxShadow.includes('rgba'));
 f.calls[1].complete();
 assert.deepEqual(await flash,{animated:true,canceled:false});
 assert.deepEqual(f.style,before);
 await flashSelection(f.target,{reduced:true});
 assert.equal(f.calls.length,2);
});
