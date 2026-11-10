const easing='cubic-bezier(.22,.75,.22,1)';
// This allow-list deliberately leaves live prices, chart axes and timers alone.
const metricSelector='.ip-kpi>strong,.ip-kpi .ip-kpi-value,.stat-card>strong,.sub-metrics b,.rv-metrics>div>strong';
const metricParent='.ip-kpi,.stat-card,.sub-metrics>span,.rv-metrics>div';
const liveSelector='.mp-page,.lm-page,.performance-chart,.ip-chart,.equity-chart,[data-live-price],[data-live-countdown],[aria-live]';
const cardSelector='.ip-card,.card,.sub-card,.rv-panel,.rv-history,.rv-previous-summary,.wf-tool-card';
const numeric=/^(?:[A-Z]{2,3}\s*)?[\s\d.,+\-−()%$€£¥₡₹₿]+(?:\s*[A-Z]{2,3})?$/u;
const stop=animation=>{try{animation?.cancel?.();}catch{}};
function preserveStyles(element,values){
 const style=element.style;
 if(!style)return ()=>{};
 const before=Object.keys(values).map(name=>[name,style.getPropertyValue?.(name)||'',style.getPropertyPriority?.(name)||'']);
 for(const [name,value] of Object.entries(values))style.setProperty(name,value);
 return ()=>{for(const [name,value,priority] of before){if(value)style.setProperty(name,value,priority);else style.removeProperty(name);}};
}
function metricEntries(main){
 const entries=[],counts=new Map();
 for(const element of main?.querySelectorAll?.(metricSelector)||[]){
  if(element.childElementCount||element.closest?.(liveSelector))continue;
  const text=element.textContent||'';
  if(!/\d/.test(text)||!numeric.test(text))continue;
  const parent=element.closest?.(metricParent),label=parent?.querySelector?.('h2,span.muted,span')?.textContent?.trim()||'';
  const group=parent?.classList?.contains('ip-kpi')?'kpi':parent?.classList?.contains('stat-card')?'stat':parent?.parentElement?.classList?.contains('rv-metrics')?'review':'summary';
  const base=group+'|'+label,index=counts.get(base)||0;counts.set(base,index+1);
  entries.push({id:base+'|'+index,element,text});
 }
 return entries;
}

/** Motion decorates real, final content; replacing a screen never waits for it. */
export function createSignatureMotion({reduced=()=>false,window:win=globalThis.window}={}){
 const jobs=new Set();let captured=null,scrollFrame=null;
 const finish=job=>{
  if(!jobs.delete(job))return;
  for(const animation of job.animations||[])stop(animation);
  job.cleanup?.();
 };
 const cancel=()=>{for(const job of [...jobs])finish(job);};
 const watch=(job,animations)=>{
  job.animations=animations;jobs.add(job);
  Promise.all(animations.map(animation=>Promise.resolve(animation.finished).catch(()=>{}))).then(()=>finish(job));
 };
 const syncScroll=()=>{
  const root=win?.document?.documentElement;
  root?.classList?.toggle('tc-page-scrolled',Number(win?.scrollY??win?.pageYOffset??0)>12);
 };
 const scroll=()=>{
  if(scrollFrame!==null)return;
  if(typeof win?.requestAnimationFrame!=='function'){syncScroll();return;}
  scrollFrame=win.requestAnimationFrame(()=>{scrollFrame=null;syncScroll();});
 };
 // The shell can be replaced by access screens; the listener remains one per app.
 win?.addEventListener?.('scroll',scroll,{passive:true});syncScroll();
 const capture=(main,{key}={})=>{
  cancel();
  captured=main&&key!==undefined&&key!==null?{key:String(key),values:new Map(metricEntries(main).map(({id,text})=>[id,text]))}:null;
 };
 const roll=(element,before,after)=>{
  if(before===after)return;
  const doc=element.ownerDocument||win?.document;
  if(!doc?.createElement||typeof element.animate!=='function')return;
  const visual=doc.createElement('span');visual.className='tc-number-visual';visual.setAttribute('aria-hidden','true');
  const tracks=[],stable=before.length===after.length&&before.replace(/\d/g,'#')===after.replace(/\d/g,'#');
  // When a digit is added or the sign changes, roll the two complete actual
  // strings instead of inventing a digit or guessing an intermediate value.
  if(!stable){
   const cell=doc.createElement('span'),track=doc.createElement('span'),old=doc.createElement('span'),next=doc.createElement('span');
   cell.className='tc-number-cell tc-number-whole';track.className='tc-number-track';old.className='tc-number-old';next.className='tc-number-new';
   old.textContent=before;next.textContent=after;track.append(old,next);cell.append(track);visual.append(cell);tracks.push(track);
  }
  for(let i=0;stable&&i<after.length;i++){
   if(before[i]!==after[i]&&/\d/.test(after[i])){
    const cell=doc.createElement('span'),track=doc.createElement('span'),old=doc.createElement('span'),next=doc.createElement('span');
    cell.className='tc-number-cell';track.className='tc-number-track';old.className='tc-number-old';next.className='tc-number-new';
    old.textContent=before[i];next.textContent=after[i];track.append(old,next);cell.append(track);visual.append(cell);tracks.push(track);
   }else{const character=doc.createElement('span');character.className='tc-number-static';character.textContent=after[i];visual.append(character);}
  }
  if(!tracks.length||tracks.some(track=>typeof track.animate!=='function'))return;
  let color,textAlign;try{const computed=win?.getComputedStyle?.(element);color=computed?.color;textAlign=computed?.textAlign;}catch{}
  visual.style.justifyContent=textAlign==='center'?'center':['right','end'].includes(textAlign)?'flex-end':'flex-start';
  if(textAlign)visual.style.textAlign=textAlign;
  const restore=preserveStyles(element,{'--tc-number-color':color||'var(--text)'});
  element.classList.add('tc-number-rolling');element.append(visual);
  // The original final text stays in the accessibility tree once. Only the
  // decorative overlay contains the two actual old/new digits, never a count-up.
  const job={cleanup:()=>{visual.remove();element.classList.remove('tc-number-rolling');restore();}},animations=[];
  try{
   for(const [index,track] of tracks.entries())animations.push(track.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d(0,-50%,0)'}],{duration:340,delay:Math.min(index*22,88),easing,fill:'both'}));
   watch(job,animations);
  }catch{for(const animation of animations)stop(animation);job.cleanup();}
 };
 const stagger=main=>{
  const cards=[...(main?.querySelectorAll?.(cardSelector)||[])].filter(element=>!element.parentElement?.closest?.(cardSelector)).slice(0,8);
  cards.forEach((element,index)=>{
   if(typeof element.animate!=='function')return;
   try{watch({},[element.animate([{opacity:0,transform:'translate3d(0,9px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:300,delay:index*32,easing,fill:'both'})]);}catch{}
  });
 };
 const mount=(main,{key,changed=false}={})=>{
  cancel();const previous=captured;captured=null;syncScroll();
  if(!main||reduced())return;
  if(changed)stagger(main);
  if(!previous||key===undefined||previous.key!==String(key))return;
  for(const {id,element,text} of metricEntries(main)){const before=previous.values.get(id);if(before!==undefined)roll(element,before,text);}
 };
 return {capture,mount,cancel,syncScroll};
}
