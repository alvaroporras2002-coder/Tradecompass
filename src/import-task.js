import {parseMT5} from './importer.js';

const abortError=()=>Object.assign(new Error('Import canceled'),{name:'AbortError'});
const defaultWorker=()=>typeof globalThis.Worker==='function'?new Worker(new URL('./import-worker.js',import.meta.url),{type:'module'}):null;
// Let a real status change reach the screen before work on the fallback thread.
const paint=()=>new Promise(resolve=>{
 if(typeof globalThis.requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(resolve,0));
 else setTimeout(resolve,0);
});

/** Owns one file operation. Replacing or canceling it can never deliver a stale result. */
export function createImportTask({createWorker=defaultWorker,parse=parseMT5,yieldToPaint=paint}={}){
 let active=null;
 function cancel(){
  const job=active;if(!job)return;
  active=null;job.canceled=true;job.worker?.terminate();job.rejectCancel(abortError());
 }
 async function run(file,options,{onStage=()=>{},isCurrent=()=>true}={}){
  cancel();
  let rejectCancel;
  const cancellation=new Promise((_,reject)=>{rejectCancel=reject;});
  // Cancellation can occur while a synchronous callback runs, before the next race.
  cancellation.catch(()=>{});
  const job={canceled:false,worker:null,rejectCancel};active=job;
  const valid=()=>active===job&&!job.canceled&&isCurrent();
  const check=()=>{if(!valid())throw abortError();};
  const wait=promise=>Promise.race([promise,cancellation]);
  const stage=name=>{check();onStage(name);check();};
  try{
   stage('reading');
   const text=await wait(file.text());check();
   stage('reviewing');
   let worker;
   try{worker=createWorker();}catch{worker=null;}
   let result;
   if(worker){
    job.worker=worker;
    try{
     result=await wait(new Promise((resolve,reject)=>{
      worker.onmessage=event=>{
       if(event.data?.type==='result')resolve(event.data.result);
       else if(event.data?.type==='error')reject(Object.assign(new Error(event.data.message||'Import failed'),{importParseError:true}));
      };
      worker.onerror=()=>reject(new Error('Import worker unavailable'));
      worker.onmessageerror=()=>reject(new Error('Import worker message unavailable'));
      worker.postMessage({text,options});
     }));
    }catch(error){
     check();if(error.importParseError)throw error;
     // A browser that cannot start module workers still supports the same import contract.
     await wait(yieldToPaint());check();result=parse(text,options);
    }finally{worker.terminate();job.worker=null;}
   }else{await wait(yieldToPaint());check();result=parse(text,options);}
   check();stage('preparing');
   return result;
  }finally{job.worker?.terminate();if(active===job)active=null;}
 }
 return {run,cancel,get busy(){return active!==null;}};
}
