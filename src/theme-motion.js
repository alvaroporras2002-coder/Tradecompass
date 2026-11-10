const settle=promise=>Promise.resolve(promise).then(value=>({ok:true,value}),error=>({ok:false,error}));

/** Theme saves run in order; a visual failure never rolls back a successful save. */
export function createThemeTransition({
 document:doc=globalThis.document,
 reduced=()=>false,
 viewport=()=>({width:globalThis.innerWidth,height:globalThis.innerHeight}),
}={}) {
 let pending=Promise.resolve();
 const root=()=>doc?.documentElement;
 const originFor=element=>{
  let size={},rect;
  try{size=viewport()||{};}catch{}
  try{rect=element?.getBoundingClientRect?.();}catch{}
  const width=Number(size.width)||root()?.clientWidth||0,height=Number(size.height)||root()?.clientHeight||0;
  const center=(start,length,fallback)=>Number.isFinite(start)&&Number.isFinite(length)?start+length/2:fallback;
  const x=Math.max(0,Math.min(width,center(rect?.left,rect?.width,width/2)));
  const y=Math.max(0,Math.min(height,center(rect?.top,rect?.height,height/2)));
  return {x,y,radius:Math.hypot(Math.max(x,width-x),Math.max(y,height-y))};
 };
 const animate=async(frames,options)=>{
  if(typeof root()?.animate!=='function')return false;
  try{
   const animation=root().animate(frames,options);
   await settle(animation?.finished);
   return true;
  }catch{return false;}
 };
 const fade=async()=>{
  if(reduced())return;
  await animate([{opacity:.96},{opacity:1}],{duration:160,easing:'ease-out',fill:'none'});
 };
 const run=async(point,apply)=>{
  let applied;
  const applyOnce=()=>{
   if(!applied){applied=Promise.resolve().then(apply);applied.catch(()=>{});}
   return applied;
  };
  if(reduced()||typeof doc?.startViewTransition!=='function'){
   const result=await applyOnce();
   await fade();
   return result;
  }
  let transition;
  const skip=()=>{try{transition?.skipTransition?.();}catch{}};
  root()?.classList?.add('tc-theme-revealing');
  try{
   try{transition=doc.startViewTransition(applyOnce);}catch{}
   // Attach handlers immediately: ready and finished also reject when a save fails.
   const ready=settle(transition?.ready??transition?.updateCallbackDone);
   const finished=settle(transition?.finished);
   if(transition?.updateCallbackDone)settle(transition.updateCallbackDone);
   if(!transition){const result=await applyOnce();await fade();return result;}
   const readiness=await ready;
   const result=await applyOnce();
   if(!readiness.ok){skip();await fade();return result;}
   if(reduced()){skip();return result;}
   const {x,y,radius}=point;
   const animated=await animate([
    {clipPath:`circle(0px at ${x}px ${y}px)`},
    {clipPath:`circle(${radius}px at ${x}px ${y}px)`},
   ],{duration:480,easing:'cubic-bezier(.22,.8,.22,1)',fill:'both',pseudoElement:'::view-transition-new(root)'});
   if(!animated){skip();await fade();return result;}
   await finished;
   return result;
  }catch(error){skip();throw error;}
  finally{root()?.classList?.remove('tc-theme-revealing');}
 };
 return function change({origin,apply}={}){
  // Capture before a queued save can replace the button or its surrounding DOM.
  const point=originFor(origin);
  const task=pending.then(()=>{
   if(typeof apply!=='function')throw new TypeError('A theme apply function is required');
   return run(point,apply);
  });
  pending=task.catch(()=>{});
  return task;
 };
}
