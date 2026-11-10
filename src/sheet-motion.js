/** Keep the native dialog and its focus trap alive until the closing motion ends. */
export function createSheetMotion(dialog,{reduced=()=>false,onClosed=()=>{},schedule=setTimeout,unschedule=clearTimeout}={}) {
 let phase='closed',generation=0,timer,listener,pending;
 function clear(){
  if(timer!==undefined){unschedule(timer);timer=undefined;}
  if(listener){dialog.removeEventListener('animationend',listener);listener=null;}
  dialog.classList.remove('tc-sheet-opening','tc-sheet-closing');
 }
 function supersede(){
  generation++;clear();
  if(pending){pending.resolve({canceled:true});pending=null;}
 }
 function finishClose(token,restoreFocus){
  if(token!==generation||phase!=='closing')return;
  clear();phase='closed';
  if(dialog.open)dialog.close();
  const job=pending;pending=null;
  onClosed({restoreFocus});job?.resolve({canceled:false});
 }
 function open(){
  supersede();
  if(!dialog.open)dialog.showModal();
  phase='open';
  if(reduced())return;
  const token=generation;
  // Restart entry when one sheet replaces another, while retaining the same dialog.
  void dialog.offsetWidth;
  dialog.classList.add('tc-sheet-opening');
  listener=event=>{if(event.target===dialog&&event.animationName==='tc-sheet-open'&&token===generation)clear();};
  dialog.addEventListener('animationend',listener);
  timer=schedule(()=>{if(token===generation)clear();},280);
 }
 function close({immediate=false,restoreFocus=true}={}){
  if(!dialog.open){supersede();phase='closed';return Promise.resolve({canceled:false});}
  if(phase==='closing'&&!immediate&&!reduced())return pending.promise;
  supersede();phase='closing';const token=generation;
  const promise=new Promise(resolve=>{pending={resolve};});pending.promise=promise;
  if(immediate||reduced()){finishClose(token,restoreFocus);return promise;}
  dialog.classList.add('tc-sheet-closing');
  listener=event=>{if(event.target===dialog&&event.animationName==='tc-sheet-close')finishClose(token,restoreFocus);};
  dialog.addEventListener('animationend',listener);
  // CSS animation events can be absent when the page is backgrounded or motion changes.
  timer=schedule(()=>finishClose(token,restoreFocus),220);
  return promise;
 }
 function settle(){
  if(phase==='closing')finishClose(generation,true);
  else clear();
 }
 return {open,close,settle,get phase(){return phase;}};
}
