import test from 'node:test';
import assert from 'node:assert/strict';
import {createThemeTransition} from '../src/theme-motion.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
function documentMock({native=true,animated=true}={}){
 const classes=new Set(),animations=[],transitions=[];
 const documentElement={clientWidth:400,clientHeight:800,classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}};
 if(animated)documentElement.animate=(frames,options)=>{
  const completion=deferred(),animation={frames,options,finished:completion.promise,finish:completion.resolve,cancel:()=>completion.reject(new Error('Canceled'))};
  animations.push(animation);return animation;
 };
 const doc={documentElement};
 if(native)doc.startViewTransition=update=>{
  const ready=deferred(),finished=deferred(),updateCallbackDone=Promise.resolve().then(update);
  updateCallbackDone.then(ready.resolve,error=>{ready.reject(error);finished.reject(error);});
  const transition={ready:ready.promise,finished:finished.promise,updateCallbackDone,finish:finished.resolve,skipTransition(){this.skipped=true;finished.resolve();}};
  transitions.push(transition);return transition;
 };
 return {doc,classes,animations,transitions};
}

test('the saved theme renders before revealing from the original tapped button',async()=>{
 const {doc,classes,animations,transitions}=documentMock(),save=deferred();
 let rect={left:320,top:20,width:40,height:40},rendered=false;
 const change=createThemeTransition({document:doc,viewport:()=>({width:400,height:800})});
 const done=change({origin:{getBoundingClientRect:()=>rect},apply:async()=>{await save.promise;rendered=true;return 'dark';}});
 rect={left:0,top:0,width:10,height:10};await flush();
 assert.equal(animations.length,0);assert.equal(rendered,false);assert.equal(classes.has('tc-theme-revealing'),true);
 save.resolve();await flush();
 assert.equal(rendered,true);assert.equal(animations.length,1);
 assert.deepEqual(animations[0].frames,[{clipPath:'circle(0px at 340px 40px)'},{clipPath:`circle(${Math.hypot(340,760)}px at 340px 40px)`}]);
 assert.equal(animations[0].options.pseudoElement,'::view-transition-new(root)');
 animations[0].finish();transitions[0].finish();assert.equal(await done,'dark');assert.equal(classes.size,0);
});

test('reduced motion applies the saved preference without a native transition or animation',async()=>{
 const {doc,animations,transitions}=documentMock(),save=deferred();
 const done=createThemeTransition({document:doc,reduced:()=>true})({apply:()=>save.promise});
 await flush();assert.equal(transitions.length,0);assert.equal(animations.length,0);
 save.resolve('light');assert.equal(await done,'light');assert.equal(animations.length,0);
});

test('unsupported native transitions softly fade the rendered page and never hide it',async()=>{
 const {doc,animations}=documentMock({native:false}),save=deferred();
 const done=createThemeTransition({document:doc})({apply:()=>save.promise});
 await flush();assert.equal(animations.length,0);save.resolve('dark');await flush();
 assert.deepEqual(animations[0].frames,[{opacity:.96},{opacity:1}]);
 assert.equal(animations[0].options.pseudoElement,undefined);animations[0].finish();assert.equal(await done,'dark');
});

test('plain updates work without either animation API',async()=>{
 const {doc}=documentMock({native:false,animated:false});
 assert.equal(await createThemeTransition({document:doc})({apply:async()=>42}),42);
});

test('a rejected save propagates its error, skips the snapshot, and permits the next change',async()=>{
 const {doc,classes,animations,transitions}=documentMock(),error=new Error('Save failed');
 const change=createThemeTransition({document:doc,reduced:()=>false});
 await assert.rejects(change({apply:async()=>{throw error;}}),value=>value===error);
 assert.equal(transitions[0].skipped,true);assert.equal(animations.length,0);assert.equal(classes.size,0);
 const next=change({apply:async()=> 'light'});await flush();animations[0].finish();transitions[1].finish();assert.equal(await next,'light');
});

test('rapid requests serialize both saves and reveals without losing a requested preference',async()=>{
 const {doc,animations,transitions}=documentMock(),save=deferred(),calls=[];
 const change=createThemeTransition({document:doc});
 const first=change({apply:async()=>{calls.push('dark');await save.promise;return 'dark';}});
 const second=change({apply:async()=>{calls.push('light');return 'light';}});
 await flush();assert.deepEqual(calls,['dark']);save.resolve();await flush();
 assert.deepEqual(calls,['dark']);animations[0].finish();transitions[0].finish();assert.equal(await first,'dark');await flush();
 assert.deepEqual(calls,['dark','light']);animations[1].finish();transitions[1].finish();assert.equal(await second,'light');
});

test('a native setup failure applies once even if its callback already started',async()=>{
 const {doc,animations}=documentMock({native:false});let saves=0;
 doc.startViewTransition=update=>{update();throw new Error('Unsupported');};
 const done=createThemeTransition({document:doc})({apply:async()=>{saves++;return 'dark';}});
 await flush();assert.equal(saves,1);animations[0].finish();assert.equal(await done,'dark');
});

test('an unsupported pseudo element animation falls back without failing a successful save',async()=>{
 const {doc,animations,transitions}=documentMock(),original=doc.documentElement.animate;
 doc.documentElement.animate=(frames,options)=>{if(options.pseudoElement)throw new Error('Unsupported pseudo element');return original(frames,options);};
 const done=createThemeTransition({document:doc})({apply:async()=> 'light'});
 await flush();assert.equal(transitions[0].skipped,true);assert.equal(animations.length,1);
 animations[0].cancel();assert.equal(await done,'light');
});

test('a failed snapshot preserves a successful save and cleans up its transition class',async()=>{
 const {doc,animations,classes}=documentMock({native:false});
 doc.startViewTransition=update=>{
  const updateCallbackDone=Promise.resolve().then(update);
  return {updateCallbackDone,ready:updateCallbackDone.then(()=>{throw new Error('No snapshot');}),finished:Promise.reject(new Error('Skipped')),skipTransition(){}};
 };
 const done=createThemeTransition({document:doc})({apply:async()=> 'dark'});
 await flush();animations[0].finish();assert.equal(await done,'dark');assert.equal(classes.size,0);
});
