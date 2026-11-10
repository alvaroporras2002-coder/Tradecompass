import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisclosureMotion,captureSectionState,createSectionMotion} from '../src/section-motion.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function element({height=120,animated=true}={}){
 const values=new Map(),priorities=new Map(),animations=[];
 const result={height,animations,style:{getPropertyValue:name=>values.get(name)||'',getPropertyPriority:name=>priorities.get(name)||'',setProperty(name,value,priority=''){values.set(name,value);priorities.set(name,priority);},removeProperty:name=>{values.delete(name);priorities.delete(name);}},getBoundingClientRect(){return {height:this.height};}};
 if(animated)result.animate=(frames,options)=>{
  let finish,reject;const animation={frames,options,finished:new Promise((resolve,fail)=>{finish=resolve;reject=fail;}),finish:()=>finish(),cancel(){this.canceled=true;reject(new Error('Canceled'));}};
  animations.push(animation);return animation;
 };
 return result;
}
function disclosure({open=false,animated=true}={}){
 const details=element({animated});details.tagName='DETAILS';details.open=open;
 details.getBoundingClientRect=function(){return {height:this.midHeight??(this.open?180:48)};};
 const summary={parentElement:details,closest:selector=>selector==='summary'?summary:null};
 const handlers=new Map(),root={contains:value=>value===details,addEventListener:(name,listener)=>handlers.set(name,listener),removeEventListener:name=>handlers.delete(name)};
 const click=(target=summary,extra={})=>{const event={target,button:0,preventDefault(){this.defaultPrevented=true;},...extra};handlers.get('click')?.(event);return event;};
 return {root,details,summary,handlers,click};
}
function screen({route='review',reviewMode='weekly',stage='0',chart=null,animated=true,stageHeight=300}={}){
 const panel=element({height:stageHeight,animated}),reviewPanel=element({height:stageHeight+70,animated}),chartPanel=element({height:270,animated});
 const state={route,reviewMode,stage,chart};
 const root={dataset:{currentRoute:route},querySelector(selector){
  if(selector==='[data-phone-review-mode][aria-selected="true"]')return state.reviewMode===null?null:{dataset:{phoneReviewMode:state.reviewMode}};
  if(selector==='[data-rv-stage]')return state.stage===null?null:{dataset:{rvStage:state.stage}};
  if(selector==='[data-af-chart][aria-pressed="true"]')return state.chart===null?null:{dataset:{afChart:state.chart}};
  return {'#wf-review-panel':reviewPanel,'.rv-panel':panel,'.ip-chart-card':chartPanel}[selector]||null;
 }};
 return {root,state,panel,reviewPanel,chartPanel};
}

