// Public, fixed-origin market history. No credentials or personal workspace data.
const MARKET_PAIRS = Object.freeze({BTCUSD:'XBTUSD',ETHUSD:'ETHUSD',SOLUSD:'SOLUSD'});
const MARKET_FRAMES = Object.freeze({'5s':null,'10s':null,'30s':null,'1m':1,'5m':5,'15m':15,'30m':30,'1h':60,'4h':240,'1d':1440,'1w':1440,'1mo':1440});
let marketCaches = new WeakMap();
const MARKET_CACHE_LIMIT=24;
const marketJson=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const marketProblem=(code,message,status)=>marketJson({error:{code,message}},status);
const marketFinite=value=>typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number.isFinite(Number(value)):false;
const marketPositive=value=>marketFinite(value)&&Number(value)>0;
const marketNonnegative=value=>marketFinite(value)&&Number(value)>=0;
function marketResultRows(body){
 if(!body||typeof body!=='object'||!Array.isArray(body.error)||body.error.length||!body.result||typeof body.result!=='object')throw new Error('Invalid upstream market response');
 const entries=Object.entries(body.result).filter(([key,value])=>key!=='last'&&Array.isArray(value));
 if(entries.length!==1)throw new Error('Missing market rows');
 return entries[0][1];
}
function marketParseTrades(rows){
 if(rows.length>1000)throw new Error('Too many market trades');
 return rows.map((row,index)=>{
  if(!Array.isArray(row)||!marketPositive(row[0])||!marketPositive(row[1])||!marketPositive(row[2]))throw new Error('Invalid market trade');
  const price=Number(row[0]),volume=Number(row[1]),time=Number(row[2])*1000;
  if(!Number.isFinite(time)||time>8.64e15)throw new Error('Invalid market timestamp');
  return {id:row[6]!==undefined?String(row[6]):`${row[2]}:${row[0]}:${row[1]}:${index}`,time,price,volume};
 }).sort((a,b)=>a.time-b.time);
}
function marketParseCandles(rows){
 if(rows.length>720)throw new Error('Too many market candles');
 const parsed=rows.map(row=>{
  if(!Array.isArray(row)||!marketPositive(row[0])||![row[1],row[2],row[3],row[4]].every(marketPositive)||!marketNonnegative(row[6]))throw new Error('Invalid market candle');
  const [seconds,open,high,low,close]=row.map(Number),time=seconds*1000,volume=Number(row[6]);
  if(!Number.isFinite(time)||time>8.64e15||low>Math.min(open,close)||high<Math.max(open,close)||low>high)throw new Error('Invalid OHLC bounds');
  return {time,open,high,low,close,volume};
 }).sort((a,b)=>a.time-b.time);
 if(new Set(parsed.map(c=>c.time)).size!==parsed.length)throw new Error('Duplicate market candle');
 return parsed;
}
function marketCacheFor(fetcher){
 let cache=marketCaches.get(fetcher);
 if(!cache){cache=new Map();marketCaches.set(fetcher,cache);}
 return cache;
}
function marketBoundCache(cache){
 while(cache.size>MARKET_CACHE_LIMIT){const oldest=[...cache.entries()].find(([,value])=>!value.pending);if(!oldest)break;cache.delete(oldest[0]);}
}
async function marketLoad(url,fetcher,now,seconds){
 const cache=marketCacheFor(fetcher),key=url.href,entry=cache.get(key),ttl=seconds?3000:10000;
 if(entry?.pending)return entry.pending;
 if(entry?.value&&now>=entry.value.fetchedAt&&now-entry.value.fetchedAt<ttl)return entry.value;
 if(!entry&&cache.size>=MARKET_CACHE_LIMIT){const evict=[...cache.entries()].find(([,value])=>!value.pending);if(!evict)throw new Error('Market source busy');cache.delete(evict[0]);}
 const pending=(async()=>{
  const controller=new AbortController();
  let deadline;
  try{
   const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{controller.abort();const error=new Error('Market source timeout');error.marketTimeout=true;reject(error);},8000);});
   const response=await Promise.race([fetcher(url.href,{method:'GET',headers:{'Accept':'application/json'},signal:controller.signal}),timeout]);
   if(!response?.ok)throw new Error('Market source unavailable');
   const body=await Promise.race([response.json(),timeout]),rows=marketResultRows(body);
   const value={fetchedAt:now,candles:seconds?[]:marketParseCandles(rows),trades:seconds?marketParseTrades(rows):[]};
   if(!value.candles.length&&!value.trades.length)throw new Error('No market data');
   cache.set(key,{value});marketBoundCache(cache);return value;
  }catch(error){cache.delete(key);throw error;}finally{clearTimeout(deadline);}
 })();
 cache.set(key,{pending});marketBoundCache(cache);return pending;
}
export function resetMarketDataCache(){marketCaches=new WeakMap();}
export async function marketDataResponse(request,{fetcher=fetch,now=Date.now()}={}){
 const url=new URL(request.url);
 if(url.pathname!=='/api/markets')return marketProblem('not_found','Ruta no disponible.',404);
 if(request.method!=='GET')return marketProblem('method','Consulta de mercados disponible mediante GET.',405);
 const symbol=url.searchParams.get('symbol')||'BTCUSD',timeframe=url.searchParams.get('timeframe')||'1m';
 if(!Object.hasOwn(MARKET_PAIRS,symbol)||!Object.hasOwn(MARKET_FRAMES,timeframe)||url.searchParams.getAll('symbol').length>1||url.searchParams.getAll('timeframe').length>1||[...url.searchParams.keys()].some(key=>!['symbol','timeframe'].includes(key)))return marketProblem('market_parameters','Selecciona un instrumento y una temporalidad disponibles.',400);
 if(typeof fetcher!=='function'||!Number.isFinite(now))return marketProblem('unavailable','No se pudo consultar la fuente de precios.',503);
 const seconds=MARKET_FRAMES[timeframe]===null,upstream=new URL(`https://api.kraken.com/0/public/${seconds?'Trades':'OHLC'}`);
 upstream.searchParams.set('pair',MARKET_PAIRS[symbol]);
 if(!seconds)upstream.searchParams.set('interval',String(MARKET_FRAMES[timeframe]));
 try{
  const data=await marketLoad(upstream,fetcher,now,seconds);
  return marketJson({source:'Kraken',symbol,timeframe,...data});
 }catch(error){return marketProblem(error.marketTimeout?'source_timeout':'source_unavailable',error.marketTimeout?'La fuente de precios tardó demasiado. Vuelve a intentarlo.':'No se pudieron obtener cotizaciones de Kraken. Vuelve a intentarlo.',error.marketTimeout?503:502);}
}
