import { net, metrics } from '../domain.js';

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const guard = (ctx, handler) => async event => {
  try { await handler(event); }
  catch (error) {
    ctx.toast(error?.message || ctx.t('No se pudo guardar. Vuelve a intentarlo.', 'Could not save. Try again.'));
    if (event?.currentTarget) event.currentTarget.disabled = false;
  }
};
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const closed = trades => (trades || []).filter(trade => trade.status === 'closed');
const signClass = value => value < 0 ? 'negative' : value > 0 ? 'positive' : '';
const weekStart = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateKey = (input, timezone) => {
  const date = new Date(input);
  if (Number.isNaN(date.valueOf())) return '';
  try {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    return `${p.find(x => x.type === 'year').value}-${p.find(x => x.type === 'month').value}-${p.find(x => x.type === 'day').value}`;
  } catch { return date.toISOString().slice(0, 10); }
};
const fmt = (n, digits = 1) => Number.isFinite(Number(n)) ? Number(n).toFixed(digits) : '—';
const title = (ctx, kicker, heading, description) => `<div class="page-intro"><div><p class="eyebrow">${kicker}</p><h1>${heading}</h1><p class="muted">${description}</p></div></div>`;
const empty = (ctx, heading, detail) => `<div class="empty-state"><span class="insight-empty-icon">${ctx.icon('analytics', 28)}</span><h3>${heading}</h3><p class="muted">${detail}</p><button class="btn btn-primary" data-insight-journal>${ctx.t('Ir al diario', 'Open journal')}</button></div>`;

export function equityChart(ctx, points, options = {}) {
  const width = 760, height = options.height || 230;
  const values = (points || []).map(point => finite(point.value ?? point));
  if (!values.length) return `<div class="insight-chart-placeholder muted">${ctx.t('La curva aparecerá al cerrar tu primera operación.', 'Your curve appears after your first closed trade.')}</div>`;
  if (values.length === 1) values.unshift(finite(options.initial ?? values[0]));
  const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(1, Math.abs(max) * .02);
  const left = 14, right = 14, top = 22, bottom = 28;
  const coords = values.map((value, index) => [left + index * (width - left - right) / (values.length - 1), top + (max - value) / span * (height - top - bottom)]);
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0]},${height - bottom} L${left},${height - bottom} Z`;
  const id = options.id || 'equity-insights';
  const chartLabel = `${ctx.t('Curva del saldo realizado', 'Realized balance curve')}: ${ctx.money(values[0])} → ${ctx.money(values.at(-1))}. ${ctx.t('Mínimo', 'Minimum')}: ${ctx.money(min)}. ${ctx.t('Máximo', 'Maximum')}: ${ctx.money(max)}.`;
  return `<div class="insight-chart-wrap"><svg class="insight-equity" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ctx.esc(chartLabel)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#C1FF5E" stop-opacity=".23"/><stop offset="100%" stop-color="#C1FF5E" stop-opacity="0"/></linearGradient></defs>${[0, 1, 2, 3].map(i => `<line x1="${left}" x2="${width - right}" y1="${top + i * (height - top - bottom) / 3}" y2="${top + i * (height - top - bottom) / 3}" stroke="currentColor" class="insight-gridline" stroke-dasharray="3 6"/>`).join('')}<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="#C1FF5E" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${coords.at(-1)[0]}" cy="${coords.at(-1)[1]}" r="4" fill="#C1FF5E" stroke="#1C2023" stroke-width="3"/></svg><div class="insight-chart-axis"><span>${ctx.t('Inicio del periodo', 'Period start')}</span><span>${ctx.t('Última operación', 'Latest trade')}</span></div></div>`;
}

function groupRows(ctx, rows, key, fallback) {
  const grouped = new Map();
  for (const trade of rows) {
    const name = key(trade) || fallback;
    const item = grouped.get(name) || {name, pnl: 0, count: 0, wins: 0};
    item.pnl += net(trade); item.count++; item.wins += net(trade) > 0 ? 1 : 0;
    grouped.set(name, item);
  }
  const all = [...grouped.values()].sort((a, b) => b.pnl - a.pnl);
  const maximum = Math.max(1, ...all.map(item => Math.abs(item.pnl)));
  return all.map(item => `<div class="insight-bar-row"><div class="insight-bar-meta"><strong>${ctx.esc(item.name)}</strong><span class="${signClass(item.pnl)}">${ctx.money(item.pnl)}</span></div><div class="insight-bar-track"><span class="${item.pnl < 0 ? 'is-loss' : ''}" style="width:${Math.max(2, Math.abs(item.pnl) / maximum * 100)}%"></span></div><div class="insight-bar-detail"><span>${item.count} ${ctx.t('operaciones', 'trades')}</span><span>${fmt(item.wins / item.count * 100, 0)}% ${ctx.t('acierto', 'win rate')}</span></div></div>`).join('');
}

