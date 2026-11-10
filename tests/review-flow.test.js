import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState} from '../src/demo.js';
import {validateBackup,metrics} from '../src/domain.js';
import {esc,icon} from '../src/ui.js';
import {weekOf,weeklySummary,buildWeeklyReview,createWeeklyDraftStore,renderWeeklyReview} from '../src/views/review-flow.js';
const zone='America/Costa_Rica';
function trade(accountId,id,closedAt,patch={}){
 return {id,accountId,symbol:'EURUSD',side:'buy',status:'closed',openedAt:closedAt,closedAt,entry:1.08,exit:1.09,volume:.1,gross:100,commission:-5,swap:-1,risk:50,strategy:'Trend',reason:'Confirmed entry',notes:'Followed setup',tags:['patience','London'],attachments:[],checklist:{plan:'yes',risk:'no'},source:'manual',...patch};
}
function fixture(){
 const s=createEmptyState(),id=s.accounts[0].id;s.settings.timezone=zone;
 s.accounts.push({...s.accounts[0],id:'other-account',name:'Other'});
 s.rules=[{id:'plan',text:'My plan',strategy:''},{id:'risk',text:'Risk defined',strategy:''},{id:'news',text:'News checked',strategy:'Breakout'}];
 s.trades=[trade(id,'before','2026-11-09T05:59:00Z',{gross:1000}),trade(id,'a','2026-11-09T06:00:00Z'),trade(id,'b','2026-11-16T05:59:00Z',{gross:-30,commission:-4,swap:0,strategy:'',reason:'',notes:'',tags:['patience'],checklist:{plan:'yes'}}),trade(id,'after','2026-11-16T06:00:00Z',{gross:1000}),trade('other-account','different','2026-11-10T12:00:00Z',{gross:5000}),trade(id,'open','2026-11-10T12:00:00Z',{status:'open',closedAt:'',gross:9999})];
 s.cashflows=[{id:'deposit',accountId:id,date:'2026-11-12T12:00:00Z',amount:50000}];
 s.reviews=[{id:'old',accountId:id,week:'2026-10-26',answers:[],action:'Old action',completed:true,createdAt:'2026-10-26T12:00:00Z'},{id:'prior',accountId:id,week:'2026-11-02',answers:['Kept the plan'],action:'Wait for confirmation',completed:false,createdAt:'2026-11-02T12:00:00Z'},{id:'wrong-account',accountId:'other-account',week:'2026-11-02',answers:[],action:'Do not mix accounts',completed:true,createdAt:'2026-11-02T12:00:00Z'}];
 return s;
}
function context(state){const account=state.accounts[0];return {state,account,trades:state.trades.filter(tr=>tr.accountId===account.id),stats:metrics(state.trades.filter(tr=>tr.accountId===account.id)),t:(es,en)=>state.settings.language==='en'?en:es,esc,icon,money:n=>new Intl.NumberFormat('en-US',{style:'currency',currency:account.currency}).format(n),date:d=>String(d).slice(0,10),render(){},navigate(){},toast(){}};}

