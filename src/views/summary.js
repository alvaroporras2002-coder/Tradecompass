import { net, metrics, compliance } from '../domain.js';
import { curve } from '../ui.js';

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const signedClass = value => value < 0 ? 'negative' : value > 0 ? 'positive' : '';

function periodText(ctx) {
  if (typeof ctx.periodLabel === 'function') return ctx.periodLabel();
  if (ctx.periodLabel) return ctx.periodLabel;
  return ctx.period === 'week' ? ctx.t('Últimos 7 días', 'Last 7 days')
    : ctx.period === 'all' ? ctx.t('Todo el historial', 'All history')
      : ctx.t('Últimos 30 días', 'Last 30 days');
}

function activityRows(ctx, rows) {
  const { t, esc, money, icon, date } = ctx;
  if (!rows.length) return `<div class="empty-state summary-empty-activity">
    ${icon('journal', 28)}<h3>${t('Tu diario empieza aquí', 'Your journal starts here')}</h3>
    <p>${t('Registra una operación para añadir contexto a tus resultados.', 'Log a trade to add context to your results.')}</p>
    <button type="button" class="btn btn-primary" data-new-trade>${icon('plus', 16)} ${t('Registrar operación', 'Log trade')}</button>
  </div>`;
  return `<div class="activity-list">${rows.map(trade => {
    const closed = trade.status === 'closed';
    const value = net(trade);
    return `<button type="button" class="activity-row" data-trade="${esc(trade.id)}" aria-label="${esc(`${t('Ver operación', 'View trade')} ${trade.symbol}`)}">
      <span class="pill ${trade.side === 'buy' ? 'pill-buy' : 'pill-sell'}">${trade.side === 'buy' ? t('Compra', 'Buy') : t('Venta', 'Sell')}</span>
      <span class="activity-description"><strong>${esc(trade.symbol)}</strong><small>${esc(trade.strategy || t('Sin estrategia', 'No strategy'))}</small></span>
      <span class="activity-result ${closed ? signedClass(value) : 'muted'}"><strong>${closed ? money(value) : t('Abierta', 'Open')}</strong><small>${esc(date(trade.closedAt || trade.openedAt))}</small></span>
      ${icon('chevron', 14)}
    </button>`;
  }).join('')}</div>`;
}

function disciplineBlock(ctx, closed, score) {
  const { t, esc, icon } = ctx;
  const percentage = score.applicable ? Math.round(score.score) : 0;
  const relevantRules = ctx.state.rules.slice(0, 3);
  return `<section class="card summary-discipline">
    <div class="card-head"><h2>${t('Disciplina del periodo', 'Discipline this period')}</h2><a href="#discipline" class="summary-card-link">${t('Ver reglas', 'View rules')} ${icon('arrow', 14)}</a></div>
    <div class="discipline-ring">
      <div class="ring" style="--score:${percentage}"><div class="ring-inner"><strong>${score.applicable ? `${percentage}%` : '—'}</strong><small>${t('Cumplimiento', 'Compliance')}</small></div></div>
      <div class="summary-rule-list">${relevantRules.length ? relevantRules.map(rule => {
        const evaluated = compliance(closed, [rule]);
        const followed = evaluated.applicable > 0 && evaluated.score >= 80;
        const shortText = rule.id === 'plan' ? t('Plan', 'Plan') : rule.id === 'risk' ? t('Riesgo', 'Risk') : rule.id === 'emotion' ? t('Emociones', 'Emotions') : rule.text;
        return `<div class="rule-mini ${followed ? 'is-followed' : 'is-unanswered'}"><span class="summary-rule-state">${icon(followed ? 'check' : 'circle', 17)}</span><span title="${esc(rule.text)}">${esc(shortText)}</span></div>`;
      }).join('') : `<p class="muted small">${t('Crea tu primera regla para evaluar tu proceso.', 'Create your first rule to review your process.')}</p>`}</div>
    </div>
    <div class="summary-section-footer"><span class="muted">${t('Checklist respondido', 'Checklist answered')} <strong>${Math.round(score.coverage)}%</strong></span><a href="#discipline">${t('Revisar disciplina', 'Review discipline')} ${icon('arrow', 14)}</a></div>
  </section>`;
}

function reviewBlock(ctx) {
  const { t, esc, icon } = ctx;
  const reviews = ctx.state.reviews.filter(review => review.accountId === ctx.account?.id)
    .slice().sort((a, b) => String(a.createdAt || a.week).localeCompare(String(b.createdAt || b.week)));
  const latest = reviews.at(-1);
  return `<section class="card summary-review">
    <div class="card-head"><h2>${t('Revisión semanal', 'Weekly review')}</h2>${icon('review', 19)}</div>
    ${latest ? `<p class="summary-review-action">${esc(latest.action)}</p><span class="summary-review-state ${latest.completed ? 'positive' : 'muted'}">${icon(latest.completed ? 'check' : 'calendar', 15)} ${latest.completed ? t('Acción completada', 'Action completed') : t('Tu próxima acción de mejora', 'Your next improvement action')}</span>`
      : `<p class="summary-review-action">${t('Observa lo que funcionó. Decide qué vas a mejorar.', 'Review what worked. Decide what to improve.')}</p><p class="muted summary-review-copy">${t('Una revisión, una acción concreta para tu próxima semana.', 'One review, one specific action for your next week.')}</p>`}
    <a href="#review" class="btn btn-ghost full-width">${icon('review', 16)} ${latest ? t('Abrir mi revisión', 'Open my review') : t('Hacer revisión semanal', 'Start weekly review')}</a>
  </section>`;
}

