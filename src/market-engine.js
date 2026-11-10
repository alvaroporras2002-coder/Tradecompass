/** Pure time and viewport calculations. All price/volume values come from supplied records. */
const SECOND=1000, MINUTE=60*SECOND, HOUR=60*MINUTE, DAY=24*HOUR, WEEK=7*DAY;
export const TIMEFRAMES=Object.freeze([
 {id:'5s',label:'5s',ms:5*SECOND},
 {id:'10s',label:'10s',ms:10*SECOND},
 {id:'30s',label:'30s',ms:30*SECOND},
 {id:'1m',label:'1m',ms:MINUTE,krakenInterval:1},
 {id:'5m',label:'5m',ms:5*MINUTE,krakenInterval:5},
 {id:'15m',label:'15m',ms:15*MINUTE,krakenInterval:15},
 {id:'30m',label:'30m',ms:30*MINUTE,krakenInterval:30},
 {id:'1h',label:'1h',ms:HOUR,krakenInterval:60},
 {id:'4h',label:'4h',ms:4*HOUR,krakenInterval:240},
 {id:'1d',label:'1D',ms:DAY,krakenInterval:1440},
 {id:'1w',label:'1W',ms:WEEK,krakenInterval:10080},
 // ms is nominal for selection/layout only. Monthly boundaries use the UTC calendar.
 {id:'1mo',label:'1M',ms:30*DAY,krakenInterval:1440},
].map(value=>Object.freeze(value)));
const frames=new Map(TIMEFRAMES.map(frame=>[frame.id,frame]));
export function timeframeById(value='1m'){
 const id=typeof value==='string'?value.toLowerCase():value?.id;
 const frame=frames.get(id);
 if(!frame)throw new RangeError('Unknown chart timeframe');
 return frame;
}
function epoch(value){if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(new Date(value).getTime()))throw new RangeError('Invalid chart timestamp');return value;}
/** Buckets use epoch-aligned fixed intervals, Mondays for weeks, calendar months in UTC. */
export function bucketStart(timestamp,timeframe='1m'){
 const time=epoch(timestamp),frame=timeframeById(timeframe);
 if(frame.id==='1mo'){
  const date=new Date(time);date.setUTCDate(1);date.setUTCHours(0,0,0,0);return date.getTime();
 }
 if(frame.id==='1w'){
  const date=new Date(time),daysSinceMonday=(date.getUTCDay()+6)%7;
  date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()-daysSinceMonday);return date.getTime();
 }
 return Math.floor(time/frame.ms)*frame.ms;
}
export function bucketEnd(timestamp,timeframe='1m'){
 const frame=timeframeById(timeframe),start=bucketStart(timestamp,frame);
 if(frame.id==='1mo'){const date=new Date(start);date.setUTCMonth(date.getUTCMonth()+1);return date.getTime();}
 return start+frame.ms;
}
export function candleCountdown(now=Date.now(),timeframe='1m'){
 const timestamp=epoch(now),remainingMs=Math.max(0,bucketEnd(timestamp,timeframe)-timestamp),seconds=Math.ceil(remainingMs/SECOND);
 const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60,pad=n=>String(n).padStart(2,'0');
 const text=days?`${days}d ${pad(hours)}:${pad(minutes)}:${pad(rest)}`:hours?`${pad(hours)}:${pad(minutes)}:${pad(rest)}`:`${pad(minutes)}:${pad(rest)}`;
 return {remainingMs,text};
}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const validTime=value=>finite(value)&&Number.isFinite(new Date(value).getTime());
function validCandle(value){return record(value)&&validTime(value.time)&&['open','high','low','close'].every(key=>finite(value[key])&&value[key]>0)&&value.high>=Math.max(value.open,value.close)&&value.low<=Math.min(value.open,value.close)&&value.high>=value.low&&finite(value.volume??0)&&(value.volume??0)>=0;}
const copyCandle=value=>({time:value.time,open:value.open,high:value.high,low:value.low,close:value.close,volume:value.volume??0});
/** Aggregate only observed trades; missing buckets are intentionally absent. */
export function aggregateTrades(trades,timeframe='1m'){
 const frame=timeframeById(timeframe),rows=(Array.isArray(trades)?trades:[]).filter(value=>record(value)&&validTime(value.time)&&finite(value.price)&&value.price>0&&finite(value.volume??0)&&(value.volume??0)>=0).map((value,index)=>({...value,index})).sort((a,b)=>a.time-b.time||a.index-b.index),buckets=new Map();
 for(const trade of rows){
  const start=bucketStart(trade.time,frame),existing=buckets.get(start);
  if(!existing)buckets.set(start,{time:start,open:trade.price,high:trade.price,low:trade.price,close:trade.price,volume:trade.volume??0});
  else {existing.high=Math.max(existing.high,trade.price);existing.low=Math.min(existing.low,trade.price);existing.close=trade.price;existing.volume+=trade.volume??0;}
 }
 return [...buckets.values()].filter(validCandle);
}
/** Aggregate supplied OHLC bars, including daily bars into true calendar months. */
export function aggregateCandles(candles,timeframe='1m'){
 const frame=timeframeById(timeframe),source=mergeCandles([],candles,{max:Array.isArray(candles)?candles.length:0}),buckets=new Map();
 for(const candle of source){
  const start=bucketStart(candle.time,frame),existing=buckets.get(start);
  if(!existing)buckets.set(start,{...candle,time:start});
  else {existing.high=Math.max(existing.high,candle.high);existing.low=Math.min(existing.low,candle.low);existing.close=candle.close;existing.volume+=candle.volume;}
 }
 return [...buckets.values()].filter(validCandle);
}
/** New records replace a matching timestamp. No interpolation or synthetic OHLC is added. */
export function mergeCandles(previous,incoming,{max=720}={}){
 if(!Number.isSafeInteger(max)||max<0)throw new RangeError('Invalid chart history limit');
 if(!max)return [];
 const rows=new Map();
 for(const group of [previous,incoming])for(const candle of Array.isArray(group)?group:[])if(validCandle(candle))rows.set(candle.time,copyCandle(candle));
 return [...rows.values()].sort((a,b)=>a.time-b.time).slice(-max);
}
/** offset=0 follows the most recent candle; increasing offset pans into history. */
export function chartViewport(candles,{offset=0,count=50}={}){
 const source=mergeCandles([],candles,{max:Array.isArray(candles)?candles.length:0}),total=source.length;
 if(!total)return {candles:[],start:0,end:0,offset:0,count:0,total:0,maxOffset:0,atLiveEdge:true};
 const wanted=finite(count)?Math.max(1,Math.floor(count)):50,visibleCount=Math.min(total,wanted),maxOffset=total-visibleCount;
 const boundedOffset=Math.max(0,Math.min(maxOffset,finite(offset)?Math.floor(offset):0)),end=total-boundedOffset,start=end-visibleCount;
 return {candles:source.slice(start,end),start,end,offset:boundedOffset,count:visibleCount,total,maxOffset,atLiveEdge:boundedOffset===0};
}
