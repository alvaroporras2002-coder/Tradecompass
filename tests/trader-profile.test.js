import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState,createDemoState} from '../src/demo.js';
import {applyPlan} from '../src/plans.js';
import {PROFILE_OPTIONS,validTraderProfile,applyTraderProfile,profileLabel,profileRecommendations} from '../src/trader-profile.js';
const now=Date.parse('2026-11-10T12:34:56.000Z');
const input=()=>({name:' Álvaro ',language:'es',currency:'CRC',timezone:'America/Costa_Rica',experience:'developing',style:'swing',markets:['forex','metals'],goal:'discipline',session:'london',platform:'mt5',weeklyReview:'friday',accountMode:'demo'});
const profile=()=>({version:1,...Object.fromEntries(Object.keys(PROFILE_OPTIONS).map(field=>[field,input()[field]])),updatedAt:new Date(now).toISOString()});

test('questionnaire options are stable bilingual IDs and labels never expose unknown values',()=>{
 assert.deepEqual(Object.keys(PROFILE_OPTIONS),['experience','style','markets','goal','session','platform','weeklyReview','accountMode']);
 for(const [field,options] of Object.entries(PROFILE_OPTIONS))for(const [id,es,en] of options){assert.ok(id&&es&&en);assert.equal(profileLabel(field,id),es);assert.equal(profileLabel(field,id,'en'),en);}
 assert.equal(profileLabel('markets','<script>'),'');assert.equal(profileLabel('unknown','id'),'');
});
test('profile schema rejects unknown, missing, duplicate, noncanonical and malformed data',()=>{
 assert.equal(validTraderProfile(profile()),true);
 for(const mutate of [p=>p.version=2,p=>p.unknown='extra',p=>delete p.style,p=>p.goal='profit',p=>p.markets=[],p=>p.markets=['forex','forex'],p=>p.markets=['invalid'],p=>p.updatedAt='2026-02-31T12:00:00.000Z',p=>p.updatedAt='not a date',p=>p.session=null]){const p=profile();mutate(p);assert.equal(validTraderProfile(p),false);}
 for(const field of Object.keys(PROFILE_OPTIONS)){const p=profile();p[field]=field==='markets'?['<img>']:'<img>';assert.equal(validTraderProfile(p),false);}
 assert.equal(validTraderProfile(null),false);assert.equal(validTraderProfile([]),false);
});
test('application stores only canonical profile fields and personalizes an untouched primary account',()=>{
 const state=createEmptyState(),draft=input();draft.provider='google';draft.password='must-not-store';
 const returned=applyTraderProfile(state,draft,now);
 assert.equal(returned,state);assert.equal(state.settings.name,'Álvaro');assert.equal(state.settings.language,'es');assert.equal(state.settings.onboardingComplete,true);assert.equal(validTraderProfile(state.settings.traderProfile),true);
 assert.equal(state.accounts[0].currency,'CRC');assert.equal(state.accounts[0].name,'Mi cuenta');assert.equal(state.accounts[0].timezone,'America/Costa_Rica');assert.equal(state.accounts[0].platform,'MetaTrader 5');assert.equal(state.accounts[0].type,'demo');
 assert.ok(!JSON.stringify(state).includes('must-not-store'));assert.ok(!Object.hasOwn(state.settings.traderProfile,'provider'));
 draft.markets.push('crypto');assert.deepEqual(state.settings.traderProfile.markets,['forex','metals']);
 assert.equal(state.rules.length,3);assert.ok(state.rules.every(rule=>!/[0-9%]/.test(rule.text)));assert.equal(state.trades.length,0);
});
test('profile updates preserve all existing records, account metadata and paid plan without resetting usage',()=>{
 const state=createDemoState(new Date(now));state.mode='personal';applyPlan(state,'elite','year','apple',state.accounts[0].id,now);state.settings.planUsage={'2026-11':24};
 const before=structuredClone(state);const draft={...input(),language:'en',currency:'EUR',timezone:'Europe/London',platform:'tradingview',accountMode:'real'};
 applyTraderProfile(state,draft,now);
 for(const key of ['accounts','trades','cashflows','reviews','imports','rules'])assert.deepEqual(state[key],before[key],key);
 assert.deepEqual(state.settings.subscription,before.settings.subscription);assert.deepEqual(state.settings.planUsage,before.settings.planUsage);assert.equal(state.settings.language,'en');assert.equal(state.settings.timezone,'Europe/London');
});
test('a custom empty account, an account with cashflows, and a read-only primary account retain metadata',()=>{
 for(const mode of ['custom','cashflows','readonly']){
  const state=createEmptyState();
  if(mode==='custom')state.accounts[0].name='My existing account';
  if(mode==='cashflows')state.cashflows=[{id:'deposit',accountId:state.accounts[0].id,date:new Date(now).toISOString(),amount:100}];
  if(mode==='readonly'){state.accounts.push({...state.accounts[0],id:'second',name:'Editable account'});applyPlan(state,'free','month',null,'second',now);}
  const before=structuredClone(state.accounts);applyTraderProfile(state,input(),now);assert.deepEqual(state.accounts,before,mode);
 }
});
test('invalid application input fails before mutating the existing workspace',()=>{
 for(const override of [{name:''},{name:'x'.repeat(61)},{language:'fr'},{currency:'JPY'},{timezone:'nowhere/invalid'},{markets:['forex','forex']},{experience:'expert'}]){
  const state=createEmptyState(),before=structuredClone(state);assert.throws(()=>applyTraderProfile(state,{...input(),...override},now));assert.deepEqual(state,before);
 }
});
test('names are stored as plain data for the UI to escape and name limits are measured after trimming',()=>{
 const state=createEmptyState(),draft={...input(),name:' <img src=x onerror=alert(1)> '};applyTraderProfile(state,draft,now);assert.equal(state.settings.name,'<img src=x onerror=alert(1)>');
 assert.ok(!Object.hasOwn(state.settings.traderProfile,'name'));assert.equal(state.settings.traderProfile.version,1);
});
test('recommendations reflect goal, style, experience and language without changing plan or adding records',()=>{
 const state=createEmptyState();applyTraderProfile(state,{...input(),goal:'consistency',style:'intraday',platform:'mt5',experience:'new',weeklyReview:'sunday'},now);const before=structuredClone(state);
 const es=profileRecommendations(state,'es'),en=profileRecommendations(state,'en');assert.equal(es.length,3);assert.equal(en.length,3);assert.equal(es[0].route,'review');assert.match(es[0].detail,/domingo/);assert.equal(es[1].route,'import');assert.equal(es[2].route,'journal');assert.match(en[0].detail,/Sunday/);assert.notEqual(es[0].title,en[0].title);assert.deepEqual(state,before);
 state.settings.traderProfile.goal='understand';state.settings.traderProfile.style='exploring';state.settings.traderProfile.experience='experienced';const options=profileRecommendations(state);assert.equal(options[0].route,'analytics');assert.equal(options[1].route,'docs');assert.equal(options[2].route,'analytics');
});
test('missing or invalid profiles receive safe real-feature suggestions',()=>{
 const state=createEmptyState();for(const value of [undefined,{style:'<script>'}]){state.settings.traderProfile=value;const recommendations=profileRecommendations(state,'en');assert.equal(recommendations.length,3);assert.deepEqual(recommendations.map(row=>row.route),['journal','discipline','review']);assert.ok(recommendations.every(row=>typeof row.title==='string'&&typeof row.detail==='string'));}
});
