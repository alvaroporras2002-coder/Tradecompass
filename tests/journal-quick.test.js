import test from 'node:test';
import assert from 'node:assert/strict';
import {buildQuickTrade,openTradeForm,openTradeDetail} from '../src/views/journal.js';
import {net,validateTrade} from '../src/domain.js';
import {createEmptyState,createDemoState} from '../src/demo.js';
import {esc,icon} from '../src/ui.js';

const form = values => {const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,String(value));return data;};
const visibleFields = extra => ({accountId:'account-a',symbol:'eurusd',side:'buy',date:'2026-11-09T12:30',netResult:'50.25',notes:'Respeté mi plan.',...extra});
const build = (values, initial={}) => buildQuickTrade(form(values),initial,{id:'quick-test',now:'2026-11-09T12:30:00Z'});
const full = () => ({id:'full-trade',accountId:'account-a',symbol:'EURUSD',side:'sell',status:'closed',openedAt:'2026-11-09T10:12:34.567Z',closedAt:'2026-11-09T12:30:45.678Z',entry:1.08675,exit:1.08552,volume:0.35,gross:150,commission:-7,swap:-3,risk:40,stopLoss:1.09,takeProfit:1.08,strategy:'Pullback',tags:['London'],notes:'Original',reason:'Confirmed trend',emotionBefore:'Calm',emotionDuring:'Focused',emotionAfter:'Neutral',lesson:'Wait',checklist:{rule1:'yes'},attachments:[],source:'manual',sourceId:'',batchId:null});

test('a closed quick trade saves using only the visible fields',()=>{
  const trade=build(visibleFields());
  assert.equal(trade.captureMode,'quick');assert.equal(trade.source,'manual');
  assert.equal(trade.symbol,'EURUSD');assert.equal(trade.side,'buy');assert.equal(trade.status,'closed');
  assert.equal(trade.openedAt,null);assert.equal(trade.closedAt,new Date('2026-11-09T12:30').toISOString());
  for(const key of ['entry','exit','volume','risk','stopLoss','takeProfit'])assert.equal(trade[key],null,`${key} must not be invented`);
  assert.equal(trade.gross,50.25);assert.equal(trade.commission,0);assert.equal(trade.swap,0);assert.equal(net(trade),50.25);
  assert.deepEqual(trade.tags,[]);assert.equal(trade.strategy,'');assert.equal(trade.notes,'Respeté mi plan.');
  assert.deepEqual(validateTrade(trade),{});
});

test('negative and zero final results remain signed and valid',()=>{
  for(const result of ['-25.50','0']){
    const trade=build(visibleFields({netResult:result}));
    assert.equal(net(trade),Number(result));assert.deepEqual(validateTrade(trade),{});
  }
});

test('optional costs are a breakdown of the entered net and are not subtracted twice',()=>{
  const trade=build(visibleFields({netResult:'25.50',commission:'-2.25',swap:'-0.75'}));
  assert.equal(trade.gross,28.50);assert.equal(net(trade),25.50);
  const loss=build(visibleFields({netResult:'-25',commission:'-2',swap:'1'}));
  assert.equal(loss.gross,-24);assert.equal(net(loss),-25);
});

test('quick edits retain omitted execution details, costs, opening time and annotations',()=>{
  const initial=full();
  const trade=build(visibleFields({side:'sell',netResult:'140',notes:'Updated note',date:initial.closedAt}),initial);
  for(const key of ['openedAt','entry','exit','volume','gross','commission','swap','risk','stopLoss','takeProfit','strategy','reason','emotionBefore','emotionDuring','emotionAfter','lesson'])assert.equal(trade[key],initial[key],`${key} was lost`);
  assert.deepEqual(trade.tags,initial.tags);assert.deepEqual(trade.checklist,initial.checklist);
  assert.equal(trade.notes,'Updated note');assert.equal(net(trade),140);assert.deepEqual(validateTrade(trade),{});
});