export function renderAnalytics(ctx) {
  const {t, money} = ctx;
  const rows = closed(ctx.trades);
  const m = ctx.stats || metrics(rows, ctx.account?.initialBalance || 0);
  const heading = title(ctx, t('DE LOS DATOS A LAS DECISIONES', 'FROM DATA TO DECISIONS'), t('Estadísticas', 'Statistics'), t('Entiende tus resultados. Identifica lo que merece repetirse.', 'Understand your results. Find what deserves repeating.'));
  if (!rows.length) return heading + `<section class="card">${empty(ctx, t('Tu historial empieza aquí', 'Your history starts here'), t('Registra o importa operaciones cerradas para analizar resultados reales.', 'Log or import closed trades to analyze your results.'))}</section>`;
  const strategyRows = groupRows(ctx, rows, row => row.strategy, t('Sin estrategia', 'No strategy'));
  const symbolRows = groupRows(ctx, rows, row => row.symbol, t('Sin activo', 'No symbol'));
  const days = new Map();
  for (const trade of rows) {
    const key = dateKey(trade.closedAt || trade.openedAt, ctx.account?.timezone || ctx.state.settings?.timezone);
    days.set(key, (days.get(key) || 0) + net(trade));
  }
  const lastDate = new Date();
  lastDate.setHours(12, 0, 0, 0);
  const calendar = Array.from({length: 35}, (_, i) => {
    const date = new Date(lastDate); date.setDate(date.getDate() - (34 - i));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const value = days.get(key), present = value !== undefined;
    return `<div class="insight-calendar-cell ${present ? value > 0 ? 'is-win' : value < 0 ? 'is-loss' : 'is-flat' : ''}" title="${key}: ${present ? money(value) : t('Sin operaciones', 'No trades')}" aria-label="${key}: ${present ? money(value) : t('Sin operaciones', 'No trades')}"><span>${date.getDate()}</span><small>${present ? value > 0 ? '+' : value < 0 ? '−' : '·' : ''}</small></div>`;
  }).join('');
  const profitFactor = m.profitFactor === Infinity ? '∞' : m.profitFactor === null || m.profitFactor === undefined ? '—' : fmt(m.profitFactor, 2);
  const avgR = m.avgR === null || m.avgR === undefined ? '—' : `${fmt(m.avgR, 2)}R`;
  const riskCount = rows.filter(row => finite(row.risk) > 0).length;
  return `${heading}<div class="insight-context"><span class="pill">${ctx.esc(ctx.account?.name || '')}</span><span>${ctx.esc(ctx.account?.currency || 'USD')} · ${rows.length} ${t('operaciones cerradas', 'closed trades')}</span><span>${t('Resultado después de comisiones y swap', 'Result after commissions and swap')}</span></div>
  <div class="grid-3 insight-metric-grid">
    <article class="card stat-card"><span class="muted">${t('Profit factor', 'Profit factor')}</span><strong>${profitFactor}</strong><small class="muted">${t('Ganancias netas / pérdidas netas absolutas', 'Net wins / absolute net losses')}</small></article>
    <article class="card stat-card"><span class="muted">${t('Expectativa por operación', 'Expectancy per trade')}</span><strong class="${signClass(m.expectancy)}">${money(finite(m.expectancy))}</strong><small class="muted">${t('Promedio neto de la muestra', 'Net sample average')}</small></article>
    <article class="card stat-card"><span class="muted">${t('Drawdown realizado', 'Realized drawdown')}</span><strong class="negative">${money(finite(m.maxDrawdown))}</strong><small class="muted">${fmt(m.maxDrawdownPct, 2)}% · ${t('del máximo al mínimo', 'from peak to trough')}</small></article>
  </div>
  <section class="card insight-chart-card"><div class="card-head"><div><p class="eyebrow">${t('TU RECORRIDO', 'YOUR JOURNEY')}</p><h2>${t('Curva de resultados', 'Performance curve')}</h2></div><div class="insight-chart-value ${signClass(m.net)}">${money(finite(m.net))}<small class="muted">${t('neto en el periodo', 'net in period')}</small></div></div>${equityChart(ctx, m.equity || [], {initial: ctx.account?.initialBalance})}<p class="insight-note muted">${t('Saldo realizado: no incluye posiciones abiertas ni pérdidas flotantes. El drawdown se calcula sobre la secuencia completa de la cuenta para el periodo seleccionado.', 'Realized balance: excludes open positions and floating losses. Drawdown uses the account balance sequence for the selected period.')}</p></section>
  <div class="grid-2"><section class="card"><div class="card-head"><h2>${t('Por estrategia', 'By strategy')}</h2><span class="pill">${t('Resultado neto', 'Net result')}</span></div>${strategyRows}</section><section class="card"><div class="card-head"><h2>${t('Por activo', 'By symbol')}</h2><span class="pill">${rows.length} ${t('cerradas', 'closed')}</span></div>${symbolRows}</section></div>
  <div class="grid-2"><section class="card"><div class="card-head"><div><h2>${t('Calendario de actividad', 'Activity calendar')}</h2><p class="muted">${t('Últimos 35 días · según el filtro actual', 'Last 35 days · current filter applied')}</p></div></div><div class="insight-calendar">${calendar}</div><div class="insight-calendar-legend"><span><i class="gain-dot"></i>${t('Ganancia', 'Profit')}</span><span><i class="loss-dot"></i>${t('Pérdida', 'Loss')}</span><span><i></i>${t('Sin actividad', 'No activity')}</span></div></section>
  <section class="card"><div class="card-head"><h2>${t('La calidad del resultado', 'The quality of results')}</h2></div><dl class="insight-definition-list"><div><dt>${t('Ganancia media', 'Average win')}</dt><dd class="positive">${money(finite(m.avgWin))}</dd></div><div><dt>${t('Pérdida media', 'Average loss')}</dt><dd class="negative">${money(finite(m.avgLoss))}</dd></div><div><dt>${t('R medio documentado', 'Documented average R')}</dt><dd>${avgR}</dd></div><div><dt>${t('Muestra con riesgo inicial', 'Trades with initial risk')}</dt><dd>${riskCount} / ${rows.length}</dd></div><div><dt>${t('Mejor racha ganadora', 'Longest winning streak')}</dt><dd>${finite(m.bestStreak)} ${t('operaciones', 'trades')}</dd></div><div><dt>${t('Mayor racha perdedora', 'Longest losing streak')}</dt><dd>${finite(m.worstStreak)} ${t('operaciones', 'trades')}</dd></div></dl></section></div>`;
}

