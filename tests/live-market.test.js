import test from 'node:test';
import assert from 'node:assert/strict';
import {applyLiveTrade,marketPlot,renderLiveMarkets,LIVE_MARKETS} from '../src/live-market.js';
import {TIMEFRAMES,bucketStart} from '../src/market-engine.js';
import {createEmptyState} from '../src/demo.js';
import {esc,icon} from '../src/ui.js';
const start=Date.parse('2026-11-10T12:00:00Z');
const candle=(i,base=100)=>({time:start+i*60000,open:base+i,high:base+i+3,low:base+i-2,close:base+i+1,volume:i+1});
function context(language='es'){
 const state=createEmptyState();state.settings.language=language;
 return {state,account:state.accounts[0],esc,icon,t:(es,en)=>language==='en'?en:es,money:n=>`$${Number(n).toFixed(2)}`};
}

test('the live market selector offers exactly the requested twelve resolutions, from five seconds through a calendar month',()=>{
 const html=renderLiveMarkets(context());
 const ids=[...html.matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(ids,['5s','10s','30s','1m','5m','15m','30m','1h','4h','1d','1w','1mo']);
 assert.deepEqual(ids,TIMEFRAMES.map(frame=>frame.id));
 assert.match(html,/1 mes/);assert.match(html,/1 semana/);
});

test('a new live chart waits for genuine data rather than rendering invented prices or candles',()=>{
 const html=renderLiveMarkets(context());
 assert.match(html,/data-live-price>—</);assert.match(html,/Cargando historial de Kraken/);
 assert.match(html,/Preparando las velas anteriores/);
 assert.doesNotMatch(html,/data-market-candle|viewBox="0 0 360 260"/);
 assert.doesNotMatch(html,/Datos simulados|Sin cotizaciones en vivo|en el ejemplo/);
 assert.match(html,/Fuente: Kraken/);
 assert.deepEqual(LIVE_MARKETS.map(m=>m.symbol),['BTCUSD','ETHUSD','SOLUSD']);
 assert.ok(LIVE_MARKETS.every(m=>m.socket.endsWith('/USD')));
});

test('English market rendering keeps source context and accessible pan, zoom and candle timer controls',()=>{
 const html=renderLiveMarkets(context('en'));
 assert.match(html,/Source: Kraken/);assert.match(html,/Candle closes in/);
 assert.match(html,/data-live-countdown/);assert.match(html,/data-live-pan="older"/);
 assert.match(html,/data-live-pan="newer"/);assert.match(html,/data-live-zoom="in"/);
 assert.match(html,/data-live-zoom="out"/);assert.match(html,/data-live-now/);
 assert.equal((html.match(/data-market-chart=/g)||[]).length,3);
 assert.doesNotMatch(html,/\b(?:NaN|undefined|Infinity)\b/);
});

test('phone plot reserves its price gutter and maps every supplied OHLC wick inside a finite viewbox',()=>{
 for(const base of [.001,100,50000])for(const length of [1,2,36,200]){
  const rows=Array.from({length},(_,i)=>candle(i,base+10));
  const before=structuredClone(rows),g=marketPlot(rows,{count:50});
  assert.equal(g.width,360);assert.equal(g.height,260);assert.ok(g.width-g.right>=60);
  assert.ok(g.high>g.low);assert.ok(Number.isFinite(g.low));assert.ok(Number.isFinite(g.high));
  for(const [i,c] of g.candles.entries()){
   assert.ok(g.x(i)>=g.left&&g.x(i)<=g.right);
   assert.ok(g.y(c.high)>=g.top&&g.y(c.low)<=g.bottom);
   assert.ok(g.y(c.high)<=g.y(c.open));assert.ok(g.y(c.low)>=g.y(c.close));
  }
  assert.deepEqual(rows,before);
 }
});

test('a flat observed candle and an empty series produce stable chart geometry without synthetic history',()=>{
 const g=marketPlot([{time:start,open:.000001,high:.000001,low:.000001,close:.000001,volume:0}]);
 assert.equal(g.candles.length,1);assert.ok(Number.isFinite(g.y(.000001)));assert.ok(g.high>g.low);
 const empty=marketPlot([]);assert.deepEqual(empty.candles,[]);assert.equal(empty.total,0);assert.ok(empty.high>empty.low);
});

test('pan and zoom select actual historical rows with bounded offsets and a clear live edge',()=>{
 const rows=Array.from({length:150},(_,i)=>candle(i));
 const live=marketPlot(rows,{count:30,offset:0}),past=marketPlot(rows,{count:30,offset:25});
 assert.equal(live.candles.at(-1).time,rows.at(-1).time);assert.equal(live.atLiveEdge,true);
 assert.equal(past.candles.at(-1).time,rows.at(-26).time);assert.equal(past.offset,25);assert.equal(past.atLiveEdge,false);
 const oldest=marketPlot(rows,{count:30,offset:1e6});assert.equal(oldest.offset,120);assert.equal(oldest.candles[0].time,rows[0].time);
});

test('live trades move the current candle in either direction while maintaining real observed high, low and volume',()=>{
 const initial=[];
 const a=applyLiveTrade(initial,{time:start+1000,price:100,volume:1},'1m');
 const b=applyLiveTrade(a,{time:start+2000,price:110,volume:2},'1m');
 const c=applyLiveTrade(b,{time:start+3000,price:95,volume:3},'1m');
 assert.deepEqual(initial,[]);assert.equal(a[0].close,100);
 assert.equal(b[0].close-b[0].open,10);assert.equal(c[0].close-c[0].open,-5);
 assert.equal(c[0].open,100);assert.equal(c[0].high,110);assert.equal(c[0].low,95);assert.equal(c[0].volume,6);
 assert.equal(c[0].time,bucketStart(start,'1m'));assert.equal(c[0].lastTradeTime,start+3000);
});

test('out-of-order trades preserve the newest close while still contributing observed wick extremes and volume',()=>{
 let rows=applyLiveTrade([],{time:start+1000,price:100,volume:1},'1m');
 rows=applyLiveTrade(rows,{time:start+3000,price:110,volume:2},'1m');
 const before=structuredClone(rows);
 const late=applyLiveTrade(rows,{time:start+2000,price:90,volume:4},'1m');
 assert.equal(late[0].close,110);assert.equal(late[0].open,100);
 assert.equal(late[0].high,110);assert.equal(late[0].low,90);assert.equal(late[0].volume,7);
 assert.equal(late[0].lastTradeTime,start+3000);assert.deepEqual(rows,before);
});

test('an older observed bucket never replaces the newest quote and missing buckets are not fabricated',()=>{
 const latest=applyLiveTrade([],{time:start+180000,price:150,volume:1},'1m');
 const withOlder=applyLiveTrade(latest,{time:start+1000,price:100,volume:1},'1m');
 assert.equal(withOlder.length,2);assert.deepEqual(withOlder.map(c=>c.time),[start,start+180000]);
 assert.equal(withOlder.at(-1).close,150);
});

test('malformed live events cannot introduce invalid prices, volumes or timestamps',()=>{
 const rows=[candle(0)];
 for(const trade of [null,{time:NaN,price:100,volume:1},{time:start,price:0,volume:1},{time:start,price:Infinity,volume:1},{time:start,price:100,volume:-1},{time:start,price:'100',volume:1},{time:1e20,price:100,volume:1}]){
  assert.doesNotThrow(()=>assert.deepEqual(applyLiveTrade(rows,trade,'1m'),rows));
 }
});

test('stream history remains bounded to 720 observed candles without mutating the caller array',()=>{
 const rows=Array.from({length:720},(_,i)=>candle(i));const before=structuredClone(rows);
 const next=applyLiveTrade(rows,{time:start+720*60000+1000,price:1000,volume:1},'1m');
 assert.equal(next.length,720);assert.equal(next[0].time,rows[1].time);assert.equal(next.at(-1).close,1000);assert.deepEqual(rows,before);
});


test('history keeps retrying while streaming is live but the bootstrap is missing',async()=>{const {historyRefreshDelay}=await import('../src/live-market.js');assert.equal(historyRefreshDelay({loaded:false,connected:true,failures:1}),10000);assert.equal(historyRefreshDelay({loaded:false,connected:true,failures:9}),30000);assert.equal(historyRefreshDelay({loaded:true,connected:true,failures:0}),60000);});
test('native Kraken weekly history keeps its own candle anchor when live trades arrive',()=>{const week=7*86400000,anchor=Date.UTC(2026,0,1),row={time:anchor,open:100,high:110,low:90,close:105,volume:10};const updated=applyLiveTrade([row],{time:anchor+3*86400000,price:108,volume:1},'1w',{anchor});assert.equal(updated.length,1);assert.equal(updated[0].time,anchor);assert.equal(updated[0].open,100);assert.equal(updated[0].close,108);const next=applyLiveTrade(updated,{time:anchor+week+1000,price:111,volume:1},'1w',{anchor});assert.equal(next.length,2);assert.equal(next.at(-1).time,anchor+week);});
