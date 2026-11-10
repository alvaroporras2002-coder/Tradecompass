import {net,metrics} from '../domain.js';
import {esc,icon} from '../ui.js';
import {renderPhoneChart,bindPhoneCharts} from '../phone-charts.js';
import {openTradeDetail} from './journal.js';

const DAY=86400000;
const defaults={from:'',to:'',symbol:'',side:'all',strategy:'',tag:'',emotion:'',emotionPhase:'any',compliance:'all',hourFrom:'',hourTo:''};
const views=new Map(),formatters=new Map(),localPartsCache=new Map();
const viewFor=id=>{if(!views.has(id))views.set(id,{filters:{...defaults},dimension:'strategy',chart:'result'});return views.get(id);};
const localFormatter=zone=>{if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}));return formatters.get(zone);};
export function analysisLocalTime(value,timeZone='UTC'){
 const timestamp=typeof value==='string'&&value?Date.parse(value):NaN;if(!Number.isFinite(timestamp))return null;
 const key=timeZone+'|'+timestamp;if(localPartsCache.has(key))return localPartsCache.get(key);
 const parts=Object.fromEntries(localFormatter(timeZone).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
 const result={day:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)%24,timestamp};
 if(localPartsCache.size>60000)localPartsCache.clear();localPartsCache.set(key,result);return result;
}
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function normalizeAnalysisFilters(input={}){
 const filters=Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,input[key]===null||input[key]===undefined?value:String(input[key]).trim()]));
 for(const key of ['from','to'])if(filters[key]&&!validDay(filters[key]))throw new Error('Las fechas del análisis no son válidas.');
 if(filters.from&&filters.to&&filters.from>filters.to)throw new Error('La fecha inicial debe ser anterior o igual a la final.');
 for(const key of ['hourFrom','hourTo'])if(filters[key]!==''&&(!/^\d{1,2}$/.test(filters[key])||Number(filters[key])<0||Number(filters[key])>23))throw new Error('Usa horas entre 0 y 23.');
 if(!['all','buy','sell'].includes(filters.side))throw new Error('La dirección no es válida.');
 if(!['any','before','during','after'].includes(filters.emotionPhase))throw new Error('La fase emocional no es válida.');
 if(!['all','met','broken','unevaluated'].includes(filters.compliance))throw new Error('El estado de disciplina no es válido.');
 return filters;
}
export function classifyCompliance(trade,rules=[]){
 const relevant=rules.filter(rule=>!rule.strategy||['all','*'].includes(rule.strategy)||rule.strategy===trade.strategy);
 if(!relevant.length)return 'unevaluated';
 const answers=relevant.map(rule=>trade.checklist?.[rule.id]);
 if(answers.includes('no'))return 'broken';
 return answers.some(answer=>answer==='yes')&&answers.every(answer=>answer==='yes'||answer==='na')?'met':'unevaluated';
}
const emotionValues=(trade,phase)=>phase==='any'?[trade.emotionBefore,trade.emotionDuring,trade.emotionAfter]:[trade[{before:'emotionBefore',during:'emotionDuring',after:'emotionAfter'}[phase]]];
export function filterAnalysis(state,account,input={},options={}){
 const accountId=typeof account==='string'?account:account?.id,filters=normalizeAnalysisFilters(input),timeZone=options.timeZone||state.settings?.timezone||account?.timezone||'UTC';
 localFormatter(timeZone).format(new Date(0));
 const now=options.now===undefined?Date.now():new Date(options.now).getTime();if(!Number.isFinite(now))throw new Error('La fecha de referencia no es válida.');
 const period=options.period||'all',customDates=!!(filters.from||filters.to),cutoff=customDates?-Infinity:period==='week'?now-7*DAY:period==='month'?now-30*DAY:-Infinity;
 const baseRows=(state.trades||[]).filter(trade=>{
  if(trade.accountId!==accountId||trade.status!=='closed')return false;
  const local=analysisLocalTime(trade.closedAt,timeZone);if(!local||local.timestamp<cutoff)return false;
  return (!filters.from||local.day>=filters.from)&&(!filters.to||local.day<=filters.to);
 }).slice().sort((a,b)=>String(a.closedAt).localeCompare(String(b.closedAt))||String(a.id).localeCompare(String(b.id)));
 let unknownOpeningCount=0;const hourFiltered=filters.hourFrom!==''||filters.hourTo!=='';
 const fromHour=filters.hourFrom===''?0:Number(filters.hourFrom),toHour=filters.hourTo===''?23:Number(filters.hourTo);
 const rows=baseRows.filter(trade=>{
  if(filters.symbol&&trade.symbol!==filters.symbol)return false;
  if(filters.side!=='all'&&trade.side!==filters.side)return false;
  if(filters.strategy&&trade.strategy!==filters.strategy)return false;
  if(filters.tag&&!(trade.tags||[]).includes(filters.tag))return false;
  if(filters.emotion&&!emotionValues(trade,filters.emotionPhase).includes(filters.emotion))return false;
  if(filters.compliance!=='all'&&classifyCompliance(trade,state.rules||[])!==filters.compliance)return false;
  const opening=analysisLocalTime(trade.openedAt,timeZone);if(!opening)unknownOpeningCount++;
  if(hourFiltered){const local=opening;if(!local)return false;const within=fromHour<=toHour?local.hour>=fromHour&&local.hour<=toHour:local.hour>=fromHour||local.hour<=toHour;if(!within)return false;}
  return true;
 });
 return {rows,baseRows,unknownOpeningCount,timeZone,customDates,filters,hourFiltered};
}
export function groupAnalysis(rows,rules=[],dimension='strategy',timeZone='UTC'){
 const groups=new Map();
 const values=trade=>dimension==='symbol'?[trade.symbol||'Sin activo']:dimension==='hour'?[analysisLocalTime(trade.openedAt,timeZone)?.hour??'unknown']:dimension==='tag'?[...new Set(trade.tags?.length?trade.tags:['Sin etiqueta'])]:dimension==='emotion'?[trade.emotionBefore||'Sin emoción']:dimension==='compliance'?[classifyCompliance(trade,rules)]:[trade.strategy||'Sin estrategia'];
 for(const trade of rows)for(const value of values(trade)){
  const id=String(value);if(!groups.has(id))groups.set(id,{id,label:dimension==='hour'?(value==='unknown'?'Hora no registrada':`${String(value).padStart(2,'0')}:00–${String(value).padStart(2,'0')}:59`):id,rows:[]});groups.get(id).rows.push(trade);
 }
 return [...groups.values()].map(group=>{const result=metrics(group.rows,0,[]);return {...group,count:result.closedCount,net:result.net,winRate:result.winRate};}).sort((a,b)=>b.count-a.count||b.net-a.net||a.label.localeCompare(b.label));
}
export function buildAnalysis(state,account,filters={},options={}){
 const filtered=filterAnalysis(state,account,filters,options);
 return {...filtered,stats:metrics(filtered.rows,0,[]),allClosedCount:(state.trades||[]).filter(trade=>trade.accountId===(typeof account==='string'?account:account?.id)&&trade.status==='closed').length};
}
function currentAnalysis(ctx){const view=viewFor(ctx.account.id);return buildAnalysis(ctx.state,ctx.account,view.filters,{period:ctx.period,timeZone:ctx.state.settings.timezone});}
const locale=ctx=>ctx.state.settings.language==='en'?'en-US':'es-CR';
const decimal=(ctx,value,digits=2)=>new Intl.NumberFormat(locale(ctx),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const tone=value=>value<0?'negative':value>0?'positive':'';
const signedMoney=(ctx,value)=>`${value>0?'+':''}${ctx.money(value)}`;
const choices=(items)=>[...new Set(items.filter(value=>typeof value==='string'&&value.trim()))].sort((a,b)=>a.localeCompare(b));
const activeCount=filters=>Object.entries(filters).filter(([key,value])=>value!==defaults[key]&&!(key==='emotionPhase'&&!filters.emotion)).length;
function dateLabel(ctx,day){return new Intl.DateTimeFormat(locale(ctx),{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00Z'));}
function periodLabel(ctx,analysis){
 const f=analysis.filters;if(analysis.customDates){if(f.from&&f.to)return `${dateLabel(ctx,f.from)} — ${dateLabel(ctx,f.to)}`;return f.from?ctx.t('Desde ','From ')+dateLabel(ctx,f.from):ctx.t('Hasta ','Through ')+dateLabel(ctx,f.to);}
 return ctx.period==='week'?ctx.t('Últimos 7 días','Last 7 days'):ctx.period==='all'?ctx.t('Todo el historial','All history'):ctx.t('Últimos 30 días','Last 30 days');
}
function groupLabel(ctx,group,dimension){
 if(dimension==='compliance')return ({met:ctx.t('Plan cumplido','Plan met'),broken:ctx.t('Con incumplimientos','With rule breaks'),unevaluated:ctx.t('Sin evaluación completa','Not fully evaluated')})[group.id]||group.label;
 const labels={'Sin estrategia':ctx.t('Sin estrategia','No strategy'),'Sin activo':ctx.t('Sin activo','No asset'),'Sin etiqueta':ctx.t('Sin etiqueta','No tag'),'Sin emoción':ctx.t('Sin emoción','No emotion'),'Hora no registrada':ctx.t('Hora no registrada','Opening time unknown')};return labels[group.label]||group.label;
}
function metricCard(ctx,title,value,note='',color=''){return `<section class="ip-card ip-kpi af-kpi"><h2>${title}</h2><strong class="${color}">${esc(value)}</strong>${note?`<small>${note}</small>`:''}</section>`;}
export function renderAnalysisFlow(ctx){
 const {t}=ctx,view=viewFor(ctx.account.id),a=currentAnalysis(ctx),m=a.stats,has=m.closedCount>0,count=activeCount(a.filters),groups=groupAnalysis(a.rows,ctx.state.rules,view.dimension,a.timeZone);
 const pf=!has?'—':m.profitFactor===null?(m.wins?'∞':'—'):decimal(ctx,m.profitFactor),expectancy=has?ctx.money(m.expectancy):'—',drawdown=has?ctx.money(m.maxDrawdown):'—',r=has&&m.avgR!==null?decimal(ctx,m.avgR)+'R':'—';
 const chartContext={...ctx,trades:a.rows,stats:m};
 const dimensions=[['strategy',t('Estrategia','Strategy')],['symbol',t('Activo','Asset')],['hour',t('Hora de apertura','Opening hour')],['tag',t('Etiqueta','Tag')],['emotion',t('Emoción antes de entrar','Emotion before entry')],['compliance',t('Disciplina','Discipline')]];
 return `<div class="af-page"><div class="af-heading"><h1 class="ip-page-title">${t('Análisis','Analysis')}</h1><button class="af-filter-button" data-af-filters>${icon('search',17)} ${t('Filtrar','Filter')}${count?`<span>${count}</span>`:''}</button></div><button class="ip-period-line" data-af-period><span>${esc(periodLabel(ctx,a))}</span>${icon('chevron',15)}</button><p class="af-context">${esc(ctx.account.name)} · ${esc(ctx.account.currency)} · <strong>${m.closedCount}</strong> ${t('operaciones cerradas','closed trades')}</p>${count?`<div class="af-filter-state"><span>${t('Vista filtrada','Filtered view')}</span><button data-af-reset>${t('Restablecer filtros','Reset filters')} ×</button></div>`:''}<div class="ip-kpis">${metricCard(ctx,'Profit factor',pf,has&&m.wins&&!m.losses?t('Sin pérdidas en esta muestra','No losses in this sample'):'')}${metricCard(ctx,t('Expectativa neta','Net expectancy'),expectancy,'',has?tone(m.expectancy):'')}${metricCard(ctx,t('Drawdown de la muestra','Sample drawdown'),drawdown,'',has&&m.maxDrawdown>0?'negative':'')}${metricCard(ctx,t('Resultado medio en R','Average result in R'),r,has?`${m.rCount}/${m.closedCount} ${t('con riesgo inicial','with initial risk')}`:'')}</div>${has?`<div class="ip-chart-mode" role="group" aria-label="${t('Tipo de gráfico','Chart type')}"><button class="${view.chart==='result'?'is-active':''}" data-af-chart="result" aria-pressed="${view.chart==='result'}">${t('Resultado','Result')}</button><button class="${view.chart==='drawdown'?'is-active':''}" data-af-chart="drawdown" aria-pressed="${view.chart==='drawdown'}">Drawdown</button></div><section class="ip-card ip-chart-card"><h2>${view.chart==='result'?t('Resultado de la muestra','Sample result'):t('Caídas desde el máximo','Declines from the peak')}</h2><p class="af-caption">${t('Neto acumulado de las operaciones seleccionadas.','Cumulative net result of selected trades.')}</p>${renderPhoneChart(chartContext,{kind:view.chart})}</section><div class="af-sample-summary"><span>${t('Resultado neto','Net result')}<strong class="${tone(m.net)}">${esc(signedMoney(ctx,m.net))}</strong></span><span>${t('Acierto','Win rate')}<strong>${decimal(ctx,m.winRate,1)}%</strong></span></div>`:`<section class="ip-card af-empty">${icon('analytics',31)}<h2>${a.allClosedCount?t('Ninguna operación coincide.','No trades match.'):t('Primero, una muestra real.','First, a real sample.')}</h2><p>${a.allClosedCount?t('Amplía el periodo o cambia los filtros para explorar tu historial.','Expand the period or change your filters to explore your history.'):t('Registra o importa operaciones cerradas para estudiar tus resultados. R necesita además el riesgo inicial.','Log or import closed trades to study your results. R also needs initial risk.')}</p>${a.allClosedCount?`<button class="ip-primary" data-af-reset>${t('Limpiar filtros y ver todo','Clear filters and show all')}</button>`:`<a class="ip-primary" href="#journal">${t('Abrir mi diario','Open my journal')} ${icon('arrow',17)}</a><a class="af-text-link" href="#import">${t('Importar desde MT5','Import from MT5')}</a>`}</section>`}${has?`<section class="ip-card af-breakdown"><div class="af-breakdown-head"><h2>${t('Encuentra el patrón','Find the pattern')}</h2><label><span class="sr-only">${t('Agrupar por','Group by')}</span><select data-af-group>${dimensions.map(([value,text])=>`<option value="${value}" ${view.dimension===value?'selected':''}>${text}</option>`).join('')}</select></label></div><p class="af-caption">${t('Abre un grupo para ver las operaciones que lo explican.','Open a group to inspect the trades behind it.')}</p><div class="af-groups">${groups.map((group,index)=>`<button class="af-group" data-af-group-open="${index}"><span><strong>${esc(groupLabel(ctx,group,view.dimension))}</strong><small>${group.count} ${t('operaciones','trades')} · ${decimal(ctx,group.winRate,1)}% ${t('acierto','win rate')}</small></span><b class="${tone(group.net)}">${esc(signedMoney(ctx,group.net))}</b>${icon('chevron',14)}</button>`).join('')}</div>${view.dimension==='tag'?`<p class="af-caption af-overlap">${t('Una operación puede tener varias etiquetas. Los grupos se superponen y no deben sumarse.','A trade can have multiple tags. Groups overlap and must not be added together.')}</p>`:''}</section>`:''}<div class="af-notes"><p>${t('Fechas por cierre; horas por apertura.','Dates use closing time; hours use opening time.')} <strong>${esc(a.timeZone)}</strong>.</p>${a.hourFiltered&&a.unknownOpeningCount?`<p>${a.unknownOpeningCount} ${t('operaciones coincidentes no tienen hora de apertura y no participan en el filtro horario.','matching trades have no opening time and are excluded from the hour filter.')}</p>`:''}${has&&m.rCount<m.closedCount?`<p>${t('R solo usa operaciones con riesgo inicial documentado.','R uses only trades with documented initial risk.')}</p>`:''}<p>${t('Los depósitos y retiros quedan fuera del resultado.','Deposits and withdrawals are excluded from trading results.')}</p></div><a href="#reports" class="ip-secondary-link">${icon('download',18)} ${t('Informes de la cuenta','Account reports')} ${icon('chevron',15)}</a></div>`;
}
function option(value,label,current){return `<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;}
function filterSheet(ctx){
 const {t}=ctx,view=viewFor(ctx.account.id),f=view.filters,all=ctx.state.trades.filter(trade=>trade.accountId===ctx.account.id&&trade.status==='closed');
 const symbols=choices([...all.map(x=>x.symbol),f.symbol]),strategies=choices([...all.map(x=>x.strategy),f.strategy]),tags=choices([...all.flatMap(x=>x.tags||[]),f.tag]),emotions=choices([...all.flatMap(x=>[x.emotionBefore,x.emotionDuring,x.emotionAfter]),f.emotion]);
 const select=(name,title,values,emptyLabel)=>`<label class="field"><span>${title}</span><select name="${name}">${option('',emptyLabel,f[name])}${values.map(value=>option(value,value,f[name])).join('')}</select></label>`;
 ctx.modal(`<div class="af-filter-sheet"><h2>${t('Explora tu historial','Explore your history')}</h2><p>${esc(ctx.account.name)} · ${esc(ctx.account.currency)}</p><form data-af-filter-form><div class="af-filter-section"><h3>${t('Periodo y operación','Period and trade')}</h3><p>${t('Las fechas personalizadas sustituyen el periodo relativo.','Custom dates replace the relative period.')}</p><label class="field"><span>${t('Desde (cierre)','From (close)')}</span><input name="from" type="date" value="${esc(f.from)}"></label><label class="field"><span>${t('Hasta (cierre)','Through (close)')}</span><input name="to" type="date" value="${esc(f.to)}"></label>${select('symbol',t('Activo','Asset'),symbols,t('Todos los activos','All assets'))}<label class="field"><span>${t('Dirección','Direction')}</span><select name="side">${[['all',t('Todas','All')],['buy',t('Compra','Buy')],['sell',t('Venta','Sell')]].map(([value,text])=>option(value,text,f.side)).join('')}</select></label>${select('strategy',t('Estrategia','Strategy'),strategies,t('Todas las estrategias','All strategies'))}</div><details class="af-filter-details"><summary>${t('Horario de apertura','Opening hours')}${f.hourFrom!==''||f.hourTo!==''?' · '+t('Activo','Active'):''}</summary><p>${t('Hora local entre 00 y 23, con extremos incluidos. Si el inicio es mayor que el final, el rango cruza medianoche. Las aperturas no documentadas quedan fuera.','Local hour from 00 to 23, including both endpoints. If the start is later than the end, the range crosses midnight. Undocumented openings are excluded.')} ${esc(ctx.state.settings.timezone)}</p><label class="field"><span>${t('Desde la hora','From hour')}</span><select name="hourFrom">${option('',t('Sin límite','No limit'),f.hourFrom)}${Array.from({length:24},(_,i)=>option(String(i),String(i).padStart(2,'0')+':00',f.hourFrom)).join('')}</select></label><label class="field"><span>${t('Hasta la hora','Through hour')}</span><select name="hourTo">${option('',t('Sin límite','No limit'),f.hourTo)}${Array.from({length:24},(_,i)=>option(String(i),String(i).padStart(2,'0')+':59',f.hourTo)).join('')}</select></label></details><details class="af-filter-details"><summary>${t('Contexto y disciplina','Context and discipline')}</summary>${select('tag',t('Etiqueta','Tag'),tags,t('Todas las etiquetas','All tags'))}${select('emotion',t('Emoción','Emotion'),emotions,t('Todas las emociones','All emotions'))}<label class="field"><span>${t('Momento de la emoción','Emotion phase')}</span><select name="emotionPhase">${[['any',t('Cualquier momento','Any phase')],['before',t('Antes de entrar','Before entry')],['during',t('Durante','During')],['after',t('Después','After')]].map(([value,text])=>option(value,text,f.emotionPhase)).join('')}</select></label><label class="field"><span>${t('Cumplimiento de reglas','Rule compliance')}</span><select name="compliance">${[['all',t('Todas las operaciones','All trades')],['met',t('Plan cumplido','Plan met')],['broken',t('Con incumplimientos','With rule breaks')],['unevaluated',t('Sin evaluación completa','Not fully evaluated')]].map(([value,text])=>option(value,text,f.compliance)).join('')}</select></label><p>${t('Una respuesta pendiente no cuenta como cumplimiento. Una sola regla incumplida identifica un incumplimiento.','A pending answer does not count as compliance. One failed rule identifies a rule break.')}</p></details><p class="negative af-filter-error" role="alert"></p><div class="af-filter-actions"><button type="button" class="btn btn-ghost" data-af-sheet-reset>${t('Restablecer','Reset')}</button><button type="submit" class="btn btn-primary">${t('Aplicar filtros','Apply filters')}</button></div></form></div>`,root=>{
  const form=root.querySelector('[data-af-filter-form]');form.addEventListener('submit',event=>{event.preventDefault();const input=Object.fromEntries(new FormData(form));try{view.filters=normalizeAnalysisFilters(input);ctx.closeModal();ctx.render();}catch(error){root.querySelector('.af-filter-error').textContent=ctx.state.settings.language==='en'?'Check the dates and hour range.':error.message;}});
  root.querySelector('[data-af-sheet-reset]').addEventListener('click',()=>{view.filters={...defaults};ctx.closeModal();ctx.render();});
 });
}
function periodSheet(ctx){
 const {t}=ctx;ctx.modal(`<h2>${t('Periodo del análisis','Analysis period')}</h2><div class="ip-period-options">${[['week',t('Últimos 7 días','Last 7 days')],['month',t('Últimos 30 días','Last 30 days')],['all',t('Todo el historial','All history')]].map(([value,label])=>`<button class="ip-period-option" data-af-period-value="${value}">${label}</button>`).join('')}<button class="ip-period-option" data-af-custom-date>${t('Elegir fechas','Choose dates')} ${icon('calendar',18)}</button></div>`,root=>{
  root.querySelectorAll('[data-af-period-value]').forEach(button=>button.addEventListener('click',()=>{const view=viewFor(ctx.account.id);view.filters={...view.filters,from:'',to:''};ctx.closeModal();ctx.setPeriod(button.dataset.afPeriodValue);}));
  root.querySelector('[data-af-custom-date]').addEventListener('click',()=>filterSheet(ctx));
 });
}
function groupSheet(ctx,index){
 const a=currentAnalysis(ctx),view=viewFor(ctx.account.id),group=groupAnalysis(a.rows,ctx.state.rules,view.dimension,a.timeZone)[index];if(!group)return;
 ctx.modal(`<div class="af-trade-sheet"><p class="eyebrow">${ctx.t('LAS OPERACIONES DETRÁS DEL PATRÓN','TRADES BEHIND THE PATTERN')}</p><h2>${esc(groupLabel(ctx,group,view.dimension))}</h2><div class="af-group-summary"><span>${group.count} ${ctx.t('operaciones cerradas','closed trades')} · ${esc(ctx.account.currency)}</span><strong class="${tone(group.net)}">${esc(signedMoney(ctx,group.net))}</strong></div><div class="af-trades">${group.rows.slice().reverse().map(trade=>`<button data-af-trade="${esc(trade.id)}"><span><strong>${esc(trade.symbol)}</strong><small>${esc(ctx.date(trade.closedAt))} · ${trade.side==='buy'?ctx.t('Compra','Buy'):ctx.t('Venta','Sell')}</small></span><b class="${tone(net(trade))}">${esc(signedMoney(ctx,net(trade)))}</b>${icon('chevron',14)}</button>`).join('')}</div></div>`,root=>root.querySelectorAll('[data-af-trade]').forEach(button=>button.addEventListener('click',()=>{ctx.closeModal();openTradeDetail(ctx,button.dataset.afTrade);}))); 
}
export function bindAnalysisFlow(ctx){
 bindPhoneCharts(ctx);
 document.querySelector('[data-af-filters]')?.addEventListener('click',()=>filterSheet(ctx));
 document.querySelector('[data-af-period]')?.addEventListener('click',()=>periodSheet(ctx));
 document.querySelectorAll('[data-af-reset]').forEach(button=>button.addEventListener('click',()=>{viewFor(ctx.account.id).filters={...defaults};if(ctx.period!=='all'&&currentAnalysis(ctx).rows.length===0)ctx.setPeriod('all');else ctx.render();}));
 document.querySelectorAll('[data-af-chart]').forEach(button=>button.addEventListener('click',()=>{viewFor(ctx.account.id).chart=button.dataset.afChart==='drawdown'?'drawdown':'result';ctx.render();}));
 document.querySelector('[data-af-group]')?.addEventListener('change',event=>{viewFor(ctx.account.id).dimension=event.target.value;ctx.render();});
 document.querySelectorAll('[data-af-group-open]').forEach(button=>button.addEventListener('click',()=>groupSheet(ctx,Number(button.dataset.afGroupOpen))));
}