function ruleStats(ctx) {
  let possible = 0, answered = 0, yes = 0;
  const failures = new Map();
  for (const trade of ctx.trades || []) {
    for (const rule of ctx.state.rules || []) {
      if (rule.strategy && !['*', 'all'].includes(rule.strategy) && rule.strategy !== trade.strategy) continue;
      possible++;
      const result = trade.checklist?.[rule.id];
      if (['yes', 'no', 'na'].includes(result)) answered++;
      if (result === 'yes') yes++;
      if (result === 'no') failures.set(rule.id, (failures.get(rule.id) || 0) + 1);
    }
  }
  const applicable = (ctx.trades || []).reduce((count, trade) => count + (ctx.state.rules || []).filter(rule => (!rule.strategy || ['*', 'all'].includes(rule.strategy) || rule.strategy === trade.strategy) && ['yes', 'no'].includes(trade.checklist?.[rule.id])).length, 0);
  return {possible, answered, yes, applicable, coverage: possible ? answered / possible * 100 : 0, score: applicable ? yes / applicable * 100 : null, failures: [...failures].sort((a, b) => b[1] - a[1])};
}

export function renderDiscipline(ctx) {
  const {t, esc} = ctx, s = ruleStats(ctx), rules = ctx.state.rules || [];
  const strategies = [...new Set((ctx.trades || []).map(row => row.strategy).filter(Boolean))];
  return `${title(ctx, t('CONSISTENCIA ANTES QUE RESULTADOS', 'CONSISTENCY BEFORE RESULTS'), t('Tu plan. Tus reglas.', 'Your plan. Your rules.'), t('Evalúa cómo operas, además de cuánto ganas.', 'Evaluate how you trade, as well as how much you earn.'))}
  <div class="grid-3 insight-metric-grid"><article class="card stat-card"><span class="muted">${t('Cumplimiento', 'Compliance')}</span><strong class="positive">${s.score === null ? '—' : `${fmt(s.score, 0)}%`}</strong><small class="muted">${s.yes} / ${s.applicable} ${t('respuestas aplicables', 'applicable answers')}</small></article><article class="card stat-card"><span class="muted">${t('Cobertura de evaluación', 'Evaluation coverage')}</span><strong>${fmt(s.coverage, 0)}%</strong><small class="muted">${s.answered} / ${s.possible} ${t('reglas evaluadas', 'rules evaluated')}</small></article><article class="card stat-card"><span class="muted">${t('Reglas en tu plan', 'Rules in your plan')}</span><strong>${rules.length}</strong><small class="muted">${t('Globales y por estrategia', 'Global and strategy specific')}</small></article></div>
  <div class="grid-2"><section class="card"><div class="card-head"><div><p class="eyebrow">${t('CHECKLIST DE OPERACIÓN', 'TRADE CHECKLIST')}</p><h2>${t('Tu proceso', 'Your process')}</h2></div><button class="btn btn-primary btn-small" data-insight-add-rule>${ctx.icon('plus', 16)} ${t('Añadir', 'Add')}</button></div><p class="insight-note muted">${t('Responde cada checklist desde el detalle de una operación: cumplida, incumplida o no aplicable. Las respuestas pendientes no se cuentan como cumplidas.', 'Complete the checklist in a trade detail: passed, failed or not applicable. Unanswered rules do not count as passed.')}</p><div class="insight-rule-list">${rules.length ? rules.map((rule, i) => `<article class="insight-rule"><span class="insight-rule-index">${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(rule.text)}</strong><small class="muted">${!rule.strategy || ['*', 'all'].includes(rule.strategy) ? t('Todas las estrategias', 'All strategies') : esc(rule.strategy)}</small></div><button class="btn btn-ghost icon-button" aria-label="${t('Editar regla', 'Edit rule')}" data-insight-edit-rule="${esc(rule.id)}">${ctx.icon('edit', 17)}</button><button class="btn btn-ghost icon-button" aria-label="${t('Eliminar regla', 'Delete rule')}" data-insight-delete-rule="${esc(rule.id)}">${ctx.icon('trash', 17)}</button></article>`).join('') : `<div class="empty-state"><h3>${t('Define tu primera regla', 'Define your first rule')}</h3><p class="muted">${t('Empieza por una condición que puedas evaluar en cada operación.', 'Start with a condition you can evaluate for every trade.')}</p></div>`}</div><div class="insight-rule-example"><span>${ctx.icon('shield', 19)}</span><p>${t('Una buena regla es observable: «Definí el stop antes de entrar» permite una respuesta clara.', 'A useful rule is observable: “I defined the stop before entering” allows a clear answer.')}</p></div></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">${t('OPORTUNIDADES DE MEJORA', 'ROOM TO IMPROVE')}</p><h2>${t('Faltas frecuentes', 'Frequent rule breaks')}</h2></div></div>${s.failures.length ? s.failures.map(([id, count]) => `<div class="insight-failure"><span class="insight-failure-count">${count}</span><div><strong>${esc(rules.find(rule => rule.id === id)?.text || '')}</strong><small class="muted">${count} ${t('evaluaciones incumplidas', 'failed evaluations')}</small></div></div>`).join('') : `<div class="empty-state"><span class="insight-empty-icon">${ctx.icon('check', 28)}</span><h3>${t('Todavía no hay faltas registradas', 'No rule breaks recorded yet')}</h3><p class="muted">${t('La evaluación requiere respuestas. Una cobertura baja no demuestra disciplina.', 'Evaluation requires answers. Low coverage does not prove discipline.')}</p></div>`}<button class="btn btn-ghost insight-full-width" data-insight-review>${t('Llevar a la revisión semanal', 'Take this to the weekly review')} ${ctx.icon('up', 16)}</button></section></div><datalist id="insight-strategies">${strategies.map(name => `<option value="${esc(name)}"></option>`).join('')}</datalist>`;
}

