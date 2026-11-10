import { validExtensions } from './extensions.js';
// Pure journal calculations. Costs are signed: commissions paid are negative.
export { parseMT5 } from './importer.js';
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const net = trade => round(number(trade.gross) + number(trade.commission) + number(trade.swap));
const closed = trade => trade.status === 'closed';
const timestamp = trade => trade.closedAt || trade.openedAt || '';

export function filterTrades(state, options = {}) {
  const { accountId, period = 'all', search = '', side = '', result = '', strategy = '' } = options;
  // Never aggregate currencies or accounts implicitly.
  if (!accountId) return [];
  const now = Date.now();
  const since = period === 'week' ? now - 7 * 86400000 : period === 'month' ? now - 30 * 86400000 : -Infinity;
  const query = search.trim().toLocaleLowerCase();
  return state.trades.filter(trade => {
    if (trade.accountId !== accountId) return false;
    if (new Date(timestamp(trade)).getTime() < since) return false;
    if (side && side !== 'all' && trade.side !== side) return false;
    if (strategy && strategy !== 'all' && trade.strategy !== strategy) return false;
    if (result === 'win' && (!closed(trade) || net(trade) <= 0)) return false;
    if (result === 'loss' && (!closed(trade) || net(trade) >= 0)) return false;
    if (result === 'open' && closed(trade)) return false;
    if (query && ![trade.symbol, trade.strategy, trade.notes, trade.reason, trade.lesson, ...(trade.tags || [])].join(' ').toLocaleLowerCase().includes(query)) return false;
    return true;
  }).sort((a, b) => timestamp(b).localeCompare(timestamp(a)));
}

export function metrics(trades, initialBalance = 0, cashflows = []) {
  const list = trades.filter(closed).slice().sort((a, b) => timestamp(a).localeCompare(timestamp(b)) || String(a.id).localeCompare(String(b.id)));
  const gains = list.filter(t => net(t) > 0), losses = list.filter(t => net(t) < 0);
  const grossWin = gains.reduce((sum, t) => sum + net(t), 0);
  const grossLoss = losses.reduce((sum, t) => sum + net(t), 0);
  const totalNet = round(grossWin + grossLoss);
  const documentedR = list.filter(t => number(t.risk) > 0).map(t => net(t) / number(t.risk));
  let balance = number(initialBalance), flowTotal = 0, peak = balance;
  let maxDrawdown = 0, maxDrawdownPct = 0, winRun = 0, lossRun = 0, bestStreak = 0, worstStreak = 0;
  const equity = [{ date: list[0] ? timestamp(list[0]) : new Date().toISOString(), value: round(balance), pnl: 0 }];
  const events = [...list.map(trade => ({ date: timestamp(trade), trade })), ...cashflows.map(flow => ({ date: flow.date || flow.timestamp || flow.createdAt || '', flow }))].sort((a, b) => a.date.localeCompare(b.date) || (a.flow ? -1 : 1));
  let cumulative = 0;
  for (const event of events) {
    if (event.flow) {
      const amount = number(event.flow.amount);
      balance += amount;
      flowTotal += amount;
      // Cash transfers are not trading losses or gains; move the high-water mark by the transfer.
      peak += amount;
      continue;
    }
    const value = net(event.trade);
    balance += value;
    cumulative += value;
    peak = Math.max(peak, balance);
    const drawdown = Math.max(0, peak - balance);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak > 0 ? drawdown / peak * 100 : 0);
    if (value > 0) { winRun++; lossRun = 0; } else if (value < 0) { lossRun++; winRun = 0; } else { winRun = 0; lossRun = 0; }
    bestStreak = Math.max(bestStreak, winRun);
    worstStreak = Math.max(worstStreak, lossRun);
    equity.push({ date: event.date, value: round(balance), pnl: round(cumulative) });
  }
  return {
    net: totalNet, closedCount: list.length, wins: gains.length, losses: losses.length,
    winRate: list.length ? gains.length / list.length * 100 : 0,
    profitFactor: grossLoss < 0 ? grossWin / Math.abs(grossLoss) : null,
    expectancy: list.length ? totalNet / list.length : 0,
    avgWin: gains.length ? grossWin / gains.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    maxDrawdown: round(maxDrawdown), maxDrawdownPct,
    avgR: documentedR.length ? documentedR.reduce((sum, value) => sum + value, 0) / documentedR.length : null,
    rCount: documentedR.length, bestStreak, worstStreak, equity,
    balance: round(balance), cashflowTotal: round(flowTotal),
  };
}

