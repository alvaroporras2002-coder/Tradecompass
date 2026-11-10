import test from 'node:test';
import assert from 'node:assert/strict';
import {createSignatureMotion} from '../src/signature-motion.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function dom(){
 const all=[],events=new Map(),classes=new Set();
 const doc={documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},createElement:()=>node()};
 function node(text=''){
  let own=text;const names=new Set(),values=new Map(),priorities=new Map();
  const result={ownerDocument:doc,children:[],attributes:new Map(),animations:[],parentElement:null,className:'',
   classList:{add:name=>names.add(name),remove:name=>names.delete(name),contains:name=>names.has(name)},
   get childElementCount(){return this.children.length;},get textContent(){return own+this.children.map(child=>child.textContent).join('');},set textContent(value){own=value;this.children=[];},
   setAttribute(name,value){this.attributes.set(name,value);},
   append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}},
   remove(){const parent=this.parentElement;if(parent)parent.children=parent.children.filter(child=>child!==this);this.parentElement=null;},
   style:{getPropertyValue:name=>values.get(name)||'',getPropertyPriority:name=>priorities.get(name)||'',setProperty(name,value,priority=''){values.set(name,value);priorities.set(name,priority);},removeProperty:name=>{values.delete(name);priorities.delete(name);}},
   closest(){return null;},querySelector(){return null;},
   animate(frames,options){let finish,reject;const animation={frames,options,finished:new Promise((resolve,fail)=>{finish=resolve;reject=fail;}),finish,cancel(){this.canceled=true;reject(new Error('Canceled'));}};this.animations.push(animation);return animation;}
  };all.push(result);return result;
 }
 const win={document:doc,scrollY:0,getComputedStyle:()=>({color:'rgb(1, 2, 3)'}),addEventListener(name,listener,options){events.set(name,{listener,options});}};
 const metric=(text,label='Resultado')=>{const value=node(text),parent=node();parent.classList.add('ip-kpi');parent.querySelector=()=>({textContent:label});value.closest=selector=>selector.includes('.mp-page')?null:parent;return value;};
 const screen=(metrics=[],cards=[])=>({querySelectorAll:selector=>selector.includes('.ip-kpi>strong')?metrics:cards});
 return {all,doc,win,metric,screen,node,events,classes};
}

test('first mount and a different route/account show final metrics without numeric animation',()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win}),first=d.metric('$120.00');
 motion.mount(d.screen([first]),{key:'summary|one'});assert.equal(first.children.length,0);
 motion.capture(d.screen([first]),{key:'summary|one'});
 const second=d.metric('$125.00');motion.mount(d.screen([second]),{key:'summary|two'});
 assert.equal(second.children.length,0);assert.equal(second.textContent,'$125.00');
});

test('changed metrics roll only old/new rendered digits while final text stays accessible once',async()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win}),before=d.metric('$120.00'),after=d.metric('$125.00');
 motion.capture(d.screen([before]),{key:'summary|one'});motion.mount(d.screen([after]),{key:'summary|one'});
 const overlay=after.children[0];assert.equal(overlay.attributes.get('aria-hidden'),'true');
 const track=d.all.find(node=>node.className==='tc-number-track');
 assert.deepEqual(track.children.map(child=>child.textContent),['0','5']);
 assert.equal(after.style.getPropertyValue('--tc-number-color'),'rgb(1, 2, 3)');
 track.animations[0].finish();await flush();
 assert.equal(after.textContent,'$125.00');assert.equal(after.children.length,0);
 assert.equal(after.style.getPropertyValue('--tc-number-color'),'');
});

test('cancellation restores the final text and preserves preexisting inline styles',()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win}),before=d.metric('12'),after=d.metric('13');
 after.style.setProperty('--tc-number-color','purple','important');
 motion.capture(d.screen([before]),{key:'analytics|one'});motion.mount(d.screen([after]),{key:'analytics|one'});
 const track=d.all.find(node=>node.className==='tc-number-track');motion.cancel();
 assert.equal(track.animations[0].canceled,true);assert.equal(after.textContent,'13');
 assert.equal(after.style.getPropertyValue('--tc-number-color'),'purple');assert.equal(after.style.getPropertyPriority('--tc-number-color'),'important');
});

