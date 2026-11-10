import {planId} from '../plans.js';
import {basicDiscipline} from '../plans-ui.js';
import {net,compliance} from '../domain.js';
import {esc,icon} from '../ui.js';
import {EA_CONCEPTS} from './explore.js';
import {renderPhoneChart,bindPhoneCharts} from '../phone-charts.js';
import {renderAnalysisFlow,bindAnalysisFlow} from './analysis-flow.js';
import {renderWeeklyReview,bindWeeklyReview,captureWeeklyDraft} from './review-flow.js';
import {renderReview,renderDiscipline} from './insights.js';

let allJournal=false;
let analyticsChart='result';
let reviewMode='weekly';
const reviewDrafts=new Map();
const reviewBaselines=new WeakMap();
let journalFilters={search:'',side:'all',status:'all',strategy:''};
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const tone=value=>value<0?'ip-negative':value>0?'ip-positive':'';
const periodText=ctx=>ctx.period==='week'?ctx.t('Últimos 7 días','Last 7 days'):ctx.period==='all'?ctx.t('Todo el historial','All history'):ctx.t('Últimos 30 días','Last 30 days');
const dataText=ctx=>ctx.state.mode==='demo'?ctx.t('Datos ilustrativos','Illustrative data'):ctx.t('Tu historial','Your history');
const heading=(ctx,title)=>`<h1 class="ip-page-title">${title}</h1>`;
const status=ctx=>`<span class="ip-ea-status">${ctx.t('En desarrollo','In development')}</span>`;
const label=ctx=>ctx.state.settings.language==='en'?'en-US':'es-CR';
const decimal=(ctx,value,digits=1)=>new Intl.NumberFormat(label(ctx),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(finite(value));
const signedMoney=(ctx,value)=>`${value>0?'+':''}${ctx.money(value)}`;
function periodLine(ctx){return `<button class="ip-period-line" data-phone-period aria-label="${ctx.t('Cambiar periodo','Change period')}"><span>${dataText(ctx)} · ${periodText(ctx)}</span>${icon('chevron',15)}</button>`;}

export function phoneSummaryNumbers(ctx){
 const s=ctx.stats,initial=finite(s.equity?.[0]?.value);
 return {count:s.closedCount,winRate:s.closedCount?s.winRate:null,net:s.net,returnPct:initial>0?s.net/initial*100:null,payoff:s.avgWin>0&&s.avgLoss<0?s.avgWin/Math.abs(s.avgLoss):null};
}

export function phoneChart(ctx,options={}){return renderPhoneChart(ctx,options);}

function resultCard(ctx){return `<section class="ip-card ip-chart-card"><h2>${ctx.t('Evolución del resultado','Result evolution')}</h2><p class="ip-subtitle">${dataText(ctx)}</p>${phoneChart(ctx)}</section>`;}

export function workflowProgress(ctx){
 const accountTrades=ctx.state.trades.filter(trade=>trade.accountId===ctx.account?.id);
 return {account:!!ctx.state.settings.onboardingComplete,rules:ctx.state.rules.length>0,trades:accountTrades.length>0,accountTrades};
}
function setupCard(ctx){
 const {t}=ctx,p=workflowProgress(ctx),steps=[
  {complete:p.account,route:'welcome',title:t('Prepara tu cuenta','Prepare your account'),body:t('Nombre, moneda, balance y zona horaria.','Name, currency, balance, and timezone.')},
  {complete:p.rules,route:'discipline',title:t('Define tus reglas','Define your rules'),body:p.rules?`${ctx.state.rules.length} ${t('reglas listas para evaluar.','rules ready to evaluate.')}`:t('Elige qué vas a comprobar al operar.','Choose what you will check when you trade.')},
  {complete:p.trades,route:'import',title:t('Empieza tu historial','Start your history'),body:t('Importa desde MT5 o registra una operación.','Import from MT5 or log a trade.')}
 ];
 return `<section class="ip-card wf-setup"><div class="wf-setup-heading"><span class="wf-kicker">${t('TU PUNTO DE PARTIDA','YOUR STARTING POINT')}</span><h2>${t('Empieza con dirección.','Start with direction.')}</h2><p>${t('Tres pasos para convertir tus operaciones en aprendizaje.','Three steps to turn your trades into learning.')}</p></div><ol class="wf-steps">${steps.map((step,index)=>`<li><a href="#${step.route}" class="wf-step ${step.complete?'is-complete':''}"><span class="wf-step-number">${step.complete?icon('check',16):index+1}</span><span><strong>${step.title}</strong><small>${esc(step.body)}</small></span>${icon('chevron',15)}</a></li>`).join('')}</ol><button class="ip-primary" data-new-trade>${icon('plus',20)} ${t('Registrar mi primera operación','Log my first trade')}</button><a href="#import" class="wf-import-link">${icon('upload',17)} ${t('Importar historial de MT5','Import MT5 history')}</a></section>`;
}
export function renderPhoneSummary(ctx){
 const {t}=ctx,p=workflowProgress(ctx);
 if(!p.trades)return `${heading(ctx,t('Inicio','Home'))}<p class="wf-screen-intro">${t('Tu diario. Tus reglas. Un proceso más claro.','Your journal. Your rules. A clearer process.')}</p>${setupCard(ctx)}<button class="ip-text-action" data-phone-demo>${t('Explorar un diario de ejemplo','Explore a sample journal')}</button>`;
 const n=phoneSummaryNumbers(ctx),netValue=n.returnPct===null?signedMoney(ctx,n.net):`${n.returnPct>0?'+':''}${decimal(ctx,n.returnPct)}%`,latest=ctx.state.reviews.filter(row=>row.accountId===ctx.account?.id).slice().sort((a,b)=>String(b.week).localeCompare(String(a.week)))[0];
 return `${heading(ctx,t('Inicio','Home'))}${periodLine(ctx)}<div class="ip-kpis"><section class="ip-card ip-kpi"><h2>${t('Operaciones','Trades')}</h2><strong>${n.count}</strong></section><section class="ip-card ip-kpi"><h2>${t('Acierto','Win rate')}</h2><strong>${n.winRate===null?'—':decimal(ctx,n.winRate)+'%'}</strong></section><section class="ip-card ip-kpi"><h2>${t('Resultado neto','Net result')}</h2><strong class="${n.count?tone(n.net):''}">${n.count?esc(netValue):'—'}</strong></section><section class="ip-card ip-kpi"><h2>${t('Ratio B/R','Reward/risk')}</h2><strong>${n.payoff===null?'—':decimal(ctx,n.payoff,2)}</strong></section></div>${resultCard(ctx)}<button class="ip-primary ip-summary-register" data-new-trade>${icon('plus',21)} ${t('Registrar operación','Log trade')}</button><section class="ip-card wf-next-action"><span class="wf-kicker">${t('TU PRÓXIMA ACCIÓN','YOUR NEXT ACTION')}</span><h2>${latest?t('Un compromiso para tu próxima sesión.','A commitment for your next session.'):t('Cierra la semana con una decisión.','Close the week with a decision.')}</h2><p>${latest?esc(latest.action):t('Revisa tu proceso y elige una mejora que puedas comprobar.','Review your process and choose one improvement you can verify.')}</p><a href="#review">${latest?t('Revisar mi compromiso','Review my commitment'):t('Hacer mi revisión semanal','Start my weekly review')} ${icon('arrow',15)}</a></section>`;
}

function disciplinePanel(ctx){
 const closed=ctx.trades.filter(x=>x.status==='closed'),score=compliance(closed,ctx.state.rules),percent=score.applicable?Math.round(score.score):0;
 const prefer=['plan','risk','emotion'],rules=prefer.map(id=>ctx.state.rules.find(x=>x.id===id)).filter(Boolean);
 if(!rules.length)rules.push(...ctx.state.rules.slice(0,3));
 const names={plan:ctx.t('Plan','Plan'),risk:ctx.t('Riesgo','Risk'),emotion:ctx.t('Emociones','Emotions')};
 return `<section class="ip-card ip-discipline"><h2>${ctx.t('Disciplina del periodo','Discipline this period')}</h2><p class="ip-subtitle">${dataText(ctx)}</p><div class="ip-discipline-body"><div class="ip-ring" style="--score:${percent}" role="img" aria-label="${ctx.t('Cumplimiento','Compliance')}: ${score.applicable?percent+'%':ctx.t('Sin evaluar','Not evaluated')}"><div class="ip-ring-center">${score.applicable?percent+'%':'—'}</div></div><div class="ip-rule-list">${rules.length?rules.map(rule=>{const c=compliance(closed,[rule]),ok=c.applicable&&c.score>=80;return `<a href="#discipline" class="ip-rule"><span class="ip-rule-icon ${ok?'ip-rule-met':''}">${ok?icon('check',14):''}</span><span title="${esc(rule.text)}">${esc(names[rule.id]||rule.text)}</span></a>`;}).join(''):`<p class="ip-subtitle">${ctx.t('Define tu plan antes de evaluar.','Define your plan before evaluating.')}</p><a href="#discipline" class="ip-text-link">${ctx.t('Crear reglas','Create rules')} →</a>`}</div></div></section>`;
}

export function filterPhoneJournal(trades,filters=journalFilters){
 const q=String(filters.search||'').trim().toLocaleLowerCase();
 return trades.filter(trade=>(!q||[trade.symbol,trade.strategy,trade.notes,...(trade.tags||[])].join(' ').toLocaleLowerCase().includes(q))&&(!filters.side||filters.side==='all'||trade.side===filters.side)&&(!filters.status||filters.status==='all'||trade.status===filters.status)&&(!filters.strategy||trade.strategy===filters.strategy)).sort((a,b)=>String(b.closedAt||b.openedAt).localeCompare(String(a.closedAt||a.openedAt)));
}
export function renderPhoneJournal(ctx){
 const hasAccountTrades=ctx.state.trades.some(trade=>trade.accountId===ctx.account?.id),trades=filterPhoneJournal(ctx.trades),rows=allJournal?trades:trades.slice(0,8),filtered=journalFilters.search||journalFilters.side!=='all'||journalFilters.status!=='all'||journalFilters.strategy;
 return `${heading(ctx,ctx.t('Diario de trading','Trading journal'))}<button class="ip-primary" data-new-trade>${icon('plus',24)} ${ctx.t('Nueva operación','New trade')}</button><div class="ip-journal-controls"><span>${ctx.esc(ctx.account.name)} · ${periodText(ctx)}</span><button data-phone-journal-filter class="ip-filter-button">${icon('search',15)} ${ctx.t('Filtrar','Filter')}${filtered?'<i></i>':''}</button></div>${filtered?`<div class="ip-active-filter"><span>${trades.length} ${ctx.t('resultados','results')}</span><button data-phone-journal-reset>${ctx.t('Limpiar filtros','Clear filters')} ×</button></div>`:''}<section class="ip-card ip-recent"><div class="ip-card-heading"><h2>${ctx.t('Operaciones recientes','Recent trades')}</h2></div><p class="ip-subtitle">${dataText(ctx)}</p><div class="ip-activity">${rows.length?rows.map(trade=>`<button class="ip-list-row" data-trade="${esc(trade.id)}"><span class="ip-side ${trade.side==='buy'?'ip-buy':'ip-sell'}">${trade.side==='buy'?ctx.t('Compra','Buy'):ctx.t('Venta','Sell')}</span><span class="ip-row-strategy"><strong>${esc(trade.symbol)}</strong><small>${esc(trade.strategy||ctx.t('Sin estrategia','No strategy'))} · ${esc(ctx.date(trade.closedAt||trade.openedAt))}</small></span><strong class="ip-row-result ${trade.status==='closed'?tone(net(trade)):''}">${trade.status==='closed'?esc(signedMoney(ctx,net(trade))):ctx.t('Abierta','Open')}</strong>${icon('chevron',14)}</button>`).join(''):`<div class="ip-empty-list"><p>${filtered?ctx.t('No hay operaciones con esos filtros.','No trades match these filters.'):hasAccountTrades?ctx.t('No hay operaciones en este periodo.','No trades in this period.'):ctx.t('Registra una operación o importa tu historial. Después podrás añadir notas, capturas y tu checklist.','Log a trade or import your history. Then add notes, screenshots, and your checklist.')}</p><a href="#import" class="ip-text-link">${icon('upload',17)} ${ctx.t('Importar historial de MT5','Import MT5 history')}</a></div>`}</div>${trades.length>8?`<button class="ip-text-action" data-phone-journal-toggle>${allJournal?ctx.t('Ver recientes','Show recent'):ctx.t('Ver todas','Show all')+' ('+trades.length+')'}</button>`:''}</section>${hasAccountTrades?disciplinePanel(ctx):`<a href="#discipline" class="wf-plan-prompt">${icon('shield',23)}<span><strong>${ctx.state.rules.length?ctx.t('Tu plan está listo','Your plan is ready'):ctx.t('Prepara tu plan de trading','Prepare your trading plan')}</strong><small>${ctx.state.rules.length?ctx.t('Completa el checklist en cada operación.','Complete the checklist for every trade.'):ctx.t('Define las reglas que evaluarás en cada operación.','Define the rules you will evaluate for every trade.')}</small></span>${icon('chevron',15)}</a>`}<div class="ip-inline-actions"><a href="#import">${icon('upload',16)} ${ctx.t('Importar','Import')}</a><a href="#review">${icon('review',16)} ${ctx.t('Revisión semanal','Weekly review')}</a></div>`;
}

function journalFilterSheet(ctx){
 const {t}=ctx,strategies=[...new Set(ctx.trades.map(x=>x.strategy).filter(Boolean))].sort();
 ctx.modal(`<h2>${t('Filtrar diario','Filter journal')}</h2><form data-phone-filter-form><label class="field"><span>${t('Buscar activo, estrategia o nota','Search asset, strategy or note')}</span><input name="search" type="search" maxlength="150" value="${esc(journalFilters.search)}" placeholder="EURUSD, Pullback…"></label><div class="form-grid"><label class="field"><span>${t('Dirección','Direction')}</span><select name="side">${[['all',t('Todas','All')],['buy',t('Compra','Buy')],['sell',t('Venta','Sell')]].map(([v,label])=>`<option value="${v}" ${journalFilters.side===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="field"><span>${t('Estado','Status')}</span><select name="status">${[['all',t('Todos','All')],['closed',t('Cerrada','Closed')],['open',t('Abierta','Open')]].map(([v,label])=>`<option value="${v}" ${journalFilters.status===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="field"><span>${t('Estrategia','Strategy')}</span><select name="strategy"><option value="">${t('Todas','All')}</option>${strategies.map(v=>`<option value="${esc(v)}" ${journalFilters.strategy===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-phone-filter-clear>${t('Limpiar','Clear')}</button><button type="submit" class="btn btn-primary">${t('Aplicar filtros','Apply filters')}</button></div></form>`,root=>{
  root.querySelector('[data-phone-filter-form]').addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(event.currentTarget);journalFilters={search:String(fd.get('search')||'').trim(),side:String(fd.get('side')||'all'),status:String(fd.get('status')||'all'),strategy:String(fd.get('strategy')||'')};allJournal=false;ctx.closeModal();ctx.render();});
  root.querySelector('[data-phone-filter-clear]').addEventListener('click',()=>{journalFilters={search:'',side:'all',status:'all',strategy:''};allJournal=false;ctx.closeModal();ctx.render();});
 });
}

const eaPath=[
 '<path d="M4 27 13 17 21 23 34 8M23 8h11v11"/>',
 '<path d="M4 20h31M11 12l-8 8 8 8M28 12l8 8-8 8"/>',
 '<path d="M4 30 14 18 22 24 35 7M25 7h10v10"/>',
 '<path d="M6 30V23M16 30V17M26 30V10M36 30V4" stroke-width="6"/>',
 '<path d="M3 27 12 14 22 24 35 10"/>'
];
function eaIcon(i){return `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${eaPath[i]}</svg>`;}
export function renderPhoneLibrary(ctx){return `${heading(ctx,ctx.t('Biblioteca de EA','EA library'))}<p class="ip-library-caption">${ctx.t('Estrategias conceptuales para MT5 Desktop.','Conceptual strategies for MT5 Desktop.')}<br>${ctx.t('Ejecución externa en MT5 (solo escritorio).','External execution in MT5 (desktop only).')}</p><div class="ip-ea-list">${EA_CONCEPTS.map((ea,i)=>`<article class="ip-card ip-ea-row"><span class="ip-ea-art ip-ea-${i}">${eaIcon(i)}</span><div class="ip-ea-copy"><h2>${esc(ea.name)}</h2>${status(ctx)}</div><button class="ip-ea-button" data-ea-open="${esc(ea.id)}">${ctx.t('Ver concepto','View concept')}</button></article>`).join('')}</div><a href="#laboratory" class="ip-secondary-link">${icon('lab',18)} ${ctx.t('Abrir laboratorio','Open laboratory')} ${icon('chevron',15)}</a>`;}

export function renderPhoneAnalytics(ctx){return renderAnalysisFlow(ctx);}

function removeInsightIntro(html){
 if(!html.startsWith('<div class="page-intro insight-intro">'))return html;
 const tags=/<\/?div\b[^>]*>/g;let depth=0,match;
 while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(tags.lastIndex);}
 return html;
}
export function renderPhoneReview(ctx){
 const {t}=ctx,weekly=reviewMode==='weekly';
 const panel=weekly?renderWeeklyReview(ctx):removeInsightIntro((planId(ctx.state)==='free'?basicDiscipline(ctx,false):renderDiscipline(ctx)));
 return `${heading(ctx,t('Revisión','Review'))}<p class="wf-screen-intro">${t('Observa tu proceso. Decide qué vas a mejorar.','Review your process. Decide what you will improve.')}</p><div class="wf-review-tabs" role="tablist" aria-label="${t('Tu revisión','Your review')}"><button type="button" id="wf-weekly-tab" role="tab" aria-selected="${weekly}" aria-controls="wf-review-panel" data-phone-review-mode="weekly">${t('Revisión semanal','Weekly review')}</button><button type="button" id="wf-discipline-tab" role="tab" aria-selected="${!weekly}" aria-controls="wf-review-panel" data-phone-review-mode="discipline">${t('Disciplina','Discipline')}</button></div><div class="wf-review ip-secondary" id="wf-review-panel" role="tabpanel" aria-labelledby="${weekly?'wf-weekly-tab':'wf-discipline-tab'}">${panel}</div>`;
}
export function renderPhoneTools(ctx){
 const {t}=ctx,tools=[
  ['library','lab',t('Biblioteca de EA','EA library'),t('Cinco conceptos y sus fichas completas.','Five concepts and their full details.'),'SuperTrade'],
  ['laboratory','target',t('Laboratorio','Laboratory'),t('Documenta tus evaluaciones históricas y observaciones.','Document your historical evaluations and observations.'),t('Registro manual','Manual records')],
  ['markets','analytics',t('Mercados','Markets'),t('Explora activos y guarda tus niveles de referencia.','Explore instruments and save your reference levels.'),t('Gráficos','Charts')]
 ];
 return `${heading(ctx,t('Herramientas','Tools'))}<p class="wf-screen-intro">${t('Recursos para explorar y documentar. Tu diario sigue siendo el centro.','Resources to explore and document. Your journal remains the center.')}</p><div class="wf-tool-list">${tools.map(([route,glyph,title,detail,badge])=>`<a href="#${route}" class="wf-tool-card"><span class="wf-tool-icon">${icon(glyph,27)}</span><span class="wf-tool-copy"><strong>${title}</strong><small>${detail}</small><span class="wf-tool-badge">${badge}</span></span>${icon('chevron',16)}</a>`).join('')}</div><div class="ip-settings-label">${t('RECURSOS','RESOURCES')}</div><section class="ip-card ip-settings-group">${settingsRow(ctx,'guide','compass',t('Identidad y guía visual','Identity and visual guide'),t('Las 49 referencias de TradeCompass.','The 49 TradeCompass references.'))}${settingsRow(ctx,'communications','file',t('Plantillas de comunicación','Communication templates'),t('Textos e imágenes para descargar.','Text and images to download.'))}</section>`;
}

function settingsRow(ctx,route,glyph,title,detail=''){return `<a class="ip-settings-row" href="#${route}"><span class="ip-settings-icon">${icon(glyph,21)}</span><span class="ip-settings-copy"><strong>${title}</strong>${detail?`<small>${detail}</small>`:''}</span>${icon('chevron',15)}</a>`;}
export function renderPhoneSettings(ctx){
 const {t,state,account}=ctx,name=state.settings.name||'Trader';
 const groups=[
  [t('CUENTA Y DATOS','ACCOUNT AND DATA'),[['settings-details','settings',t('Cuentas y conexiones','Accounts and connections')],['reports','download',t('Exportación y respaldo','Exports and backup')]]],
  [t('INFORMACIÓN Y AYUDA','INFORMATION AND HELP'),[['plans','wallet',t('Planes y facturación','Plans and billing')],['docs','file',t('Ayuda e instalación','Help and installation')]]]
 ];
 return `${heading(ctx,t('Perfil','Profile'))}<section class="ip-card ip-profile-card"><a href="#welcome" class="ip-profile-link"><span class="ip-avatar">${esc(name.slice(0,1).toUpperCase())}</span><span><strong>${esc(name)}</strong><small>${t('Editar perfil','Edit profile')}</small></span>${icon('chevron',17)}</a></section><div class="ip-settings-label">${t('CUENTA ACTIVA','ACTIVE ACCOUNT')}</div>${state.accounts.filter(a=>!a.archived).length>1?`<label class="sr-only" for="phone-active-account">${t('Cuenta activa','Active account')}</label><select id="phone-active-account" class="ip-account-select">${state.accounts.filter(a=>!a.archived||a.id===account.id).map(a=>`<option value="${esc(a.id)}" ${a.id===account.id?'selected':''}>${esc(a.name)} · ${esc(a.currency)}</option>`).join('')}</select>`:''}<section class="ip-card ip-account-card"><button class="ip-settings-row" data-edit-account="${esc(account.id)}"><span class="ip-settings-icon">${icon('wallet',21)}</span><span class="ip-settings-copy"><strong>${esc(account.name)}</strong><small>${esc(account.currency)} · ${esc(account.platform||'MT5')}</small></span>${icon('edit',17)}</button></section><a href="#tools" class="wf-tools-entry"><span class="wf-tool-icon">${icon('lab',25)}</span><span><strong>${t('Herramientas','Tools')}</strong><small>${t('EA, laboratorio y mercados.','EAs, laboratory, and markets.')}</small></span>${icon('chevron',16)}</a>${groups.map(([title,rows])=>`<div class="ip-settings-label">${title}</div><section class="ip-card ip-settings-group">${rows.map(([route,glyph,text])=>settingsRow(ctx,route,glyph,text)).join('')}</section>`).join('')}<div class="ip-settings-label">${t('APARIENCIA','APPEARANCE')}</div><section class="ip-card ip-appearance"><div class="ip-theme-picker" role="group" aria-label="${t('Tema','Theme')}"><button class="ip-theme-choice ${state.settings.theme!=='light'?'is-selected':''}" data-phone-theme="dark" aria-pressed="${state.settings.theme!=='light'}">${t('Oscuro','Dark')}</button><button class="ip-theme-choice ${state.settings.theme==='light'?'is-selected':''}" data-phone-theme="light" aria-pressed="${state.settings.theme==='light'}">${t('Claro','Light')}</button></div></section>${planId(state)!=='free'?`<button class="ip-secondary-link" data-phone-sync>${icon('cloud',18)} ${t('Sincronizar ahora','Sync now')} ${icon('chevron',15)}</button>`:''}<button class="ip-text-action" data-phone-demo>${state.mode==='demo'?t('Volver a mis datos','Back to my data'):t('Ver diario de ejemplo','View sample journal')}</button><p class="ip-product-footer">TradeCompass<br>${t('Tu diario. Tus reglas. Tu perspectiva.','Your journal. Your rules. Your perspective.')}</p>`;
}

function reviewFields(form){
 const value=name=>String(form.elements?.[name]?.value||'');
 return {week:value('week'),reviewId:value('reviewId'),answers:Array.from({length:6},(_,i)=>value(`answer${i}`)),action:value('action')};
}
function sameReviewFields(a,b){
 return a.week===b.week&&a.reviewId===b.reviewId&&a.action===b.action&&a.answers.every((value,i)=>value===b.answers[i]);
}
function reviewWeek(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const date=new Date(`${value}T12:00:00`);if(!Number.isFinite(+date))return value;
 date.setDate(date.getDate()-((date.getDay()+6)%7));
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function draftMatchesSaved(ctx,draft,accountId){
 const saved=(ctx.state.reviews||[]).find(row=>row.accountId===accountId&&row.week===reviewWeek(draft.week));
 return draft.action.trim()===(saved?.action||'').trim()&&draft.answers.every((value,i)=>value.trim()===(saved?.answers?.[i]||'').trim());
}
/** Keep only unsaved weekly fields, in memory, under the account that rendered the form. */
export function capturePhoneDraft(root=globalThis.document){
 const progressive=captureWeeklyDraft(root);
 const form=root?.querySelector?.('[data-insight-review-form][data-phone-review-account]');
 const accountId=form?.dataset?.phoneReviewAccount,baseline=form&&reviewBaselines.get(form);
 if(!form||!accountId||!baseline)return Boolean(progressive);
 const fields=reviewFields(form);
 if(sameReviewFields(fields,baseline)){reviewDrafts.delete(accountId);return Boolean(progressive);}
 reviewDrafts.set(accountId,fields);return true;
}
/** Record the saved baseline before restoring a pending draft with input values only. */
export function restorePhoneDraft(ctx,root=globalThis.document){
 const form=root?.querySelector?.('[data-insight-review-form][data-phone-review-account]');
 const accountId=form?.dataset?.phoneReviewAccount;if(!form||!accountId)return false;
 reviewBaselines.set(form,reviewFields(form));
 const draft=reviewDrafts.get(accountId);
 if(draft){
  if(draftMatchesSaved(ctx,draft,accountId))reviewDrafts.delete(accountId);
  else{
   const fields={week:draft.week,reviewId:draft.reviewId,action:draft.action,...Object.fromEntries(draft.answers.map((value,i)=>[`answer${i}`,value]))};
   for(const [key,value]of Object.entries(fields))if(form.elements[key])form.elements[key].value=value;
  }
 }
 form.elements.week?.addEventListener?.('change',()=>queueMicrotask(()=>{
  if(form.isConnected===false)return;
  // bindInsights loads the chosen saved week later in the same change event.
  reviewBaselines.set(form,reviewFields(form));reviewDrafts.delete(accountId);
 }));
 return !!draft&&reviewDrafts.has(accountId);
}

export function bindPhone(ctx){
 if(document.querySelector('.af-page'))bindAnalysisFlow(ctx);else bindPhoneCharts(ctx);
 bindWeeklyReview(ctx);
 restorePhoneDraft(ctx);
 document.querySelectorAll('[data-phone-review-mode]').forEach(button=>button.addEventListener('click',()=>{capturePhoneDraft();reviewMode=button.dataset.phoneReviewMode==='discipline'?'discipline':'weekly';ctx.render();requestAnimationFrame(()=>document.querySelector(`[data-phone-review-mode="${reviewMode}"]`)?.focus({preventScroll:true}));}));
 document.querySelector('[data-phone-journal-filter]')?.addEventListener('click',()=>journalFilterSheet(ctx));
 document.querySelector('[data-phone-journal-reset]')?.addEventListener('click',()=>{journalFilters={search:'',side:'all',status:'all',strategy:''};allJournal=false;ctx.render();});
 document.querySelectorAll('[data-phone-chart-kind]').forEach(button=>button.addEventListener('click',()=>{analyticsChart=button.dataset.phoneChartKind;ctx.render();}));
 document.querySelector('#phone-active-account')?.addEventListener('change',event=>ctx.selectAccount(event.target.value));
 document.querySelector('[data-phone-journal-toggle]')?.addEventListener('click',()=>{allJournal=!allJournal;ctx.render();});
 document.querySelectorAll('[data-phone-period]').forEach(el=>el.addEventListener('click',()=>ctx.modal(`<h2 class="ip-sheet-title">${ctx.t('Periodo','Period')}</h2><div class="ip-period-options">${[['week',ctx.t('Últimos 7 días','Last 7 days')],['month',ctx.t('Últimos 30 días','Last 30 days')],['all',ctx.t('Todo el historial','All history')]].map(([value,text])=>`<button class="ip-period-option ${value===ctx.period?'is-selected':''}" data-phone-period-value="${value}">${text}${value===ctx.period?icon('check',19):''}</button>`).join('')}</div>`,dialog=>dialog.querySelectorAll('[data-phone-period-value]').forEach(button=>button.addEventListener('click',()=>{ctx.closeModal();ctx.setPeriod(button.dataset.phonePeriodValue);})))));
 document.querySelectorAll('[data-phone-theme]').forEach(button=>button.addEventListener('click',async()=>{try{await ctx.update(state=>{state.settings.theme=button.dataset.phoneTheme;});}catch{}}));
 document.querySelector('[data-phone-motion]')?.addEventListener('change',async event=>{const checked=event.target.checked;try{await ctx.update(state=>{state.settings.reducedMotion=checked;});}catch{}});
 document.querySelector('[data-phone-sync]')?.addEventListener('click',()=>ctx.syncNow());
}