export function validateTrade(trade) {
  const errors = {};
  if (!trade.accountId) errors.accountId = 'Selecciona una cuenta.';
  if (typeof trade.symbol !== 'string' || !trade.symbol.trim() || trade.symbol.length > 100) errors.symbol = 'Indica el activo.';
  if (!['buy', 'sell'].includes(trade.side)) errors.side = 'Selecciona compra o venta.';
  if (!['open', 'closed'].includes(trade.status)) errors.status = 'Selecciona el estado.';
  const quick = trade.captureMode === 'quick' && trade.source === 'manual';
  const supplied = value => value !== null && value !== undefined && value !== '';
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  const hasOpened = supplied(trade.openedAt);
  const opened = hasOpened ? new Date(trade.openedAt).getTime() : NaN;
  if ((!quick || trade.status === 'open' || hasOpened) && (typeof trade.openedAt !== 'string' || !Number.isFinite(opened))) errors.openedAt = 'Indica una fecha de apertura válida.';
  if (trade.status === 'closed') {
    const end = new Date(trade.closedAt).getTime();
    if (typeof trade.closedAt !== 'string' || !Number.isFinite(end)) errors.closedAt = 'Indica una fecha de cierre válida.';
    else if (Number.isFinite(opened) && end < opened) errors.closedAt = 'El cierre no puede ser anterior a la apertura.';
    for (const key of ['gross', 'commission', 'swap']) if (trade[key] === '' || trade[key] == null || !Number.isFinite(Number(trade[key]))) errors[key] = 'Indica un importe válido.';
    if ((!quick || supplied(trade.exit)) && !positive(trade.exit)) errors.exit = 'El precio de salida debe ser mayor que cero.';
  }
  if ((!quick || supplied(trade.entry)) && !positive(trade.entry)) errors.entry = 'El precio de entrada debe ser mayor que cero.';
  if ((!quick || supplied(trade.volume)) && !positive(trade.volume)) errors.volume = 'El volumen debe ser mayor que cero.';
  if (quick && trade.status === 'open' && supplied(trade.exit) && !positive(trade.exit)) errors.exit = 'Indica un precio de salida válido.';
  if (trade.risk != null && trade.risk !== '' && !positive(trade.risk)) errors.risk = 'El riesgo debe ser mayor que cero o dejarse vacío.';
  if ((trade.attachments || []).length > 10) errors.attachments = 'El máximo técnico es de diez capturas por operación.';
  return errors;
}

export function compliance(trades, rules) {
  let answered = 0, total = 0, passed = 0, applicable = 0;
  const failures = new Map();
  for (const trade of trades) {
    const relevant = rules.filter(rule => !rule.strategy || rule.strategy === 'all' || rule.strategy === trade.strategy);
    for (const rule of relevant) {
      total++;
      const answer = trade.checklist?.[rule.id];
      if (['yes', 'no', 'na'].includes(answer)) answered++;
      if (answer === 'yes') { passed++; applicable++; }
      if (answer === 'no') { applicable++; const current = failures.get(rule.id) || { id: rule.id, text: rule.text, count: 0 }; current.count++; failures.set(rule.id, current); }
    }
  }
  return { answered, total, coverage: total ? answered / total * 100 : 0, score: applicable ? passed / applicable * 100 : 0, applicable, passed, failures: [...failures.values()].sort((a, b) => b.count - a.count) };
}

