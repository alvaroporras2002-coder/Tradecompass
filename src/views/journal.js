import { net, validateTrade } from '../domain.js';
const filters = { search:'', strategy:'', side:'', result:'', sort:'newest' };
const uid = () => crypto.randomUUID();
const localInput = value => { if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
const toISO = value => value ? new Date(value).toISOString() : '';
const selected = (a,b) => a===b?'selected':'';
const pct = value => Number(value).toFixed(2);
const dateOf = t => t.closedAt || t.openedAt;
const safeMoney = (ctx,value) => ctx.money(Number(value)||0);
function visibleTrades(ctx) {
  const q=filters.search.trim().toLocaleLowerCase();
  const list=ctx.trades.filter(t=>(!q || [t.symbol,t.strategy,t.notes,t.reason,t.lesson,...(t.tags||[])].join(' ').toLocaleLowerCase().includes(q)) && (!filters.strategy||t.strategy===filters.strategy) && (!filters.side||t.side===filters.side) && (!filters.result||filters.result==='open'&&t.status==='open'||filters.result==='win'&&t.status==='closed'&&net(t)>0||filters.result==='loss'&&t.status==='closed'&&net(t)<0||filters.result==='flat'&&t.status==='closed'&&net(t)===0));
  return list.sort((a,b)=>filters.sort==='oldest'?dateOf(a).localeCompare(dateOf(b)):filters.sort==='best'?net(b)-net(a):filters.sort==='worst'?net(a)-net(b):dateOf(b).localeCompare(dateOf(a)));
}
let selectedTradeId = null;
const tradeCosts = trade => -(Number(trade.commission || 0) + Number(trade.swap || 0));
function tradePrice(ctx, value) {
  return value == null || value === '' ? '—' : ctx.esc(new Intl.NumberFormat(ctx.state.settings.language === 'en' ? 'en-US' : 'es-CR', {maximumFractionDigits: 5}).format(Number(value)));
}
function selectedPanel(ctx, trade) {
  const {t,esc,icon}=ctx;
  if(!trade)return '';
  const relevant=ctx.state.rules.filter(rule=>!rule.strategy||rule.strategy==='all'||rule.strategy===trade.strategy);
  const side=trade.side==='buy'?t('Compra','Buy'):t('Venta','Sell');
  const result=trade.status==='closed'?safeMoney(ctx,net(trade)):t('Abierta','Open');
  return `<aside class="card journal-selection" aria-label="${t('Detalle de la operación seleccionada','Selected trade details')}"><div class="journal-selection-heading"><h2>${t('Operación seleccionada','Selected trade')}</h2><span class="pill journal-symbol-tag">${esc(trade.symbol)}</span></div><strong class="journal-selection-result ${trade.status==='closed'?(net(trade)>=0?'positive':'negative'):'muted'}">${result}</strong><p class="journal-selection-meta">${side} · ${esc(trade.strategy||t('Sin estrategia','No strategy'))} · ${esc(ctx.date(dateOf(trade)))}</p><div class="journal-price-grid"><div><span>${t('Entrada','Entry')}</span><strong>${tradePrice(ctx,trade.entry)}</strong></div><div><span>${t('Salida','Exit')}</span><strong>${trade.status==='closed'?tradePrice(ctx,trade.exit):'—'}</strong></div><div><span>${t('Costos','Costs')}</span><strong>${esc(safeMoney(ctx,tradeCosts(trade)))}</strong></div></div><section class="journal-panel-section"><h3>${icon('journal',16)} ${t('Notas','Notes')}</h3><p class="journal-panel-note">${esc(trade.notes||trade.reason||t('Añade el contexto de esta operación.','Add context to this trade.'))}</p></section><section class="journal-panel-section"><h3>${t('Emociones','Emotions')}</h3><div class="journal-emotions">${[[t('Antes','Before'),trade.emotionBefore],[t('Durante','During'),trade.emotionDuring],[t('Después','After'),trade.emotionAfter]].map(([label,value])=>`<div><small>${label}</small><span class="journal-emotion-chip ${value===trade.emotionBefore&&value?'is-first':''}">${esc(value||'—')}</span></div>`).join('')}</div></section><section class="journal-panel-section"><h3>${icon('shield',16)} ${t('Checklist de disciplina','Discipline checklist')}</h3><div class="journal-panel-checklist">${relevant.map(rule=>{const answer=trade.checklist?.[rule.id];return `<div><span class="journal-check-state ${answer==='yes'?'is-yes':answer==='no'?'is-no':'is-pending'}" aria-label="${answer==='yes'?t('Cumplida','Followed'):answer==='no'?t('Incumplida','Missed'):answer==='na'?t('No aplicable','Not applicable'):t('Pendiente','Unanswered')}">${answer==='yes'?icon('check',13):answer==='no'?icon('close',13):''}</span><span>${esc(rule.text)}</span>${answer==='na'?`<small>${t('N/A','N/A')}</small>`:''}</div>`;}).join('')||`<p class="muted">${t('Sin reglas aplicables.','No applicable rules.')}</p>`}</div></section><div class="journal-selection-actions"><button type="button" class="btn btn-primary" data-journal-edit="${esc(trade.id)}">${icon('edit',16)} ${t('Editar operación','Edit trade')}</button><button type="button" class="btn btn-ghost btn-danger icon-btn" data-journal-delete="${esc(trade.id)}" aria-label="${t('Eliminar operación','Delete trade')}">${icon('trash',17)}</button></div><button type="button" class="journal-all-details" data-trade="${esc(trade.id)}">${t('Ver todos los detalles','View all details')} ${icon('chevron',14)}</button></aside>`;
}
export function renderJournal(ctx) {
  const {t,esc,icon}=ctx,list=visibleTrades(ctx);
  const chosen=list.find(trade=>trade.id===selectedTradeId)||list.find(trade=>trade.status==='closed')||list[0];
  selectedTradeId=chosen?.id||null;
  const strategies=[...new Set(ctx.trades.map(x=>x.strategy).filter(Boolean))].sort();
  const closed=list.filter(trade=>trade.status==='closed');
  const total=closed.reduce((sum,trade)=>sum+net(trade),0);
  const winRate=closed.length?closed.filter(trade=>net(trade)>0).length/closed.length*100:0;
  const filtered=filters.search||filters.strategy||filters.side||filters.result;
  const empty=`<div class="empty-state">${icon('journal',34)}<h3>${ctx.trades.length?t('No hay coincidencias','No matches found'):t('Tu primera operación empieza aquí','Your first trade starts here')}</h3><p>${ctx.trades.length?t('Prueba otros filtros o busca otro término.','Try different filters or another search term.'):t('Registra una operación o importa un historial de MT5 para empezar a observar tus decisiones.','Record a trade or import MT5 history to start reviewing your decisions.')}</p><button class="btn btn-primary" ${ctx.trades.length?'data-clear-filters':'data-new-trade'}>${ctx.trades.length?t('Limpiar filtros','Clear filters'):t('Registrar mi primera operación','Record my first trade')}</button></div>`;
  return `<div class="page-intro journal-intro"><div><h1><span class="journal-desktop-title">${t('Diario de operaciones','Trading journal')}</span><span class="journal-mobile-title">${t('Tu diario de trading','Your trading journal')}</span></h1><p>${t('Registra, analiza y mejora con evidencia.','Record, analyze and improve with evidence.')}</p></div><div class="page-actions"><button class="btn btn-ghost journal-import-button" data-journal-import>${icon('upload',17)} ${t('Importar MT5','Import MT5')}</button><button class="btn btn-primary journal-new-button" data-new-trade>${icon('plus',18)} ${t('Nueva operación','New trade')}</button></div></div>
  <div class="filters journal-filters"><label class="search-input"><span class="sr-only">${t('Buscar operaciones','Search trades')}</span>${icon('search',18)}<input id="journal-search" type="search" placeholder="${t('Activo, notas, etiquetas…','Symbol, notes, tags…')}" value="${esc(filters.search)}"></label><label><span class="sr-only">${t('Estrategia','Strategy')}</span><select data-journal-filter="strategy"><option value="">${t('Todas las estrategias','All strategies')}</option>${strategies.map(s=>`<option value="${esc(s)}" ${selected(filters.strategy,s)}>${esc(s)}</option>`).join('')}</select></label><label><span class="sr-only">${t('Dirección','Direction')}</span><select data-journal-filter="side"><option value="">${t('Compra y venta','Buy and sell')}</option><option value="buy" ${selected(filters.side,'buy')}>${t('Compra','Buy')}</option><option value="sell" ${selected(filters.side,'sell')}>${t('Venta','Sell')}</option></select></label><label><span class="sr-only">${t('Resultado','Result')}</span><select data-journal-filter="result"><option value="">${t('Todos los resultados','All results')}</option><option value="win" ${selected(filters.result,'win')}>${t('Ganadoras','Winners')}</option><option value="loss" ${selected(filters.result,'loss')}>${t('Perdedoras','Losers')}</option><option value="flat" ${selected(filters.result,'flat')}>${t('Equilibrio','Breakeven')}</option><option value="open" ${selected(filters.result,'open')}>${t('Abiertas','Open')}</option></select></label></div>
  <div class="journal-toolbar"><p class="trade-count">${list.length} ${t('operaciones','trades')} · ${esc(ctx.account?.currency||'')} · ${ctx.period==='week'?t('Últimos 7 días','Last 7 days'):ctx.period==='month'?t('Últimos 30 días','Last 30 days'):t('Todo el historial','All history')}</p><label class="journal-sort"><span class="sr-only">${t('Ordenar','Sort')}</span><select data-journal-filter="sort"><option value="newest" ${selected(filters.sort,'newest')}>${t('Más recientes','Newest first')}</option><option value="oldest" ${selected(filters.sort,'oldest')}>${t('Más antiguas','Oldest first')}</option><option value="best" ${selected(filters.sort,'best')}>${t('Mayor resultado','Highest result')}</option><option value="worst" ${selected(filters.sort,'worst')}>${t('Menor resultado','Lowest result')}</option></select></label></div>
  <div class="journal-workspace ${chosen?'':'journal-workspace-empty'}"><div class="journal-main"><section class="card journal-desktop-table">${list.length?`<div class="journal-table-scroll"><table><thead><tr><th>${t('Fecha','Date')}</th><th>${t('Instrumento','Symbol')}</th><th>${t('Estrategia','Strategy')}</th><th>${t('Dirección','Side')}</th><th>${t('Entrada','Entry')}</th><th>${t('Salida','Exit')}</th><th>${t('Costos','Costs')}</th><th class="journal-result-cell">${t('Resultado','Result')}</th></tr></thead><tbody>${list.map(trade=>`<tr class="${trade.id===selectedTradeId?'is-selected':''}" data-journal-select="${esc(trade.id)}" tabindex="0" aria-selected="${trade.id===selectedTradeId}" aria-label="${t('Seleccionar operación','Select trade')} ${esc(trade.symbol)}"><td>${esc(ctx.date(dateOf(trade)))}</td><td><strong>${esc(trade.symbol)}</strong></td><td class="journal-strategy-cell"><span title="${esc(trade.strategy||'')}">${esc(trade.strategy||'—')}</span></td><td><span class="pill pill-${trade.side}">${trade.side==='buy'?t('Compra','Buy'):t('Venta','Sell')}</span></td><td>${tradePrice(ctx,trade.entry)}</td><td>${trade.status==='closed'?tradePrice(ctx,trade.exit):'—'}</td><td>${esc(safeMoney(ctx,tradeCosts(trade)))}</td><td class="journal-result-cell ${trade.status==='closed'?(net(trade)>=0?'positive':'negative'):'muted'}">${trade.status==='closed'?safeMoney(ctx,net(trade)):t('Abierta','Open')}</td></tr>`).join('')}</tbody></table></div>`:empty}</section>
  <div class="journal-mobile-list">${list.length?list.map(trade=>`<article class="card journal-mobile-card" data-trade="${esc(trade.id)}" role="button" tabindex="0" aria-label="${t('Abrir operación','Open trade')} ${esc(trade.symbol)}"><div class="journal-mobile-card-head"><div><h2>${esc(trade.symbol)}</h2><p>${esc(ctx.date(dateOf(trade)))} · ${esc(trade.strategy||t('Sin estrategia','No strategy'))}</p></div><div class="journal-mobile-result"><span class="pill pill-${trade.side}">${trade.side==='buy'?t('Compra','Buy'):t('Venta','Sell')}</span><strong class="${trade.status==='closed'?(net(trade)>=0?'positive':'negative'):'muted'}">${trade.status==='closed'?safeMoney(ctx,net(trade)):t('Abierta','Open')}</strong></div></div><div class="journal-price-grid"><div><span>${t('Entrada','Entry')}</span><strong>${tradePrice(ctx,trade.entry)}</strong></div><div><span>${t('Salida','Exit')}</span><strong>${trade.status==='closed'?tradePrice(ctx,trade.exit):'—'}</strong></div><div><span>${t('Costos','Costs')}</span><strong>${esc(safeMoney(ctx,tradeCosts(trade)))}</strong></div></div><p class="journal-mobile-note">${icon('journal',16)}<span>${esc(trade.notes||trade.reason||t('Sin notas. Toca para añadir contexto.','No notes. Tap to add context.'))}</span></p></article>`).join(''):empty}</div>
  <section class="card journal-summary-strip" aria-label="${t('Resumen del periodo','Period summary')}"><div class="journal-summary-label"><h2>${filtered?t('Resumen filtrado','Filtered summary'):t('Resumen del periodo','Period summary')}</h2><small>${ctx.state.mode==='demo'?t('Datos ilustrativos','Illustrative data'):esc(ctx.account?.name||'')} · ${closed.length} ${t('cerradas','closed')}</small></div><div><span>${t('Operaciones','Trades')}</span><strong>${list.length}</strong></div><div><span>${t('Acierto','Win rate')}</span><strong>${winRate.toFixed(1)}%</strong></div><div><span>${t('Resultado neto','Net result')}</span><strong class="${total>=0?'lime':'negative'}">${safeMoney(ctx,total)}</strong></div></section></div>${selectedPanel(ctx,chosen)}</div><p class="inline-note journal-note">${t('Resultado neto = beneficio bruto + comisión + swap. Las operaciones abiertas no cuentan en las estadísticas realizadas.','Net result = gross profit + commission + swap. Open trades are excluded from realized statistics.')}</p>`;
}
function confirmPanelDelete(ctx,id) {
  const {t}=ctx;
  ctx.modal(`<div class="modal-head"><div><h2>${t('¿Eliminar esta operación?','Delete this trade?')}</h2><p class="muted">${t('Se eliminarán el registro, sus notas y sus capturas. Esta acción no se puede deshacer.','The record, its notes and screenshots will be deleted. This cannot be undone.')}</p></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close-modal>${t('Cancelar','Cancel')}</button><button type="button" class="btn btn-danger" data-panel-confirm-delete>${t('Eliminar operación','Delete trade')}</button></div>`,root=>root.querySelector('[data-panel-confirm-delete]').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await ctx.update(state=>{state.trades=state.trades.filter(trade=>trade.id!==id);});ctx.closeModal();ctx.toast(t('Operación eliminada','Trade deleted'));}catch(error){button.disabled=false;ctx.toast(error.message);}}));
}
export function bindJournal(ctx) {
  document.querySelectorAll('[data-trade]').forEach(el=>{el.addEventListener('click',()=>openTradeDetail(ctx,el.dataset.trade));if(el.hasAttribute('tabindex'))el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openTradeDetail(ctx,el.dataset.trade);}});});
  document.querySelectorAll('[data-journal-select]').forEach(el=>{const select=()=>{if(window.matchMedia('(max-width:1020px)').matches){openTradeDetail(ctx,el.dataset.journalSelect);return;}selectedTradeId=el.dataset.journalSelect;const scroll=document.querySelector('.journal-table-scroll')?.scrollTop||0;ctx.render();const table=document.querySelector('.journal-table-scroll');if(table)table.scrollTop=scroll;document.querySelector(`[data-journal-select="${CSS.escape(selectedTradeId)}"]`)?.focus({preventScroll:true});};el.addEventListener('click',select);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});});
  document.querySelectorAll('[data-journal-edit]').forEach(el=>el.addEventListener('click',()=>openTradeForm(ctx,ctx.state.trades.find(trade=>trade.id===el.dataset.journalEdit))));
  document.querySelectorAll('[data-journal-delete]').forEach(el=>el.addEventListener('click',()=>confirmPanelDelete(ctx,el.dataset.journalDelete)));
  document.querySelectorAll('[data-new-trade]').forEach(el=>el.addEventListener('click',()=>openTradeForm(ctx)));
  document.querySelectorAll('[data-journal-import]').forEach(el=>el.addEventListener('click',()=>ctx.navigate('import')));
  document.querySelectorAll('[data-journal-filter]').forEach(el=>el.addEventListener('change',()=>{filters[el.dataset.journalFilter]=el.value;ctx.render();}));
  document.querySelectorAll('[data-clear-filters]').forEach(el=>el.addEventListener('click',()=>{Object.assign(filters,{search:'',strategy:'',side:'',result:'',sort:'newest'});ctx.render();}));
  let timer;
  document.querySelector('#journal-search')?.addEventListener('input',e=>{clearTimeout(timer);const value=e.target.value;timer=setTimeout(()=>{filters.search=value;ctx.render();document.querySelector('#journal-search')?.focus();},180);});
}
function field(ctx,name,label,type,value,extra='') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${ctx.esc(value??'')}" ${extra}><small class="field-error" data-error="${name}"></small></label>`;
}
function textArea(ctx,name,label,value,span=false) {return `<label class="field ${span?'span-2':''}"><span>${label}</span><textarea name="${name}" maxlength="10000">${ctx.esc(value||'')}</textarea></label>`;}
async function compressImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('IMAGE_TYPE');
  if(file.size>8*1024*1024)throw new Error('IMAGE_SIZE');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    const scale=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');context.fillStyle='#1c2023';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    return {id:uid(),name:file.name.slice(0,100),data:canvas.toDataURL('image/jpeg',0.76)};
  } finally {URL.revokeObjectURL(url);}
}
/** Build a manual quick capture without inventing execution prices or volume.
 * netResult is the final platform amount; costs only break that amount down.
 * Omitted fields retain existing values, including original imported figures.
 */
