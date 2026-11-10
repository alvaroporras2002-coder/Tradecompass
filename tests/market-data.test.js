import test from 'node:test';
import assert from 'node:assert/strict';
import {marketDataResponse,resetMarketDataCache} from '../server/market-data.js';
const request=(query='',method='GET')=>new Request('https://tradecompass.example.test/api/markets'+query,{method});
const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
const candle=[1700000000,'100','105','98','102','101','12.5',8];
const ohlc=()=>({error:[],result:{XXBTZUSD:[candle,[1700000060,'102','106','99','104','103','6',4]],last:1700000060}});
const tradeRows=()=>({error:[],result:{XXBTZUSD:[['101.5','0.2',1700000001.25,'b','m','',42],['100','0.1',1700000000.5,'s','m','',41]],last:'1700000001250000000'}});
test.beforeEach(resetMarketDataCache);
test('fixed Kraken history maps real OHLCV without substituting synthetic values',async()=>{
 let called;const fetcher=async(url,options)=>{called={url,options};return response(ohlc());};
 const r=await marketDataResponse(request('?symbol=BTCUSD&timeframe=5m'),{fetcher,now:10000});const data=await r.json();
 assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(called.url,'https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=5');assert.equal(called.options.method,'GET');assert.ok(called.options.signal instanceof AbortSignal);assert.deepEqual(data.candles[0],{time:1700000000000,open:100,high:105,low:98,close:102,volume:12.5});assert.deepEqual(data.trades,[]);assert.equal(data.source,'Kraken');assert.equal(data.fetchedAt,10000);
});
test('second frames expose chronological original executions for exact client aggregation',async()=>{
 let url;const fetcher=async value=>{url=value;return response(tradeRows());};
 for(const timeframe of ['5s','10s','30s']){const r=await marketDataResponse(request('?symbol=ETHUSD&timeframe='+timeframe),{fetcher,now:1000});const data=await r.json();assert.equal(r.status,200);assert.equal(data.timeframe,timeframe);assert.equal(data.trades[0].id,'41');assert.equal(data.trades[1].time,1700000001250);assert.equal(data.trades[1].price,101.5);assert.deepEqual(data.candles,[]);}assert.equal(url,'https://api.kraken.com/0/public/Trades?pair=ETHUSD');
});
test('calendar months use daily source rows rather than pretending 15 days is a month',async()=>{
 let source;const fetcher=async url=>{source=url;return response(ohlc());};const r=await marketDataResponse(request('?symbol=SOLUSD&timeframe=1mo'),{fetcher,now:100});assert.equal(r.status,200);assert.equal(new URL(source).searchParams.get('interval'),'1440');assert.equal(new URL(source).searchParams.get('pair'),'SOLUSD');
});
test('unknown, duplicated or injected parameters never reach an arbitrary upstream',async()=>{
 let count=0;const fetcher=async()=>{count++;throw Error('Unexpected fetch');};
 for(const q of ['?symbol=EURUSD','?timeframe=2m','?symbol=BTCUSD&symbol=ETHUSD','?url=https://attacker.test','?symbol=https://attacker.test','?timeframe=1m&api_key=secret'])assert.equal((await marketDataResponse(request(q),{fetcher})).status,400);
 assert.equal((await marketDataResponse(request('','POST'),{fetcher})).status,405);assert.equal(count,0);
});
test('matching public requests share a short cache and an in-flight request',async()=>{
 let count=0,release;const hold=new Promise(r=>{release=r;});const fetcher=async()=>{count++;await hold;return response(ohlc());};
 const a=marketDataResponse(request(),{fetcher,now:1000}),b=marketDataResponse(request(),{fetcher,now:1001});release();const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.status,200);assert.equal(rb.status,200);assert.equal(count,1);
 assert.equal((await marketDataResponse(request(),{fetcher,now:10999})).status,200);assert.equal(count,1);await marketDataResponse(request(),{fetcher,now:11000});assert.equal(count,2);
});
test('second-frame cache is shared between resolutions and expires after three seconds',async()=>{
 let count=0;const fetcher=async()=>{count++;return response(tradeRows());};await marketDataResponse(request('?timeframe=5s'),{fetcher,now:100});await marketDataResponse(request('?timeframe=10s'),{fetcher,now:3099});assert.equal(count,1);await marketDataResponse(request('?timeframe=30s'),{fetcher,now:3100});assert.equal(count,2);
});
test('upstream errors, malformed prices and impossible OHLC bounds fail openly without a fake fallback',async()=>{
 const values=[{error:['EQuery:Unknown asset pair'],result:{}},{error:[],result:{}},{error:[],result:{X:[[1700000000,'100','99','98','102','101','1',1]]}},{error:[],result:{X:[[1700000000,'','105','98','102','101','1',1]]}}];
 for(const body of values){const r=await marketDataResponse(request(),{fetcher:async()=>response(body),now:100});assert.equal(r.status,502);const json=await r.json();assert.equal(json.candles,undefined);assert.equal(json.error.code,'source_unavailable');}
 for(const fetcher of [async()=>new Response('',{status:429}),async()=>{throw Error('offline');},async()=>new Response('not json',{status:200})])assert.equal((await marketDataResponse(request(),{fetcher,now:100})).status,502);
});
test('missing or nonpositive executions are rejected, not converted into zero prices',async()=>{
 for(const value of ['',null,'NaN','0','-1']){const body=tradeRows();body.result.XXBTZUSD[0][0]=value;const r=await marketDataResponse(request('?timeframe=5s'),{fetcher:async()=>response(body),now:100});assert.equal(r.status,502);}
});
