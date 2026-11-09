import { parseMT5, tradeCSV, validateBackup, net } from '../domain.js';
import { createDemoState, createEmptyState } from '../demo.js';

let pendingImport = null;
let mutationPending = false;
async function persist(ctx, mutator) {
  if(mutationPending) return false;
  mutationPending = true;
  try { await ctx.update(mutator); return true; } catch { return false; }
  finally { mutationPending = false; }
}
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const zones = ['America/Costa_Rica','America/New_York','America/Toronto','America/Vancouver','America/Mexico_City','America/Bogota','Europe/Madrid','Europe/London','Asia/Tokyo','UTC'];
const currencies = ['USD','EUR','CRC','CAD','GBP','MXN'];
const value = (data, name) => String(data.get(name) ?? '').trim();
const attrs = (a,b) => a === b ? 'selected' : '';
const button = (ctx,action,text,primary=false) => `<button type="button" class="btn ${primary?'btn-primary':'btn-ghost'}" data-manage="${action}">${text}</button>`;

function download(name,content,type='text/plain;charset=utf-8') {
  const blob = new Blob([content],{type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=name;
  document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function dateText(ctx, input) {
  const date = new Date(input);
  if(Number.isNaN(+date)) return ctx.esc(input || '—');
  return ctx.esc(date.toLocaleDateString(ctx.state.settings.language==='en'?'en-US':'es-CR',{dateStyle:'medium',timeZone:ctx.state.settings.timezone || 'UTC'}));
}
function syncLabel(ctx) {
  const labels = {saved:ctx.t('Sincronizado','Synced'),synced:ctx.t('Sincronizado','Synced'),syncing:ctx.t('Sincronizando…','Syncing…'),offline:ctx.t('Sin conexión','Offline'),error:ctx.t('No se pudo sincronizar','Sync failed'),conflict:ctx.t('Conflicto: revisa la sincronización','Conflict: review synchronization'),local:ctx.t('Guardado en este dispositivo','Saved on this device'),disabled:ctx.t('Solo en este dispositivo','On this device only'),pending:ctx.t('Cambios pendientes','Changes pending'),ready:ctx.t('Nube disponible','Cloud available')};
  return labels[ctx.sync?.status] || ctx.t('Guardado local','Saved locally');
}

export function renderSettings(ctx) {
  const {state,t,esc,icon} = ctx;
  const isDemo = state.mode === 'demo';
  return `<div class="page-intro manage-intro"><div><p class="eyebrow">${t('Tu espacio de trabajo','Your workspace')}</p><h1>${t('Ajustes','Settings')}</h1><p class="muted">${t('Tus cuentas, tus preferencias. Todo bajo control.','Your accounts, your preferences. Everything under control.')}</p></div><span class="pill ${isDemo?'':'positive'}">${icon('circle',12)} ${isDemo?t('Modo demostración','Demo mode'):t('Espacio personal','Personal workspace')}</span></div>
  <div class="grid-2 settings-grid"><section class="card"><div class="card-head"><div><p class="eyebrow">${t('Organización','Organization')}</p><h2>${t('Cuentas de trading','Trading accounts')}</h2></div>${button(ctx,'add-account',`+ ${t('Añadir','Add')}`,true)}</div>
  <div class="account-list">${state.accounts.map(a=>`<div class="account-row"><div class="account-badge">${esc(a.currency)}</div><div class="account-info"><strong>${esc(a.name)}</strong><span class="muted">${esc(a.platform)} · ${esc(a.currency)} · ${a.type==='real'?t('Real','Live'):t('Demo','Demo')}${a.archived?` · ${t('Archivada','Archived')}`:''}</span></div><button type="button" class="btn btn-ghost btn-small" data-edit-account="${esc(a.id)}" aria-label="${t('Editar cuenta','Edit account')} ${esc(a.name)}">${icon('edit',17)}</button></div>`).join('')}</div><p class="muted small">${t('Cada cuenta conserva sus resultados y moneda. No mezclamos balances de monedas distintas.','Each account keeps its own results and currency. Balances in different currencies stay separate.')}</p></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">${t('A tu medida','Make it yours')}</p><h2>${t('Preferencias','Preferences')}</h2></div>${icon('settings')}</div><form id="preferences-form" class="manage-form"><label class="field"><span>${t('Idioma','Language')}</span><select name="language"><option value="es" ${attrs(state.settings.language,'es')}>Español</option><option value="en" ${attrs(state.settings.language,'en')}>English</option></select></label><label class="field"><span>${t('Zona horaria para mostrar fechas','Timezone for displayed dates')}</span><select name="timezone">${[...new Set([...zones,state.settings.timezone])].filter(Boolean).map(z=>`<option value="${esc(z)}" ${attrs(state.settings.timezone,z)}>${esc(z.replaceAll('_',' '))}</option>`).join('')}</select></label><button class="btn btn-primary" type="submit">${t('Guardar preferencias','Save preferences')}</button></form></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">${t('Respaldo','Backup')}</p><h2>${t('Tus datos te pertenecen','Your data belongs to you')}</h2></div>${icon('download')}</div><p class="muted">${t('El archivo JSON incluye cuentas, operaciones, capturas, reglas y revisiones. El CSV exporta las operaciones de la cuenta seleccionada.','The JSON file includes accounts, trades, screenshots, rules and reviews. CSV exports trades from the selected account.')}</p><div class="button-row">${button(ctx,'export-json',t('Exportar respaldo JSON','Export JSON backup'))}${button(ctx,'export-csv',t('Exportar CSV','Export CSV'))}<label class="btn btn-ghost file-button" tabindex="0" role="button" data-file-trigger="restore-backup">${t('Restaurar JSON','Restore JSON')}<input id="restore-backup" type="file" accept=".json,application/json" hidden></label></div><p class="muted small">${t('Restaurar reemplaza el espacio actual después de pedir confirmación. Descarga primero un respaldo.','Restoring replaces the current workspace after confirmation. Download a backup first.')}</p></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">${t('Continuidad','Continuity')}</p><h2>${t('Sincronización','Synchronization')}</h2></div>${icon('cloud')}</div><div class="sync-message"><span class="status-dot"></span><strong>${esc(syncLabel(ctx))}</strong></div><p class="muted">${t('En la versión alojada, tu sesión de ChatGPT identifica tu espacio privado y permite recuperarlo en otro dispositivo. El modo demo permanece local. Sin conexión, los cambios se guardan aquí y se reintentan al reconectar.','On the hosted version, your ChatGPT session identifies your private workspace and makes it available on another device. Demo mode stays local. Offline changes are saved here and retried when connection returns.')}</p>${button(ctx,'sync',t('Sincronizar ahora','Sync now'))}</section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">${t('Siempre a mano','Always with you')}</p><h2>${t('Instalar TradeCompass','Install TradeCompass')}</h2></div>${icon('smartphone')}</div><p class="muted">${t('Abre esta app con conexión una vez para usar el diario sin conexión. En Android: menú del navegador → Instalar app. En iPhone: Safari → Compartir → Añadir a pantalla de inicio.','Open this app online once to use the journal offline. Android: browser menu → Install app. iPhone: Safari → Share → Add to Home Screen.')}</p>${button(ctx,'install',t('Instalar en este dispositivo','Install on this device'),true)}<p class="muted small">${t('TradeCompass es una app web instalable; no requiere una tienda de aplicaciones.','TradeCompass is an installable web app; no app store is required.')}</p></section>
  <section class="card danger-zone"><div class="card-head"><div><p class="eyebrow">${t('Espacio de datos','Data workspace')}</p><h2>${isDemo?t('Listo para tu propio diario','Ready for your own journal'):t('Administrar mis datos','Manage my data')}</h2></div>${icon('shield')}</div><p class="muted">${isDemo?t('Los resultados que ves son ejemplos simulados. Crea un espacio personal vacío para registrar tus propias operaciones.','The results you see are simulated examples. Create an empty personal workspace to record your own trades.'):t('Puedes sustituir tus datos por una demostración o borrar el espacio actual. Estas acciones requieren confirmación.','You can replace your data with a demonstration or clear the current workspace. These actions require confirmation.')}</p><div class="button-row">${button(ctx,'personal',isDemo?t('Crear mi espacio','Create my workspace'):t('Borrar todos mis datos','Delete all my data'),isDemo)}${!isDemo?button(ctx,'demo',t('Cargar demostración','Load demonstration')):''}</div></section></div>
  <p class="app-note muted">TradeCompass · v1.0 · ${t('Diario y análisis. Los ejemplos y el laboratorio son simulaciones educativas.','Journal and analysis. Examples and the lab are educational simulations.')}</p>`;
}

function accountModal(ctx, id) {
  const a = ctx.state.accounts.find(x=>x.id===id);
  const initial = a || {name:'',currency:'USD',initialBalance:10000,platform:'MetaTrader 5',timezone:ctx.state.settings.timezone,type:'demo'};
  const {esc,t} = ctx;
  const hasRecords = a && (ctx.state.trades.some(x=>x.accountId===id) || (ctx.state.cashflows||[]).some(x=>x.accountId===id) || ctx.state.reviews.some(x=>x.accountId===id));
  ctx.modal(`<div class="modal-head"><div><p class="eyebrow">${t('Cuentas','Accounts')}</p><h2>${a?t('Editar cuenta','Edit account'):t('Nueva cuenta','New account')}</h2></div></div><form id="account-form"><div class="form-grid"><label class="field"><span>${t('Nombre','Name')}</span><input name="name" required maxlength="60" value="${esc(initial.name)}" placeholder="${t('Mi cuenta principal','My main account')}"></label><label class="field"><span>${t('Plataforma','Platform')}</span><input name="platform" required maxlength="60" value="${esc(initial.platform)}"></label><label class="field"><span>${t('Moneda','Currency')}</span><select name="currency" ${hasRecords?'disabled':''}>${currencies.map(c=>`<option ${attrs(c,initial.currency)}>${c}</option>`).join('')}</select></label><label class="field"><span>${t('Balance inicial','Initial balance')}</span><input name="initialBalance" type="number" step="0.01" min="0" max="1000000000" required value="${Number(initial.initialBalance)}"></label><label class="field"><span>${t('Tipo de cuenta','Account type')}</span><select name="type"><option value="demo" ${attrs(initial.type,'demo')}>${t('Demo','Demo')}</option><option value="real" ${attrs(initial.type,'real')}>${t('Real','Live')}</option></select></label><label class="field"><span>${t('Zona horaria del bróker','Broker timezone')}</span><select name="timezone">${[...new Set([...zones,initial.timezone])].filter(Boolean).map(z=>`<option value="${esc(z)}" ${attrs(z,initial.timezone)}>${esc(z)}</option>`).join('')}</select></label></div>${hasRecords?`<p class="muted small">${t('La moneda no se puede cambiar mientras la cuenta tenga registros.','Currency cannot be changed while the account has records.')}</p>`:''}${a?`<label class="check-field"><input name="archived" type="checkbox" ${a.archived?'checked':''}><span>${t('Archivar cuenta (conserva el historial)','Archive account (keeps history)')}</span></label>`:''}<div class="modal-actions">${a&&!hasRecords&&ctx.state.accounts.length>1?`<button type="button" class="btn btn-danger" id="delete-empty-account">${t('Eliminar cuenta','Delete account')}</button>`:''}<button type="button" class="btn btn-ghost" id="cancel-account">${t('Cancelar','Cancel')}</button><button type="submit" class="btn btn-primary">${t('Guardar cuenta','Save account')}</button></div><p id="account-error" class="negative" role="alert"></p></form>`,()=>{
    document.querySelector('#cancel-account')?.addEventListener('click',ctx.closeModal);
    document.querySelector('#delete-empty-account')?.addEventListener('click',()=>confirmAction(ctx,t('Eliminar esta cuenta vacía','Delete this empty account'),t('La cuenta se eliminará de tu espacio.','The account will be removed from your workspace.'),async()=>{if(!await persist(ctx,s=>{s.accounts=s.accounts.filter(x=>x.id!==id);}))return;ctx.closeModal();ctx.toast(t('Cuenta eliminada','Account deleted'));}));
    document.querySelector('#account-form')?.addEventListener('submit',async e=>{
      e.preventDefault(); const data = new FormData(e.currentTarget); const name=value(data,'name'); const balance=Number(data.get('initialBalance'));
      if(a && !a.archived && data.get('archived')==='on' && ctx.state.accounts.filter(x=>!x.archived).length<=1){document.querySelector('#account-error').textContent=t('Mantén al menos una cuenta activa.','Keep at least one account active.');return;}
      if(!name || !Number.isFinite(balance) || balance<0){document.querySelector('#account-error').textContent=t('Revisa el nombre y el balance inicial.','Check the name and initial balance.');return;}
      const record={...initial,id:a?.id||uid(),name,platform:value(data,'platform'),currency:hasRecords?initial.currency:value(data,'currency'),initialBalance:balance,type:value(data,'type'),timezone:value(data,'timezone'),archived:data.get('archived')==='on'};
      if(!await persist(ctx,s=>{if(a){s.accounts=s.accounts.map(x=>x.id===id?record:x);}else{s.accounts.push(record);}}))return;ctx.closeModal();ctx.toast(t('Cuenta guardada','Account saved'));
    });
  });
}
function confirmAction(ctx,title,description,action) {
  ctx.modal(`<div class="modal-head"><h2>${ctx.esc(title)}</h2></div><p class="muted">${ctx.esc(description)}</p><label class="check-field"><input type="checkbox" id="confirm-check"><span>${ctx.t('Entiendo y quiero continuar','I understand and want to continue')}</span></label><div class="modal-actions"><button class="btn btn-ghost" id="confirm-cancel">${ctx.t('Cancelar','Cancel')}</button><button class="btn btn-danger" id="confirm-action" disabled>${ctx.t('Confirmar','Confirm')}</button></div>`,()=>{
    document.querySelector('#confirm-check').addEventListener('change',e=>{document.querySelector('#confirm-action').disabled=!e.target.checked;});
    document.querySelector('#confirm-cancel').addEventListener('click',ctx.closeModal);
    document.querySelector('#confirm-action').addEventListener('click',action);
  });
}

export function renderImport(ctx) {
  const {t,esc,state,account,icon,money} = ctx;
  if(pendingImport && pendingImport.accountId!==account?.id) pendingImport=null;
  const p=pendingImport;
  const history = (state.imports||[]).filter(x=>x.accountId===account?.id).slice().reverse();
  return `<div class="page-intro manage-intro"><div><p class="eyebrow">${t('Menos copiar, más analizar','Less copying, more analysis')}</p><h1>${t('Importar operaciones','Import trades')}</h1><p class="muted">${t('Trae tu historial de MetaTrader 5 con una revisión antes de guardar.','Bring your MetaTrader 5 history in and review it before saving.')}</p></div><span class="pill">${icon('upload',15)} ${t('Importación manual','Manual import')}</span></div>
  <div class="grid-2 import-top"><section class="card"><div class="card-head"><div><p class="eyebrow">01 · ${t('Preparar','Prepare')}</p><h2>${t('Exporta tu historial','Export your history')}</h2></div>${icon('file')}</div><ol class="import-steps"><li>${t('En MT5, abre Historial y selecciona el periodo completo.','In MT5, open History and select the complete period.')}</li><li>${t('Guarda el reporte HTML de posiciones cerradas o prepara un CSV/TSV con los campos de la plantilla.','Save the HTML report of closed positions or prepare a CSV/TSV using the template fields.')}</li><li>${t('Carga el archivo, revisa los resultados y confirma el lote.','Upload the file, review the results, and confirm the batch.')}</li></ol>${button(ctx,'sample-csv',t('Descargar plantilla CSV','Download CSV template'))}<p class="muted small">${t('No se conectan credenciales del bróker. El archivo se procesa en tu dispositivo. Un reporte de deals parciales puede requerir consolidación por posición.','No broker credentials are connected. The file is processed on your device. Partial-deal reports may require consolidation by position.')}</p></section>
  <section class="card"><div class="card-head"><div><p class="eyebrow">02 · ${t('Cargar','Upload')}</p><h2>${t('Selecciona tu archivo','Select your file')}</h2></div><span class="pill">${esc(account?.currency||'USD')}</span></div><label class="import-drop" for="mt5-file" tabindex="0" role="button" data-file-trigger="mt5-file">${icon('upload',32)}<strong>${t('Pulsa para elegir un reporte','Tap to choose a report')}</strong><span class="muted">CSV, TSV, HTML · ${t('máximo 12 MB','12 MB maximum')}</span><input id="mt5-file" type="file" accept=".csv,.tsv,.txt,.htm,.html,text/csv,text/tab-separated-values,text/html" hidden></label><p class="muted small">${t('Destino','Destination')}: <strong>${esc(account?.name||'—')}</strong>. ${t('Las fechas sin zona explícita se interpretan como UTC. Ajusta el archivo si tu reporte usa la hora del bróker.','Dates without an explicit timezone are interpreted as UTC. Adjust the file if your report uses broker time.')}</p><p id="import-error" class="negative" role="alert"></p></section></div>
  ${p?renderPreview(ctx,p):''}
  <section class="card import-history"><div class="card-head"><div><p class="eyebrow">${t('Trazabilidad','Traceability')}</p><h2>${t('Historial de importaciones','Import history')}</h2></div><span class="pill">${history.length} ${t('lotes','batches')}</span></div>${history.length?`<div class="table-scroll"><table><thead><tr><th>${t('Archivo y fecha','File and date')}</th><th>${t('Operaciones','Trades')}</th><th>${t('Resultado neto','Net result')}</th><th>${t('Acción','Action')}</th></tr></thead><tbody>${history.map(h=>`<tr><td><strong>${esc(h.name)}</strong><small class="muted">${dateText(ctx,h.createdAt)}${h.reverted?` · ${t('Revertido','Reverted')}`:''}</small></td><td>${Number(h.count)||0}${h.cashflowCount?` <small class="muted">+ ${Number(h.cashflowCount)} ${t('movimientos','movements')}</small>`:''}</td><td>${money(Number(h.net)||0)}</td><td>${h.reverted?'<span class="muted">—</span>':`<button type="button" class="btn btn-ghost btn-small" data-rollback="${esc(h.id)}">${t('Revertir','Revert')}</button>`}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state">${icon('file',30)}<h3>${t('Aún no hay importaciones','No imports yet')}</h3><p class="muted">${t('Cada lote confirmado quedará registrado aquí.','Every confirmed batch will be recorded here.')}</p></div>`}</section>`;
}
function renderPreview(ctx,p) {
  const {t,esc,money} = ctx; const r=p.result; const assumedUTC=r.trades.some(x=>x.original?.timezoneAssumption?.includes('UTC')) || r.cashflows.some(x=>x.original?.timezoneAssumption?.includes('UTC')); const sum=r.trades.reduce((v,x)=>v+net(x),0);
  return `<section class="card import-preview"><div class="card-head"><div><p class="eyebrow">03 · ${t('Revisar y confirmar','Review and confirm')}</p><h2>${esc(p.name)}</h2></div><span class="pill">${t('Vista previa','Preview')}</span></div><div class="grid-3"><div class="stat-card"><span class="muted">${t('Listas para importar','Ready to import')}</span><strong class="positive">${r.trades.length}</strong></div><div class="stat-card"><span class="muted">${t('Duplicadas omitidas','Duplicates skipped')}</span><strong>${r.duplicates.length}</strong></div><div class="stat-card"><span class="muted">${t('Filas con errores','Rows with errors')}</span><strong class="${r.errors.length?'negative':''}">${r.errors.length}</strong></div></div>${assumedUTC?`<p class="import-timezone-warning">${t('Revisa las horas: las fechas sin una zona explícita se han interpretado como UTC. Verifica que coincidan con tu reporte antes de confirmar.','Check the times: dates without an explicit timezone were interpreted as UTC. Verify they match your report before confirming.')}</p>`:''}<div class="preview-total"><span>${t('Resultado neto del lote','Batch net result')}</span><strong class="${sum>=0?'positive':'negative'}">${money(sum)}</strong></div><p class="muted small">${t('Incluye comisiones y swap.','Includes commissions and swap.')} ${(r.cashflows||[]).length} ${t('depósitos/retiros separados del resultado de trading.','deposits/withdrawals separated from trading results.')}</p>
  ${r.trades.length?`<div class="table-scroll"><table><thead><tr><th>${t('Activo','Symbol')}</th><th>${t('Dirección','Direction')}</th><th>${t('Cierre','Closed')}</th><th>${t('Neto','Net')}</th></tr></thead><tbody>${r.trades.slice(0,8).map(x=>`<tr><td>${esc(x.symbol)}</td><td>${x.side==='buy'?t('Compra','Buy'):t('Venta','Sell')}</td><td>${dateText(ctx,x.closedAt||x.openedAt)}</td><td class="${net(x)>=0?'positive':'negative'}">${money(net(x))}</td></tr>`).join('')}</tbody></table></div><p class="muted small">${t('Se muestran hasta 8 operaciones. El botón confirma todas las filas válidas del lote.','Up to 8 trades are shown. Confirm adds all valid rows in the batch.')}</p>`:''}
  ${r.errors.length?`<details class="import-errors"><summary>${t('Ver errores que no se importarán','View errors that will not be imported')} (${r.errors.length})</summary><ul>${r.errors.slice(0,20).map(x=>`<li>${esc(typeof x==='string'?x:ctx.t('Fila','Row')+' '+(x.row||x.line||'?')+': '+(x.message||x.error||JSON.stringify(x)))}</li>`).join('')}</ul></details>`:''}
  <div class="button-row"><button type="button" class="btn btn-primary" id="confirm-import" ${!r.trades.length&&!(r.cashflows||[]).length?'disabled':''}>${t('Confirmar importación','Confirm import')}</button><button type="button" class="btn btn-ghost" id="discard-import">${t('Descartar vista previa','Discard preview')}</button></div></section>`;
}

export function bindManage(ctx) {
  const {t} = ctx;
  document.querySelectorAll('[data-file-trigger]').forEach(el=>el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById(el.dataset.fileTrigger)?.click();}}));
  document.querySelectorAll('[data-manage]').forEach(el=>el.addEventListener('click',()=>{
    const action=el.dataset.manage;
    if(action==='add-account') return accountModal(ctx);
    if(action==='export-json') {download(`TradeCompass_backup_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(ctx.state,null,2),'application/json');ctx.toast(t('Respaldo descargado','Backup downloaded'));}
    if(action==='export-csv') {download('TradeCompass_trades.csv',tradeCSV(ctx.state.trades.filter(x=>x.accountId===ctx.account?.id)),'text/csv;charset=utf-8');ctx.toast(t('CSV descargado','CSV downloaded'));}
    if(action==='install') ctx.installApp?.();
    if(action==='sync') ctx.syncNow?.();
    if(action==='sample-csv') download('TradeCompass_MT5_template.csv','ticket,symbol,side,openedAt,closedAt,entry,exit,volume,gross,commission,swap,risk,strategy\n100001,EURUSD,buy,2026-10-01T13:00:00Z,2026-10-01T14:15:00Z,1.1000,1.1020,0.10,20,-1,-0.2,10,Pullback\n100002,XAUUSD,sell,2026-10-02T14:00:00Z,2026-10-02T14:45:00Z,2670,2675,0.10,-50,-2,0,50,Breakout\n','text/csv;charset=utf-8');
    if(action==='personal'||action==='demo') {
      const demo=action==='demo';
      confirmAction(ctx,demo?t('Sustituir por la demostración','Replace with demo data'):t('Crear un espacio personal vacío','Create an empty personal workspace'),t('Esto reemplazará todos los datos del espacio actual, incluidas capturas y revisiones. Exporta un respaldo antes de continuar.','This replaces all data in the current workspace, including screenshots and reviews. Export a backup before continuing.'),async()=>{if(!await persist(ctx,s=>Object.assign(s,demo?createDemoState():createEmptyState())))return;pendingImport=null;ctx.closeModal();ctx.navigate('summary');ctx.toast(demo?t('Demostración cargada','Demo loaded'):t('Tu espacio personal está listo','Your personal workspace is ready'));});
    }
  }));
  document.querySelectorAll('[data-edit-account]').forEach(el=>el.addEventListener('click',()=>accountModal(ctx,el.dataset.editAccount)));
  document.querySelector('#preferences-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=new FormData(e.currentTarget);if(!await persist(ctx,s=>{s.settings.language=value(d,'language');s.settings.timezone=value(d,'timezone');}))return;ctx.toast(value(d,'language')==='en'?'Preferences saved':'Preferencias guardadas');});
  document.querySelector('#restore-backup')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    try {
      if(file.size>12*1024*1024) throw new Error(t('El respaldo supera 12 MB.','Backup exceeds 12 MB.'));
      const data=JSON.parse(await file.text());
      if(validateBackup(data)===false) throw new Error(t('Formato de respaldo inválido.','Invalid backup format.'));
      confirmAction(ctx,t('Restaurar este respaldo','Restore this backup'),t('Se reemplazarán todos los datos actuales. Conserva una copia del espacio actual antes de continuar.','All current data will be replaced. Keep a copy of the current workspace before continuing.'),async()=>{if(!await persist(ctx,s=>Object.assign(s,data)))return;pendingImport=null;ctx.closeModal();ctx.toast(t('Respaldo restaurado','Backup restored'));});
    } catch(error) {ctx.toast(t('No se pudo restaurar: ','Could not restore: ')+error.message);}
    e.target.value='';
  });
  document.querySelector('#mt5-file')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    const errorEl=document.querySelector('#import-error');
    try {
      if(!ctx.account) throw new Error(t('Crea una cuenta antes de importar.','Create an account before importing.'));
      if(file.size>12*1024*1024) throw new Error(t('El archivo supera 12 MB.','File exceeds 12 MB.'));
      const text=await file.text();
      const result=parseMT5(text,{accountId:ctx.account.id,existing:[...ctx.state.trades,...(ctx.state.cashflows||[])]});
      result.trades ||= [];result.duplicates ||= [];result.errors ||= [];result.cashflows ||= [];
      pendingImport={name:file.name,accountId:ctx.account.id,result};ctx.render();
    } catch(error) {if(errorEl)errorEl.textContent=error.message==='MT5_HTML_NO_POSITIONS'?t('No encontramos una tabla de posiciones cerradas. Exporta un reporte de posiciones o usa la plantilla CSV.','No closed-position table was found. Export a position report or use the CSV template.'):t('No se pudo leer el archivo: ','Could not read file: ')+error.message;}
  });
  document.querySelector('#discard-import')?.addEventListener('click',()=>{pendingImport=null;ctx.render();});
  document.querySelector('#confirm-import')?.addEventListener('click',async()=>{
    if(!pendingImport || pendingImport.accountId!==ctx.account?.id)return;
    const p=pendingImport;const batchId=uid();
    // Reparse-time duplicate protection also covers changes from another UI action.
    const existingIds=new Set(ctx.state.trades.filter(x=>x.accountId===p.accountId).map(x=>String(x.sourceId||'')));
    const incoming=p.result.trades.filter(x=>!x.sourceId || !existingIds.has(String(x.sourceId)));
    const knownFlows=new Set((ctx.state.cashflows||[]).filter(x=>x.accountId===p.accountId).map(x=>String(x.sourceId||'')));
    const incomingFlows=p.result.cashflows.filter(x=>!x.sourceId || !knownFlows.has(String(x.sourceId)));
    if(!incoming.length && !incomingFlows.length){ctx.toast(t('No quedan filas nuevas para importar.','No new rows remain to import.'));return;}
    if(!await persist(ctx,s=>{s.trades.push(...incoming.map(x=>({...x,id:x.id||uid(),batchId,source:'mt5'})));s.cashflows||=[];s.cashflows.push(...incomingFlows.map(x=>({...x,id:x.id||uid(),accountId:p.accountId,batchId})));s.imports||=[];s.imports.push({id:batchId,accountId:p.accountId,name:p.name,createdAt:new Date().toISOString(),count:incoming.length,cashflowCount:incomingFlows.length,net:incoming.reduce((v,x)=>v+net(x),0),duplicates:p.result.duplicates.length,errors:p.result.errors.length});}))return;
    pendingImport=null;ctx.toast(t('Lote importado correctamente','Batch imported successfully'));ctx.render();
  });
  document.querySelectorAll('[data-rollback]').forEach(el=>el.addEventListener('click',()=>{
    const id=el.dataset.rollback;const batch=ctx.state.imports.find(x=>x.id===id);if(!batch)return;
    confirmAction(ctx,t('Revertir esta importación','Revert this import'),t('Se eliminarán las operaciones y movimientos de este lote, incluidas sus notas, etiquetas y capturas añadidas después. El historial del lote se conservará.','This removes trades and movements in this batch, including notes, tags and screenshots added later. The batch history will be kept.'),async()=>{if(!await persist(ctx,s=>{s.trades=s.trades.filter(x=>x.batchId!==id);s.cashflows=(s.cashflows||[]).filter(x=>x.batchId!==id);s.imports=s.imports.map(x=>x.id===id?{...x,reverted:true,revertedAt:new Date().toISOString()}:x);}))return;ctx.closeModal();ctx.toast(t('Importación revertida','Import reverted'));});
  }));
}