export function buildQuickTrade(data, initial = {}, options = {}) {
  const has = name => typeof data?.has === 'function' ? data.has(name) : Object.prototype.hasOwnProperty.call(data || {}, name);
  const read = (name, fallback = '') => has(name) ? String(typeof data?.get === 'function' ? data.get(name) ?? '' : data[name] ?? '').trim() : fallback;
  const text = name => read(name, initial[name] ?? '');
  const number = (name, fallback = null) => {
    if (!has(name)) return initial[name] ?? fallback;
    const raw = read(name);
    return raw === '' ? null : Number(raw);
  };
  const dateValue = (raw, previous) => {
    if (!raw) return null;
    if (previous && localInput(previous) === raw) return previous;
    const value = new Date(raw);
    return Number.isFinite(+value) ? value.toISOString() : raw;
  };
  const imported = initial.source === 'mt5';
  const status = imported ? initial.status : read('status', initial.status || 'closed');
  const priorDate = status === 'open' ? initial.openedAt : initial.closedAt;
  const rawDate = read('date', priorDate || options.now || new Date().toISOString());
  const commission = number('commission', 0) ?? 0;
  const swap = number('swap', 0) ?? 0;
  const finalNet = has('netResult') ? number('netResult') : initial.id && initial.status === 'closed' ? net(initial) : null;
  const gross = status === 'closed' ? finalNet == null ? null : Math.round((finalNet - commission - swap) * 1e8) / 1e8 : initial.gross ?? 0;
  const trade = {
    ...initial,
    id: initial.id || options.id || uid(),
    accountId: read('accountId', initial.accountId || options.accountId || ''),
    symbol: read('symbol', initial.symbol || '').toUpperCase(),
    side: read('side', initial.side || ''), status,
    openedAt: status === 'open' ? dateValue(rawDate, initial.openedAt) : has('openedAt') ? dateValue(read('openedAt'), initial.openedAt) : initial.openedAt ?? null,
    closedAt: status === 'closed' ? dateValue(rawDate, initial.closedAt) : null,
    entry: number('entry'), exit: number('exit'), volume: number('volume'),
    gross, commission, swap, risk: number('risk'),
    stopLoss: number('stopLoss'), takeProfit: number('takeProfit'),
    strategy: text('strategy'),
    tags: has('tags') ? [...new Set(read('tags').split(',').map(tag => tag.trim().slice(0, 150)).filter(Boolean))] : [...(initial.tags || [])],
    notes: text('notes'), reason: text('reason'), lesson: text('lesson'),
    emotionBefore: text('emotionBefore'), emotionDuring: text('emotionDuring'), emotionAfter: text('emotionAfter'),
    checklist: {...(options.checklist ?? initial.checklist ?? {})},
    attachments: (options.attachments ?? initial.attachments ?? []).map(item => ({...item})),
    source: initial.source || 'manual', sourceId: initial.sourceId || '', batchId: initial.batchId || null,
  };
  if (imported) {
    // The source record stays immutable; only personal annotations are updated.
    for (const key of ['accountId','symbol','side','status','openedAt','closedAt','entry','exit','volume','gross','commission','swap','stopLoss','takeProfit','source','sourceId','batchId','original']) {
      if (Object.prototype.hasOwnProperty.call(initial, key)) trade[key] = initial[key];
      else delete trade[key];
    }
  } else trade.captureMode = 'quick';
  return trade;
}

