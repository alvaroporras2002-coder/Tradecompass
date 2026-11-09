import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoState, createEmptyState } from '../src/demo.js';
import { migrateWorkspace } from '../src/workspace.js';

const legacy = () => createDemoState(new Date('2024-03-18T02:42:10.000Z'));
const ownTrade = accountId => ({ ...structuredClone(legacy().trades[0]), id:'my-first-trade', accountId, notes:'My actual journal entry', checklist:{}, source:'manual' });
const shifted = (trade, days) => {trade.openedAt = new Date(Date.parse(trade.openedAt) + days * 86400000).toISOString();if(trade.closedAt)trade.closedAt = new Date(Date.parse(trade.closedAt) + days * 86400000).toISOString();};

test('pristine legacy demonstration becomes a truly empty personal journal without mutating its source', () => {
  const before = legacy(), original = structuredClone(before);
  const result = migrateWorkspace(before);
  assert.equal(result.changed,true);assert.equal(result.removedTrades,49);assert.equal(result.removedAccounts,2);assert.equal(result.removedRules,5);
  assert.deepEqual(result.state.trades,[]);assert.deepEqual(result.state.rules,[]);assert.deepEqual(result.state.accounts,createEmptyState().accounts);
  assert.equal(result.state.accounts[0].initialBalance,0);assert.equal(result.state.mode,'personal');assert.deepEqual(before,original);
});

test('an old calendar anchor is reconstructed instead of comparing samples with today', () => {
  const old = legacy();
  assert.ok(old.trades[0].openedAt.startsWith('2024-02-'));
  const result=migrateWorkspace(old);
  assert.equal(result.removedTrades,49);assert.equal(result.state.trades.length,0);
});

test('edited sample notes, images, fields and unknown metadata remain as personal records', () => {
  const state=legacy();
  state.trades[0].notes='I documented this operation myself.';
  state.trades[1].attachments=[{id:'capture',name:'My chart',data:'data:image/jpeg;base64,YQ=='}];
  state.trades[2].gross=321;
  state.trades[3].userMetadata={reviewed:true};
  const edited=structuredClone(state.trades.slice(0,4));
  const result=migrateWorkspace(state);
  assert.equal(result.removedTrades,45);assert.deepEqual(result.state.trades,edited);
  assert.deepEqual(result.state.accounts,state.accounts);
  assert.deepEqual(result.state.rules,state.rules); // These retained records use the original checklists.
});

test('custom records and dependent accounts survive while unused demo account and rules are removed', () => {
  const state=legacy();
  const trade=ownTrade('account-main');state.trades.push(trade);
  state.reviews=[{id:'review-own',accountId:'account-main',week:'2024-03-18',answers:['My review'],action:'Wait for confirmation'}];
  state.imports=[{id:'import-own',accountId:'account-main',name:'own.csv',createdAt:'2024-03-18T10:00:00Z',count:1,net:50}];
  state.cashflows=[{id:'deposit-own',accountId:'account-main',date:'2024-03-18T09:00:00Z',amount:123}];
  const original=structuredClone(state);
  const result=migrateWorkspace(state);
  assert.equal(result.removedTrades,49);assert.deepEqual(result.state.trades,[trade]);
  assert.deepEqual(result.state.accounts,[original.accounts[0]]);assert.equal(result.removedAccounts,1);
  assert.deepEqual(result.state.reviews,original.reviews);assert.deepEqual(result.state.imports,original.imports);assert.deepEqual(result.state.cashflows,original.cashflows);
  assert.deepEqual(result.state.rules,[]);
});

test('edited account configurations, edited rules and arbitrary preferences are preserved exactly', () => {
  const state=legacy();
  state.accounts[0].name='My real account';state.accounts[0].initialBalance=250;
  state.rules[0].text='My own plan';state.rules[1].userMetadata={priority:1};
  state.settings={language:'en',timezone:'Europe/Madrid',name:'Me',futurePreference:{density:'compact'}};
  state.futureMetadata={notes:'Personal configuration',accountId:'account-lab'};
  const result=migrateWorkspace(state);
  assert.deepEqual(result.state.accounts,state.accounts);
  assert.deepEqual(result.state.rules,state.rules.slice(0,2));
  assert.deepEqual(result.state.settings,state.settings);assert.deepEqual(result.state.futureMetadata,state.futureMetadata);
});

test('personal diaries and explicitly marked states are inert even when they contain sample-looking identifiers', () => {
  for(const state of [{...legacy(),mode:'personal'}, {...legacy(),settings:{...legacy().settings,emptyStartVersion:1}}]) {
    const before=structuredClone(state),result=migrateWorkspace(state);
    assert.equal(result.changed,false);assert.equal(result.removedTrades,0);assert.equal(result.removedAccounts,0);assert.equal(result.removedRules,0);
    assert.deepEqual(result.state,before);assert.notEqual(result.state,state);
  }
});

test('coherently date-edited minority records are preserved against the original majority cohort', () => {
  const state=legacy();shifted(state.trades[0],7);shifted(state.trades[1],7);
  const modified=structuredClone(state.trades.slice(0,2));
  const result=migrateWorkspace(state);
  assert.equal(result.removedTrades,47);assert.deepEqual(result.state.trades,modified);
});

test('a tied date cohort or lone candidate is ambiguous and is not deleted', () => {
  const state=legacy();state.trades=state.trades.slice(0,4);shifted(state.trades[2],7);shifted(state.trades[3],7);
  const result=migrateWorkspace(state);
  assert.equal(result.removedTrades,0);assert.deepEqual(result.state.trades,state.trades);
  const lone=legacy();lone.trades=lone.trades.slice(0,1);
  assert.equal(migrateWorkspace(lone).removedTrades,0);
});

test('the exact legacy personal account is removed only inside an unreferenced demo workspace', () => {
  const state=legacy();state.accounts.push({id:'account-personal',name:'Mi cuenta',currency:'USD',initialBalance:10000,platform:'MetaTrader 5',timezone:'America/Costa_Rica',type:'demo',archived:false});
  const result=migrateWorkspace(state);
  assert.equal(result.removedAccounts,3);assert.deepEqual(result.state.accounts,createEmptyState().accounts);
  const edited=legacy();edited.accounts.push({...state.accounts[2],name:'My configured personal account'});
  assert.deepEqual(migrateWorkspace(edited).state.accounts,[edited.accounts[2]]);
});

test('migration is idempotent and never marks a newly empty workspace as changed', () => {
  const once=migrateWorkspace(legacy()), twice=migrateWorkspace(once.state);
  assert.equal(twice.changed,false);assert.deepEqual(twice.state,once.state);
  assert.deepEqual(migrateWorkspace(createEmptyState()).state,createEmptyState());
  assert.equal(migrateWorkspace(createEmptyState()).changed,false);
});


test('JSON-persisted legacy examples normalize negative zero without disguising personalized fields', () => {
  const original=legacy();
  assert.ok(original.trades.some(trade=>Object.is(trade.gross,-0)),'The fixture exercises negative-zero gross amounts');
  const stored=JSON.parse(JSON.stringify(original));
  const result=migrateWorkspace(stored);
  assert.equal(result.removedTrades,49);assert.deepEqual(result.state.trades,[]);assert.deepEqual(result.state.rules,[]);
  const personalized=JSON.parse(JSON.stringify(original));
  personalized.trades[6].myMetadata={reviewed:true};
  const preserved=structuredClone(personalized.trades[6]);
  const mixed=migrateWorkspace(personalized);
  assert.equal(mixed.removedTrades,48);assert.deepEqual(mixed.state.trades,[preserved],'Unknown personal fields still prevent removal');
});
