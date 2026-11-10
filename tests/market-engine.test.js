import test from 'node:test';
import assert from 'node:assert/strict';
import {TIMEFRAMES,timeframeById,bucketStart,bucketEnd,candleCountdown,aggregateTrades,aggregateCandles,mergeCandles,chartViewport} from '../src/market-engine.js';
const epoch=Date.parse;
const candle=(time,close=12)=>({time,open:10,high:Math.max(14,close),low:8,close,volume:2});

test('the exact requested resolutions expose immutable selection data',()=>{
 assert.deepEqual(TIMEFRAMES.map(frame=>frame.id),['5s','10s','30s','1m','5m','15m','30m','1h','4h','1d','1w','1mo']);
 assert.equal(timeframeById('4H').krakenInterval,240);
 assert.equal(timeframeById(TIMEFRAMES[0]).ms,5000);
 assert.equal(timeframeById('1mo').krakenInterval,1440);
 assert.throws(()=>timeframeById('2h'),RangeError);
 assert.ok(Object.isFrozen(TIMEFRAMES)&&TIMEFRAMES.every(Object.isFrozen));
});
test('second/minute/hour buckets align to the UTC epoch and do not change at fractional boundaries',()=>{
 const time=epoch('2026-11-10T12:34:59.900Z');
 assert.equal(bucketStart(time,'5s'),epoch('2026-11-10T12:34:55Z'));
 assert.equal(bucketEnd(time,'5s'),epoch('2026-11-10T12:35:00Z'));
 assert.equal(bucketStart(time,'30m'),epoch('2026-11-10T12:30:00Z'));
 assert.equal(bucketStart(time,'4h'),epoch('2026-11-10T12:00:00Z'));
 assert.equal(bucketStart(-1,'5s'),-5000);
 for(const invalid of [NaN,Infinity,'2026-01-01',null])assert.throws(()=>bucketStart(invalid,'1m'),RangeError);
});
test('weeks begin on Monday and calendar months respect variable lengths and leap years',()=>{
 assert.equal(bucketStart(epoch('2026-11-08T23:59:59Z'),'1w'),epoch('2026-11-02T00:00:00Z'));
 assert.equal(bucketStart(epoch('2026-11-09T00:00:00Z'),'1w'),epoch('2026-11-09T00:00:00Z'));
 assert.equal(bucketEnd(epoch('2026-12-31T23:59:59Z'),'1w'),epoch('2027-01-04T00:00:00Z'));
 assert.equal(bucketStart(epoch('2024-02-29T11:00:00Z'),'1mo'),epoch('2024-02-01T00:00:00Z'));
 assert.equal(bucketEnd(epoch('2024-02-29T11:00:00Z'),'1mo'),epoch('2024-03-01T00:00:00Z'));
 assert.equal(bucketEnd(epoch('2026-12-31T11:00:00Z'),'1mo'),epoch('2027-01-01T00:00:00Z'));
});
test('the countdown measures real bucket closure instead of a visual animation loop',()=>{
 assert.deepEqual(candleCountdown(epoch('2026-11-10T12:34:59.900Z'),'5s'),{remainingMs:100,text:'00:01'});
 assert.deepEqual(candleCountdown(epoch('2026-11-10T12:35:00Z'),'5s'),{remainingMs:5000,text:'00:05'});
 assert.equal(candleCountdown(epoch('2026-11-10T00:00:00Z'),'1d').text,'1d 00:00:00');
 assert.equal(candleCountdown(epoch('2024-02-01T00:00:00Z'),'1mo').remainingMs,29*86400000);
 assert.equal(candleCountdown(epoch('2026-01-31T23:59:59Z'),'1mo').text,'00:01');
});
test('trade aggregation sorts observations and retains real opens, wicks, closes, volume and gaps',()=>{
 const base=epoch('2026-11-10T12:00:00Z');
 const trades=[{time:base+3000,price:12,volume:2},{time:base+1000,price:10,volume:1},{time:base+2000,price:8,volume:3},{time:base+22000,price:11,volume:4}];
 const original=structuredClone(trades),result=aggregateTrades(trades,'5s');
 assert.deepEqual(result,[{time:base,open:10,high:12,low:8,close:12,volume:6},{time:base+20000,open:11,high:11,low:11,close:11,volume:4}]);
 assert.deepEqual(trades,original);
 assert.equal(result.length,2,'empty intervals must not manufacture candles');
});
test('equal-time trades retain source order and invalid/nonfinite quotes never enter chart geometry',()=>{
 const result=aggregateTrades([{time:1000,price:12,volume:1},{time:1000,price:11,volume:2},{time:2000,price:NaN,volume:1},{time:2000,price:0,volume:1},{time:2000,price:100,volume:-1},{time:Infinity,price:100,volume:1},null],'5s');
 assert.deepEqual(result,[{time:0,open:12,high:12,low:11,close:11,volume:3}]);
 assert.deepEqual(aggregateTrades([{time:1000,price:12,volume:1e308},{time:2000,price:11,volume:1e308}],'5s'),[],'overflowing volumes do not produce Infinity');
});
test('daily OHLC aggregation respects month boundaries and preserves extremal wick values',()=>{
 const days=[candle(epoch('2026-02-28T00:00:00Z'),15),{time:epoch('2026-02-01T00:00:00Z'),open:10,high:13,low:7,close:11,volume:3},candle(epoch('2026-03-01T00:00:00Z'),9)];
 const original=structuredClone(days),result=aggregateCandles(days,'1mo');
 assert.deepEqual(result,[{time:epoch('2026-02-01T00:00:00Z'),open:10,high:15,low:7,close:15,volume:5},{time:epoch('2026-03-01T00:00:00Z'),open:10,high:14,low:8,close:9,volume:2}]);
 assert.deepEqual(days,original);
});
test('merging live OHLC updates replaces an open candle without doubling its volume',()=>{
 const previous=[candle(2000,12),candle(1000,11)],incoming=[{...candle(2000,13),volume:5},candle(3000,14)];
 assert.deepEqual(mergeCandles(previous,incoming),[candle(1000,11),{...candle(2000,13),volume:5},candle(3000,14)]);
 assert.deepEqual(mergeCandles(previous,incoming,{max:2}),[{...candle(2000,13),volume:5},candle(3000,14)]);
 assert.deepEqual(mergeCandles(previous,incoming,{max:0}),[]);
 assert.throws(()=>mergeCandles(previous,incoming,{max:-1}),RangeError);
 assert.throws(()=>mergeCandles(previous,incoming,{max:Infinity}),RangeError);
 const duplicate=[candle(1000,11),{...candle(1000,13),volume:5}];
 assert.equal(aggregateCandles(duplicate,'1m')[0].volume,5);
});
test('invalid OHLC bounds are omitted rather than silently repaired',()=>{
 const good=candle(1000,11),bad=[{...good,high:9},{...good,low:12},{...good,close:Infinity},{...good,open:-1},{...good,time:NaN},{...good,volume:-1}];
 assert.deepEqual(mergeCandles(bad,[good]),[good]);
 assert.deepEqual(aggregateCandles(bad,'1m'),[]);
});
test('viewport pan/zoom remains bounded and returning to offset zero follows the live edge',()=>{
 const candles=Array.from({length:100},(_,i)=>candle(i*1000,12));
 const live=chartViewport(candles,{count:20});
 assert.equal(live.start,80);assert.equal(live.end,100);assert.equal(live.atLiveEdge,true);assert.equal(live.maxOffset,80);
 const old=chartViewport(candles,{count:20,offset:999});
 assert.equal(old.offset,80);assert.equal(old.start,0);assert.equal(old.end,20);assert.equal(old.atLiveEdge,false);
 assert.equal(chartViewport(candles,{count:200}).count,100);
 assert.equal(chartViewport(candles,{count:0}).count,1);
 assert.equal(chartViewport(candles,{count:20,offset:-20}).offset,0);
 assert.deepEqual(chartViewport([]),{candles:[],start:0,end:0,offset:0,count:0,total:0,maxOffset:0,atLiveEdge:true});
 assert.deepEqual(candles[0],candle(0,12));
});