export function openTradeForm(ctx, existing) {
  const {t,esc}=ctx, imported=existing?.source==='mt5';
  const now=new Date().toISOString();
  const initial=existing||{accountId:ctx.account?.id,symbol:'',side:'',status:'closed',openedAt:null,closedAt:now,entry:null,exit:null,volume:null,gross:null,commission:0,swap:0,risk:null,strategy:'',tags:[],notes:'',reason:'',emotionBefore:'',emotionDuring:'',emotionAfter:'',lesson:'',checklist:{},attachments:[],source:'manual'};
  let attachments=(initial.attachments||[]).map(item=>({...item,id:item.id||uid()}));
  const readonly=imported?'readonly':'', disabled=imported?'disabled':'';
  const accounts=ctx.state.accounts.filter(account=>!account.archived||account.id===initial.accountId);
  const account=accounts.find(item=>item.id===initial.accountId)||ctx.account;
  const strategies=[...new Set(ctx.state.trades.map(trade=>trade.strategy).filter(Boolean))];
  const mainDate=initial.status==='open'?initial.openedAt:initial.closedAt;
  const accountField=accounts.length>1?`<label class="field span-2"><span>${t('Cuenta','Account')}</span><select name="accountId" ${disabled}>${accounts.map(item=>`<option value="${esc(item.id)}" ${selected(item.id,initial.accountId)}>${esc(item.name)} · ${esc(item.currency)}</option>`).join('')}</select><small class="field-error" data-error="accountId"></small></label>`:`<input type="hidden" name="accountId" value="${esc(initial.accountId||account?.id||'')}">`;
  const optionalNumber=(name,label,step='any',extra='')=>field(ctx,name,label,'number',initial[name],`step="${step}" ${extra} ${readonly}`);
  ctx.modal(`<div class="modal-head"><div><h2>${existing?t('Editar operación','Edit trade'):t('Nueva operación','New trade')}</h2><p class="muted">${imported?t('Los datos importados se conservan. Añade tu contexto y aprendizaje.','Imported figures are preserved. Add your context and learning.'):t('Lo esencial ahora. Los detalles, cuando quieras.','The essentials now. Add details whenever you like.')}</p></div></div>
  <form id="trade-form" class="journal-quick-form" novalidate><div id="trade-error" class="error-banner" hidden role="alert"></div>
  <div class="form-grid journal-quick-fields">${accountField}
    ${field(ctx,'symbol',t('Activo','Symbol'),'text',initial.symbol,`required maxlength="40" ${readonly} ${imported?'':'autofocus'} placeholder="EURUSD, XAUUSD…"`)}
    <label class="field"><span>${t('Compra o venta','Buy or sell')}</span><select name="side" required ${disabled}><option value="" ${selected(initial.side,'')}>${t('Selecciona','Select')}</option><option value="buy" ${selected(initial.side,'buy')}>${t('Compra','Buy')}</option><option value="sell" ${selected(initial.side,'sell')}>${t('Venta','Sell')}</option></select><small class="field-error" data-error="side"></small></label>
    ${field(ctx,'date',t('Fecha','Date'),'datetime-local',localInput(mainDate||now),`required ${readonly}`)}
    <label class="field journal-quick-net" data-quick-net-field><span>${t('Resultado neto','Net result')} <small data-quick-currency>${esc(account?.currency||'')}</small></span><input name="netResult" type="number" step="0.01" value="${esc(existing&&initial.status==='closed'?net(initial):'')}" placeholder="+50.00 / −25.00" ${initial.status==='closed'?'required':''} ${readonly}><small class="field-error" data-error="netResult"></small><small class="muted">${t('El resultado final de tu plataforma, positivo o negativo.','Your platform’s final result, positive or negative.')}</small></label>
    <label class="field span-2 journal-quick-note"><span>${t('Nota (opcional)','Note (optional)')}</span><textarea name="notes" rows="2" maxlength="10000" placeholder="${t('¿Algo que quieras recordar?','Anything you want to remember?')}">${esc(initial.notes||'')}</textarea></label>
  </div>
  <details class="form-section journal-quick-details" data-quick-section="technical"><summary>${t('Más detalles (opcional)','More details (optional)')}</summary><div class="form-grid">
    <label class="field"><span>${t('Estado','Status')}</span><select name="status" ${disabled}><option value="closed" ${selected(initial.status,'closed')}>${t('Cerrada','Closed')}</option><option value="open" ${selected(initial.status,'open')}>${t('Abierta','Open')}</option></select><small class="field-error" data-error="status"></small></label>
    <div data-quick-opening>${field(ctx,'openedAt',t('Fecha de apertura (opcional)','Opening date (optional)'),'datetime-local',localInput(initial.openedAt),readonly)}</div>
    ${optionalNumber('entry',t('Precio de entrada','Entry price'))}${optionalNumber('exit',t('Precio de salida','Exit price'))}
    ${optionalNumber('volume',t('Volumen / lotes','Volume / lots'))}${field(ctx,'risk',t('Riesgo inicial','Initial risk'),'number',initial.risk,'step="0.01"')}
    ${optionalNumber('stopLoss','Stop loss')}${optionalNumber('takeProfit','Take profit')}
    ${optionalNumber('commission',t('Comisión','Commission'),'0.01')}${optionalNumber('swap','Swap','0.01')}
    <p class="inline-note span-2 journal-quick-cost-note">${t('El neto ya incluye estos costes. Aquí solo desglosas el importe; las comisiones pagadas llevan signo negativo.','The net result already includes these costs. This is only a breakdown; paid commissions are negative.')}</p>
    <label class="field"><span>${t('Estrategia','Strategy')}</span><input name="strategy" list="strategy-options" maxlength="80" value="${esc(initial.strategy||'')}"><datalist id="strategy-options">${strategies.map(strategy=>`<option value="${esc(strategy)}"></option>`).join('')}</datalist></label>
    ${field(ctx,'tags',t('Etiquetas, separadas por coma','Tags, separated by commas'),'text',(initial.tags||[]).join(', '),'maxlength="300"')}
  </div></details>
  <details class="form-section journal-quick-details" data-quick-section="context"><summary>${t('Emociones y aprendizaje (opcional)','Emotions and learning (optional)')}</summary><div class="form-grid">${textArea(ctx,'reason',t('Motivo de entrada','Entry reason'),initial.reason,true)}${field(ctx,'emotionBefore',t('Emoción antes','Emotion before'),'text',initial.emotionBefore,'maxlength="100"')}${field(ctx,'emotionDuring',t('Emoción durante','Emotion during'),'text',initial.emotionDuring,'maxlength="100"')}${field(ctx,'emotionAfter',t('Emoción después','Emotion after'),'text',initial.emotionAfter,'maxlength="100"')}${textArea(ctx,'lesson',t('Aprendizaje','Learning'),initial.lesson,true)}</div></details>
  <details class="form-section journal-quick-details" data-quick-section="checklist"><summary>${t('Checklist (opcional)','Checklist (optional)')}</summary><div id="trade-checklist"></div></details>
  <details class="form-section journal-quick-details" data-quick-section="images"><summary>${t('Capturas (opcional)','Screenshots (optional)')}</summary><p class="inline-note">${t('Hasta 3 imágenes JPG, PNG o WebP.','Up to 3 JPG, PNG or WebP images.')}</p><label class="btn btn-ghost journal-upload">${ctx.icon('upload',16)} ${t('Añadir capturas','Add screenshots')}<input id="trade-images" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label><div id="trade-image-list" class="attachment-grid"></div></details>
  <div class="modal-actions journal-quick-actions"><button type="button" class="btn btn-ghost" data-close-modal>${t('Cancelar','Cancel')}</button><button type="submit" class="btn btn-primary" id="trade-save">${t('Guardar operación','Save trade')}</button></div></form>`,root=>{
    const form=root.querySelector('#trade-form');
    let imageBusy=false;
    const checklistValues={...(initial.checklist||{})};
    function updateStatus(){const isOpen=form.elements.status.value==='open';const result=form.elements.netResult;root.querySelector('[data-quick-net-field]').hidden=isOpen;result.disabled=isOpen;result.required=!isOpen;root.querySelector('[data-quick-opening]').hidden=isOpen;}
    updateStatus();form.elements.status.addEventListener('change',updateStatus);
    form.elements.accountId?.addEventListener('change',()=>{const chosen=accounts.find(item=>item.id===form.elements.accountId.value);root.querySelector('[data-quick-currency]').textContent=chosen?.currency||'';});
    function drawChecklist(){const strategy=form.elements.strategy.value.trim();const relevant=ctx.state.rules.filter(rule=>!rule.strategy||rule.strategy==='all'||rule.strategy==='*'||rule.strategy===strategy);root.querySelector('#trade-checklist').innerHTML=relevant.length?relevant.map(rule=>`<label class="checklist-row"><span>${esc(rule.text)}</span><select data-rule="${esc(rule.id)}"><option value="">${t('Pendiente','Unanswered')}</option><option value="yes" ${selected(checklistValues[rule.id],'yes')}>${t('Cumplida','Followed')}</option><option value="no" ${selected(checklistValues[rule.id],'no')}>${t('Incumplida','Missed')}</option><option value="na" ${selected(checklistValues[rule.id],'na')}>${t('No aplicable','Not applicable')}</option></select></label>`).join(''):`<p class="muted small">${t('Sin reglas para esta estrategia.','No rules for this strategy.')}</p>`;root.querySelectorAll('[data-rule]').forEach(element=>element.addEventListener('change',()=>{if(element.value)checklistValues[element.dataset.rule]=element.value;else delete checklistValues[element.dataset.rule];}));}
    drawChecklist();form.elements.strategy.addEventListener('change',drawChecklist);
    function drawImages(){root.querySelector('#trade-image-list').innerHTML=attachments.map(image=>`<div class="journal-attachment"><img src="${esc(image.data)}" alt="${esc(image.name||t('Captura','Screenshot'))}"><button type="button" class="journal-remove-image" data-remove-image="${esc(image.id)}" aria-label="${t('Eliminar captura','Remove screenshot')}">${ctx.icon('close',13)}</button></div>`).join('');root.querySelectorAll('[data-remove-image]').forEach(element=>element.addEventListener('click',()=>{attachments=attachments.filter(image=>image.id!==element.dataset.removeImage);drawImages();}));}
    drawImages();
    root.querySelector('#trade-images').addEventListener('change',async event=>{if(imageBusy)return;imageBusy=true;root.querySelector('#trade-save').disabled=true;try{for(const file of event.target.files){if(attachments.length>=3){ctx.toast(t('Máximo 3 capturas.','Maximum 3 screenshots.'));break;}attachments.push(await compressImage(file));}drawImages();}catch(error){ctx.toast(error.message==='IMAGE_TYPE'?t('Usa imágenes JPG, PNG o WebP.','Use JPG, PNG or WebP images.'):error.message==='IMAGE_SIZE'?t('Cada imagen debe pesar menos de 8 MB.','Each image must be smaller than 8 MB.'):t('No se pudo procesar la imagen.','Could not process the image.'));}finally{imageBusy=false;root.querySelector('#trade-save').disabled=false;event.target.value='';}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(imageBusy)return;
      const data=new FormData(form);
      let trade;
      try{trade=buildQuickTrade(data,initial,{accountId:ctx.account?.id,attachments,checklist:checklistValues});}catch{const banner=root.querySelector('#trade-error');banner.hidden=false;banner.textContent=t('Revisa la fecha antes de guardar.','Check the date before saving.');form.elements.date.focus();return;}
      const errors=validateTrade(trade);
      if(!imported&&trade.status==='closed'&&String(data.get('netResult')??'').trim()==='')errors.gross=t('Indica el resultado neto; puede ser cero.','Enter the net result; zero is allowed.');
      root.querySelectorAll('[data-error]').forEach(element=>{element.textContent='';});
      root.querySelectorAll('[aria-invalid]').forEach(element=>element.removeAttribute('aria-invalid'));
      if(Object.keys(errors).length){
        const banner=root.querySelector('#trade-error');banner.hidden=false;banner.textContent=t('Revisa los campos marcados.','Review the highlighted fields.');
        const labels={accountId:t('Selecciona una cuenta.','Select an account.'),symbol:t('Indica el activo.','Enter a symbol.'),side:t('Selecciona compra o venta.','Select buy or sell.'),status:t('Selecciona el estado.','Select a status.'),date:t('Indica una fecha válida.','Enter a valid date.'),openedAt:t('Indica una apertura válida, anterior al cierre.','Enter a valid opening date before the close.'),netResult:t('Indica el resultado neto; puede ser cero.','Enter the net result; zero is allowed.'),entry:t('Usa un precio positivo o deja el campo vacío.','Use a positive price or leave blank.'),exit:t('Usa un precio positivo o deja el campo vacío.','Use a positive price or leave blank.'),volume:t('Usa un volumen positivo o deja el campo vacío.','Use a positive volume or leave blank.'),risk:t('Usa un riesgo positivo o deja el campo vacío.','Use positive risk or leave blank.'),commission:t('Indica una comisión válida.','Enter a valid commission.'),swap:t('Indica un swap válido.','Enter a valid swap.')};
        let first;
        for(const [key,message] of Object.entries(errors)){
          const target=key==='closedAt'||key==='openedAt'&&trade.status==='open'?'date':key==='gross'?'netResult':key;
          const error=root.querySelector(`[data-error="${target}"]`);if(error)error.textContent=labels[target]||(ctx.state.settings.language==='en'?t(message,'Enter a valid value.'):message);
          const input=form.elements[target];if(input){input.setAttribute('aria-invalid','true');const section=input.closest('details');if(section)section.open=true;if(!first)first=input;}
        }
        first?.focus();return;
      }
      const save=root.querySelector('#trade-save');save.disabled=true;save.textContent=t('Guardando…','Saving…');
      try{await ctx.update(state=>{const index=state.trades.findIndex(item=>item.id===trade.id);if(index<0)state.trades.push(trade);else state.trades[index]=trade;});ctx.closeModal();ctx.toast(t('Operación guardada','Trade saved'),{kind:'success'});}catch(error){save.disabled=false;save.textContent=t('Guardar operación','Save trade');root.querySelector('#trade-error').hidden=false;root.querySelector('#trade-error').textContent=error.message;}
    });
  });
}

