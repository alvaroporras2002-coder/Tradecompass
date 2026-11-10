import test from 'node:test';
import assert from 'node:assert/strict';
import {PRIMARY_ROUTES,normalizeRoute,sectionForRoute,transitionDirection,transitionSpec,createNavigationMotion,updateTabbar,bindTabbarFeedback} from '../src/navigation.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function classes(){const set=new Set();return {add:(...values)=>values.forEach(x=>set.add(x)),remove:(...values)=>values.forEach(x=>set.delete(x)),contains:x=>set.has(x),toggle:(x,on)=>{const value=on===undefined?!set.has(x):on;value?set.add(x):set.delete(x);return value;}};}
function mainElement(animated=true){
 const attrs=new Map(),styleValues=new Map(),animations=[];
 const main={classList:classes(),style:{setProperty:(k,v)=>styleValues.set(k,v),removeProperty:k=>styleValues.delete(k)},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),attrs,animations};
 if(animated)main.animate=(frames,options)=>{let done,fail;const finished=new Promise((resolve,reject)=>{done=resolve;fail=reject;});const a={frames,options,finished,finish:done,cancel:()=>{a.wasCanceled=true;fail(new Error('canceled'));}};animations.push(a);return a;};
 return main;
}
function tab(key){const attrs=new Map();return {dataset:{primaryRoute:key},classList:classes(),attrs,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:70,height:50}),closest(){return this;}};}
function tabbar(){const tabs=PRIMARY_ROUTES.map(tab),handlers=new Map(),vars=new Map();return {tabs,handlers,vars,dataset:{},classList:classes(),style:{setProperty:(k,v)=>vars.set(k,v)},querySelectorAll:selector=>selector==='.is-pressing'?tabs.filter(t=>t.classList.contains('is-pressing')):tabs,contains:target=>tabs.includes(target),addEventListener:(key,value)=>handlers.set(key,value),removeEventListener:key=>handlers.delete(key)};}