const questionPairs = [
  ['¿Qué hice bien esta semana?', 'What did I do well this week?'],
  ['¿Qué operación representa mejor mi plan y por qué?', 'Which trade best represents my plan, and why?'],
  ['¿Qué error se repitió y qué lo provocó?', 'Which mistake repeated, and what triggered it?'],
  ['¿Cómo influyeron mis emociones?', 'How did my emotions affect my trading?'],
  ['¿Qué muestran los datos frente a mi percepción?', 'What do the data show compared with my perception?'],
  ['¿Qué voy a cambiar en la próxima sesión?', 'What will I change in my next session?'],
];

export function renderReview(ctx) {
  const {t, esc, money} = ctx;
  const reviews = (ctx.state.reviews || []).filter(row => row.accountId === ctx.account?.id).sort((a, b) => b.week.localeCompare(a.week));
  const week = weekStart(), current = reviews.find(row => row.week === week);
  const rows = closed(ctx.state.trades || []).filter(row => row.accountId === ctx.account?.id && weekStart(row.closedAt || row.openedAt) === week);
  const total = rows.reduce((sum, row) => sum + net(row), 0);
  return `${title(ctx, t('CIERRA LA SEMANA CON CLARIDAD', 'CLOSE THE WEEK WITH CLARITY'), t('Pausa. Revisa. Mejora.', 'Pause. Review. Improve.'), t('Convierte tu historial en una acción concreta para la próxima semana.', 'Turn your history into a concrete action for next week.'))}
  <section class="card insight-review-summary"><div><p class="eyebrow">${t('SEMANA DEL', 'WEEK OF')} ${week}</p><h2>${ctx.esc(ctx.account?.name || '')}</h2><span class="muted">${rows.length} ${t('operaciones cerradas', 'closed trades')} · ${ctx.esc(ctx.account?.currency || '')}</span></div><strong class="${signClass(total)}">${money(total)}</strong><span class="pill">${current ? t('Revisión guardada', 'Review saved') : t('Pendiente de revisión', 'Review pending')}</span></section>
  <div class="insight-review-layout"><section class="card"><div class="card-head"><h2>${t('Tu revisión semanal', 'Your weekly review')}</h2><span class="pill">6 ${t('preguntas', 'questions')}</span></div><form data-insight-review-form><input type="hidden" name="reviewId" value="${esc(current?.id || '')}"><label class="field">${t('Inicio de la semana', 'Week start')}<input type="date" name="week" value="${week}" required><small class="muted">${t('Se guardará en la semana que contiene esta fecha.', 'Saved to the week containing this date.')}</small></label>${questionPairs.map((pair, i) => `<label class="field insight-review-question"><span><b>${String(i + 1).padStart(2, '0')}</b>${t(...pair)}</span><textarea name="answer${i}" rows="3" maxlength="2500" placeholder="${t('Escribe una observación concreta…', 'Write a specific observation…')}">${esc(current?.answers?.[i] || '')}</textarea></label>`).join('')}<label class="field insight-review-action"><span>${ctx.icon('target', 18)} ${t('Una acción para la próxima semana', 'One action for next week')}</span><input name="action" required maxlength="300" value="${esc(current?.action || '')}" placeholder="${t('Ej.: Registrar el riesgo antes de cada entrada', 'E.g. Log risk before every entry')}"><small class="muted">${t('Algo concreto y comprobable. Las seis respuestas son opcionales.', 'Make it specific and verifiable. The six answers are optional.')}</small></label><button class="btn btn-primary insight-full-width" type="submit">${ctx.icon('check', 18)} ${t('Guardar revisión', 'Save review')}</button></form></section>
  <aside><section class="card"><p class="eyebrow">${t('TU COMPROMISO', 'YOUR COMMITMENT')}</p><h2>${t('Pequeños cambios, mejor proceso.', 'Small changes, a better process.')}</h2><p class="muted">${t('Evalúa la ejecución de tu plan. Una semana positiva también puede esconder errores; una semana negativa puede contener buenas decisiones.', 'Evaluate how you executed your plan. A positive week can still hide mistakes; a negative week can contain sound decisions.')}</p><button class="btn btn-ghost insight-full-width" data-insight-discipline>${t('Revisar mis reglas', 'Review my rules')} ${ctx.icon('up', 16)}</button></section><section class="card insight-review-history"><div class="card-head"><h2>${t('Revisiones guardadas', 'Saved reviews')}</h2><span class="pill">${reviews.length}</span></div>${reviews.length ? reviews.map(row => `<article class="insight-saved-review"><div class="insight-saved-review-top"><span class="eyebrow">${t('SEMANA', 'WEEK')} ${esc(row.week)}</span><button class="btn btn-ghost icon-button" data-insight-delete-review="${esc(row.id)}" aria-label="${t('Eliminar revisión', 'Delete review')}">${ctx.icon('trash', 16)}</button></div><p>${esc(row.action)}</p><label class="insight-action-check"><input type="checkbox" data-insight-complete-review="${esc(row.id)}" ${row.completed ? 'checked' : ''}><span>${t('Acción completada', 'Action completed')}</span></label><details><summary>${t('Ver respuestas', 'View answers')}</summary>${questionPairs.map((pair, i) => row.answers?.[i] ? `<div class="insight-saved-answer"><strong>${t(...pair)}</strong><p class="muted">${esc(row.answers[i])}</p></div>` : '').join('') || `<p class="muted">${t('Sin respuestas adicionales.', 'No additional answers.')}</p>`}</details><button class="btn btn-ghost insight-full-width" data-insight-edit-review="${esc(row.id)}">${t('Editar revisión', 'Edit review')}</button></article>`).join('') : `<p class="muted">${t('Tu primera revisión aparecerá aquí.', 'Your first review will appear here.')}</p>`}</section></aside></div>`;
}

