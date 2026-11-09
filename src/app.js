import {createEmptyState} from './demo.js';
import {migrateWorkspace} from './workspace.js';
import {loadState,saveState,saveMigrationSnapshot} from './storage.js';
import {net,metrics,filterTrades,validateBackup} from './domain.js';
import {esc,icon} from './ui.js';
import {renderSummary} from './views/summary.js';
import {createSync} from './sync.js';
import {renderAnalytics,renderDiscipline,renderReview,renderLab,bindInsights} from './views/insights.js';
import {renderSettings,renderImport,bindManage} from './views/manage.js';
import {renderJournal,bindJournal} from './views/journal.js';
let state,accountId,route='summary',period='month',installPrompt,syncManager,toastTimer,modalOpener;
let saveQueue=Promise.resolve();
const app=document.querySelector('#app'),dialog=document.querySelector('#modal');
const routes={summary:['Resumen','Overview','overview'],journal:['Diario','Journal','journal'],lab:['EA','EA','lab'],analytics:['Estadísticas','Statistics','analytics'],settings:['Ajustes','Settings','settings'],discipline:['Disciplina','Discipline','shield'],review:['Revisión semanal','Weekly review','review'],import:['Importar MT5','Import MT5','upload']};
const primary=['summary','journal','lab','analytics','settings'];
const t=(es,en)=>state?.settings?.language==='en'?en:es;
const money=n=>new Intl.NumberFormat(state?.settings?.language==='en'?'en-US':'es-CR',{style:'currency',currency:account()?.currency||'USD',maximumFractionDigits:2}).format(Number(n)||0);
const date=(value,options={})=>{if(!value)return '—';try{return new Intl.DateTimeFormat(state?.settings?.language==='en'?'en-US':'es-CR',{...(!options.dateStyle&&!options.timeStyle?{month:'short',day:'numeric'}:{}),timeZone:state?.settings?.timezone||'UTC',...options}).format(new Date(value));}catch{return '—';}};
function account(){return state?.accounts.find(a=>a.id===accountId)||state?.accounts.find(a=>!a.archived)||state?.accounts[0];}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
function closeModal(){if(dialog.open)dialog.close();dialog.innerHTML='';modalOpener?.focus?.();}
function modal(html,onMount){modalOpener=document.activeElement;dialog.innerHTML=`<div class="modal-shell"><button class="btn btn-ghost icon-btn modal-close" data-close-modal aria-label="${t('Cerrar','Close')}">${icon('close',18)}</button>${html}</div>`;if(!dialog.open)dialog.showModal();dialog.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));onMount?.(dialog);requestAnimationFrame(()=>{const first=dialog.querySelector('input:not([type=hidden]),textarea,select,button:not(.modal-close)');(first||dialog.querySelector('button'))?.focus();});}
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
function navigate(next){if(!routes[next])next='summary';if(location.hash.slice(1)===next){route=next;render();}else location.hash=next;window.scrollTo({top:0});}
function update(mutator){const task=saveQueue.then(async()=>{const next=structuredClone(state);mutator(next);validateBackup(next);await saveState(next);state=next;accountId=account()?.id;syncManager?.markDirty();render();return state;});saveQueue=task.catch(()=>{});return task.catch(error=>{toast(t('No se pudo guardar. Exporta una copia y revisa el almacenamiento.','Could not save. Export a backup and check device storage.'));throw error;});}
function ctx(){const a=account();const trades=filterTrades(state,{accountId:a?.id,period});const before=filterTrades(state,{accountId:a?.id,period:'all'}).filter(x=>x.status==='closed'&&!trades.some(y=>y.id===x.id));const cutoff=period==='week'?Date.now()-7*864e5:period==='month'?Date.now()-30*864e5:-Infinity;const pastFlows=state.cashflows.filter(x=>x.accountId===a?.id&&new Date(x.date||x.timestamp||x.createdAt).getTime()<cutoff);const currentFlows=state.cashflows.filter(x=>x.accountId===a?.id&&new Date(x.date||x.timestamp||x.createdAt).getTime()>=cutoff);const opening=Number(a?.initialBalance||0)+before.reduce((s,x)=>s+net(x),0)+pastFlows.reduce((s,x)=>s+Number(x.amount||0),0);return {state,account:a,trades,stats:metrics(trades,opening,currentFlows),period,periodControl,periodLabel:period==='week'?t('Últimos 7 días','Last 7 days'):period==='month'?t('Últimos 30 días','Last 30 days'):t('Todo el historial','All history'),t,money,esc,icon,date,update,navigate,toast,modal,closeModal,render,sync:syncManager?.sync||{status:'local'},syncNow:handleSync,installApp};}
function navLink(key,mobile=false){const [es,en,ico]=routes[key];return `<a href="#${key}" class="${mobile?'':'nav-link '}${route===key?'active':''}" ${route===key?'aria-current="page"':''}>${icon(ico,19)}<span>${t(es,en)}</span></a>`;}
function syncLabel(){const labels={saved:t('Sincronizado','Synced'),ready:t('Nube disponible','Cloud ready'),local:t('Guardado local','Saved locally'),offline:t('Sin conexión','Offline'),pending:t('Pendiente de sincronizar','Pending sync'),syncing:t('Sincronizando','Syncing'),error:t('Error al sincronizar','Sync error'),conflict:t('Revisar conflicto','Review conflict')};return labels[syncManager?.sync.status]||labels.local;}
function refreshSync(){const settingsStatus=document.querySelector('.sync-message strong');if(settingsStatus)settingsStatus.textContent=syncLabel();const button=document.querySelector('[data-sync]');if(button){button.dataset.state=syncManager?.sync.status;button.title=syncLabel();button.innerHTML=`<span class="status-dot"></span><span class="sync-text">${syncLabel()}</span>${icon('cloud',14)}`;}}
function periodControl(){return `<div class="period-control" role="group" aria-label="${t('Periodo','Period')}">${[['week','7D','7D'],['month','30D','30D'],['all','Todo','All']].map(([v,es,en])=>`<button data-period="${v}" class="${period===v?'active':''}" aria-pressed="${period===v}">${t(es,en)}</button>`).join('')}</div>`;}
function render() {
  if (!state) return;
  route = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'summary';
  accountId = account()?.id;
  const c = ctx();
  document.documentElement.lang = state.settings.language;
  document.title = `TradeCompass · ${t(...routes[route])}`;
  const views = {summary:renderSummary,journal:renderJournal,lab:renderLab,analytics:renderAnalytics,settings:renderSettings,discipline:renderDiscipline,review:renderReview,import:renderImport};
  app.innerHTML = `<div class="app-shell">
    <header class="topbar">
      <a class="brand header-brand" href="#summary" aria-label="TradeCompass"><span class="brand-logo-crop"><img class="brand-symbol" src="./icon.svg" alt=""></span><span>TradeCompass</span></a>
      <nav class="desktop-tabs" aria-label="${t('Secciones','Sections')}">${['summary','journal','analytics','review'].map(key=>`<a class="top-tab ${route===key?'active':''}" data-tab="${key}" href="#${key}" ${route===key?'aria-current="page"':''}>${t(...routes[key])}</a>`).join('')}</nav>
      <div class="top-controls">
        <button class="sync-status" data-sync title="${syncLabel()}"></button>
        <label class="account-picker">${icon('wallet',17)}<span class="sr-only">${t('Cuenta activa','Active account')}</span><select id="active-account">${state.accounts.filter(a=>!a.archived||a.id===accountId).map(a=>`<option value="${esc(a.id)}" ${a.id===accountId?'selected':''}>${esc(a.name)} · ${esc(a.currency)}</option>`).join('')}</select></label>
      </div>
    </header>
    <aside class="sidebar">
      <button class="btn btn-primary nav-create" data-new-trade>${icon('plus',18)}<span>${t('Nueva operación','New trade')}</span></button>
      <nav class="side-nav" aria-label="${t('Navegación principal','Main navigation')}">${['summary','journal','analytics','review'].map(key=>navLink(key)).join('')}</nav>
      <div class="side-divider"></div>
      <p class="side-label">${t('Tu proceso','Your process')}</p>
      <nav class="side-nav" aria-label="${t('Herramientas','Tools')}">${['discipline','lab','import','settings'].map(key=>navLink(key)).join('')}</nav>
      <div class="sidebar-bottom"><div class="sidebar-note"><b>${icon('compass',18)} ${t('Registra. Revisa. Mejora.','Log. Review. Improve.')}</b><p>${t('Decide con evidencia.','Decide with evidence.')}</p></div><div class="version"><span>TradeCompass</span><span>v1.2</span></div></div>
    </aside>
    <div class="workspace"><main id="main" tabindex="-1">
      ${['analytics','journal','discipline'].includes(route)?`<div class="context-tools"><span class="eyebrow">${t('Periodo','Period')} · ${esc(c.account?.name)} · ${esc(c.account?.currency)}</span>${periodControl()}</div>`:''}
      ${views[route](c)}
      <footer class="footer-note"><span>${esc(c.account?.name)} · ${esc(c.account?.currency)} · ${esc(state.settings.timezone)} · ${c.stats.closedCount} ${t('operaciones cerradas en el periodo','closed trades in period')}</span><span>${state.mode==='demo'?t('Datos simulados · Sin conexión con bróker','Simulated data · No broker connection'):t('Importación manual · Datos de tu diario','Manual import · Your journal data')}</span></footer>
    </main></div>
    <nav class="mobile-nav" aria-label="${t('Navegación principal','Main navigation')}">${primary.map(key=>navLink(key,true)).join('')}</nav>
    ${!['summary','journal','lab'].includes(route)?`<button class="fab" data-new-trade aria-label="${t('Registrar operación','Log trade')}">${icon('plus',24)}</button>`:''}
  </div>`;
  refreshSync();
  app.querySelectorAll('[data-route]').forEach(element=>element.addEventListener('click',()=>navigate(element.dataset.route)));
  app.querySelectorAll('[data-period]').forEach(element=>element.addEventListener('click',()=>{period=element.dataset.period;render();}));
  app.querySelector('#active-account').addEventListener('change',event=>{accountId=event.target.value;try{localStorage.setItem('tc-account',accountId);}catch{}render();});
  app.querySelector('[data-sync]').addEventListener('click',handleSync);
  bindJournal(c); bindManage(c); bindInsights(c);
}
async function handleSync(){if(syncManager.sync.status==='conflict'){const owner=syncManager.sync.conflict==='owner';modal(`<div class="modal-head"><div><p class="eyebrow">${t('SINCRONIZACIÓN','SYNC')}</p><h2>${t('Elige qué versión conservar','Choose which version to keep')}</h2></div></div><p class="muted">${owner?t('Este dispositivo contiene datos de otra sesión. Descarga un respaldo antes de cambiar de espacio.','This device holds data from another session. Download a backup before switching workspaces.'):t('Hay cambios distintos en este dispositivo y en la nube. Exporta un respaldo en Ajustes antes de sustituir una versión.','This device and the cloud have different changes. Export a backup in Settings before replacing a version.')}</p><div class="modal-actions"><button class="btn btn-ghost" data-close-modal>${t('Cancelar','Cancel')}</button>${syncManager.hasRemote()?`<button class="btn btn-ghost" id="use-remote">${t('Cargar la nube','Load cloud')}</button>`:''}${!owner?`<button class="btn btn-primary" id="use-local">${t('Usar este dispositivo','Use this device')}</button>`:''}</div>`,d=>{d.querySelector('#use-remote')?.addEventListener('click',async()=>{await syncManager.resolve('remote');closeModal();render();});d.querySelector('#use-local')?.addEventListener('click',async()=>{await syncManager.resolve('local');closeModal();render();});});return;}await syncManager.syncNow();if(syncManager.sync.status==='conflict')return handleSync();toast(syncLabel());}
async function installApp(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else modal(`<div class="modal-head"><div><p class="eyebrow">${t('SIEMPRE A MANO','ALWAYS AT HAND')}</p><h2>${t('Instala TradeCompass','Install TradeCompass')}</h2></div></div><p>${t('Android: abre el menú de Chrome y pulsa “Añadir a pantalla de inicio” o “Instalar aplicación”.','Android: open the Chrome menu and choose “Add to Home screen” or “Install app”.')}</p><p style="margin-top:16px">${t('iPhone: abre esta dirección en Safari, pulsa Compartir y “Añadir a pantalla de inicio”.','iPhone: open this address in Safari, tap Share, then “Add to Home Screen”.')}</p><p class="inline-note" style="margin-top:18px">${t('La instalación necesita una dirección HTTPS. El diario funciona sin conexión después de la primera visita; la sincronización requiere internet.','Installation requires an HTTPS address. The journal works offline after the first visit; cloud sync requires internet.')}</p>`);}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('hashchange',()=>{closeModal();render();});
async function boot() {
  try {
    const stored = await loadState();
    if (stored) validateBackup(stored);
    const prepared = stored ? migrateWorkspace(stored) : {state:createEmptyState(),changed:false};
    if (prepared.changed) await saveMigrationSnapshot(stored);
    state = prepared.state;
    validateBackup(state);
    if (!stored || prepared.changed) await saveState(state);
    try { accountId = localStorage.getItem('tc-account'); } catch {}
    render();
    syncManager = createSync({
      getState:()=>state,
      applyRemote:async(remote,guard)=>{
        const task=saveQueue.then(async()=>{
          if(guard&&!guard())return false;
          const cleaned=migrateWorkspace(remote);
          validateBackup(cleaned.state);
          if(cleaned.changed)await saveMigrationSnapshot(remote);
          await saveState(cleaned.state);
          state=cleaned.state;render();
          return {needsSync:cleaned.changed};
        });
        saveQueue=task.catch(()=>{});return task;
      },
      onStatus:refreshSync
    });
    if (prepared.changed) syncManager.markDirty();
    refreshSync();
    await syncManager.connect();
    if(syncManager.sync.status==='conflict')toast(t('Hay cambios pendientes de revisar en la sincronización.','There are sync changes to review.'));
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  } catch(error) {
    app.innerHTML=`<div class="boot"><span>${t('No se pudo abrir el espacio guardado. No se ha sobrescrito. Revisa el almacenamiento del navegador.','Could not open the saved workspace. It has not been overwritten. Check browser storage.')}</span><button class="btn" id="retry-boot">${t('Reintentar','Try again')}</button></div>`;
    document.querySelector('#retry-boot')?.addEventListener('click',()=>location.reload());
  }
}
boot();
