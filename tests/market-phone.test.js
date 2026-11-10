import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_EXAMPLES,phoneMarketGeometry,renderMarkets} from '../src/views/explore.js';
import {createEmptyState} from '../src/demo.js';
import {esc,icon} from '../src/ui.js';

test('phone market plot retains a readable right price gutter and all OHLC bodies inside 360 by 260',()=>{
 for(const market of MARKET_EXAMPLES)for(const frame of ['15M','1H','4H','1D'])for(const phase of [0,1,4]){
  const g=phoneMarketGeometry(market,[],frame,phase);
  assert.equal(g.width,360);assert.equal(g.height,260);assert.equal(g.candles.length,36);
  assert.ok(g.width-g.right>=60);
  for(const [i,c] of g.candles.entries()){
   assert.ok(g.x(i)>=g.left&&g.x(i)<=g.right);
   assert.ok(g.y(c.high)>=g.top&&g.y(c.low)<=g.bottom);
   assert.ok(g.y(c.high)<=g.y(c.open)&&g.y(c.low)>=g.y(c.close));
  }
  assert.equal(g.last,g.candles.at(-1).close);
  assert.equal(g.change,(g.last-g.candles[0].open)/g.candles[0].open*100);
 }
});

test('a distant annotation cannot flatten the illustrative candles or place SVG geometry outside the plot',()=>{
 const base=phoneMarketGeometry(),withLevels=phoneMarketGeometry(MARKET_EXAMPLES[0],[.01,1.083,1e9]);
 assert.equal(withLevels.low,base.low);assert.equal(withLevels.high,base.high);
 assert.equal(withLevels.levels[0].visible,false);assert.equal(withLevels.levels.at(-1).visible,false);
 for(const level of withLevels.levels)assert.ok(Number.isFinite(level.y)&&level.y>=base.top&&level.y<=base.bottom);
});

test('markets compose a full width chart with instrument sheet, rather than a two-column watchlist',()=>{
 const state=createEmptyState(),ctx={state,account:state.accounts[0],t:es=>es,esc,icon,money:n=>`$${n}`};
 const html=renderMarkets(ctx);
 assert.match(html,/data-market-watchlist/);assert.match(html,/class="mp-chart-card"/);
 assert.doesNotMatch(html,/class="markets-layout"|class="market-watchlist"/);
 assert.match(html,/Conectando con el mercado/);
 assert.equal((html.match(/data-market-candle/g)||[]).length,0);
 assert.equal((html.match(/<option value=/g)||[]).length,12);
 assert.equal((html.match(/data-market-chart=/g)||[]).length,3);
 assert.doesNotMatch(html,/\b(?:NaN|undefined|Infinity)\b/);
});