test('unknown values, markup, live regions and missing previous values do not roll',()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win});
 for(const [oldText,newText,decorate] of [['Balance 12','Balance 13'],['12','13',node=>node.append(d.node('x'))],['12','13',node=>{node.closest=selector=>selector.includes('.mp-page')?{}:null;}],['—','12']]){
  const before=d.metric(oldText),after=d.metric(newText);decorate?.(before);decorate?.(after);
  motion.capture(d.screen([before]),{key:'summary|one'});motion.mount(d.screen([after]),{key:'summary|one'});
  assert.equal(after.classList.contains('tc-number-rolling'),false);
 }
});

test('added digits and changed signs roll the two actual whole strings',()=>{
 for(const [oldText,newText] of [['9','10'],['-12','+13'],['99.00','100.00']]){
  const d=dom(),motion=createSignatureMotion({window:d.win}),before=d.metric(oldText),after=d.metric(newText);
  motion.capture(d.screen([before]),{key:'summary'});motion.mount(d.screen([after]),{key:'summary'});
  const track=d.all.find(node=>node.className==='tc-number-track');
  assert.deepEqual(track.children.map(child=>child.textContent),[oldText,newText]);
  motion.cancel();assert.equal(after.textContent,newText);
 }
});

test('Intl currency prefixes/suffixes are allowed and overlays preserve numeric alignment',()=>{
 for(const [oldText,newText,textAlign,expected] of [['US$12.00','US$13.00','right','flex-end'],['USD 12.00','USD 13.00','center','center'],['12.00 USD','13.00 USD','end','flex-end']]){
  const d=dom();d.win.getComputedStyle=()=>({color:'green',textAlign});
  const motion=createSignatureMotion({window:d.win}),before=d.metric(oldText),after=d.metric(newText);
  motion.capture(d.screen([before]),{key:'summary'});motion.mount(d.screen([after]),{key:'summary'});
  assert.equal(after.children[0].style.justifyContent,expected);
  assert.equal(after.children[0].style.textAlign,textAlign);
  motion.cancel();assert.equal(after.textContent,newText);
 }
});

test('card entrance runs only on route changes, skips nested cards, and caps the sequence',()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win}),cards=Array.from({length:12},()=>d.node());
 const nested=d.node();nested.parentElement={closest:()=>cards[0]};
 motion.mount(d.screen([],cards),{key:'summary',changed:false});assert.equal(cards[0].animations.length,0);
 motion.mount(d.screen([],[nested,...cards]),{key:'journal',changed:true});
 assert.equal(nested.animations.length,0);assert.equal(cards.filter(card=>card.animations.length).length,8);
 assert.equal(cards[7].animations[0].options.delay,224);
 motion.cancel();assert.equal(cards[0].animations[0].canceled,true);
});

test('reduced motion is immediate and the one passive scroll listener handles replaced shells',()=>{
 const d=dom(),motion=createSignatureMotion({window:d.win,reduced:()=>true}),before=d.metric('12'),after=d.metric('13'),card=d.node();
 motion.capture(d.screen([before]),{key:'summary'});motion.mount(d.screen([after],[card]),{key:'summary',changed:true});
 assert.equal(after.children.length,0);assert.equal(card.animations.length,0);
 assert.equal(d.events.size,1);assert.equal(d.events.get('scroll').options.passive,true);
 d.win.scrollY=100;d.events.get('scroll').listener();assert.equal(d.classes.has('tc-page-scrolled'),true);
 d.win.scrollY=0;motion.syncScroll();assert.equal(d.classes.has('tc-page-scrolled'),false);
});
