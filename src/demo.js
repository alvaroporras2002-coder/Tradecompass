// Deterministic, internally consistent sample data. Never connected to a broker.
const rules = () => [
  { id: 'plan', text: 'La entrada coincide con mi estrategia.', strategy: '' },
  { id: 'risk', text: 'Riesgo máximo del 1 % por operación.', strategy: '' },
  { id: 'stop', text: 'Stop loss definido antes de entrar.', strategy: '' },
  { id: 'news', text: 'Revisé el calendario económico.', strategy: '' },
  { id: 'emotion', text: 'Operé con calma y sin recuperar pérdidas.', strategy: '' },
];
export function createEmptyState() {
  return {
    version: 1, mode: 'personal', accounts: [{ id: 'account-personal', name: 'Mi cuenta', currency: 'USD', initialBalance: 10000, platform: 'MetaTrader 5', timezone: 'America/Costa_Rica', type: 'demo', archived: false }],
    trades: [], rules: rules(), reviews: [], imports: [], cashflows: [],
    settings: { language: 'es', timezone: 'America/Costa_Rica', name: 'Trader' },
  };
}
export function createDemoState() {
  const state = createEmptyState();
  state.mode = 'demo';
  state.accounts = [
    { id: 'account-main', name: 'Cuenta principal', currency: 'USD', initialBalance: 10000, platform: 'MetaTrader 5', timezone: 'America/Costa_Rica', type: 'demo', archived: false },
    { id: 'account-lab', name: 'Práctica · Swing', currency: 'USD', initialBalance: 5000, platform: 'MetaTrader 5', timezone: 'America/Costa_Rica', type: 'demo', archived: false },
  ];
  const symbols = ['EURUSD', 'XAUUSD', 'GBPUSD', 'NAS100', 'USDJPY'];
  const basePrices = [1.0824, 2650, 1.2936, 20450, 152.38];
  const steps = [0.001, 2, 0.001, 10, 0.1];
  const strategies = ['Pullback H1', 'Ruptura de sesión', 'Reversión en rango'];
  const outcomes = [1.8, -1, 2.2, 1.35, -1, 2.6, 0, -1, 1.6, 2.1, -1, 1.45, -1, 2.8, 1.2, -1, 1.7, 2.3];
  const now = new Date();
  now.setUTCHours(14, 0, 0, 0);
  for (let i = 0; i < 48; i++) {
    const symbolIndex = i % symbols.length;
    const accountId = i % 6 === 0 ? 'account-lab' : 'account-main';
    const risk = accountId === 'account-main' ? 75 + (i % 3) * 10 : 40;
    const ratio = outcomes[i % outcomes.length];
    const intendedGross = Math.round(risk * ratio * 100) / 100;
    const commission = -(i % 3 === 0 ? 3.5 : 2.4);
    const swap = i % 11 === 0 ? -1.2 : 0;
    const opened = new Date(now.getTime() - (Math.floor((47 - i) / 2) + 1) * 86400000 + (i % 2) * 3 * 3600000);
    const exit = new Date(opened.getTime() + (35 + i % 90) * 60000);
    const side = i % 3 === 0 ? 'sell' : 'buy';
    const entry = basePrices[symbolIndex] + (i % 7) * steps[symbolIndex];
    const precision = symbolIndex === 0 || symbolIndex === 2 ? 5 : 2;
    const volume = symbolIndex === 1 ? 0.1 : symbolIndex === 3 ? 2 : 0.25;
    const contract = symbolIndex === 1 ? 100 : symbolIndex === 3 ? 1 : 100000;
    const direction = side === 'buy' ? 1 : -1;
    const priceForProfit = amount => symbolIndex === 4 ? entry / (1 - amount / (direction * volume * contract)) : entry + amount / (direction * volume * contract);
    const exitPrice = Number(priceForProfit(intendedGross).toFixed(precision));
    const gross = Math.round((exitPrice - entry) * direction * volume * contract / (symbolIndex === 4 ? exitPrice : 1) * 100) / 100;
    const compliant = i % 7 !== 0;
    state.trades.push({
      id: `demo-trade-${i + 1}`, accountId, symbol: symbols[symbolIndex], side, status: 'closed',
      openedAt: opened.toISOString(), closedAt: exit.toISOString(),
      entry: Number(entry.toFixed(precision)), exit: exitPrice,
      volume, gross, commission, swap, risk,
      stopLoss: Number(priceForProfit(-risk).toFixed(precision)),
      takeProfit: Number(priceForProfit(risk * 3).toFixed(precision)),
      strategy: strategies[i % strategies.length], tags: i % 2 ? ['Nueva York', 'Plan respetado'] : ['Londres', ratio < 0 ? 'Revisar entrada' : 'Paciencia'],
      reason: ratio >= 0 ? 'Confirmación en zona de interés y cierre de vela a favor.' : 'Entrada en nivel definido; el precio alcanzó el stop inicial.',
      notes: compliant ? 'Esperé la confirmación. Mantuve el riesgo previsto y documenté la salida.' : 'Entré antes del cierre de vela. Revisar este patrón en la sesión semanal.',
      emotionBefore: i % 7 === 0 ? 'Impaciencia' : 'Calma', emotionDuring: ratio < 0 ? 'Atención' : 'Concentración', emotionAfter: ratio < 0 ? 'Aceptación' : 'Satisfacción',
      lesson: compliant ? 'La calidad del proceso es más importante que una sola operación.' : 'Esperar el cierre de la vela antes de confirmar la entrada.',
      checklist: { plan: compliant ? 'yes' : 'no', risk: 'yes', stop: 'yes', news: i % 9 === 0 ? 'no' : 'yes', emotion: compliant ? 'yes' : 'no' },
      attachments: [], source: 'manual', sourceId: '', batchId: null,
    });
  }
  const last = new Date(now.getTime() - 2 * 3600000);
  state.trades.push({ id: 'demo-open-1', accountId: 'account-main', symbol: 'EURUSD', side: 'buy', status: 'open', openedAt: last.toISOString(), closedAt: '', entry: 1.0872, exit: null, volume: 0.2, gross: 0, commission: 0, swap: 0, risk: 80, strategy: 'Pullback H1', tags: ['En seguimiento'], reason: 'Retroceso hacia la media y confirmación pendiente.', notes: 'Operación de ejemplo abierta; no se incluye en resultados realizados.', emotionBefore: 'Calma', emotionDuring: '', emotionAfter: '', lesson: '', checklist: { plan: 'yes', risk: 'yes', stop: 'yes', news: 'yes', emotion: 'yes' }, attachments: [], source: 'manual', sourceId: '', batchId: null });
  return state;
}