const robots = [
  {name: 'Trend Navigator', kind: ['Tendencia', 'Trend'], desc: ['Explora reglas para seguir una dirección sostenida del precio.', 'Explore rules that follow a sustained price direction.'], symbol: '↗', rate: .45, reward: 1.8},
  {name: 'Range Explorer', kind: ['Rango', 'Range'], desc: ['Organiza una hipótesis sobre movimientos dentro de un rango.', 'Organize a hypothesis about moves within a range.'], symbol: '↔', rate: .55, reward: 1.15},
  {name: 'Session Breakout', kind: ['Sesiones', 'Sessions'], desc: ['Estructura una idea de ruptura al inicio de una sesión.', 'Structure a breakout idea around the start of a session.'], symbol: '⌁', rate: .4, reward: 2.1},
  {name: 'Momentum Pulse', kind: ['Impulso', 'Momentum'], desc: ['Documenta una hipótesis basada en aceleración del movimiento.', 'Document a hypothesis based on accelerating movement.'], symbol: 'ϟ', rate: .48, reward: 1.5},
  {name: 'Pullback Planner', kind: ['Retroceso', 'Pullback'], desc: ['Estudia un esquema de retroceso dentro de una tendencia.', 'Study a pullback framework within a trend.'], symbol: '⌇', rate: .5, reward: 1.5},
];

