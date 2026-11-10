import {cleanupLiveMarkets} from './live-market.js';
import {createAccessController,renderPersonalizedHome,renderTraderProfile} from './access.js';
import {planId,canAccessLibrary,planFor,writableAccounts,enforcePlan,PlanLimitError} from './plans.js';
import {renderSubscription,bindSubscriptions,startPlanChange,planLock,basicAnalytics,basicDiscipline,accountNotice,renderComparison,bindComparison} from './plans-ui.js';
import {createEmptyState,createDemoState} from './demo.js';
import {migrateWorkspace} from './workspace.js';
import {loadState,saveState,saveMigrationSnapshot} from './storage.js';
import {net,metrics,filterTrades,validateBackup} from './domain.js';
import {esc,icon} from './ui.js';
import {renderPhoneSummary,renderPhoneJournal,renderPhoneLibrary,renderPhoneAnalytics,renderPhoneSettings,renderPhoneTools,renderPhoneReview,capturePhoneDraft,bindPhone} from './views/iphone.js';
import {createSync} from './sync.js';
import {createSheetMotion} from './sheet-motion.js';
import {createThemeTransition} from './theme-motion.js';
import {createSignatureMotion} from './signature-motion.js';
import {createModalExit} from './modal-exit.js';
import {createDisclosureMotion,captureSectionState,createSectionMotion} from './section-motion.js';
import {PRIMARY_ROUTES,normalizeRoute,sectionForRoute,createNavigationMotion,updateTabbar,bindTabbarFeedback} from './navigation.js';
import {renderAnalytics,renderDiscipline,renderReview,bindInsights} from './views/insights.js';
import {renderSettings,renderImport,bindManage} from './views/manage.js';
import {renderJournal,bindJournal} from './views/journal.js';
import {renderMarkets,renderLibrary,renderEADetail,renderLaboratory,bindExplore} from './views/explore.js';
import {renderReports,renderDocs,renderCommunications,renderWelcome,bindResources} from './views/resources.js';
import {renderGuide,bindGuide} from './views/guide.js';
let state,accountId,route='summary',period='month',installPrompt,syncManager,toastTimer,modalOpener,previewMode=false,previewState;
let saveQueue=Promise.resolve(),renderedRoute=null,accessController;
let localSaveStatus='',localSaveTimer,localSaveCount=0,modalEpoch=0;
const motion=createNavigationMotion({reduced:()=>reducedMotion()});
let motionPreference;try{motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');}catch{}
function reducedMotion(){return Boolean(workspace()?.settings?.reducedMotion||motionPreference?.matches);}
const app=document.querySelector('#app'),dialog=document.querySelector('#modal');
const bootSurface=document.querySelector('.tc-boot');
if(bootSurface)document.body.append(bootSurface);
const disclosures=createDisclosureMotion(document,{reduced:reducedMotion});
const sectionMotion=createSectionMotion({reduced:reducedMotion});
const sheetMotion=createSheetMotion(dialog,{reduced:reducedMotion,onClosed:({restoreFocus})=>{
 disclosures.cancel();dialog.innerHTML='';dialog.classList.remove('guide-dialog');
 if(restoreFocus)(modalOpener?.isConnected?modalOpener:app.querySelector('#main'))?.focus({preventScroll:true});
}});
const routes={comparison:['Comparador SuperTrade','SuperTrade comparison','analytics'],summary:['Inicio','Home','overview'],journal:['Diario','Journal','journal'],markets:['Mercados','Markets','analytics'],library:['Biblioteca de EA','EA library','lab'],'ea-detail':['Detalle del EA','EA concept','lab'],laboratory:['Laboratorio','Laboratory','target'],analytics:['Análisis','Analysis','analytics'],'analytics-details':['Análisis detallado','Detailed analytics','analytics'],settings:['Perfil','Profile','settings'],'settings-details':['Cuentas y datos','Accounts & data','settings'],discipline:['Disciplina','Discipline','shield'],review:['Revisión','Review','review'],import:['Importar MT5','Import MT5','upload'],plans:['Planes y facturación','Plans & billing','wallet'],reports:['Informes','Reports','file'],docs:['Ayuda e instalación','Help & installation','file'],communications:['Comunicaciones','Communications','cloud'],welcome:['Configurar mi espacio','Set up workspace','compass'],guide:['Guía visual · 49 referencias','Visual guide · 49 references','compass'],tools:['Herramientas','Tools','lab'],more:['Herramientas','Tools','lab']};
const primary=PRIMARY_ROUTES;
const workspace=()=>previewMode?previewState:state;
const t=(es,en)=>workspace()?.settings?.language==='en'?en:es;
const money=n=>new Intl.NumberFormat(workspace()?.settings?.language==='en'?'en-US':'es-CR',{style:'currency',currency:account()?.currency||'USD',maximumFractionDigits:2}).format(Number(n)||0);
const date=(value,options={})=>{if(!value)return '—';try{return new Intl.DateTimeFormat(workspace()?.settings?.language==='en'?'en-US':'es-CR',{...(!options.dateStyle&&!options.timeStyle?{month:'short',day:'numeric'}:{}),timeZone:workspace()?.settings?.timezone||'America/Guatemala',...options}).format(new Date(value));}catch{return '—';}};
const themeTransition=createThemeTransition({reduced:reducedMotion});
const signature=createSignatureMotion({reduced:reducedMotion});
const modalExit=createModalExit(options=>sheetMotion.close(options));
function changeTheme(origin,theme){
 if(!['light','dark'].includes(theme))return Promise.resolve();
 return themeTransition({origin,apply:()=>workspace()?.settings.theme===theme?Promise.resolve():update(next=>{next.settings.theme=theme;})});
}
function account(){return workspace()?.accounts.find(a=>a.id===accountId)||workspace()?.accounts.find(a=>!a.archived)||workspace()?.accounts[0];}
function savedMark(){return '<svg class="tc-saved-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';}
function toast(message,{kind='info'}={}){
 const el=document.querySelector('#toast');el.dataset.kind=kind;
 el.innerHTML=`${kind==='success'?savedMark():''}<span>${esc(message)}</span>`;
 el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
}
function closeModal(options={}){modalEpoch++;return modalExit.close(options);}
function modal(html,onMount,options={}){
 if(!dialog.open)modalOpener=document.activeElement;
 const epoch=++modalEpoch;
 modalExit.replace(options.onBeforeClose);
 dialog.innerHTML=`<div class="modal-shell"><button class="btn btn-ghost icon-btn modal-close" data-close-modal aria-label="${t('Cerrar','Close')}">${icon('close',18)}</button>${html}</div>`;
 sheetMotion.open();
 dialog.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal()));
 onMount?.(dialog);
 requestAnimationFrame(()=>{
  if(epoch!==modalEpoch||!dialog.open)return;
  const first=dialog.querySelector('input:not([type=hidden]),textarea,select,button:not(.modal-close)');
  (first||dialog.querySelector('button'))?.focus({preventScroll:true});
 });
}
function beginLocalSave(){clearTimeout(localSaveTimer);localSaveCount++;localSaveStatus='saving';refreshSync();}
function finishLocalSave(ok){
 localSaveCount=Math.max(0,localSaveCount-1);localSaveStatus=localSaveCount?'saving':ok?'saved':'error';refreshSync();
 if(!localSaveCount)localSaveTimer=setTimeout(()=>{localSaveStatus='';refreshSync();},ok?1800:4000);
}
function finishBoot(){
 if(!bootSurface?.isConnected)return;
 bootSurface.setAttribute('aria-hidden','true');bootSurface.removeAttribute('role');
 if(reducedMotion()){bootSurface.remove();return;}
 bootSurface.classList.add('is-leaving');
 bootSurface.addEventListener('animationend',event=>{if(event.target===bootSurface&&event.animationName==='tc-boot-exit')bootSurface.remove();});
 setTimeout(()=>bootSurface.remove(),200);
}
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
function navigate(next){
 next=normalizeRoute(next);if(!routes[next])next='summary';
 const current=normalizeRoute(location.hash.slice(1));
 closeModal({immediate:true,restoreFocus:false});
 if(current===next){if(renderedRoute===next)window.scrollTo({top:0,behavior:reducedMotion()?'auto':'smooth'});return;}
 location.hash=next;
}
function update(mutator,subscriptionChange=false){
 const editingPreview=previewMode;if(!editingPreview)beginLocalSave();
 const task=saveQueue.then(async()=>{
  const previous=editingPreview?previewState:state;const next=structuredClone(previous);mutator(next);if(!subscriptionChange)enforcePlan(previous,next);validateBackup(next);
  if(editingPreview)previewState=next;else{await saveState(next);state=next;syncManager?.markDirty();}
  accountId=account()?.id;render();if(subscriptionChange&&!editingPreview&&planId(next)!=='free')void syncManager?.connect();return next;
 });
 saveQueue=task.catch(()=>{});
 return task.then(value=>{if(!editingPreview)finishLocalSave(true);return value;},error=>{
  if(!editingPreview)finishLocalSave(false);
  if(error instanceof PlanLimitError){toast(t('Alcanzaste un límite del plan. No se guardaron cambios; puedes revisar un plan superior.','You reached a plan limit. No changes were saved; you can review a higher plan.'));startPlanChange(ctx(),error.required);throw error;}
  toast(t('No se pudo guardar. Exporta una copia y revisa el almacenamiento.','Could not save. Export a backup and check device storage.'),{kind:'error'});throw error;
 });
}
function ctx(){const s=workspace(),a=account();const trades=filterTrades(s,{accountId:a?.id,period});const included=new Set(trades.map(trade=>trade.id));const before=filterTrades(s,{accountId:a?.id,period:'all'}).filter(x=>x.status==='closed'&&!included.has(x.id));const cutoff=period==='week'?Date.now()-7*864e5:period==='month'?Date.now()-30*864e5:-Infinity;const pastFlows=s.cashflows.filter(x=>x.accountId===a?.id&&new Date(x.date||x.timestamp||x.createdAt).getTime()<cutoff);const currentFlows=s.cashflows.filter(x=>x.accountId===a?.id&&new Date(x.date||x.timestamp||x.createdAt).getTime()>=cutoff);const opening=Number(a?.initialBalance||0)+before.reduce((sum,x)=>sum+net(x),0)+pastFlows.reduce((sum,x)=>sum+Number(x.amount||0),0);return {state:s,account:a,trades,stats:metrics(trades,opening,currentFlows),period,periodControl,periodLabel:period==='week'?t('Últimos 7 días','Last 7 days'):period==='month'?t('Últimos 30 días','Last 30 days'):t('Todo el historial','All history'),t,money,esc,icon,date,update,requestPlan:plan=>startPlanChange(ctx(),plan),updateSubscription:mutator=>update(mutator,true),navigate,toast,modal,closeModal,render,changeTheme,reducedMotion,sync:previewMode?{status:'local'}:syncManager?.sync||{status:'local'},syncNow:handleSync,installApp,toggleDemo,selectAccount:id=>{if(workspace().accounts.some(a=>a.id===id)){accountId=id;if(!previewMode)try{localStorage.setItem('tc-account',id);}catch{}render();}},setPeriod:value=>{if(['week','month','all'].includes(value)){period=value;render();}}};}
function phoneIcon(key){const paths={summary:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',journal:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M12 5v15"/>',analytics:'<path d="M4 20V12m5 8V5m6 15V9m5 11V2"/>',review:'<rect x="4" y="5" width="16" height="17" rx="2"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="m8 13 2 2 5-5M8 18h8"/>',settings:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>'};return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;}
function navLink(key){const labels={summary:['Inicio','Home'],journal:['Diario','Journal'],analytics:['Análisis','Analysis'],review:['Revisión','Review'],settings:['Perfil','Profile']};return `<a href="#${key}" class="ip-tab" data-primary-route="${key}">${phoneIcon(key)}<span>${t(...labels[key])}</span></a>`;}
function syncLabel(){if(planId(workspace())==='free')return '';const labels={saved:t('Sincronizado','Synced'),ready:t('Nube disponible','Cloud ready'),local:t('Disponible','Available'),offline:t('Sin conexión','Offline'),pending:t('Guardando en la nube','Saving to cloud'),syncing:t('Sincronizando','Syncing'),error:t('Error al sincronizar','Sync error'),conflict:t('Revisar conflicto','Review conflict')};return previewMode?t('Vista de ejemplo','Example view'):labels[syncManager?.sync.status]||labels.local;}
function refreshSync(){
 const base=syncLabel(),local=previewMode?'':localSaveStatus;
 const message=local==='saving'?t('Guardando en dispositivo…','Saving on device…'):local==='saved'?t('Guardado en dispositivo','Saved on device'):local==='error'?t('No se pudo guardar','Could not save'):base;
 document.querySelectorAll('.sync-message strong').forEach(el=>el.textContent=base);
 document.querySelectorAll('[data-sync]').forEach(button=>{
  button.dataset.state=local||syncManager?.sync.status||'local';button.title=message;button.setAttribute('aria-label',message);
  button.classList.toggle('tc-save-status',Boolean(local));
  const key=button.dataset.state+'|'+message;
  if(button.dataset.feedbackLabel===key)return;
  button.dataset.feedbackLabel=key;
  const mark=local==='saving'?'<span class="tc-saving-mark" aria-hidden="true"></span>':local==='saved'?savedMark():'<span class="status-dot"></span>';
  button.innerHTML=`${mark}<span class="sync-text">${esc(message)}</span>${!local&&button.dataset.syncCompact===undefined?icon('cloud',14):''}`;
 });
 const announcement=document.querySelector('#tc-save-announcement');
 if(announcement&&local&&announcement.textContent!==message)announcement.textContent=message;
}
function periodControl(){return `<div class="period-control" role="group" aria-label="${t('Periodo','Period')}">${[['week','7D','7D'],['month','30D','30D'],['all','Todo','All']].map(([v,es,en])=>`<button data-period="${v}" class="${period===v?'active':''}" aria-pressed="${period===v}">${t(es,en)}</button>`).join('')}</div>`;}
function ensureShell(){
 if(app.querySelector('.ip-portal'))return;
 app.innerHTML=`<div class="ip-portal"><div class="ip-page"><header class="ip-header"><a href="#summary" class="ip-brand" aria-label="TradeCompass"><svg class="ip-brand-mark" width="31" height="31" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#C1FF5E" stroke-width="2.8"/><path d="m30 10-6.6 13.4L10 30l6.6-13.4Z" fill="currentColor"/></svg><span>TradeCompass</span></a></header><div class="ip-contextbar"><button class="ip-context-account" data-global-account aria-haspopup="dialog"></button></div><main class="ip-main" id="main" data-current-route="summary" tabindex="-1"></main></div><nav class="ip-tabbar" aria-label="${t('Navegación principal','Main navigation')}"><span class="ip-tab-indicator" aria-hidden="true"></span>${primary.map(navLink).join('')}</nav><span id="ip-route-status" class="sr-only" aria-live="polite" aria-atomic="true"></span><span id="tc-save-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span></div>`;
 app.querySelector('[data-global-account]').addEventListener('click',accountSheet);
 app.querySelector('.ip-context-sync')?.addEventListener('click',handleSync);
 bindTabbarFeedback(app.querySelector('.ip-tabbar'),{reduced:reducedMotion,activate:navigate});
}
function updateShell(next){
 const s=workspace(),a=account();
 document.documentElement.dataset.plan=planId(s);document.documentElement.lang=s.settings.language;document.documentElement.dataset.theme=s.settings.theme||'dark';document.documentElement.dataset.motion=reducedMotion()?'reduced':'normal';
 document.title=`TradeCompass · ${t(...routes[next])}`;document.querySelector('meta[name=theme-color]')?.setAttribute('content',s.settings.theme==='light'?'#f7f7f0':'#181c1f');
 app.querySelector('[data-global-account]').innerHTML=`${icon('wallet',15)}<span>${esc(a.name)} <small>· ${esc(a.currency)}</small></span>${icon('chevron',12)}`;
 app.querySelector('[data-global-account]').setAttribute('aria-label',t('Cambiar cuenta','Change account')+': '+a.name+' · '+a.currency);
 const labels={summary:['Inicio','Home'],journal:['Diario','Journal'],analytics:['Análisis','Analysis'],review:['Revisión','Review'],settings:['Perfil','Profile']};
 app.querySelectorAll('[data-primary-route]').forEach(el=>{el.querySelector('span').textContent=t(...labels[el.dataset.primaryRoute]);});
 const nav=app.querySelector('.ip-tabbar');nav.setAttribute('aria-label',t('Navegación principal','Main navigation'));updateTabbar(nav,next,{animate:renderedRoute!==null,reduced:reducedMotion()});refreshSync();
}
function parentRoute(next){
 if(next==='ea-detail')return 'library';
 if(['library','laboratory','markets','guide','communications'].includes(next))return 'tools';
 if(next==='comparison')return 'analytics';if(next==='tools')return 'settings';if(['import','discipline'].includes(next))return 'journal';if(['analytics-details','reports'].includes(next))return 'analytics';return 'settings';
}
function mountScreen(next){
 cleanupLiveMarkets();
 const previousMain=app.querySelector('#main');signature.capture(previousMain,{key:previousMain?.dataset.motionKey});
 const before=captureSectionState(previousMain);sectionMotion.cancel();disclosures.cancel();
 capturePhoneDraft(app.querySelector('#main'));
 const changed=renderedRoute!==next;route=next;const c=ctx();
 const free=planId(c.state)==='free';const views={comparison:cc=>planId(cc.state)==='elite'?renderComparison(cc):planLock(cc,'elite'),summary:free?basicAnalytics:renderPhoneSummary,journal:renderPhoneJournal,library:cc=>canAccessLibrary(cc.state)?renderPhoneLibrary(cc):planLock(cc,'elite'),analytics:free?basicAnalytics:cc=>renderPhoneAnalytics(cc)+'<a class="ip-secondary-link" href="#comparison">Comparador SuperTrade →</a>','analytics-details':free?cc=>planLock(cc):renderAnalytics,settings:renderPhoneSettings,tools:renderPhoneTools,markets:renderMarkets,'ea-detail':cc=>canAccessLibrary(cc.state)?renderEADetail(cc):planLock(cc,'elite'),laboratory:cc=>planId(cc.state)==='elite'?renderLaboratory(cc):planLock(cc,'elite',cc.t('Evalúa estrategias manualmente y guarda evidencias con SuperTrade.','Evaluate strategies manually and save evidence with SuperTrade.')),'settings-details':renderSettings,discipline:free?basicDiscipline:renderDiscipline,review:renderPhoneReview,import:renderImport,plans:renderSubscription,reports:renderReports,docs:renderDocs,communications:renderCommunications,welcome:renderWelcome,guide:renderGuide,more:renderPhoneTools};
 const main=app.querySelector('#main'),secondary=!primary.includes(next),personalHome=next==='summary'?renderPersonalizedHome(c):'',screenHtml=personalHome?views[next](c).replace(/<h1\b([^>]*)>/,'<h2$1>').replace('</h1>','</h2>'):views[next](c);
 main.classList.add('ip-main');main.classList.toggle('ip-secondary',secondary);main.dataset.currentRoute=next;main.setAttribute('aria-label',t(...routes[next]));
 main.innerHTML=`${secondary?`<button type="button" class="ip-back" data-route="${parentRoute(next)}">← ${t('Volver','Back')}</button>`:''}${next==='welcome'?`<h1 class="ip-page-title">${t('Tu perfil y tu cuenta','Your profile and account')}</h1><p class="ip-context-help">${t('Configura tu punto de partida para registrar y revisar.','Set your starting point for logging and reviewing.')}</p>`:''}${accountNotice(c)}${personalHome}${screenHtml}${next==='settings'?renderTraderProfile(c,accessController?.provider()):''}${previewMode?`<button class="ip-demo-return" data-phone-demo>${t('Datos ilustrativos · Volver a mi diario','Illustrative data · Back to my journal')} ${icon('arrow',13)}</button>`:''}`;
 main.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.route)));
 main.querySelectorAll('[data-period]').forEach(el=>el.addEventListener('click',()=>{period=el.dataset.period;render();}));
 main.querySelectorAll('[data-phone-demo]').forEach(el=>el.addEventListener('click',toggleDemo));main.querySelectorAll('[data-sync]').forEach(el=>el.addEventListener('click',handleSync));
 main.querySelector('[data-trader-edit]')?.addEventListener('click',()=>accessController.edit());main.querySelector('[data-trader-logout]')?.addEventListener('click',()=>accessController.logout());
 bindPhone(c);bindJournal(c);bindManage(c);bindInsights(c);bindExplore(c);bindResources(c);bindGuide(c);bindSubscriptions(c);bindComparison(c);if(free){main.querySelectorAll('[data-resource-report=html]').forEach(b=>b.onclick=()=>startPlanChange(c,'pro'));}
 renderedRoute=next;refreshSync();
 if(!changed)sectionMotion.update(main,before);
 if(changed){window.scrollTo({top:0,behavior:'auto'});app.querySelector('#ip-route-status').textContent=t(...routes[next]);}
 main.dataset.motionKey=`${next}|${accountId}|${previewMode}`;signature.mount(main,{key:main.dataset.motionKey,changed});signature.syncScroll();
}
function render(){
 if(!state)return;
 if(accessController?.gate())return;
 if(reducedMotion()){signature.cancel();disclosures.cancel();sectionMotion.cancel();sheetMotion.settle();}
 const normalized=normalizeRoute(location.hash.slice(1)),next=routes[normalized]?normalized:'summary';accountId=account()?.id;
 ensureShell();updateShell(next);
 const main=app.querySelector('#main');
 if(renderedRoute===null||renderedRoute===next||reducedMotion()){motion.cancel();mountScreen(next);}
 else void motion.transition(main,{from:renderedRoute,to:next,render:()=>mountScreen(next)}).catch(()=>{
  if(normalizeRoute(location.hash.slice(1))!==next)return;
  motion.cancel();
  try{mountScreen(next);}catch{main.innerHTML=`<div class="empty-state"><h2>${t('No se pudo abrir esta pantalla','Could not open this screen')}</h2><p>${t('Vuelve a intentarlo para cargar su contenido.','Try again to load its content.')}</p><button class="btn btn-primary" data-retry-screen>${t('Reintentar','Try again')}</button></div>`;main.querySelector('[data-retry-screen]').addEventListener('click',render);}
 });
}
function accountSheet(){
 const c=ctx();modal(`<h2>${t('Tus cuentas','Your accounts')}</h2><p class="ip-context-help">${t('El diario y los análisis muestran la cuenta que elijas.','Your journal and analysis use the account you choose.')}</p><div class="ip-context-accounts">${workspace().accounts.filter(a=>!a.archived||a.id===account()?.id).map(a=>`<button class="ip-context-account-row ${a.id===account()?.id?'is-selected':''}" data-select-account="${esc(a.id)}"><span>${icon('wallet',19)}<strong>${esc(a.name)}<small>${esc(a.currency)} · ${a.type==='real'?t('Real','Live'):t('Demo','Demo')}</small></strong></span>${a.id===account()?.id?icon('check',19):icon('chevron',15)}</button>`).join('')}</div><button class="btn btn-ghost full-width" data-open-accounts>${t('Administrar cuentas','Manage accounts')}</button>`,d=>{
  d.querySelectorAll('[data-select-account]').forEach(el=>el.addEventListener('click',()=>{closeModal();c.selectAccount(el.dataset.selectAccount);}));
  d.querySelector('[data-open-accounts]').addEventListener('click',()=>navigate('settings-details'));
 });
}
function toggleDemo(){previewMode=!previewMode;if(previewMode){previewState=createDemoState();previewState.settings={...previewState.settings,...state.settings,emptyStartVersion:1};accountId=previewState.accounts[0].id;}else{accountId=state.accounts[0].id;}closeModal();render();}
async function handleSync(){if(!accessController?.isReady())return;if(planId(workspace())==='free'){startPlanChange(ctx(),'pro');return;}if(previewMode){toast(t('Esta vista usa datos de ejemplo. Vuelve a tu espacio para sincronizar.','This view uses sample data. Return to your workspace to sync.'));return;}if(!syncManager)return;if(syncManager.sync.status==='conflict'){const owner=syncManager.sync.conflict==='owner';modal(`<div class="modal-head"><h2>${t('Elige qué versión conservar','Choose which version to keep')}</h2></div><p class="muted">${t('Exporta un respaldo en Cuenta y conexiones antes de sustituir una versión.','Export a backup in Account & connections before replacing a version.')}</p><div class="modal-actions"><button class="btn btn-ghost" data-close-modal>${t('Cancelar','Cancel')}</button>${syncManager.hasRemote()?`<button class="btn btn-ghost" id="use-remote">${t('Cargar la nube','Load cloud')}</button>`:''}${!owner?`<button class="btn btn-primary" id="use-local">${t('Usar este dispositivo','Use this device')}</button>`:''}</div>`,d=>{d.querySelector('#use-remote')?.addEventListener('click',async()=>{await syncManager.resolve('remote');closeModal();render();});d.querySelector('#use-local')?.addEventListener('click',async()=>{await syncManager.resolve('local');closeModal();render();});});return;}await syncManager.syncNow();if(syncManager.sync.status==='conflict')return handleSync();toast(syncLabel());}
async function installApp(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else modal(`<div class="modal-head"><div><p class="eyebrow">${t('SIEMPRE A MANO','ALWAYS AT HAND')}</p><h2>${t('Instala TradeCompass','Install TradeCompass')}</h2></div></div><p>${t('Android: abre el menú de Chrome y pulsa “Añadir a pantalla de inicio” o “Instalar aplicación”.','Android: open the Chrome menu and choose “Add to Home screen” or “Install app”.')}</p><p style="margin-top:16px">${t('iPhone: abre esta dirección en Safari, pulsa Compartir y “Añadir a pantalla de inicio”.','iPhone: open this address in Safari, tap Share, then “Add to Home Screen”.')}</p><p class="inline-note" style="margin-top:18px">${t('Abre la app una vez con conexión para preparar el diario sin conexión. La sincronización requiere internet.','Open the app online once to prepare offline use. Synchronization requires internet.')}</p>`);}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});window.addEventListener('hashchange',()=>{closeModal({immediate:true,restoreFocus:false});render();});
motionPreference?.addEventListener?.('change',()=>{signature.cancel();disclosures.cancel();sectionMotion.cancel();sheetMotion.settle();if(state)render();});
async function boot(){try{const stored=await loadState();if(stored)validateBackup(stored);const prepared=stored?migrateWorkspace(stored):{state:createEmptyState(),changed:false};if(prepared.changed)await saveMigrationSnapshot(stored);state=prepared.state;validateBackup(state);if(!stored||prepared.changed)await saveState(state);try{accountId=localStorage.getItem('tc-account');}catch{}if(bootSurface&&state.settings.language==='en'){bootSurface.querySelector('[data-boot-message]').textContent='Opening your journal…';bootSurface.querySelector('[data-boot-tagline]').textContent='Your journal. Your rules. Your perspective.';}accessController=createAccessController({app,getState:()=>state,save:mutator=>update(mutator),beforeGate:()=>{cleanupLiveMarkets();signature.cancel();motion.cancel();sectionMotion.cancel();disclosures.cancel();closeModal({immediate:true,restoreFocus:false});renderedRoute=null;previewMode=false;},onLogout:()=>{previewMode=false;},onReady:()=>{renderedRoute=null;location.hash='summary';render();syncManager?.markDirty();if(planId(state)!=='free')void syncManager?.connect();}});render();finishBoot();syncManager=createSync({enabled:()=>accessController?.isReady()&&planId(state)!=='free',getState:()=>state,applyRemote:async(remote,guard)=>{const task=saveQueue.then(async()=>{if(!accessController?.isReady()||planId(state)==='free'||guard&&!guard())return false;const cleaned=migrateWorkspace(remote);validateBackup(cleaned.state);if(cleaned.changed)await saveMigrationSnapshot(remote);await saveState(cleaned.state);state=cleaned.state;render();return {needsSync:cleaned.changed};});saveQueue=task.catch(()=>{});return task;},onStatus:refreshSync});if(prepared.changed)syncManager.markDirty();refreshSync();await syncManager.connect();if(syncManager.sync.status==='conflict')toast(t('Hay cambios pendientes de revisar en la sincronización.','There are sync changes to review.'));if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(error){finishBoot();if(app.querySelector('.ip-portal')){toast(t('Tu diario está abierto; no se pudo completar la conexión.','Your journal is open; the connection could not be completed.'),{kind:'error'});return;}app.innerHTML=`<div class="boot"><span>${t('No se pudo abrir el espacio guardado. Revisa el almacenamiento del navegador.','Could not open the saved workspace. Check browser storage.')}</span><button class="btn" id="retry-boot">${t('Reintentar','Try again')}</button></div>`;document.querySelector('#retry-boot')?.addEventListener('click',()=>location.reload());}}
boot();
