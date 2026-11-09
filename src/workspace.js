import { createDemoState, createEmptyState } from './demo.js';

const DAY = 86400000;
const HOUR = 3600000;
const legacyPersonalAccount = {
  id: 'account-personal', name: 'Mi cuenta', currency: 'USD', initialBalance: 10000,
  platform: 'MetaTrader 5', timezone: 'America/Costa_Rica', type: 'demo', archived: false,
};

// An ID is only a lookup hint. A record is removable only when every key/value
// still equals the original fixture; notes, screenshots and extra metadata count.
function exactlyEqual(left, right) {
  // JSON/cloud persistence normalizes -0 to 0; both represent the same amount.
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && exactlyEqual(left[key], right[key]));
}

function sampleIndex(id) {
  if (id === 'demo-open-1') return 'open';
  const match = /^demo-trade-([1-9]\d*)$/.exec(id || '');
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return index >= 0 && index < 48 ? index : null;
}

function inferredAnchor(trade) {
  const index = sampleIndex(trade.id);
  if (index === null || typeof trade.openedAt !== 'string') return null;
  const opened = Date.parse(trade.openedAt);
  if (!Number.isFinite(opened)) return null;
  let anchor;
  if (index === 'open') {
    if (trade.status !== 'open' || trade.closedAt !== '') return null;
    anchor = opened + 2 * HOUR;
  } else {
    if (trade.status !== 'closed' || typeof trade.closedAt !== 'string') return null;
    if (Date.parse(trade.closedAt) - opened !== (35 + index % 90) * 60000) return null;
    anchor = opened + (Math.floor((47 - index) / 2) + 1) * DAY - (index % 2) * 3 * HOUR;
  }
  const date = new Date(anchor);
  if (date.getUTCHours() !== 14 || date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds()) return null;
  return date.toISOString();
}

function commonAnchor(trades) {
  const candidates = trades.filter(trade => sampleIndex(trade.id) !== null);
  const cohorts = new Map();
  for (const trade of candidates) {
    const anchor = inferredAnchor(trade);
    if (anchor) cohorts.set(anchor, (cohorts.get(anchor) || 0) + 1);
  }
  const winner = [...cohorts.entries()].sort((a, b) => b[1] - a[1])[0];
  // A lone record or competing/tied date cohorts do not establish provenance.
  return winner && winner[1] >= 2 && winner[1] > candidates.length / 2 ? winner[0] : null;
}

function survivingReferences(state) {
  const accounts = new Set(), rules = new Set(), seen = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (typeof value.accountId === 'string') accounts.add(value.accountId);
    if (value.checklist && typeof value.checklist === 'object' && !Array.isArray(value.checklist)) {
      for (const id of Object.keys(value.checklist)) rules.add(id);
    }
    for (const child of Object.values(value)) visit(child);
  }
  // Keep account links in future/custom metadata as well as the current record
  // collections. Account definitions themselves are not dependent records.
  for (const [key, value] of Object.entries(state)) if (key !== 'accounts' && key !== 'rules') visit(value);
  return { accounts, rules };
}

/** Remove only untouched legacy examples; never reset an existing personal diary. */
export function migrateWorkspace(input) {
  const state = structuredClone(input);
  const result = { state, changed: false, removedTrades: 0, removedAccounts: 0, removedRules: 0 };
  if (!state || state.mode !== 'demo' || state.settings?.emptyStartVersion >= 1) return result;

  const anchor = commonAnchor(state.trades || []);
  const fixture = createDemoState(new Date(anchor || '2026-01-01T14:00:00.000Z'));
  const originalTrades = new Map(fixture.trades.map(trade => [trade.id, trade]));
  if (anchor) {
    state.trades = (state.trades || []).filter(trade => {
      const original = originalTrades.get(trade.id);
      if (!original || !exactlyEqual(trade, original)) return true;
      result.removedTrades++;
      return false;
    });
  }

  const references = survivingReferences(state);
  const originalAccounts = new Map([...fixture.accounts, legacyPersonalAccount].map(account => [account.id, account]));
  state.accounts = (state.accounts || []).filter(account => {
    const original = originalAccounts.get(account.id);
    if (!original || references.accounts.has(account.id) || !exactlyEqual(account, original)) return true;
    result.removedAccounts++;
    return false;
  });
  const originalRules = new Map(fixture.rules.map(rule => [rule.id, rule]));
  state.rules = (state.rules || []).filter(rule => {
    const original = originalRules.get(rule.id);
    if (!original || references.rules.has(rule.id) || !exactlyEqual(rule, original)) return true;
    result.removedRules++;
    return false;
  });

  if (!state.accounts.length) state.accounts = structuredClone(createEmptyState().accounts);
  state.mode = 'personal';
  // Mode is the idempotency boundary. Preferences and arbitrary metadata retain
  // their original contents; an external migration marker is also respected.
  result.changed = true;
  return result;
}
