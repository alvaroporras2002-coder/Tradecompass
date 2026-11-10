import test from 'node:test';
import assert from 'node:assert/strict';
import {metrics} from '../src/domain.js';
import {drawdownSeries,strategySeries,renderAnalytics} from '../src/views/insights.js';
import {createEmptyState} from '../src/demo.js';
import {esc,icon} from '../src/ui.js';

const trade=(id,date,result,strategy='Plan A')=>({id,closedAt:date,openedAt:date,status:'closed',gross:result,commission:0,swap:0,strategy});
test('drawdown chart follows realized loss from the peak and ignores deposits and withdrawals',()=>{
 const rows=[trade('1','2026-11-01T12:00:00Z',100),trade('2','2026-11-03T12:00:00Z',-35),trade('3','2026-11-05T12:00:00Z',10)];
 const withoutFlows=metrics(rows,1000);
 const withFlows=metrics(rows,1000,[{date:'2026-11-02T12:00:00Z',amount:5000},{date:'2026-11-04T12:00:00Z',amount:-1000}]);
 assert.deepEqual(drawdownSeries(withoutFlows.equity),drawdownSeries(withFlows.equity));
 assert.deepEqual(drawdownSeries(withFlows.equity).map(x=>x.value),[0,0,-35,-25]);
 assert.equal(Math.max(...drawdownSeries(withFlows.equity).map(x=>-x.value)),withFlows.maxDrawdown);
});
test('strategy comparison sorts real close dates and accumulates only that strategy’s closed trades',()=>{
 const rows=[trade('3','2026-11-03T12:00:00Z',10,'A'),trade('2','2026-11-02T12:00:00Z',-20,'B'),trade('1','2026-11-01T12:00:00Z',5,'A'),{...trade('4','2026-11-04T12:00:00Z',500,'A'),status:'open'}];
 const series=strategySeries(rows);
 assert.deepEqual(series.map(x=>[x.name,x.result,x.count]),[['A',15,2],['B',-20,1]]);
 assert.deepEqual(series[0].points.map(x=>x.value),[5,15]);
 assert.equal(series[0].points[0].date,'2026-11-01T12:00:00Z');
});
test('new comparison and drawdown charts preserve user labels as text and avoid nonfinite geometry',()=>{
 const state=createEmptyState();const payload='<img src=x onerror=alert(1)>';
 state.trades=[trade('1','2026-11-01T12:00:00Z',0,payload)];
 const ctx={state,account:state.accounts[0],trades:state.trades,stats:metrics(state.trades),t:es=>es,esc,icon,money:n=>`$${n}`,date:value=>String(value).slice(0,10)};
 const html=renderAnalytics(ctx);
 assert.match(html,/Drawdown a lo largo del periodo/);assert.match(html,/Evolución por estrategia/);
 assert.ok(!html.includes(payload));assert.ok(html.includes('&lt;img'));
 assert.doesNotMatch(html,/\b(?:NaN|Infinity|undefined)\b/);
});