export function openTradeDetail(ctx,id) {
  const trade=ctx.state.trades.find(x=>x.id===id);if(!trade)return;
  const {t,esc,icon}=ctx,account=ctx.state.accounts.find(a=>a.id===trade.accountId);
  const info=(label,value)=>`<div><small>${label}</small><b>${value}</b></div>`;
  const money=value=>new Intl.NumberFormat(ctx.state.settings.language==='en'?'en-US':'es-CR',{style:'currency',currency:account?.currency||'USD'}).format(Number(value)||0);
  const text=(label,value)=>value?`<div class="detail-section"><h3>${label}</h3><p class="detail-notes">${esc(value)}</p></div>`:'';
  ctx.modal(`<div class="modal-head"><div><p class="eyebrow">${esc(account?.name||'')} · ${trade.source==='mt5'?'MT5':t('REGISTRO MANUAL','MANUAL ENTRY')}</p><h2>${esc(trade.symbol)} <span class="pill pill-${trade.side}">${trade.side==='buy'?t('Compra','Buy'):t('Venta','Sell')}</span></h2><p class="muted">${esc(trade.strategy||t('Sin estrategia','No strategy'))}</p></div></div><div class="journal-detail-result ${trade.status==='closed'?(net(trade)>=0?'positive':'negative'):'muted'}">${trade.status==='closed'?esc(money(net(trade))):t('Operación abierta','Open trade')}<small>${t('Resultado realizado neto','Realized net result')}</small></div><div class="detail-grid">${info(t('Entrada','Entry'),esc(trade.entry??'—'))}${info(t('Salida','Exit'),trade.status==='closed'?esc(trade.exit??'—'):'—')}${info(t('Volumen','Volume'),esc(trade.volume??'—'))}${info(t('Apertura','Opened'),trade.openedAt?esc(ctx.date(trade.openedAt,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})):'—')}${info(t('Cierre','Closed'),trade.closedAt?esc(ctx.date(trade.closedAt,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})):'—')}${info(t('Beneficio bruto','Gross profit'),esc(money(trade.gross)))}${info(t('Comisión','Commission'),esc(money(trade.commission)))}${info('Swap',esc(money(trade.swap)))}${info(t('Riesgo inicial','Initial risk'),trade.risk?esc(money(trade.risk)):'—')}${info(t('Múltiplo R','R multiple'),trade.risk&&trade.status==='closed'?`${(net(trade)/trade.risk).toFixed(2)} R`:'—')}${info('Stop loss',esc(trade.stopLoss??'—'))}${info('Take profit',esc(trade.takeProfit??'—'))}</div><div class="tag-list">${(trade.tags||[]).map(tag=>`<span class="pill">${esc(tag)}</span>`).join('')}</div>${text(t('Motivo de entrada','Entry reason'),trade.reason)}${text(t('Notas','Notes'),trade.notes)}${text(t('Emociones: antes → durante → después','Emotions: before → during → after'),[trade.emotionBefore,trade.emotionDuring,trade.emotionAfter].map(v=>v||'—').join(' → '))}${text(t('Aprendizaje','Learning'),trade.lesson)}<div class="detail-section"><h3>${t('Disciplina','Discipline')}</h3>${ctx.state.rules.filter(r=>!r.strategy||r.strategy==='all'||r.strategy===trade.strategy).map(r=>`<div class="checklist-row"><span>${esc(r.text)}</span><span class="${trade.checklist?.[r.id]==='yes'?'positive':trade.checklist?.[r.id]==='no'?'negative':'muted'}">${trade.checklist?.[r.id]==='yes'?t('Cumplida','Followed'):trade.checklist?.[r.id]==='no'?t('Incumplida','Missed'):trade.checklist?.[r.id]==='na'?t('No aplicable','Not applicable'):t('Pendiente','Unanswered')}</span></div>`).join('')||`<p class="muted small">${t('Sin reglas aplicables.','No applicable rules.')}</p>`}</div>${trade.attachments?.length?`<div class="detail-section"><h3>${t('Capturas','Screenshots')}</h3><div class="attachment-grid">${trade.attachments.map((a,i)=>`<button class="journal-image-button" data-view-image="${i}" aria-label="${t('Ampliar captura','Enlarge screenshot')} ${i+1}"><img src="${esc(a.data)}" alt="${esc(a.name||t('Captura','Screenshot'))}"></button>`).join('')}</div></div>`:''}${trade.source==='mt5'?`<details class="form-section journal-original"><summary>${t('Datos originales de MT5','Original MT5 data')}</summary><p class="inline-note">${t('Identificador','Source ID')}: ${esc(trade.sourceId||'—')} · ${t('Lote','Batch')}: ${esc(trade.batchId||'—')}</p><pre>${esc(JSON.stringify(trade.original||{},null,2))}</pre></details>`:''}<div class="modal-actions"><button class="btn btn-danger" type="button" id="delete-trade">${icon('trash',16)} ${t('Eliminar','Delete')}</button><button class="btn btn-primary" type="button" id="edit-trade">${icon('edit',16)} ${t('Editar','Edit')}</button></div>`,root=>{
    root.querySelector('#edit-trade').addEventListener('click',()=>openTradeForm(ctx,trade));
    root.querySelector('#delete-trade').addEventListener('click',()=>ctx.modal(`<div class="modal-head"><div><h2>${t('¿Eliminar esta operación?','Delete this trade?')}</h2><p class="muted">${t('Se eliminarán el registro, sus notas y sus capturas. Esta acción no se puede deshacer.','The record, its notes and screenshots will be deleted. This cannot be undone.')}</p></div></div><div class="modal-actions"><button class="btn btn-ghost" type="button" data-cancel-delete>${t('Cancelar','Cancel')}</button><button class="btn btn-danger" type="button" data-confirm-delete>${t('Eliminar operación','Delete trade')}</button></div>`,confirmation=>{confirmation.querySelector('[data-cancel-delete]').addEventListener('click',()=>openTradeDetail(ctx,id));confirmation.querySelector('[data-confirm-delete]').addEventListener('click',async e=>{const deleteButton=e.currentTarget;deleteButton.disabled=true;try{await ctx.update(s=>{s.trades=s.trades.filter(x=>x.id!==id);});ctx.closeModal();ctx.toast(t('Operación eliminada','Trade deleted'));}catch(error){ctx.toast(error.message);deleteButton.disabled=false;}});}));
    root.querySelectorAll('[data-view-image]').forEach(el=>el.addEventListener('click',()=>{const a=trade.attachments[Number(el.dataset.viewImage)];ctx.modal(`<div class="modal-head"><h2>${t('Captura de operación','Trade screenshot')}</h2></div><img class="journal-full-image" src="${esc(a.data)}" alt="${esc(a.name||'')}"><div class="modal-actions"><button type="button" class="btn btn-ghost" id="back-to-trade">${t('Volver a la operación','Back to trade')}</button></div>`,dialog=>dialog.querySelector('#back-to-trade').addEventListener('click',()=>openTradeDetail(ctx,id)));}));
  });
}
