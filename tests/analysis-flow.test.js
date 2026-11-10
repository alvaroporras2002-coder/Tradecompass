import test from 'node:test';
import assert from 'node:assert/strict';
import {filterAnalysis,buildAnalysis,groupAnalysis,classifyCompliance,renderAnalysisFlow} from '../src/views/analysis-flow.js';
import {createEmptyState} from '../src/demo.js';
import {esc,icon} from '../src/ui.js';

const account={id:'a',name:'Cuenta A',currency:'USD',initialBalance:1000,timezone:'America/Costa_Rica'};
const rules=[{id:'plan',text:'Plan',strategy:''},{id:'risk',text:'Risk',strategy:'Trend'}];
const trade=(id,extra={})=>({id,accountId:'a',symbol:'EURUSD',strategy:'Trend',side:'buy',status:'closed',openedAt:'2026-11-09T15:00:00Z',closedAt:'2026-11-09T16:00:00Z',gross:100,commission:-2,swap:-1,risk:50,tags:['Londres'],emotionBefore:'Calma',emotionDuring:'Atención',emotionAfter:'Aceptación',notes:'',checklist:{plan:'yes',risk:'yes'},...extra});
const state=trades=>({accounts:[{...account},{...account,id:'b',name:'Other',currency:'EUR'}],trades,rules,cashflows:[{id:'deposit',accountId:'a',date:'2026-11-09T10:00:00Z',amount:50000}],settings:{language:'es',timezone:'America/Costa_Rica'},reviews:[]});
const options={period:'all',now:new Date('2026-11-10T12:00:00Z'),timeZone:'America/Costa_Rica'};
const ids=rows=>rows.map(x=>x.id).sort();

test('advanced analysis isolates the selected account, realized results and cash transfers',()=>{
 const s=state([trade('a1'),trade('a2',{gross:-30,commission:0,swap:0}),trade('open',{status:'open',gross:999999}),trade('foreign',{accountId:'b',gross:900000})]);
 const before=structuredClone(s),result=buildAnalysis(s,account,{},options);
 assert.deepEqual(ids(result.rows),['a1','a2']);assert.equal(result.stats.net,67);assert.equal(result.stats.closedCount,2);
 assert.equal(result.stats.cashflowTotal,0);assert.equal(result.stats.equity[0].value,0);assert.equal(result.stats.equity.at(-1).pnl,67);assert.deepEqual(s,before);
 assert.deepEqual(filterAnalysis(s,null,{},options).rows,[]);
});

test('calendar filters use local closing dates and override a relative period only when custom dates exist',()=>{
 const s=state([trade('local-previous',{openedAt:'2026-01-02T01:00:00Z',closedAt:'2026-01-02T03:00:00Z'}),trade('local-next',{openedAt:'2026-01-02T10:00:00Z',closedAt:'2026-01-02T12:00:00Z'}),trade('recent',{closedAt:'2026-11-09T18:00:00Z'})]);
 const custom=filterAnalysis(s,account,{from:'2026-01-01',to:'2026-01-01'},{...options,period:'month'});
 assert.deepEqual(ids(custom.rows),['local-previous']);assert.equal(custom.customDates,true);
 assert.deepEqual(ids(filterAnalysis(s,account,{}, {...options,period:'month'}).rows),['recent']);
 for(const filters of [{from:'2026-02-30'},{to:'not-a-date'},{from:'2026-02-02',to:'2026-01-01'},{hourFrom:'24'},{hourTo:'-1'}])assert.throws(()=>filterAnalysis(s,account,filters,options));
});

test('opening-hour filtering supports midnight wrap and never substitutes close time for unknown opening time',()=>{
 const s=state([trade('late',{openedAt:'2026-11-09T05:00:00Z'}),trade('early',{openedAt:'2026-11-09T07:00:00Z'}),trade('day',{openedAt:'2026-11-09T18:00:00Z'}),trade('unknown',{openedAt:'',closedAt:'2026-11-09T05:00:00Z'})]);
 const result=filterAnalysis(s,account,{hourFrom:'22',hourTo:'2'},options);
 assert.deepEqual(ids(result.rows),['early','late']);assert.equal(result.unknownOpeningCount,1);
 assert.deepEqual(ids(filterAnalysis(s,account,{hourFrom:'12',hourTo:'12'},options).rows),['day']);
 assert.equal(filterAnalysis(s,account,{},options).rows.length,4);
});