test('daily workflow owns the five primary tabs and future tools stay under profile',()=>{
 assert.deepEqual(PRIMARY_ROUTES,['summary','journal','analytics','review','settings']);
 for(const [alias,route] of Object.entries({home:'summary',profile:'settings',analysis:'analytics',revision:'review',lab:'library',more:'tools'}))assert.equal(normalizeRoute(alias),route);
 assert.equal(normalizeRoute('#review'),'review');assert.equal(normalizeRoute('unknown'),'summary');
 for(const route of ['library','ea-detail','laboratory','markets','tools'])assert.equal(sectionForRoute(route),'settings');
 assert.equal(sectionForRoute('review'),'review');assert.equal(sectionForRoute('discipline'),'journal');assert.equal(sectionForRoute('reports'),'analytics');
 assert.equal(transitionDirection('summary','review'),1);assert.equal(transitionDirection('settings','journal'),-1);assert.equal(transitionDirection('tools','library'),1);assert.equal(transitionDirection('ea-detail','library'),-1);assert.equal(transitionDirection('journal','journal'),0);
});
test('tab changes stay subtle while opening and returning from details form an inverse pair',()=>{
 const tab=transitionSpec('journal','analytics'),push=transitionSpec('library','ea-detail'),pop=transitionSpec('ea-detail','library');
 assert.equal(tab.kind,'tab');assert.equal(push.kind,'push');assert.equal(pop.kind,'pop');
 assert.ok(Math.abs(push.inDistance)>Math.abs(tab.inDistance));
 assert.equal(push.inDistance,pop.outDistance);assert.equal(push.outDistance,pop.inDistance);assert.equal(push.direction,-pop.direction);
 for(const spec of [tab,push,pop])assert.ok(spec.exitDuration+spec.enterDuration<=300);
 assert.equal(transitionSpec('ea-detail','journal').kind,'tab');assert.equal(transitionSpec('reports','analytics').kind,'pop');
 assert.equal(transitionSpec('profile','tools').kind,'push');assert.equal(transitionSpec('home','summary').kind,'none');
 assert.equal(transitionSpec('summary','welcome').kind,'push');assert.equal(transitionSpec('analytics','import').direction,1);assert.equal(transitionSpec('analytics','import').kind,'push');
});
test('missing animation support, reduced motion and same screen render immediately',async()=>{
 for(const [main,reduced,from,to] of [[mainElement(false),false,'summary','review'],[mainElement(),true,'summary','review'],[mainElement(),false,'journal','journal']]){
  const calls=[],motion=createNavigationMotion({reduced:()=>reduced});const result=motion.transition(main,{from,to,render:()=>calls.push(to)});assert.deepEqual(calls,[to]);assert.deepEqual(await result,{canceled:false,mounted:true});assert.equal(main.animations.length,0);
 }
});
test('page transition mounts exactly once between outgoing and incoming phases and leaves no effects',async()=>{
 const main=mainElement(),calls=[],motion=createNavigationMotion();const promise=motion.transition(main,{from:'summary',to:'journal',render:()=>calls.push('journal')});
 assert.equal(main.animations.length,1);assert.ok(main.animations[0].options.duration>0);assert.deepEqual(calls,[]);assert.equal(main.attrs.get('aria-busy'),'true');
 main.animations[0].finish();await flush();assert.deepEqual(calls,['journal']);assert.equal(main.animations.length,2);assert.ok(main.animations[0].options.duration+main.animations[1].options.duration<=300);
 main.animations[1].finish();assert.deepEqual(await promise,{canceled:false,mounted:true});assert.equal(main.classList.contains('ip-screen-moving'),false);assert.equal(main.attrs.has('aria-busy'),false);
});
test('rapid navigation settles old requests and only the latest target can mount',async()=>{
 const main=mainElement(),calls=[],motion=createNavigationMotion();const first=motion.transition(main,{from:'summary',to:'journal',render:()=>calls.push('journal')});
 const second=motion.transition(main,{from:'summary',to:'review',render:()=>calls.push('review')});
 assert.deepEqual(await first,{canceled:true,mounted:false});assert.equal(main.animations[0].wasCanceled,true);
 main.animations[0].finish();await flush();assert.deepEqual(calls,[]);
 main.animations[1].finish();await flush();assert.deepEqual(calls,['review']);main.animations[2].finish();assert.deepEqual(await second,{canceled:false,mounted:true});
});
test('cancel during entry settles the mounted request and respects a new reduced-motion setting',async()=>{
 let reduced=false;const main=mainElement(),calls=[],motion=createNavigationMotion({reduced:()=>reduced});
 const old=motion.transition(main,{from:'summary',to:'review',render:()=>calls.push('review')});main.animations[0].finish();await flush();assert.deepEqual(calls,['review']);
 reduced=true;motion.cancel();assert.deepEqual(await old,{canceled:true,mounted:true});assert.equal(main.animations[1].wasCanceled,true);assert.equal(main.classList.contains('ip-screen-moving'),false);
 const latest=await motion.transition(main,{from:'review',to:'settings',render:()=>calls.push('settings')});assert.equal(latest.canceled,false);assert.deepEqual(calls,['review','settings']);assert.equal(main.animations.length,2);
});
test('a reduced-motion change after the outgoing phase skips entry animation',async()=>{
 let reduced=false;const main=mainElement(),motion=createNavigationMotion({reduced:()=>reduced});let rendered=false;
 const promise=motion.transition(main,{from:'summary',to:'review',render:()=>{rendered=true;}});reduced=true;main.animations[0].finish();await promise;assert.equal(rendered,true);assert.equal(main.animations.length,1);assert.equal(main.classList.contains('ip-screen-moving'),false);
});
test('a canceled detail transition cannot mount after the user chooses another tab',async()=>{
 const main=mainElement(),motion=createNavigationMotion(),calls=[];
 const opening=motion.transition(main,{from:'library',to:'ea-detail',render:()=>calls.push('detail')});
 const changing=motion.transition(main,{from:'library',to:'journal',render:()=>calls.push('journal')});
 assert.deepEqual(await opening,{canceled:true,mounted:false});main.animations[0].finish();await flush();assert.deepEqual(calls,[]);
 main.animations[1].finish();await flush();assert.deepEqual(calls,['journal']);main.animations[2].finish();await changing;
 assert.equal(main.attrs.has('aria-busy'),false);assert.equal(main.classList.contains('ip-screen-moving'),false);
});
test('animation failures release the screen and report the error for the caller fallback',async()=>{
 const main=mainElement(),motion=createNavigationMotion();main.animate=()=>{throw new Error('animation unavailable');};
 await assert.rejects(motion.transition(main,{from:'settings',to:'tools',render:()=>assert.fail('must use caller fallback')}),/animation unavailable/);
 assert.equal(main.attrs.has('aria-busy'),false);assert.equal(main.classList.contains('ip-screen-moving'),false);
});
test('tab selection updates existing elements, active section and accessibility without rebuilding',()=>{
 const nav=tabbar(),identities=nav.tabs.slice();updateTabbar(nav,'library',{animate:false,reduced:false});assert.equal(nav.vars.get('--tab-index'),'4');assert.equal(nav.tabs[4].attrs.get('aria-current'),'page');assert.equal(nav.tabs[4].classList.contains('is-active'),true);assert.equal(nav.classList.contains('ip-tabs-static'),true);
 updateTabbar(nav,'review',{animate:true,reduced:true});assert.equal(nav.vars.get('--tab-index'),'3');assert.equal(nav.tabs[4].attrs.has('aria-current'),false);assert.equal(nav.tabs[3].attrs.get('aria-current'),'page');assert.deepEqual(nav.tabs,identities);assert.equal(nav.tabs[3].classList.contains('is-activated'),false);
});
test('tap binding activates only unmodified navigation and cleans up listeners',()=>{
 const nav=tabbar(),calls=[];const cleanup=bindTabbarFeedback(nav,{reduced:()=>true,activate:key=>calls.push(key)});const target=nav.tabs[3];let prevented=0;
 nav.handlers.get('click')({target,button:0,ctrlKey:true,preventDefault:()=>prevented++});assert.deepEqual(calls,[]);
 nav.handlers.get('click')({target,button:0,preventDefault:()=>prevented++});assert.deepEqual(calls,['review']);assert.equal(prevented,1);assert.equal(target.classList.contains('is-activated'),false);
 nav.handlers.get('pointerdown')({target});assert.equal(target.classList.contains('is-pressing'),false);cleanup();assert.equal(nav.handlers.size,0);
});
