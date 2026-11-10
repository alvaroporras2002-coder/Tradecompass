/** Small, cancelable changes inside an already mounted phone screen. */
const easing='cubic-bezier(.22,.75,.22,1)';
const size=element=>{
 try{const value=Number(element?.getBoundingClientRect?.().height);return Number.isFinite(value)&&value>0?value:0;}catch{return 0;}
};
function temporaryStyles(element,values){
 const style=element.style;
 if(!style)return ()=>{};
 const previous=Object.keys(values).map(name=>[name,style.getPropertyValue?.(name)||'',style.getPropertyPriority?.(name)||'']);
 for(const [name,value] of Object.entries(values))style.setProperty(name,value);
 return ()=>{for(const [name,value,priority] of previous){if(value)style.setProperty(name,value,priority);else style.removeProperty(name);}};
}
const stopAnimation=animation=>{try{animation?.cancel();}catch{}};

/** Native details retain their semantics; only intentional summary clicks animate. */
export function createDisclosureMotion(root,{reduced=()=>false}={}){
 const byElement=new WeakMap(),active=new Set();
 let destroyed=false;
 const settle=(job,{keepOpen}={})=>{
  if(byElement.get(job.element)!==job)return;
  byElement.delete(job.element);active.delete(job);
  job.element.open=keepOpen??job.targetOpen;
  job.restore();
  stopAnimation(job.animation);
 };
 const abandon=job=>{
  if(!job)return;
  byElement.delete(job.element);active.delete(job);
  job.restore();stopAnimation(job.animation);
 };
 const click=event=>{
  if(destroyed||event.defaultPrevented||(event.button!==undefined&&event.button!==0)||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const target=event.target?.closest?event.target:event.target?.parentElement;
  const summary=target?.closest?.('summary'),element=summary?.parentElement;
  if(!summary||element?.tagName?.toLowerCase()!=='details'||!root.contains?.(element))return;
  const control=target.closest?.('a,button,input,select,textarea,label,[contenteditable="true"]');
  if(control&&control!==summary)return;
  event.preventDefault();
  const prior=byElement.get(element),targetOpen=!(prior?prior.targetOpen:element.open),from=size(element);
  abandon(prior);
  if(reduced()||typeof element.animate!=='function'){
   element.open=targetOpen;return;
  }
  // Measure the real final height before pinning the in-between frame.
  element.open=targetOpen;
  const to=size(element);
  if(!targetOpen)element.open=true;
  if(!from||!to){element.open=targetOpen;return;}
  const job={element,targetOpen,restore:temporaryStyles(element,{overflow:'hidden','will-change':'height'})};
  byElement.set(element,job);active.add(job);
  try{
   job.animation=element.animate([{height:`${from}px`},{height:`${to}px`}],{duration:200,easing,fill:'both'});
   Promise.resolve(job.animation.finished).then(()=>settle(job),()=>settle(job));
  }catch{settle(job);}
 };
 const focus=event=>{
  // A validation error can focus a field while a close is in flight.
  if(event.target?.closest?.('summary'))return;
  let element=event.target?.closest?.('details');
  while(element){const job=byElement.get(element);if(job&&!job.targetOpen)settle(job,{keepOpen:true});element=element.parentElement?.closest?.('details');}
 };
 const cancel=()=>{for(const job of [...active])settle(job);};
 root?.addEventListener?.('click',click);
 root?.addEventListener?.('focusin',focus);
 return {cancel,destroy(){destroyed=true;cancel();root?.removeEventListener?.('click',click);root?.removeEventListener?.('focusin',focus);}};
}

/** Capture before replacing a screen, keeping no references to removed form fields. */
export function captureSectionState(root){
 const selectedReview=root?.querySelector?.('[data-phone-review-mode][aria-selected="true"]');
 const form=root?.querySelector?.('[data-rv-stage]');
 const selectedChart=root?.querySelector?.('[data-af-chart][aria-pressed="true"]');
 return {
  route:root?.dataset?.currentRoute||'',
  reviewMode:selectedReview?.dataset?.phoneReviewMode??null,
  stage:form?.dataset?.rvStage??null,
  chart:selectedChart?.dataset?.afChart??null,
  heights:{review:size(root?.querySelector?.('#wf-review-panel')),stage:size(root?.querySelector?.('.rv-panel')),chart:size(root?.querySelector?.('.ip-chart-card'))}
 };
}

export function createSectionMotion({reduced=()=>false}={}){
 let active=null;
 const finish=(job,canceled=false)=>{
  if(active!==job)return;
  active=null;job.restore();stopAnimation(job.animation);
  job.resolve({animated:true,canceled});
 };
 const cancel=()=>{if(active)finish(active,true);};
 const update=(root,before)=>{
  cancel();
  const after=captureSectionState(root);
  if(!before||before.route!==after.route||reduced())return Promise.resolve({animated:false,canceled:false});
  let kind,selector;
  if(before.reviewMode!==null&&after.reviewMode!==null&&before.reviewMode!==after.reviewMode){kind='review';selector='#wf-review-panel';}
  else if(before.stage!==null&&after.stage!==null&&before.stage!==after.stage){kind='stage';selector='.rv-panel';}
  else if(before.chart!==null&&after.chart!==null&&before.chart!==after.chart){kind='chart';selector='.ip-chart-card';}
  const element=selector&&root?.querySelector?.(selector);
  if(!element||typeof element.animate!=='function')return Promise.resolve({animated:false,canceled:false});
  return new Promise(resolve=>{
   const from=Number(before.heights?.[kind])||0,to=after.heights[kind];
   const frames=[{opacity:.55,transform:'translate3d(0,5px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}];
   if(from>0&&to>0){frames[0].height=`${from}px`;frames[1].height=`${to}px`;}
   const job={resolve,restore:temporaryStyles(element,{overflow:'hidden','will-change':from>0&&to>0?'height,opacity,transform':'opacity,transform'})};
   active=job;
   try{
    job.animation=element.animate(frames,{duration:200,easing,fill:'both'});
    Promise.resolve(job.animation.finished).then(()=>finish(job),()=>finish(job));
   }catch{finish(job);}
  });
 };
 return {update,cancel};
}
