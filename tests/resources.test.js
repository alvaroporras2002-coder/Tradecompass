import {applyPlan} from '../src/plans.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState,createDemoState} from '../src/demo.js';
import {metrics,filterTrades,validateBackup} from '../src/domain.js';
import {esc,icon} from '../src/ui.js';
import {renderPlans,renderReports,renderDocs,renderCommunications,renderWelcome,applyProfileSetup} from '../src/views/resources.js';
const views={plans:renderPlans,reports:renderReports,docs:renderDocs,communications:renderCommunications,welcome:renderWelcome};
function context(state) {
 const account=state.accounts[0];const trades=filterTrades(state,{accountId:account.id,period:'all'});
 return {state,account,trades,stats:metrics(trades,account.initialBalance,state.cashflows.filter(f=>f.accountId===account.id)),t:(es,en)=>state.settings.language==='en'?en:es,esc,icon,money:value=>'$'+Number(value).toFixed(2),date:value=>new Date(value).toISOString().slice(0,10),periodLabel:'Todo el historial'};
}
for(const language of ['es','en'])for(const mode of ['empty','populated']){
 test(`resources ${mode} ${language}: complete views expose valid headings and finite values`,()=>{
  const state=mode==='empty'?createEmptyState():createDemoState();state.settings.language=language;applyPlan(state,'pro','month','card',state.accounts[0].id);const ctx=context(state);
  for(const [name,render] of Object.entries(views)){
   const html=render(ctx);assert.match(html,/<h1\b[^>]*>/,name);assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/,name);assert.ok(html.length>1000,name);
  }
  const report=renderReports(ctx);assert.ok(report.includes(ctx.money(ctx.stats.net)));assert.match(report,/data-resource-report="csv"/);assert.match(report,/data-resource-report="html"/);assert.match(report,/data-resource-report="json"/);
  if(mode==='empty')assert.match(report,language==='en'?/Your report starts with your first trade/:/El informe comienza con tu primera operación/);
 });
}
test('email templates include access recovery and expressly non-active subscription example',()=>{
 const ctx=context(createEmptyState());const html=renderCommunications(ctx);
 for(const id of ['welcome','recover','subscription','import','review'])assert.ok(html.includes(`data-resource-message="${id}"`),id);
 assert.match(html,/TradeCompass no administra tu contraseña/);assert.match(html,/esta plantilla no confirma una suscripción activa ni un pago procesado/);assert.match(html,/No se envían correos/);
 assert.match(renderPlans(ctx),/Sin cobros reales/);
});
test('user labels cannot escape profile inputs, email textareas or report markup',()=>{
 const state=createDemoState();const payload='\"><\/textarea><img src=x onerror=alert(1)><script>alert(2)</script>';
 state.settings.name=payload;state.accounts[0].name=payload;state.accounts[0].timezone='UTC';
 for(const tr of state.trades){tr.symbol=payload;tr.strategy=payload;}
 for(const [name,render] of Object.entries(views)){
  const html=render(context(state));assert.ok(!html.includes(payload),name);assert.ok(!html.includes('<img src=x'),name);assert.ok(!html.includes('<script>'),name);
 }
 const comms=renderCommunications(context(state));assert.ok(comms.includes('&lt;/textarea&gt;&lt;img src=x onerror=alert(1)&gt;'));
 const welcome=renderWelcome(context(state));assert.ok(welcome.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
});
const profileInput=state=>({name:'Álvaro',accountName:'Principal',currency:'EUR',initialBalance:2500,language:'en',timezone:'Europe/Madrid',starterRules:true,accountId:state.accounts[0].id});
test('initial setup honors language, timezone and starter rules and preserves valid state',()=>{
 const state=createEmptyState();applyProfileSetup(state,profileInput(state));
 assert.equal(state.settings.name,'Álvaro');assert.equal(state.settings.language,'en');assert.equal(state.settings.timezone,'Europe/Madrid');assert.equal(state.accounts[0].timezone,'Europe/Madrid');assert.equal(state.accounts[0].currency,'EUR');assert.equal(state.accounts[0].initialBalance,2500);assert.equal(state.rules.length,5);assert.match(state.rules[0].text,/My entry/);assert.equal(state.settings.onboardingComplete,true);validateBackup(state);
});
test('setup preserves baseline and currency when account contains only a cashflow',()=>{
 const state=createEmptyState();state.accounts[0].initialBalance=700;state.cashflows=[{id:'deposit',accountId:state.accounts[0].id,amount:100,date:'2026-11-01T12:00:00.000Z'}];
 applyProfileSetup(state,profileInput(state));assert.equal(state.accounts[0].initialBalance,700);assert.equal(state.accounts[0].currency,'USD');assert.equal(state.cashflows[0].amount,100);validateBackup(state);
 const html=renderWelcome(context(state));assert.match(html,/name="currency" disabled/);assert.match(html,/name="initialBalance" required value="700" readonly/);
});
test('setup preserves baseline, currency and custom rules for an existing trade ledger',()=>{
 const state=createDemoState();const before=structuredClone(state);applyProfileSetup(state,profileInput(state));
 assert.equal(state.accounts[0].initialBalance,before.accounts[0].initialBalance);assert.equal(state.accounts[0].currency,before.accounts[0].currency);assert.deepEqual(state.trades,before.trades);assert.deepEqual(state.rules,before.rules);validateBackup(state);
});
test('invalid setup is rejected before mutating records',()=>{
 for(const invalid of [{language:'fr'},{timezone:'Unknown/Zone'},{initialBalance:-1},{initialBalance:Infinity},{currency:'<x>'},{name:' '},{accountId:'missing'}]){
  const state=createEmptyState();const before=structuredClone(state);assert.throws(()=>applyProfileSetup(state,{...profileInput(state),...invalid}));assert.deepEqual(state,before);
 }
});
test('profile form exposes language and timezone including the selected custom zone',()=>{
 const state=createEmptyState();state.settings.language='en';state.settings.timezone='Pacific/Auckland';state.accounts[0].timezone='Pacific/Auckland';
 const html=renderWelcome(context(state));assert.match(html,/<select name="language">/);assert.match(html,/<select name="timezone">/);assert.match(html,/<option value="Pacific\/Auckland" selected>/);assert.match(html,/<option value="en" selected>/);
});

test('Free reports retain CSV/JSON access without exposing the paid PDF preview',()=>{const ctx=context(createEmptyState());const html=renderReports(ctx);assert.match(html,/data-resource-report="csv"/);assert.match(html,/data-resource-report="json"/);assert.doesNotMatch(html,/data-resource-report="html"/);assert.match(html,/Informes PDF con Pro/);});
