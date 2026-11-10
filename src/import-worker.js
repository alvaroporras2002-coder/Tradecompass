import {parseMT5} from './importer.js';

self.onmessage=event=>{
 try{self.postMessage({type:'result',result:parseMT5(event.data.text,event.data.options)});}
 catch(error){self.postMessage({type:'error',message:error.message});}
};