const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
export function tradeCSV(trades) {
  const fields = ['id', 'accountId', 'symbol', 'side', 'status', 'openedAt', 'closedAt', 'entry', 'exit', 'volume', 'gross', 'commission', 'swap', 'net', 'risk', 'strategy', 'tags', 'notes', 'reason', 'emotionBefore', 'emotionDuring', 'emotionAfter', 'lesson', 'source', 'sourceId', 'batchId'];
  return '\uFEFF' + [fields.map(csvCell).join(','), ...trades.map(trade => fields.map(field => csvCell(field === 'net' ? net(trade) : field === 'tags' ? (trade.tags || []).join('; ') : trade[field])).join(','))].join('\r\n');
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || data.version !== 1) throw new Error('Copia no compatible: se requiere la versión 1.');
  const limits = {accounts:100,trades:20000,rules:1000,reviews:2000,imports:2000,cashflows:10000};
  for (const [field, limit] of Object.entries(limits)) {
    if (!Array.isArray(data[field]) || data[field].length > limit) throw new Error(`La copia no contiene ${field} válidos.`);
    const ids = new Set();
    for (const record of data[field]) { if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id || record.id.length > 150 || ids.has(record.id)) throw new Error(`Identificador no válido en ${field}.`); ids.add(record.id); }
  }
  if (!['demo', 'personal'].includes(data.mode) || !data.settings || !['es','en'].includes(data.settings.language)) throw new Error('La configuración no es válida.');
  if (!validExtensions(data)) throw new Error('Las preferencias o evaluaciones de la copia no son válidas.');
  const timezone = value => { if (typeof value !== 'string' || !value) return false; try { new Intl.DateTimeFormat('en', { timeZone:value }).format(); return true; } catch { return false; } };
  if (!timezone(data.settings.timezone)) throw new Error('La zona horaria de la copia no es válida.');
  const finite = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const ids = new Set(data.accounts.map(account => account.id));
  for (const account of data.accounts) {
    if (!String(account.name || '').trim() || typeof account.name !== 'string' || account.name.length > 300 || !/^[A-Z]{3}$/.test(account.currency) || !finite(account.initialBalance) || Number(account.initialBalance) < 0 || typeof account.platform !== 'string' || !timezone(account.timezone)) throw new Error('Hay una cuenta no válida.');
  }
  for (const trade of data.trades) {
    if (!ids.has(trade.accountId) || Object.keys(validateTrade(trade)).length || !Array.isArray(trade.tags) || trade.tags.length > 100 || trade.tags.some(tag => typeof tag !== 'string' || !tag || tag.length > 150) || !Array.isArray(trade.attachments)) throw new Error('Hay operaciones no válidas o cuentas desconocidas.');
    if (trade.attachments.some(a => typeof a !== 'object' || typeof a.data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(a.data))) throw new Error('La copia contiene una captura no compatible.');
    if (trade.checklist != null && (typeof trade.checklist !== 'object' || Array.isArray(trade.checklist) || !Object.values(trade.checklist).every(answer=>['yes','no','na',''].includes(answer)))) throw new Error('La copia contiene un checklist no válido.');
  }
  if (data.rules.some(rule=>typeof rule.text !== 'string' || !rule.text || rule.text.length > 2000)) throw new Error('La copia contiene reglas no válidas.');
  if (data.reviews.some(review=>!ids.has(review.accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(review.week) || !validDate(review.week) || !Array.isArray(review.answers) || review.answers.length > 6 || review.answers.some(answer=>typeof answer !== 'string' || answer.length > 3000) || typeof review.action !== 'string' || !review.action || review.action.length > 500)) throw new Error('La copia contiene revisiones no válidas.');
  if (data.imports.some(batch=>!ids.has(batch.accountId) || typeof batch.name !== 'string' || !batch.name || batch.name.length > 1000 || !validDate(batch.createdAt) || !Number.isInteger(batch.count) || batch.count < 0 || !finite(batch.net))) throw new Error('La copia contiene lotes de importación no válidos.');
  if (data.cashflows.some(flow=>!ids.has(flow.accountId) || !finite(flow.amount) || !validDate(flow.date))) throw new Error('La copia contiene movimientos no válidos.');
  return true;
}