test('an unchanged displayed timestamp preserves the original seconds and precision',()=>{
  const initial=full(),date=new Date(initial.closedAt);
  const displayed=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const opening=new Date(initial.openedAt);
  const openingDisplayed=new Date(opening.getTime()-opening.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const trade=build(visibleFields({date:displayed,openedAt:openingDisplayed,netResult:'140'}),initial);
  assert.equal(trade.closedAt,initial.closedAt);assert.equal(trade.openedAt,initial.openedAt);
});

test('an open quick capture uses its visible date as opening and invents no execution values',()=>{
  const values=visibleFields({status:'open'});delete values.netResult;
  const trade=build(values);
  assert.equal(trade.status,'open');assert.equal(trade.openedAt,new Date(values.date).toISOString());assert.equal(trade.closedAt,null);
  assert.equal(trade.volume,null);assert.equal(trade.entry,null);assert.equal(trade.exit,null);
  assert.deepEqual(validateTrade(trade),{});
});

test('a new closed capture keeps opening unknown until explicitly provided',()=>{
  assert.equal(build(visibleFields()).openedAt,null);
  const trade=build(visibleFields({openedAt:'2026-11-09T10:00',volume:'0.2',entry:'1.10',exit:'1.11',risk:'20'}));
  assert.equal(trade.openedAt,new Date('2026-11-09T10:00').toISOString());assert.equal(trade.volume,0.2);assert.equal(trade.risk,20);
  assert.deepEqual(validateTrade(trade),{});
});

test('missing final net does not silently become a breakeven trade',()=>{
  const trade=build(visibleFields({netResult:''}));
  assert.equal(trade.gross,null);assert.ok(validateTrade(trade).gross);
});

test('invalid optional execution or risk values remain errors instead of invented defaults',()=>{
  const trade=build(visibleFields({entry:'-1',volume:'0',risk:'0'}));
  const errors=validateTrade(trade);
  assert.ok(errors.entry);assert.ok(errors.volume);assert.ok(errors.risk);
  assert.equal(trade.entry,-1);assert.equal(trade.volume,0);assert.equal(trade.risk,0);
});

test('MT5 edits preserve original financial figures, source identifiers and original payload',()=>{
  const initial={...full(),source:'mt5',sourceId:'1234567',batchId:'batch-a',original:{position:1234567,profit:150}};
  const trade=build(visibleFields({accountId:'wrong',symbol:'WRONG',side:'buy',date:'2030-01-01T00:00',status:'open',netResult:'99999',entry:'999',exit:'999',volume:'999',commission:'999',swap:'999',stopLoss:'999',takeProfit:'999',notes:'Context added'}),initial);
  for(const key of ['accountId','symbol','side','status','openedAt','closedAt','entry','exit','volume','gross','commission','swap','stopLoss','takeProfit','source','sourceId','batchId'])assert.equal(trade[key],initial[key],`${key} source figure changed`);
  assert.deepEqual(trade.original,initial.original);assert.equal(net(trade),net(initial));assert.equal(trade.notes,'Context added');assert.notEqual(trade.captureMode,'quick');
  assert.deepEqual(validateTrade(trade),{});
});

function context(state, language='es'){
  state.settings.language=language;
  const account=state.accounts[0];let html='';
  return {state,account,t:(es,en)=>language==='en'?en:es,esc,icon,modal:markup=>{html=markup;},date:value=>new Date(value).toISOString(),get html(){return html;}};
}

for(const language of ['es','en']){
  test(`${language}: new capture keeps technical, emotional, checklist and image sections collapsed`,()=>{
    const state=createEmptyState();state.accounts=state.accounts.slice(0,1);
    const ctx=context(state,language);openTradeForm(ctx);
    const html=ctx.html;
    assert.equal((html.match(/<details\b/g)||[]).length,4);
    assert.doesNotMatch(html,/<details\b[^>]*\bopen(?:\s|>)/);
    assert.match(html,/<input type="hidden" name="accountId"/);
    assert.doesNotMatch(html,/<select name="accountId"/);
    for(const name of ['entry','exit','volume','risk','openedAt']){
      const input=html.match(new RegExp(`<input name="${name}"[^>]*>`))?.[0];
      assert.ok(input,`Missing optional ${name}`);assert.doesNotMatch(input,/\brequired\b/);
      assert.match(input,/value=""/);
    }
    assert.match(html,language==='en'?/Net result/:/Resultado neto/);
    assert.doesNotMatch(html,/Device timezone|Horas del dispositivo|\bundefined\b|\bNaN\b/);
  });
}

test('a visible account selector appears when several accounts can receive the capture',()=>{
  const ctx=context(createDemoState());openTradeForm(ctx);
  assert.match(ctx.html,/<select name="accountId"/);
});

test('MT5 form retains the imported-data message and read-only net figures',()=>{
  const state=createDemoState(),initial=state.trades[0];initial.source='mt5';
  const ctx=context(state,'en');openTradeForm(ctx,initial);
  assert.match(ctx.html,/Imported figures are preserved/);
  const netInput=ctx.html.match(/<input name="netResult"[^>]*>/)?.[0];assert.match(netInput,/\breadonly\b/);
});

test('quick trade details display unknown opening and volume as absent',()=>{
  const state=createEmptyState(),ctx=context(state,'en');
  const trade=build(visibleFields({accountId:ctx.account.id}));state.trades.push(trade);
  openTradeDetail(ctx,trade.id);
  assert.match(ctx.html,/<small>Opened<\/small><b>—<\/b>/);
  assert.match(ctx.html,/<small>Volume<\/small><b>—<\/b>/);
});
