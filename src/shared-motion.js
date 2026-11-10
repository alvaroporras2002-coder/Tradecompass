// Animate the real sheet/image content so native dialogs keep their top-layer order.
// Snapshots deliberately contain only geometry: never a DOM clone or form values.
const motions=new WeakMap();
const skipped=()=>Promise.resolve({animated:false,canceled:false});

function isTarget(target){
 return target!==null&&(typeof target==='object'||typeof target==='function');
}

function readRect(value){
 if(!value)return null;
 const {left,top,width,height}=value;
 return [left,top,width,height].every(Number.isFinite)&&width>0&&height>0
  ?{left,top,width,height}:null;
}

function radiusOf(element){
 try{
  const view=element.ownerDocument?.defaultView;
  const style=view?.getComputedStyle?.(element)??globalThis.getComputedStyle?.(element);
  return typeof style?.borderRadius==='string'&&style.borderRadius.length<160?style.borderRadius:undefined;
 }catch{return undefined;}
}

export function captureMotionOrigin(element){
 try{
  if(!isTarget(element)||element.isConnected===false)return null;
  const rect=readRect(element.getBoundingClientRect?.());
  if(!rect)return null;
  const radius=radiusOf(element);
  return radius===undefined?{rect}:{rect,radius};
 }catch{return null;}
}

/** Cancel only the animation started here; callers may safely await its promise. */
export function cancelSharedMotion(target){
 if(isTarget(target))motions.get(target)?.finish(true);
}

function durationOf(duration){
 return Number.isFinite(duration)?Math.max(0,Math.min(duration,2000)):380;
}

function play(target,frames,{reduced=false,duration=380}={}){
 cancelSharedMotion(target);
 duration=durationOf(duration);
 if(reduced||duration===0||!isTarget(target)||target.isConnected===false||typeof target.animate!=='function')return skipped();
 let animation;
 try{
  animation=target.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'});
 }catch{return skipped();}
 if(!animation)return skipped();
 let resolve,timer,settled=false;
 const promise=new Promise(done=>{resolve=done;});
 const job={finish(canceled){
  if(settled)return;
  settled=true;
  clearTimeout(timer);
  if(motions.get(target)===job)motions.delete(target);
  // Removing fill restores the original styles without overwriting concurrent UI work.
  try{animation.cancel?.();}catch{}
  resolve({animated:true,canceled});
 }};
 motions.set(target,job);
 // A suspended document or a partial WAAPI implementation must not block closing.
 timer=setTimeout(()=>job.finish(false),duration+100);
 try{
  const finished=animation.finished;
  if(finished&&typeof finished.then==='function')Promise.resolve(finished).then(()=>job.finish(false),()=>job.finish(true));
 }catch{job.finish(true);}
 return promise;
}

function morph(target,snapshot,options,reverse){
 // Clear the previous transform before measuring the destination's resting layout.
 cancelSharedMotion(target);
 if(options?.reduced)return skipped();
 const destination=captureMotionOrigin(target);
 let origin;
 try{origin=readRect(snapshot?.rect);}catch{return skipped();}
 if(!origin||!destination)return skipped();
 const rect=destination.rect;
 const x=origin.left-rect.left,y=origin.top-rect.top;
 const scaleX=origin.width/rect.width,scaleY=origin.height/rect.height;
 if(![x,y,scaleX,scaleY].every(Number.isFinite))return skipped();
 const start={transform:`translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`,transformOrigin:'0 0',opacity:.65};
 const end={transform:'translate(0px, 0px) scale(1, 1)',transformOrigin:'0 0',opacity:1};
 if(typeof snapshot.radius==='string')start.borderRadius=snapshot.radius;
 if(destination.radius!==undefined)end.borderRadius=destination.radius;
 return play(target,reverse?[end,start]:[start,end],options);
}

/** Expand a card or thumbnail from a previously captured origin. */
export function animateFromOrigin(target,snapshot,options={}){
 return morph(target,snapshot,options,false);
}

/** Await this before hiding the target, returning it visually to its origin. */
export function animateToOrigin(target,snapshot,options={}){
 return morph(target,snapshot,options,true);
}

/** A brief confirmation ring; the card's underlying border/shadow stay intact. */
export function flashSelection(target,{reduced=false}={}){
 return play(target,[
  {boxShadow:'0 0 0 0 rgba(175, 255, 73, 0)'},
  {boxShadow:'0 0 0 2px rgba(175, 255, 73, .75), 0 0 28px rgba(175, 255, 73, .2)',offset:.35},
  {boxShadow:'0 0 0 6px rgba(175, 255, 73, 0)'}
 ],{reduced,duration:620});
}
