// Read-only historical market bootstrap. Both paths use Kraken's public data.
const HISTORY_PAIRS=Object.freeze({BTCUSD:'XBTUSD',ETHUSD:'ETHUSD',SOLUSD:'SOLUSD'});
const HISTORY_FRAMES=Object.freeze({'5s':null,'10s':null,'30s':null,'1m':1,'5m':5,'15m':15,'30m':30,'1h':60,'4h':240,'1d':1440,'1w':1440,'1mo':1440});
const HISTORY_TIMEOUT=12000,CACHE_TIMEOUT=400,CACHE_MAX=36;
let historyDatabase;
export class MarketHistoryError extends Error{constructor(code,message='No se pudo cargar el historial de Kraken.'){super(message);this.name='MarketHistoryError';this.code=code;}}
const historyRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const historyNumber=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value));
const historyPositive=value=>historyNumber(value)&&Number(value)>0;
const historyTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&Number.isFinite(new Date(value).getTime());
const abortError=()=>new DOMException('History request cancelled.','AbortError');
function historyParameters(symbol,timeframe,range){return Object.hasOwn(HISTORY_PAIRS,symbol)&&Object.hasOwn(HISTORY_FRAMES,timeframe)&&['recent','max'].includes(range)&&(range!=='max'||timeframe==='1w');}
function historyCandles(input,raw=false){
 if(!Array.isArray(input)||input.length>721)throw new MarketHistoryError('invalid_history');
 const result=input.map(row=>{
  const data=raw&&Array.isArray(row)?{time:Number(row[0])*1000,open:row[1],high:row[2],low:row[3],close:row[4],volume:row[6]}:row;
  if(!historyRecord(data)||!historyTime(data.time)||!['open','high','low','close'].every(k=>historyPositive(data[k]))||!historyNumber(data.volume)||Number(data.volume)<0)throw new MarketHistoryError('invalid_history');
  const candle={time:data.time,open:Number(data.open),high:Number(data.high),low:Number(data.low),close:Number(data.close),volume:Number(data.volume)};
  if(candle.low>Math.min(candle.open,candle.close)||candle.high<Math.max(candle.open,candle.close)||candle.low>candle.high)throw new MarketHistoryError('invalid_history');
  return candle;
 }).sort((a,b)=>a.time-b.time);
 if(new Set(result.map(row=>row.time)).size!==result.length)throw new MarketHistoryError('invalid_history');
 return result.slice(-720);
}
function historyTrades(input,raw=false){
 if(!Array.isArray(input)||input.length>1000)throw new MarketHistoryError('invalid_history');
 const result=input.map((row,index)=>{
  const data=raw&&Array.isArray(row)?{id:row[6]??`${row[2]}:${row[0]}:${index}`,time:Number(row[2])*1000,price:row[0],volume:row[1]}:row;
  if(!historyRecord(data)||!historyTime(data.time)||!historyPositive(data.price)||!historyPositive(data.volume)||!['string','number'].includes(typeof data.id)||!String(data.id)||String(data.id).length>150)throw new MarketHistoryError('invalid_history');
  return {id:String(data.id),time:data.time,price:Number(data.price),volume:Number(data.volume)};
 }).sort((a,b)=>a.time-b.time);
 return result;
}
function canonicalHistory(body,{symbol,timeframe,range},raw=false){
 const seconds=HISTORY_FRAMES[timeframe]===null;
 let candles,trades,fetchedAt;
 if(raw){
  if(!historyRecord(body)||!Array.isArray(body.error)||body.error.length||!historyRecord(body.result))throw new MarketHistoryError('invalid_history');
  const candidates=Object.entries(body.result).filter(([key,value])=>key!=='last'&&Array.isArray(value));
  if(candidates.length!==1)throw new MarketHistoryError('invalid_history');
  candles=seconds?[]:historyCandles(candidates[0][1],true);trades=seconds?historyTrades(candidates[0][1],true):[];fetchedAt=Date.now();
 }else{
  if(!historyRecord(body)||body.source!=='Kraken'||body.symbol!==symbol||body.timeframe!==timeframe||(body.range??body.history?.range??'recent')!==range||!historyTime(body.fetchedAt))throw new MarketHistoryError('invalid_history');
  candles=historyCandles(body.candles);trades=historyTrades(body.trades);fetchedAt=body.fetchedAt;
  if(seconds&&candles.length||!seconds&&trades.length)throw new MarketHistoryError('invalid_history');
 }
 const records=seconds?trades:candles;if(!records.length)throw new MarketHistoryError('empty_history');
 return {source:'Kraken',symbol,timeframe,range,fetchedAt,candles,trades,history:{range,resolution:timeframe,firstTime:records[0].time,lastTime:records.at(-1).time,count:records.length,scope:'Kraken',limited:true}};
}
async function historyJson(url,options,fetcher,externalSignal){
 if(externalSignal?.aborted)throw abortError();
 const controller=new AbortController();let timer,externalAbort,timedOut=false;
 const cancelled=new Promise((_,reject)=>{
  externalAbort=()=>{controller.abort();reject(abortError());};externalSignal?.addEventListener('abort',externalAbort,{once:true});
  timer=setTimeout(()=>{timedOut=true;controller.abort();reject(new MarketHistoryError('history_timeout'));},HISTORY_TIMEOUT);
 });
 try{
  return await Promise.race([(async()=>{const response=await fetcher(url,{...options,signal:controller.signal});if(!response?.ok)throw new MarketHistoryError('history_http_'+(response?.status||0));if(Number(response.headers?.get('content-length'))>2*1024*1024)throw new MarketHistoryError('invalid_history');return await response.json();})(),cancelled]);
 }catch(error){if(externalSignal?.aborted)throw abortError();if(timedOut)throw new MarketHistoryError('history_timeout');throw error;}finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',externalAbort);}
}
export async function loadMarketHistory({symbol,timeframe,range='recent',signal,fetcher=globalThis.fetch,origin=globalThis.location?.href}={}){
 if(!historyParameters(symbol,timeframe,range)||typeof fetcher!=='function')throw new MarketHistoryError('history_parameters','Selecciona un instrumento, una temporalidad y un rango disponibles.');
 if(signal?.aborted)throw abortError();
 let proxy;
 try{proxy=new URL('./api/markets',origin);if(!['https:','http:'].includes(proxy.protocol)||proxy.username||proxy.password)throw Error();}catch{throw new MarketHistoryError('history_origin');}
 proxy.searchParams.set('symbol',symbol);proxy.searchParams.set('timeframe',timeframe);proxy.searchParams.set('range',range);
 const parameters={symbol,timeframe,range};
 try{return canonicalHistory(await historyJson(proxy.href,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}},fetcher,signal),parameters);}
 catch(error){if(signal?.aborted)throw abortError();}
 const seconds=HISTORY_FRAMES[timeframe]===null,upstream=new URL(`https://api.kraken.com/0/public/${seconds?'Trades':'OHLC'}`);upstream.searchParams.set('pair',HISTORY_PAIRS[symbol]);
 if(!seconds)upstream.searchParams.set('interval',String(range==='max'?10080:HISTORY_FRAMES[timeframe]));if(range==='max')upstream.searchParams.set('since','0');
 try{return canonicalHistory(await historyJson(upstream.href,{method:'GET',credentials:'omit',mode:'cors',cache:'no-store',headers:{Accept:'application/json'}},fetcher,signal),parameters,true);}
 catch(error){if(signal?.aborted)throw abortError();throw new MarketHistoryError(error?.code==='history_timeout'?'history_timeout':'history_unavailable');}
}
function parseCacheKey(key){if(typeof key!=='string'||key.length>40)return null;const [symbol,timeframe,range,...extra]=key.split('|');return !extra.length&&historyParameters(symbol,timeframe,range)?{symbol,timeframe,range}:null;}
function openHistoryDatabase(){
 if(!globalThis.indexedDB)return Promise.resolve(null);if(historyDatabase)return historyDatabase;
 historyDatabase=new Promise(resolve=>{
  let request,settled=false;const finish=value=>{if(settled){value?.close?.();return;}settled=true;clearTimeout(timer);if(!value)historyDatabase=null;resolve(value);};const timer=setTimeout(()=>finish(null),CACHE_TIMEOUT);
  try{request=indexedDB.open('tradecompass-market-history',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('quotes'))request.result.createObjectStore('quotes',{keyPath:'key'});};request.onsuccess=()=>finish(request.result);request.onerror=request.onblocked=()=>finish(null);}catch{finish(null);}
 });return historyDatabase;
}
async function historyCacheOperation(mode,perform,fallback){
 const db=await openHistoryDatabase();if(!db)return fallback;
 return new Promise(resolve=>{let settled=false;const finish=value=>{if(!settled){settled=true;clearTimeout(timer);resolve(value);}};const timer=setTimeout(()=>finish(fallback),CACHE_TIMEOUT);
  try{const transaction=db.transaction('quotes',mode);transaction.onerror=transaction.onabort=()=>finish(fallback);perform(transaction.objectStore('quotes'),transaction,finish);}catch{finish(fallback);}
 });
}
export async function readMarketCache(key){
 const parameters=parseCacheKey(key);if(!parameters)return null;
 return historyCacheOperation('readonly',(store,transaction,finish)=>{const request=store.get(key);request.onsuccess=()=>{try{const data=request.result?.data;finish(data?canonicalHistory(data,parameters):null);}catch{finish(null);}};request.onerror=()=>finish(null);},null);
}
export async function writeMarketCache(key,data){
 const parameters=parseCacheKey(key);if(!parameters)return false;let clean;try{clean=canonicalHistory(data,parameters);}catch{return false;}
 return historyCacheOperation('readwrite',(store,transaction,finish)=>{
  store.put({key,data:clean,savedAt:Date.now()});const all=store.getAll();all.onsuccess=()=>{const records=all.result||[];records.sort((a,b)=>(a.savedAt||0)-(b.savedAt||0));for(const record of records.slice(0,Math.max(0,records.length-CACHE_MAX)))store.delete(record.key);};transaction.oncomplete=()=>finish(true);
 },false);
}
