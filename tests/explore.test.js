import test from 'node:test';
import assert from 'node:assert/strict';
import {EA_CONCEPTS,MARKET_EXAMPLES,exampleCandles,ohlcBarGeometry,validateEvaluation,renderMarkets,renderLibrary,renderEADetail,renderLaboratory} from '../src/views/explore.js';
import {createEmptyState} from '../src/demo.js';
import {validateBackup} from '../src/domain.js';
import {esc,icon} from '../src/ui.js';

test('illustrative OHLC candles retain valid price bounds for every market and timeframe',()=>{
 for(const market of MARKET_EXAMPLES)for(const frame of ['15M','1H','4H','1D'])for(const phase of [0,1,10]){
  const rows=exampleCandles(market,frame,phase);assert.equal(rows.length,56);
  for(const [i,row] of rows.entries()){
   for(const n of Object.values(row))assert.ok(Number.isFinite(n)&&n>0);
   assert.ok(row.high>=Math.max(row.open,row.close));assert.ok(row.low<=Math.min(row.open,row.close));
   if(i)assert.equal(row.open,rows[i-1].close);
  }
 }
 assert.deepEqual(exampleCandles(),exampleCandles());
 assert.notDeepEqual(exampleCandles(MARKET_EXAMPLES[0],'1H',0),exampleCandles(MARKET_EXAMPLES[0],'1H',1));
});

test('manual evaluation rejects impossible periods, nonfinite metrics and missing limitations',()=>{
 const valid={title:'Test',kind:'historical',from:'2026-01-01',to:'2026-02-01',sample:50,costs:2,result:-40,drawdown:50,limitations:'Small sample'};
 assert.equal(validateEvaluation(valid),'');
 for(const patch of [{title:''},{kind:'live'},{from:'2026-03-01'},{to:'invalid'},{sample:1.2},{sample:-1},{costs:-1},{result:Infinity},{drawdown:-5},{limitations:' '}])assert.notEqual(validateEvaluation({...valid,...patch}),'');
});

test('extra laboratory and watchlist state survives the backup contract',()=>{
 const state=createEmptyState();state.settings.marketWatchlist=['EURUSD'];state.evaluations=[{id:'test',accountId:state.accounts[0].id,title:'My test',kind:'forward',from:'2026-01-01',to:'2026-02-01',sample:100,costs:10,result:30,drawdown:8,limitations:'Demo only',source:'manual'}];
 assert.equal(validateBackup(state),true);
 assert.deepEqual(JSON.parse(JSON.stringify(state)).evaluations,state.evaluations);
});

test('all four exploration routes render correctly from an empty workspace',()=>{
 const state=createEmptyState(),ctx={state,account:state.accounts[0],t:(es)=>es,esc,icon,money:n=>`$${n}`};
 assert.match(renderMarkets(ctx),/Datos simulados/);
 assert.match(renderLibrary(ctx),/Cinco conceptos/);assert.equal(EA_CONCEPTS.length,5);
 assert.match(renderEADetail(ctx),/No disponible/);
 const lab=renderLaboratory(ctx);assert.match(lab,/Sin pruebas publicadas/);assert.match(lab,/Motor de pruebas en desarrollo/);
});

test('EA detail tabs expose proposed state and escape personal notes safely',()=>{
 const state=createEmptyState(),ctx={state,account:state.accounts[0],t:es=>es,esc,icon,money:n=>`$${n}`};
 state.settings.eaNotes={'trend-navigator':'</textarea><img src=x onerror=alert(1)>\nMy note'};
 const html=renderEADetail(ctx,'notes');assert.match(html,/data-ea-tab="parameters"/);assert.match(html,/data-ea-tab="rules"/);assert.match(html,/data-ea-tab="tests"/);assert.match(html,/data-ea-notes-form/);assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;\/textarea&gt;&lt;img/);
 assert.match(renderEADetail(ctx,'parameters'),/Parámetros propuestos/);assert.match(renderEADetail(ctx,'rules'),/Pendientes de definir/);assert.match(renderEADetail(ctx,'tests'),/Sin pruebas validadas publicadas/);
});

test('unexpected restored exploration extras cannot inject record HTML or crash views',()=>{
 const state=createEmptyState(),ctx={state,account:state.accounts[0],t:es=>es,esc,icon,money:n=>`$${n}`};
 state.settings.marketWatchlist={unexpected:'shape'};state.settings.eaNotes=['incorrect shape'];state.evaluations={unexpected:'shape'};
 assert.doesNotThrow(()=>renderMarkets(ctx));assert.doesNotThrow(()=>renderLaboratory(ctx));assert.doesNotThrow(()=>renderEADetail(ctx,'notes'));
 state.evaluations=[{id:'malformed',accountId:state.accounts[0].id,title:'Title',sample:'<script>alert(1)</script>'}];
 const lab=renderLaboratory(ctx);assert.ok(!lab.includes('<script>'));assert.match(lab,/Sin pruebas publicadas/);
});

test('evaluation dates require a real calendar day',()=>{
 const valid={title:'Test',kind:'historical',from:'2026-01-01',to:'2026-02-01',sample:50,costs:2,result:-40,drawdown:50,limitations:'Small sample'};
 assert.notEqual(validateEvaluation({...valid,to:'2026-02-31'}),'');
});


test('OHLC bars retain high, low, opening and closing levels with correct tick directions',()=>{
 for(const market of MARKET_EXAMPLES){
  const candles=exampleCandles(market),min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high));
  for(const [i,candle] of candles.entries()){
   const g=ohlcBarGeometry(candle,10+i*14,min,max);
   for(const n of Object.values(g))assert.ok(Number.isFinite(n));
   assert.ok(g.highY<=Math.min(g.openY,g.closeY));assert.ok(g.lowY>=Math.max(g.openY,g.closeY));
   assert.ok(g.leftX<g.x&&g.rightX>g.x);assert.ok(g.highY>=24&&g.lowY<=316);
   assert.equal(candle.close>=candle.open,g.closeY<=g.openY);
  }
 }
});

test('markets show three chart controls, crosshair and persistent numeric level annotations',()=>{
 const state=createEmptyState(),ctx={state,account:state.accounts[0],t:es=>es,esc,icon,money:n=>`$${n}`};
 state.settings.marketLevels={EURUSD:[1.082,1.086]};
 const html=renderMarkets(ctx);assert.match(html,/data-market-chart="bars"/);assert.match(html,/data-market-crosshair-toggle/);assert.match(html,/data-market-add-level/);assert.equal((html.match(/class="market-user-level"/g)||[]).length,2);assert.equal((html.match(/data-market-remove-level=/g)||[]).length,2);
 state.settings.marketLevels={EURUSD:['<script>bad</script>',Infinity,-2,{},1.08]};
 const malformed=renderMarkets(ctx);assert.ok(!malformed.includes('<script>'));assert.equal((malformed.match(/class="market-user-level"/g)||[]).length,1);
});
