import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade, validateBackup } from '../src/domain.js';
import { createEmptyState } from '../src/demo.js';
import { validState } from '../server/worker.js';

function fixture(overrides = {}) {
  const state = createEmptyState();
  const trade = {
    id: 'manual-quick-1', accountId: state.accounts[0].id,
    captureMode: 'quick', source: 'manual', symbol: 'EURUSD', side: 'buy', status: 'closed',
    openedAt: null, closedAt: '2026-11-09T16:00:00.000Z',
    entry: null, exit: null, volume: null,
    gross: 125.75, commission: -2, swap: -0.5, risk: null,
    strategy: '', tags: [], attachments: [], checklist: {}, notes: '',
    ...overrides,
  };
  state.trades.push(trade);
  return { state, trade };
}

function accepted(overrides = {}) {
  const { state, trade } = fixture(overrides);
  const before = structuredClone(trade);
  assert.deepEqual(validateTrade(trade), {});
  assert.equal(validateBackup(state), true);
  assert.equal(validState(state), true);
  assert.deepEqual(trade, before, 'validation must not invent execution details');
  return trade;
}

function rejected(overrides) {
  const { state, trade } = fixture(overrides);
  const description = Object.entries(overrides).map(([key, value]) => `${key}=${String(value)}`).join(', ');
  assert.notDeepEqual(validateTrade(trade), {}, `trade validator should reject ${description}`);
  assert.throws(() => validateBackup(state), 'backup validation should reject the same record');
  assert.equal(validState(state), false, 'cloud validation should reject the same record');
}

test('a personal workspace starts with no simulated balance, rules or records', () => {
  const state = createEmptyState();
  assert.equal(state.mode, 'personal');
  assert.ok(state.accounts.length > 0);
  assert.ok(state.accounts.every(account => account.initialBalance === 0));
  for (const field of ['trades', 'rules', 'reviews', 'imports', 'cashflows']) assert.deepEqual(state[field], [], field);
  assert.equal(validateBackup(state), true);
  assert.equal(validState(state), true);
});

test('manual quick closed records need no invented opening time, prices or lot size', () => {
  const trade = accepted();
  for (const field of ['openedAt', 'entry', 'exit', 'volume']) assert.equal(trade[field], null);
});

test('manual quick open records retain a real opening date without invented execution details', () => {
  accepted({ status: 'open', openedAt: '2026-11-09T15:00:00.000Z', closedAt: null, gross: 0, commission: 0, swap: 0 });
  rejected({ status: 'open', openedAt: null, closedAt: null });
  rejected({ status: 'open', openedAt: 'not-a-date', closedAt: null });
});

test('quick closed records still require a real closing date and coherent optional chronology', () => {
  for (const closedAt of [null, '', 'not-a-date']) rejected({ closedAt });
  accepted({ openedAt: '2026-11-09T15:00:00.000Z' });
  accepted({ openedAt: '2026-11-09T16:00:00.000Z' });
  rejected({ openedAt: '2026-11-09T17:00:00.000Z' });
  rejected({ openedAt: 'not-a-date' });
});

test('optional execution values remain positive and finite when supplied', () => {
  for (const phase of [{}, { status: 'open', openedAt: '2026-11-09T15:00:00.000Z', closedAt: null }]) {
    for (const field of ['entry', 'exit', 'volume']) {
      accepted({ ...phase, [field]: field === 'volume' ? 0.1 : 1.0825 });
      for (const value of [-1, 0, NaN, Infinity, 'invalid']) rejected({ ...phase, [field]: value });
    }
  }
});

test('quick-record risk may be absent but cannot be zero, negative or non-finite', () => {
  accepted({ risk: null });
  accepted({ risk: 50 });
  for (const risk of [0, -1, NaN, Infinity, 'invalid']) rejected({ risk });
});

test('quick records preserve signed finite gross result, commission and swap', () => {
  accepted({ gross: -100, commission: -2.5, swap: 1.25 });
  accepted({ gross: 0, commission: 0.25, swap: -0.75 });
  for (const field of ['gross', 'commission', 'swap']) {
    for (const value of [null, '', NaN, Infinity, 'invalid']) rejected({ [field]: value });
  }
});

test('quick capture relaxation is exclusive to explicitly manual records', () => {
  for (const source of ['mt5', 'imported', undefined]) rejected({ source });
  for (const captureMode of ['detailed', undefined]) rejected({ captureMode });
});

test('detailed and imported quick flags keep the original execution requirements', () => {
  const details = { openedAt: '2026-11-09T15:00:00.000Z', entry: 1.0825, exit: 1.0840, volume: 0.1 };
  accepted({ ...details, captureMode: 'detailed' });
  accepted({ ...details, captureMode: undefined });
  accepted({ ...details, source: 'mt5' });
  for (const source of ['manual', 'mt5']) {
    for (const field of ['openedAt', 'entry', 'exit', 'volume']) rejected({ ...details, source, captureMode: source === 'manual' ? 'detailed' : 'quick', [field]: null });
  }
});
