/** A returning thumbnail/card must finish before the native dialog closes.
 * Replacing or immediately closing a dialog invalidates any older exit. */
export function createModalExit(closeSheet){
 let hook,epoch=0,pending;
 function invalidate(){
  epoch++;
  if(pending){pending.resolve({canceled:true});pending=null;}
 }
 function replace(next){invalidate();hook=typeof next==='function'?next:null;}
 function close(options={}){
  if(options.immediate){invalidate();hook=null;return closeSheet(options);}
  if(pending)return pending.promise;
  const exit=hook;hook=null;
  if(!exit)return closeSheet(options);
  const token=epoch;
  let resolve;const promise=new Promise(done=>{resolve=done;});
  const job={promise,resolve};pending=job;
  (async()=>{
   try{await exit();}catch{/* Motion failure must never trap a dialog. */}
   if(epoch!==token||pending!==job)return;
   pending=null;
   // The shared return already provided the exit; do not briefly show the
   // full-size content again during a second sheet animation.
   try{resolve(await closeSheet({...options,immediate:true}));}catch{resolve({canceled:true});}
  })();
  return promise;
 }
 return {replace,close};
}