test('checklist classification requires all relevant rules answered and never treats missing answers as compliance',()=>{
 assert.equal(classifyCompliance(trade('yes'),rules),'met');
 assert.equal(classifyCompliance(trade('pending',{checklist:{plan:'yes'}}),rules),'unevaluated');
 assert.equal(classifyCompliance(trade('broken',{checklist:{plan:'no'}}),rules),'broken');
 assert.equal(classifyCompliance(trade('range',{strategy:'Range',checklist:{plan:'yes'}}),rules),'met');
 assert.equal(classifyCompliance(trade('na',{checklist:{plan:'na',risk:'na'}}),rules),'unevaluated');
 assert.equal(classifyCompliance(trade('nona',{checklist:{plan:'yes',risk:'na'}}),rules),'met');
 assert.equal(classifyCompliance(trade('norules'),[]),'unevaluated');
 const s=state([trade('ok'),trade('pending',{checklist:{plan:'yes'}}),trade('bad',{checklist:{plan:'no',risk:'yes'}})]);
 assert.deepEqual(ids(filterAnalysis(s,account,{compliance:'met'},options).rows),['ok']);
 assert.deepEqual(ids(filterAnalysis(s,account,{compliance:'broken'},options).rows),['bad']);
 assert.deepEqual(ids(filterAnalysis(s,account,{compliance:'unevaluated'},options).rows),['pending']);
});

test('asset, side, strategy, exact tag and phase-specific emotions combine as an intersection',()=>{
 const s=state([trade('match'),trade('wrong-side',{side:'sell'}),trade('substring-tag',{tags:['Londres apertura']}),trade('during-only',{emotionBefore:'Impaciencia',emotionDuring:'Calma'}),trade('wrong-symbol',{symbol:'XAUUSD'}),trade('wrong-strategy',{strategy:'Range'})]);
 const filters={symbol:'EURUSD',side:'buy',strategy:'Trend',tag:'Londres',emotion:'Calma',emotionPhase:'before'};
 assert.deepEqual(ids(filterAnalysis(s,account,filters,options).rows),['match']);
 assert.deepEqual(ids(filterAnalysis(s,account,{...filters,emotionPhase:'any'},options).rows),['during-only','match']);
});

test('group drilldowns contain the actual matching records and tag overlap stays observable',()=>{
 const rows=[trade('first',{gross:20,commission:0,swap:0,tags:['A','B']}),trade('second',{gross:-10,commission:0,swap:0,tags:['B']})];
 const tagGroups=groupAnalysis(rows,rules,'tag',options.timeZone);
 const a=tagGroups.find(g=>g.label==='A'),b=tagGroups.find(g=>g.label==='B');
 assert.deepEqual(ids(a.rows),['first']);assert.deepEqual(ids(b.rows),['first','second']);assert.equal(a.count,1);assert.equal(b.count,2);assert.equal(b.net,10);assert.equal(b.winRate,50);
 const strategies=groupAnalysis(rows,rules,'strategy',options.timeZone);assert.equal(strategies.length,1);assert.deepEqual(ids(strategies[0].rows),['first','second']);
 assert.equal(rows.length,2);
});

test('mobile analysis preserves safe user labels and explains genuinely empty data',()=>{
 const empty=createEmptyState(),a=empty.accounts[0];
 const context=s=>({state:s,account:s.accounts[0],period:'all',t:(es)=>es,esc,icon,money:n=>'$'+Number(n).toFixed(2),date:d=>String(d).slice(0,10)});
 const html=renderAnalysisFlow(context(empty));assert.match(html,/Análisis/);assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/);assert.match(html,/—/);
 const payload='<img src=x onerror=alert(1)>';const s=state([trade('x',{symbol:payload,strategy:payload,tags:[payload]})]);s.accounts[0].name=payload;
 const populated=renderAnalysisFlow(context(s));assert.ok(!populated.includes(payload));assert.doesNotMatch(populated,/\b(?:undefined|NaN|Infinity)\b/);
});