export function renderLab(ctx) {
  const {t} = ctx;
  return `${title(ctx, t('EXPLORA CON INTENCIÓN', 'EXPLORE WITH INTENTION'), t('Laboratorio EA', 'EA laboratory'), t('Un espacio para entender hipótesis antes de ponerlas a prueba.', 'A space to understand hypotheses before putting them to the test.'))}
  <section class="insight-lab-banner"><span class="insight-lab-orbit">${ctx.icon('compass', 34)}</span><div><span class="pill">${t('SIMULACIÓN EDUCATIVA', 'EDUCATIONAL SIMULATION')}</span><h2>${t('Ideas claras. Sin ejecución real.', 'Clear ideas. No live execution.')}</h2><p>${t('Cinco conceptos de robots con series matemáticas reproducibles. No están conectados a MT5, no descargan cotizaciones y no realizan backtests ni operaciones.', 'Five robot concepts using reproducible mathematical series. They are not connected to MT5, do not fetch prices, and do not run backtests or execute trades.')}</p></div></section>
  <div class="insight-ea-grid">${robots.map((robot, i) => `<article class="card insight-ea-card"><div class="insight-ea-card-top"><span class="insight-ea-symbol">${robot.symbol}</span><span class="pill">${t(...robot.kind)}</span></div><p class="eyebrow">EA / ${String(i + 1).padStart(2, '0')}</p><h2>${robot.name}</h2><p class="muted">${t(...robot.desc)}</p><div class="insight-ea-meta"><span>${t('Serie sintética', 'Synthetic series')}</span><span>${t('Sin conexión de broker', 'No broker connection')}</span></div><button class="btn btn-ghost insight-full-width" data-insight-open-ea="${i}">${t('Explorar simulación', 'Explore simulation')} ${ctx.icon('up', 17)}</button></article>`).join('')}<article class="card insight-ea-card insight-ea-next"><span class="insight-ea-symbol">${ctx.icon('lab', 27)}</span><p class="eyebrow">${t('EL SIGUIENTE PASO', 'THE NEXT STEP')}</p><h2>${t('De la idea a la evidencia', 'From idea to evidence')}</h2><p class="muted">${t('Un laboratorio real necesita cotizaciones verificadas, costes, reglas de ejecución y validación fuera de muestra. Esta versión explora únicamente el efecto de supuestos.', 'A real laboratory needs verified prices, costs, execution rules and out-of-sample validation. This version only explores the effect of assumptions.')}</p><span class="pill">${t('Ampliación futura', 'Future expansion')}</span></article></div>`;
}

function ruleModal(ctx, rule) {
  const {t, esc} = ctx;
  ctx.modal(`<form data-insight-rule-form><p class="eyebrow">${t('DISCIPLINA', 'DISCIPLINE')}</p><h2>${rule ? t('Editar regla', 'Edit rule') : t('Añadir una regla', 'Add a rule')}</h2><label class="field">${t('Condición que vas a evaluar', 'Condition to evaluate')}<textarea name="text" rows="3" maxlength="300" required autofocus placeholder="${t('Definí el stop antes de entrar', 'I defined my stop before entering')}">${esc(rule?.text || '')}</textarea></label><label class="field">${t('Estrategia (opcional)', 'Strategy (optional)')}<input name="strategy" list="insight-strategies" maxlength="100" value="${esc(['*', 'all'].includes(rule?.strategy) ? '' : rule?.strategy || '')}" placeholder="${t('Todas las estrategias', 'All strategies')}"><small class="muted">${t('Déjalo vacío para aplicar la regla a todas las operaciones.', 'Leave blank to apply this rule to all trades.')}</small></label><div class="insight-modal-actions"><button type="button" class="btn btn-ghost" data-insight-cancel>${t('Cancelar', 'Cancel')}</button><button type="submit" class="btn btn-primary">${t('Guardar regla', 'Save rule')}</button></div></form>`, () => {
    document.querySelector('[data-insight-cancel]')?.addEventListener('click', () => ctx.closeModal());
    document.querySelector('[data-insight-rule-form]')?.elements.text.addEventListener('input', event => event.target.setCustomValidity(''));
    document.querySelector('[data-insight-rule-form]')?.addEventListener('submit', guard(ctx, async event => {
      event.preventDefault();
      const form = event.currentTarget, data = new FormData(form);
      const text = String(data.get('text') || '').trim(), strategy = String(data.get('strategy') || '').trim();
      if (!text) {form.elements.text.setCustomValidity(t('Escribe una regla.', 'Enter a rule.')); form.reportValidity(); return;}
      await ctx.update(state => {
        state.rules ||= [];
        if (rule) { const index = state.rules.findIndex(item => item.id === rule.id); if (index >= 0) state.rules[index] = {...state.rules[index], text, strategy}; }
        else state.rules.push({id: uid(), text, strategy});
      });
      ctx.closeModal(); ctx.toast(t('Regla guardada', 'Rule saved'));
    }));
  });
}