export function renderSummary(ctx) {
  const { state, account, t, esc, icon, money, date } = ctx;
  const trades = ctx.trades || [];
  const closed = trades.filter(trade => trade.status === 'closed');
  const score = compliance(closed, state.rules || []);
  const stats = ctx.stats || metrics(trades, account?.initialBalance || 0);
  const opening = finite(stats.equity?.[0]?.value);
  const returnPct = opening > 0 ? finite(stats.net) / opening * 100 : null;
  const accountTrades = state.trades.filter(trade => trade.accountId === account?.id);
  const accountFlows = (state.cashflows || []).filter(flow => flow.accountId === account?.id);
  const balance = metrics(accountTrades, account?.initialBalance || 0, accountFlows).balance;
  const recent = trades.slice().sort((a, b) => String(b.closedAt || b.openedAt).localeCompare(String(a.closedAt || a.openedAt))).slice(0, 5);
  const period = periodText(ctx);
  const formatPct = number => new Intl.NumberFormat(state.settings.language === 'en' ? 'en-US' : 'es-CR', {maximumFractionDigits: 1, minimumFractionDigits: 1}).format(number) + '%';

  const cards = [
    {
      key: 'result', title: t('Resultado neto', 'Net result'), value: returnPct === null ? money(stats.net) : `${stats.net > 0 ? '+' : ''}${formatPct(returnPct)}`, icon: 'wallet', tone: signedClass(stats.net),
      note: `${money(stats.net)} · ${t('después de costes', 'after costs')}`,
    },
    {
      key: 'discipline', title: t('Disciplina', 'Discipline'), value: score.applicable ? `${Math.round(score.score)}%` : '—', icon: 'shield',
      note: `${Math.round(score.coverage)}% ${t('del checklist respondido', 'of checklist answered')}`,
    },
    {
      key: 'count', title: t('Operaciones', 'Trades'), value: String(stats.closedCount), icon: 'journal',
      note: `${trades.filter(trade => trade.status === 'open').length} ${t('abiertas en el periodo', 'open in period')}`,
    },
    {
      key: 'winrate', title: t('Tasa de acierto', 'Win rate'), value: stats.closedCount ? formatPct(stats.winRate) : '—', icon: 'target',
      note: `${stats.wins} ${t('ganadas de', 'wins from')} ${stats.closedCount} ${t('cerradas', 'closed trades')}`,
    },
  ];

  return `<div class="page-intro summary-intro">
    <div><h1>${t('Resumen del periodo', 'Period overview')}</h1><div class="summary-subtitle">${state.mode === 'demo' ? `<span class="pill pill-demo">${t('Datos simulados', 'Simulated data')}</span>` : ''}<span>${esc(account?.name || '')} · ${esc(period)}</span></div></div>
    <div class="page-actions summary-page-actions">${ctx.periodControl ? ctx.periodControl() : ''}<button type="button" class="btn btn-ghost summary-import" data-route="import">${icon('upload', 16)} ${t('Importar MT5', 'Import MT5')}</button><button type="button" class="btn btn-primary summary-desktop-register" data-new-trade>${icon('plus', 17)} ${t('Nueva operación', 'New trade')}</button></div>
  </div>
  <div class="kpi-grid summary-kpis">${cards.map(card => `<section class="stat-card summary-kpi summary-kpi-${card.key}"><div class="stat-top"><h2>${card.title}</h2>${icon(card.icon, 17)}</div><div class="value ${card.tone || ''}">${card.value}</div><p class="stat-note">${card.note}</p></section>`).join('')}</div>
  <button type="button" class="btn btn-primary summary-mobile-register" data-new-trade>${icon('plus', 19)} ${t('Registrar operación', 'Log trade')}</button>
  <div class="summary-grid">
    <section class="card summary-chart"><div class="card-head"><div><h2>${t('Evolución del balance realizado', 'Realized balance evolution')}</h2><p class="summary-chart-subtitle muted">${t('Balance de la cuenta', 'Account balance')} <strong>${money(balance)}</strong></p></div><span class="pill summary-currency">${esc(account?.currency || 'USD')}</span></div>
      <div class="chart-area">${stats.closedCount ? curve(stats.equity, {height: 235, id: 'summary-equity', money, date}) : `<div class="empty-state summary-empty-chart">${icon('analytics', 30)}<h3>${t('Tu evolución, operación a operación', 'Your progress, trade by trade')}</h3><p>${t('La curva aparece cuando registras tu primera operación cerrada.', 'Your curve appears when you log your first closed trade.')}</p><button type="button" class="btn btn-primary" data-new-trade>${icon('plus', 16)} ${t('Registrar operación', 'Log trade')}</button></div>`}</div>
      <div class="summary-section-footer"><span class="muted">${t('Solo resultados realizados', 'Realized results only')} · ${esc(account?.currency || 'USD')}</span><a href="#analytics">${t('Ver estadísticas', 'View statistics')} ${icon('arrow', 14)}</a></div>
    </section>
    <section class="card activity-card"><div class="card-head"><h2>${t('Actividad reciente', 'Recent activity')}</h2><a href="#journal" class="summary-card-link">${t('Ver diario', 'View journal')} ${icon('arrow', 14)}</a></div>${activityRows(ctx, recent)}</section>
  </div>
  <div class="summary-bottom">${disciplineBlock(ctx, closed, score)}${reviewBlock(ctx)}</div>`;
}