test('rapid summary clicks settle the final intention and an old animation cannot reopen the section',async()=>{
 const {root,details,click}=disclosure(),motion=createDisclosureMotion(root);
 assert.equal(click().defaultPrevented,true);assert.equal(details.open,true);
 const old=details.animations[0];click();assert.equal(old.canceled,true);
 old.finish();await flush();assert.equal(details.open,true,'closing retains the content until the final frame');
 details.animations[1].finish();await flush();assert.equal(details.open,false);
 assert.equal(details.style.getPropertyValue('overflow'),'');motion.destroy();
});
test('cancel settles the latest disclosure target and restores author styles exactly',async()=>{
 const {root,details,click}=disclosure({open:true}),motion=createDisclosureMotion(root);
 details.style.setProperty('overflow','clip','important');
 click();motion.cancel();assert.equal(details.open,false);
 assert.equal(details.style.getPropertyValue('overflow'),'clip');assert.equal(details.style.getPropertyPriority('overflow'),'important');
 details.animations[0].finish();await flush();assert.equal(details.open,false);
 motion.destroy();
});
test('reduced motion and unsupported animations toggle immediately; programmatic opens remain native',()=>{
 for(const [animated,reduced] of [[false,false],[true,true]]){
  const {root,details,click,handlers}=disclosure({animated}),motion=createDisclosureMotion(root,{reduced:()=>reduced});
  click();assert.equal(details.open,true);click();assert.equal(details.open,false);assert.equal(details.animations.length,0);
  details.open=true;assert.equal(details.open,true);assert.equal(handlers.has('toggle'),false);
  motion.destroy();assert.equal(handlers.size,0);
 }
});
test('interactive summary children and canceled clicks keep their own behavior',()=>{
 const {root,details,summary,click}=disclosure(),motion=createDisclosureMotion(root);
 const button={closest:selector=>selector==='summary'?summary:button};
 assert.equal(click(button).defaultPrevented,undefined);assert.equal(details.open,false);
 click(summary,{defaultPrevented:true});click(summary,{ctrlKey:true});assert.equal(details.animations.length,0);
 motion.destroy();
});
test('validation focus inside a collapsing section keeps the field and section available',async()=>{
 const {root,details,click,handlers}=disclosure({open:true}),motion=createDisclosureMotion(root);
 click();const animation=details.animations[0];
 handlers.get('focusin')({target:{closest:selector=>selector==='details'?details:null}});
 animation.finish();await flush();assert.equal(details.open,true);assert.equal(animation.canceled,true);
 assert.equal(details.style.getPropertyValue('overflow'),'');motion.destroy();
});
test('a review step replaces its content once and settles at its new natural height',async()=>{
 const before=screen({stage:'0',stageHeight:420}),after=screen({stage:'1',stageHeight:280});
 const motion=createSectionMotion(),snapshot=captureSectionState(before.root);
 const done=motion.update(after.root,snapshot);assert.equal(after.panel.animations.length,1);assert.equal(after.reviewPanel.animations.length,0);
 after.panel.animations[0].finish();assert.deepEqual(await done,{animated:true,canceled:false});
 assert.equal(after.panel.height,280);assert.equal(after.panel.style.getPropertyValue('overflow'),'');
});
test('ordinary data refreshes, route changes, and reduced motion do not replay section entry',async()=>{
 const before=screen(),snapshot=captureSectionState(before.root);
 for(const [after,reduced] of [[screen(),false],[screen({route:'journal',stage:'1'}),false],[screen({stage:'1'}),true]]){
  const motion=createSectionMotion({reduced:()=>reduced});assert.deepEqual(await motion.update(after.root,snapshot),{animated:false,canceled:false});
  assert.equal(after.panel.animations.length,0);
 }
});
test('review mode and chart selection animate their own surface without touching unrelated content',async()=>{
 const cases=[
  [screen(),screen({reviewMode:'discipline',stage:null}),'reviewPanel'],
  [screen({route:'analytics',reviewMode:null,stage:null,chart:'result'}),screen({route:'analytics',reviewMode:null,stage:null,chart:'drawdown'}),'chartPanel']
 ];
 for(const [before,after,target] of cases){
  const motion=createSectionMotion(),done=motion.update(after.root,captureSectionState(before.root));assert.equal(after[target].animations.length,1);
  after[target].animations[0].finish();await done;assert.equal(after[target].style.getPropertyValue('will-change'),'');
 }
});
test('a new section transition cancels the prior one without its completion clearing new styles',async()=>{
 const initial=screen(),middle=screen({stage:'1'}),latest=screen({stage:'2'}),motion=createSectionMotion();
 const old=motion.update(middle.root,captureSectionState(initial.root)),current=motion.update(latest.root,captureSectionState(middle.root));
 assert.deepEqual(await old,{animated:true,canceled:true});
 middle.panel.animations[0].finish();await flush();assert.equal(latest.panel.style.getPropertyValue('overflow'),'hidden');
 motion.cancel();assert.deepEqual(await current,{animated:true,canceled:true});assert.equal(latest.panel.style.getPropertyValue('overflow'),'');
});
test('animation failures leave expanded content and section surfaces usable',async()=>{
 const {root,details,click}=disclosure();details.animate=()=>{throw new Error('WAAPI unavailable');};
 const disclosureMotion=createDisclosureMotion(root);click();assert.equal(details.open,true);assert.equal(details.style.getPropertyValue('overflow'),'');disclosureMotion.destroy();
 const before=screen(),after=screen({stage:'1'});after.panel.animate=()=>{throw new Error('Animation error');};
 const motion=createSectionMotion();assert.deepEqual(await motion.update(after.root,captureSectionState(before.root)),{animated:true,canceled:false});assert.equal(after.panel.style.getPropertyValue('overflow'),'');
});