function confirmAction(ctx, heading, body, action) {
  ctx.modal(`<h2>${heading}</h2><p class="muted">${body}</p><div class="insight-modal-actions"><button class="btn btn-ghost" data-insight-cancel>${ctx.t('Cancelar', 'Cancel')}</button><button class="btn btn-danger" data-insight-confirm>${ctx.t('Eliminar', 'Delete')}</button></div>`, () => {
    document.querySelector('[data-insight-cancel]')?.addEventListener('click', () => ctx.closeModal());
    document.querySelector('[data-insight-confirm]')?.addEventListener('click', guard(ctx, async event => {const button = event.currentTarget; button.disabled = true; try { await action(); ctx.closeModal(); } finally { button.disabled = false; }}));
  });
}

function showEa(ctx, index) {
  const robot = robots[index]; if (!robot) return;
  const {t} = ctx;
  ctx.modal(`<div class="insight-ea-modal"><span class="pill">${t('SIMULACIÓN EDUCATIVA', 'EDUCATIONAL SIMULATION')}</span><h2>${robot.name}</h2><p class="muted">${t(...robot.desc)}</p><p class="insight-note">${t('Serie sintética fija. No representa precios, rentabilidad histórica ni predicciones. Saldo inicial hipotético: 10 000 USD.', 'Fixed synthetic series. Does not represent prices, historical performance or predictions. Hypothetical initial balance: USD 10,000.')}</p><div class="form-grid"><label class="field">${t('Riesgo por evento', 'Risk per event')} <output data-insight-risk-label>0.50%</output><input aria-label="${t('Riesgo por evento', 'Risk per event')}" data-insight-risk type="range" min="0.1" max="2" step="0.1" value="0.5"></label><label class="field">${t('Eventos sintéticos', 'Synthetic events')} <output data-insight-count-label>80</output><input aria-label="${t('Eventos sintéticos', 'Synthetic events')}" data-insight-count type="range" min="20" max="200" step="10" value="80"></label></div><div class="insight-ea-assumptions"><span>${t('Probabilidad supuesta', 'Assumed probability')}: ${fmt(robot.rate * 100, 0)}%</span><span>${t('Resultado positivo supuesto', 'Assumed positive result')}: ${robot.reward}R</span><span>${t('Resultado negativo supuesto', 'Assumed negative result')}: −1R</span></div><div data-insight-sim-result aria-live="polite"></div><p class="muted insight-note">${t('El modelo arriesga un porcentaje del saldo después de cada evento y omite costes. El resultado cambia con los supuestos; no evalúa ningún robot real.', 'The model risks a percentage of the balance after each event and excludes costs. Results change with assumptions; this does not evaluate a real robot.')}</p><button class="btn btn-ghost insight-full-width" data-insight-cancel>${t('Cerrar simulación', 'Close simulation')}</button></div>`, () => {
    const riskInput = document.querySelector('[data-insight-risk]'), countInput = document.querySelector('[data-insight-count]');
    const run = () => {
      const risk = Number(riskInput.value), count = Number(countInput.value);
      document.querySelector('[data-insight-risk-label]').textContent = `${risk.toFixed(2)}%`;
      document.querySelector('[data-insight-count-label]').textContent = String(count);
      let seed = 1743 + index * 79, balance = 10000, high = balance, drawdown = 0, wins = 0;
      const points = [{value: balance}];
      for (let i = 0; i < count; i++) {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        const win = seed / 4294967296 < robot.rate;
        if (win) wins++;
        balance += balance * risk / 100 * (win ? robot.reward : -1);
        high = Math.max(high, balance); drawdown = Math.max(drawdown, (high - balance) / high * 100);
        points.push({value: balance});
      }
      const usd = value => new Intl.NumberFormat(ctx.state.settings?.language === 'en' ? 'en-US' : 'es-CR', {style: 'currency', currency: 'USD'}).format(value);
      const localCtx = {...ctx, money: usd};
      document.querySelector('[data-insight-sim-result]').innerHTML = `<div class="grid-3 insight-sim-stats"><div><span class="muted">${t('Saldo hipotético final', 'Hypothetical ending balance')}</span><strong class="${signClass(balance - 10000)}">${usd(balance)}</strong></div><div><span class="muted">${t('Drawdown sintético', 'Synthetic drawdown')}</span><strong>${fmt(drawdown, 2)}%</strong></div><div><span class="muted">${t('Eventos positivos', 'Positive events')}</span><strong>${wins} / ${count}</strong></div></div>${equityChart(localCtx, points, {height: 180, id: 'ea-synthetic-gradient'})}`;
    };
    riskInput?.addEventListener('input', run); countInput?.addEventListener('input', run);
    document.querySelector('[data-insight-cancel]')?.addEventListener('click', () => ctx.closeModal());
    run();
  });
}

