import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../server/worker.js';
import {resetMarketDataCache} from '../server/market-data.js';
import {chartViewport} from '../src/market-engine.js';

const WEEK=7*24*60*60*1000;
const last=Date.UTC(2026,10,5); // Native source anchor is preserved, not rebucketed.
const first=last-719*WEEK;
const sourceRows=()=>Array.from({length:720},(_,i)=>[
 (first+i*WEEK)/1000,String(100+i),String(103+i),String(98+i),String(101+i),String(100.5+i),'12.5',7
]);

test('an identity-less history request reaches Kraken and fills the initial chart with a prior weekly series',async()=>{
 const original=globalThis.fetch,requests=[];resetMarketDataCache();
 globalThis.fetch=async (url,options)=>{
  requests.push({url:String(url),options});
  return new Response(JSON.stringify({error:[],result:{XXBTZUSD:sourceRows(),last:last/1000}}),{headers:{'Content-Type':'application/json'}});
 };
 try{
  const worker=createWorker();
  const response=await worker.fetch(new Request('https://trade.example/api/markets?symbol=BTCUSD&timeframe=1w&range=max'),{});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(requests.length,1);
  const upstream=new URL(requests[0].url);
  assert.equal(upstream.origin,'https://api.kraken.com');
  assert.equal(upstream.pathname,'/0/public/OHLC');
  assert.equal(upstream.searchParams.get('pair'),'XBTUSD');
  assert.equal(upstream.searchParams.get('interval'),'10080');
  assert.equal(upstream.searchParams.get('since'),'0');
  assert.equal(data.source,'Kraken');
  assert.equal(data.candles.length,720);
  assert.equal(data.trades.length,0);
  assert.deepEqual(data.history,{range:'max',resolution:'1w',firstTime:first,lastTime:last,count:720,scope:'Kraken',limited:true});
  // This is the path that previously degraded to a single WebSocket snapshot bar.
  const initial=chartViewport(data.candles,{count:50,offset:0});
  assert.equal(initial.candles.length,50);
  assert.equal(initial.atLiveEdge,true);
  const earliest=chartViewport(data.candles,{count:50,offset:10000});
  assert.equal(earliest.candles[0].time,first);
  assert.equal(earliest.candles[0].open,100);
  assert.equal(earliest.candles[0].close,101);
  assert.equal(data.candles.at(-1).time,last);
  assert.equal((await worker.fetch(new Request('https://trade.example/api/state'),{})).status,401);
 }finally{globalThis.fetch=original;resetMarketDataCache();}
});

test('an upstream history outage remains an explicit failure, never a successful empty historical series',async()=>{
 const original=globalThis.fetch;resetMarketDataCache();
 globalThis.fetch=async()=>new Response('',{status:503});
 try{
  const response=await createWorker().fetch(new Request('https://trade.example/api/markets?symbol=ETHUSD&timeframe=1w&range=max'),{});
  assert.equal(response.status,502);
  const data=await response.json();assert.equal(data.error.code,'source_unavailable');
  assert.equal(data.history,undefined);assert.equal(data.candles,undefined);
 }finally{globalThis.fetch=original;resetMarketDataCache();}
});
