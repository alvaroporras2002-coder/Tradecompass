import test from 'node:test';
import assert from 'node:assert/strict';
import { net, metrics, filterTrades, validateTrade, compliance, parseMT5, tradeCSV, validateBackup } from '../src/domain.js';
import { createDemoState, createEmptyState } from '../src/demo.js';
const trade = (id, gross, extra = {}) => ({ id, accountId: 'a', symbol: 'EURUSD', side: 'buy', status: 'closed', openedAt: '2026-01-01T10:00:00Z', closedAt: `2026-01-0${id}T11:00:00Z`, entry: 1.1, exit: 1.2, volume: 0.1, gross, commission: 0, swap: 0, risk: 100, strategy: 'S', checklist: {}, tags: [], attachments: [], ...extra });
test('net includes signed costs and floating point is rounded', () => {
  assert.equal(net({ gross: 20.1, commission: -2.4, swap: -0.7 }), 17);
});
test('metrics excludes open trades and uses closed denominator including breakeven', () => {
  const m = metrics([trade('1', 200, {commission:-10}), trade('2', -100), trade('3', 0), trade('4', 9999, {status:'open'})],10000);
  assert.equal(m.net, 90); assert.equal(m.closedCount, 3); assert.equal(m.wins, 1); assert.equal(m.losses, 1);
  assert.ok(Math.abs(m.winRate - 100/3) < 1e-10); assert.equal(m.profitFactor, 1.9); assert.equal(m.avgLoss, -100); assert.equal(m.expectancy, 30);
  assert.ok(Math.abs(m.avgR - 0.3) < 1e-10); assert.equal(m.equity.at(-1).value, 10090);
});
test('drawdown derives from ordered realized high water mark and ignores deposits as profit', () => {
  const m = metrics([trade('1', 200),trade('2', -100),trade('3', -200),trade('4', 500)],1000,[{date:'2026-01-02T10:30:00Z',amount:500}]);
  assert.equal(m.maxDrawdown,300); assert.equal(m.balance,1900); assert.equal(m.net,400); assert.equal(m.bestStreak,1); assert.equal(m.worstStreak,2);
});
test('empty and all-win samples avoid invented profit factor and risk multiples', () => {
  assert.equal(metrics([]).profitFactor,null); assert.equal(metrics([]).closedCount,0); assert.equal(metrics([]).avgR,null);
  assert.equal(metrics([trade('1',100,{risk:null})]).avgR,null); assert.equal(metrics([trade('1',100)]).profitFactor,null);
});
test('filters require an explicit account and search tags without mixing currencies', () => {
  const state={trades:[trade('1',10),trade('2',-10,{accountId:'b'}),trade('3',20,{tags:['London']})]};
  assert.equal(filterTrades(state,{}).length,0); assert.equal(filterTrades(state,{accountId:'a'}).length,2);
  assert.equal(filterTrades(state,{accountId:'a',search:'london',result:'win'}).length,1);
});
test('compliance separates response coverage and fulfilled applicable rules', () => {
  const rules=[{id:'a',text:'A'},{id:'b',text:'B'},{id:'c',text:'C'},{id:'d',text:'D'}];
  const c=compliance([{strategy:'S',checklist:{a:'yes',b:'no',c:'na'}}],rules);
  assert.equal(c.coverage,75); assert.equal(c.score,50); assert.equal(c.failures[0].count,1);
});
test('trade validation catches invalid dates and negative volume', () => {
  assert.deepEqual(validateTrade(trade('1', 100)),{});
  const errors=validateTrade(trade('1',100,{closedAt:'2025-12-01',volume:-1}));
  assert.ok(errors.closedAt); assert.ok(errors.volume);
});
test('generated sample and blank journal validate as portable backups', () => {
  assert.equal(validateBackup(createDemoState()),true); assert.equal(validateBackup(createEmptyState()),true);
  assert.throws(()=>validateBackup({version:99}));
  const sample=createDemoState(); sample.trades[0].accountId='missing'; assert.throws(()=>validateBackup(sample));
});
test('CSV safely quotes newlines, commas and quotes', () => {
  const csv=tradeCSV([trade('1',100,{notes:'A, "B"\nC'})]);
  assert.ok(csv.includes('"A, ""B""\nC"')); assert.ok(csv.startsWith('\uFEFF'));
});
test('MT5 CSV preview imports a closed position once and preserves gross plus costs', () => {
  const csv='Ticket,Open Time,Close Time,Type,Symbol,Volume,Open Price,Close Price,Profit,Commission,Swap\n123,2026.01.01 10:00:00,2026.01.01 11:00:00,buy,EURUSD,0.1,1.1,1.2,100,-2,-1';
  const result=parseMT5(csv,{accountId:'a',existing:[]});
  assert.equal(result.trades.length,1,JSON.stringify(result.errors)); assert.equal(result.totals.net,97);
  const again=parseMT5(csv,{accountId:'a',existing:result.trades}); assert.equal(again.trades.length,0); assert.equal(again.duplicates.length,1);
});
test('MT5 parser reports malformed numeric results without inventing zero P&L', () => {
  const csv='Ticket,Open Time,Close Time,Type,Symbol,Volume,Open Price,Close Price,Profit\n123,2026.01.01 10:00:00,2026.01.01 11:00:00,buy,EURUSD,0.1,1.1,1.2,broken';
  const result=parseMT5(csv,{accountId:'a',existing:[]}); assert.equal(result.trades.length,0); assert.equal(result.errors.length,1);
});
test('MT5 decimal-comma values and quoted thousands retain precise net costs', () => {
  const csv='Ticket;Open Time;Close Time;Type;Symbol;Volume;Open Price;Close Price;Profit;Commission;Swap\n234;2026.01.01 10:00:00;2026.01.01 11:00:00;sell;XAUUSD;0,10;2650,00;2640,00;"1.234,50";-2,50;-1,00';
  const result=parseMT5(csv,{accountId:'a'}); assert.equal(result.errors.length,0); assert.equal(result.totals.net,1231); assert.equal(result.trades[0].gross,1234.5);
});
test('native MT5 HTML repeated headers map entry and exit correctly', () => {
  const html='<table><tr><th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>Time</th><th>Price</th><th>Commission</th><th>Swap</th><th>Profit</th></tr><tr><td>2026.01.01 10:00:00</td><td>345</td><td>EURUSD</td><td>buy</td><td>0.1</td><td>1.1</td><td>2026.01.01 11:00:00</td><td>1.2</td><td>-2</td><td>0</td><td>100</td></tr></table>';
  const result=parseMT5(html,{accountId:'a'}); assert.equal(result.trades.length,1,JSON.stringify(result.errors)); assert.equal(result.trades[0].entry,1.1); assert.equal(result.trades[0].exit,1.2); assert.equal(result.totals.net,98);
});
test('MT5 cash transfers remain separate from trading profit', () => {
  const csv='Ticket,Time,Type,Symbol,Volume,Price,Profit\n456,2026.01.01 10:00:00,balance,,,,500\n457,2026.01.01 10:00:00,withdrawal,,,,-100';
  const result=parseMT5(csv,{accountId:'a'}); assert.equal(result.trades.length,0); assert.equal(result.cashflows.length,2); assert.equal(result.totals.net,0); assert.equal(result.cashflows[1].amount,-100);
});