export function bindInsights(ctx) {
  document.querySelectorAll('[data-insight-journal]').forEach(node => node.addEventListener('click', () => ctx.navigate('journal')));
  document.querySelectorAll('[data-insight-review]').forEach(node => node.addEventListener('click', () => ctx.navigate('review')));
  document.querySelectorAll('[data-insight-discipline]').forEach(node => node.addEventListener('click', () => ctx.navigate('discipline')));
  document.querySelector('[data-insight-add-rule]')?.addEventListener('click', () => ruleModal(ctx));
  document.querySelectorAll('[data-insight-edit-rule]').forEach(node => node.addEventListener('click', () => ruleModal(ctx, ctx.state.rules.find(rule => rule.id === node.dataset.insightEditRule))));
  document.querySelectorAll('[data-insight-delete-rule]').forEach(node => node.addEventListener('click', () => {
    const id = node.dataset.insightDeleteRule;
    confirmAction(ctx, ctx.t('¿Eliminar esta regla?', 'Delete this rule?'), ctx.t('También se eliminarán sus evaluaciones del checklist en el historial. Esta acción no se puede deshacer.', 'Its checklist evaluations will also be removed from the history. This cannot be undone.'), async () => {
      await ctx.update(state => {state.rules = state.rules.filter(rule => rule.id !== id); for (const trade of state.trades) if (trade.checklist) delete trade.checklist[id];});
      ctx.toast(ctx.t('Regla eliminada', 'Rule deleted'));
    });
  }));
  const reviewForm = document.querySelector('[data-insight-review-form]');
  reviewForm?.elements.week.addEventListener('change', () => {
    const chosen = weekStart(`${reviewForm.elements.week.value}T12:00:00`);
    const existing = (ctx.state.reviews || []).find(row => row.accountId === ctx.account?.id && row.week === chosen);
    reviewForm.elements.reviewId.value = existing?.id || '';
    for (let i = 0; i < 6; i++) reviewForm.elements[`answer${i}`].value = existing?.answers?.[i] || '';
    reviewForm.elements.action.value = existing?.action || '';
  });
  reviewForm?.elements.action.addEventListener('input', event => event.target.setCustomValidity(''));
  reviewForm?.addEventListener('submit', guard(ctx, async event => {
    event.preventDefault();
    if (!ctx.account) {ctx.toast(ctx.t('Crea una cuenta primero.', 'Create an account first.')); return;}
    const data = new FormData(reviewForm), rawWeek = String(data.get('week'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawWeek)) return;
    const week = weekStart(`${rawWeek}T12:00:00`), action = String(data.get('action') || '').trim();
    if (!action) {reviewForm.elements.action.setCustomValidity(ctx.t('Escribe una acción concreta.', 'Enter a concrete action.')); reviewForm.reportValidity(); return;}
    reviewForm.elements.action.setCustomValidity('');
    const answers = questionPairs.map((_, i) => String(data.get(`answer${i}`) || '').trim());
    await ctx.update(state => {
      state.reviews ||= [];
      const existing = state.reviews.find(row => row.accountId === ctx.account.id && row.week === week);
      if (existing) Object.assign(existing, {answers, action, updatedAt: new Date().toISOString()});
      else state.reviews.push({id: uid(), accountId: ctx.account.id, week, answers, action, completed: false, createdAt: new Date().toISOString()});
    });
    ctx.toast(ctx.t('Revisión guardada', 'Review saved'));
  }));
  document.querySelectorAll('[data-insight-complete-review]').forEach(node => node.addEventListener('change', guard(ctx, async () => {
    const id = node.dataset.insightCompleteReview, value = node.checked;
    await ctx.update(state => {const row = state.reviews?.find(review => review.id === id); if (row) row.completed = value;});
    ctx.toast(ctx.t(value ? 'Acción completada' : 'Acción pendiente', value ? 'Action completed' : 'Action pending'));
  })));
  document.querySelectorAll('[data-insight-delete-review]').forEach(node => node.addEventListener('click', () => {
    const id = node.dataset.insightDeleteReview;
    confirmAction(ctx, ctx.t('¿Eliminar esta revisión?', 'Delete this review?'), ctx.t('Se eliminarán sus respuestas y su acción de mejora. Las operaciones se conservarán.', 'Its answers and improvement action will be removed. Trades will remain.'), async () => {
      await ctx.update(state => {state.reviews = state.reviews.filter(review => review.id !== id);});
      ctx.toast(ctx.t('Revisión eliminada', 'Review deleted'));
    });
  }));
  document.querySelectorAll('[data-insight-edit-review]').forEach(node => node.addEventListener('click', () => {
    const row = ctx.state.reviews?.find(review => review.id === node.dataset.insightEditReview);
    const form = document.querySelector('[data-insight-review-form]');
    if (!row || !form) return;
    form.elements.reviewId.value = row.id; form.elements.week.value = row.week; form.elements.action.value = row.action;
    for (let i = 0; i < 6; i++) form.elements[`answer${i}`].value = row.answers?.[i] || '';
    form.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    form.elements.action.focus({preventScroll: true});
  }));
  document.querySelectorAll('[data-insight-open-ea]').forEach(node => node.addEventListener('click', () => showEa(ctx, Number(node.dataset.insightOpenEa))));
}