test('weekly dates use the configured timezone and date-only week choices remain local dates',()=>{
 assert.equal(weekOf('2026-11-09T05:59:00Z',zone),'2026-11-02');
 assert.equal(weekOf('2026-11-09T06:00:00Z',zone),'2026-11-09');
 assert.equal(weekOf('2026-11-16T05:59:00Z',zone),'2026-11-09');
 assert.equal(weekOf('2026-11-09T05:59:00Z','UTC'),'2026-11-09');
 assert.equal(weekOf('2026-11-09',zone),'2026-11-09');
 assert.equal(weekOf('2026-11-15',zone),'2026-11-09');
});
test('weekly summary uses only matching closed trades and excludes transfers and other accounts',()=>{
 const state=fixture(),before=JSON.stringify(state),summary=weeklySummary(state,state.accounts[0].id,'2026-11-12',zone);
 assert.equal(summary.week,'2026-11-09');assert.equal(summary.end,'2026-11-15');
 assert.deepEqual(summary.rows.map(tr=>tr.id).sort(),['a','b']);assert.equal(summary.net,60);
 assert.equal(summary.strategies.find(x=>x.name==='Trend')?.count,1);
 assert.equal(summary.tags.find(x=>x.name==='patience')?.count,2);
 assert.equal(summary.tags.find(x=>x.name==='London')?.count,1);
 assert.equal(summary.priorAction?.id,'prior');assert.equal(summary.priorAction?.completed,false);
 assert.equal(JSON.stringify(state),before);
});
test('weekly evidence distinguishes checklist coverage, compliance and missing context',()=>{
 const state=fixture(),summary=weeklySummary(state,state.accounts[0].id,'2026-11-09',zone);
 assert.equal(summary.compliance.total,4);assert.equal(summary.compliance.answered,3);assert.equal(summary.compliance.applicable,3);assert.equal(summary.compliance.passed,2);assert.equal(summary.compliance.coverage,75);
 assert.ok(Math.abs(summary.compliance.score-200/3)<1e-8);
 assert.equal(summary.compliance.failures.find(x=>x.id==='risk')?.count,1);
 assert.equal(summary.pending.length,1);assert.equal(summary.pending[0].trade.id,'b');assert.ok(summary.pending[0].reasons.length>=3);
 const empty=weeklySummary(createEmptyState(),'account-personal','2026-11-09',zone);assert.equal(empty.rows.length,0);assert.equal(empty.net,0);assert.equal(empty.compliance.total,0);
});
test('building a weekly review preserves prior metadata and remains a valid portable workspace',()=>{
 const state=fixture(),id=state.accounts[0].id;
 state.reviews.push({id:'existing-week',accountId:id,week:'2026-11-09',answers:['old'],action:'Old',completed:true,createdAt:'2026-11-09T12:00:00Z',custom:{keep:true}});
 const before=JSON.stringify(state),row=buildWeeklyReview(state,id,'2026-11-12',{answers:['Observed risk','','','','',''],action:'Respect the initial stop',step:2});
 assert.equal(row.id,'existing-week');assert.equal(row.week,'2026-11-09');assert.equal(row.accountId,id);assert.equal(row.action,'Respect the initial stop');assert.equal(row.answers.length,6);assert.deepEqual(row.custom,{keep:true});assert.equal(row.completed,true);assert.equal(row.createdAt,'2026-11-09T12:00:00Z');assert.equal(JSON.stringify(state),before);
 const restored=structuredClone(state);restored.reviews=restored.reviews.map(x=>x.id===row.id?row:x);assert.equal(validateBackup(restored),true);
 assert.throws(()=>buildWeeklyReview(state,id,'2026-11-09',{answers:[],action:' '}));
 assert.throws(()=>buildWeeklyReview(state,id,'2026-11-09',{answers:[],action:'x'.repeat(501)}));
});
test('unsaved review drafts are isolated by account and week, cloned, and cleared after matching save',()=>{
 const store=createWeeklyDraftStore(),draft={answers:['Need patience','','','','',''],action:'Wait one candle',step:2};
 store.set('a','2026-11-09',draft);draft.answers[0]='Mutated outside';
 const restored=store.get('a','2026-11-09');assert.equal(restored.answers[0],'Need patience');restored.action='Mutated copy';assert.equal(store.get('a','2026-11-09').action,'Wait one candle');
 assert.ok(!store.get('b','2026-11-09'));assert.ok(!store.get('a','2026-11-02'));
 assert.ok(!store.get('a','2026-11-09',{answers:['Need patience','','','','',''],action:'Wait one candle'}));
 assert.ok(!store.get('a','2026-11-09'));
 store.set('a','2026-11-09',{answers:[],action:'Draft',step:1});store.delete('a','2026-11-09');assert.ok(!store.get('a','2026-11-09'));
});
test('progressive review renders safe bilingual summary and keeps the empty week useful',()=>{
 for(const lang of ['es','en']){
  const empty=createEmptyState();empty.settings.language=lang;const html=renderWeeklyReview(context(empty));
  assert.match(html,lang==='es'?/Resumen/:/Summary/);assert.match(html,lang==='es'?/Observaciones/:/Observations/);assert.match(html,lang==='es'?/Acción/:/Action/);
  assert.match(html,lang==='es'?/Semana sin operaciones/:/No trades/);
  assert.doesNotMatch(html,/data-insight-review-form/);assert.ok((html.match(/<textarea\b/g)||[]).length<=3,'Summary should not display six essay fields');assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/);
  const populated=fixture(),payload='<img src=x onerror=alert(1)>';populated.settings.language=lang;populated.accounts[0].name=payload;populated.reviews[0].action=payload;const before=JSON.stringify(populated),screen=renderWeeklyReview(context(populated));assert.ok(!screen.includes(payload));assert.equal(JSON.stringify(populated),before);
 }
});
