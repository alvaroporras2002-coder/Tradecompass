import { esc, icon } from '../ui.js';

const entries = [
 ['Moodboard digital','brand','summary','Paleta carbón y lima, brújula y gráficos con propósito.'],
 ['Concepto central','brand','welcome','Observar, registrar, mantener disciplina y probar conceptos.'],
 ['Propuesta de valor','brand','welcome','Historial, reglas y una revisión más clara.'],
 ['Personalidad y tono','brand','docs','Mensajes claros, calmados y transparentes.'],
 ['Racional de diseño','brand','summary','Jerarquía de tarjetas, retícula y cifras legibles.'],
 ['Logotipo principal','brand','guide','Brújula y nombre de marca.'],
 ['Logotipo horizontal compacto','brand','guide','Identidad compacta de navegación.'],
 ['Isotipo','brand','guide','Brújula consistente en todos los tamaños.'],
 ['Icono de aplicación y favicon','brand','docs','Icono del teléfono y de la pestaña del navegador.'],
 ['Versiones de color','brand','guide','Identidad sobre fondos claros, oscuros y lima.'],
 ['Reglas de uso','brand','guide','Espacio de protección y proporciones del símbolo.'],
 ['Paleta de marca','brand','guide','Los ocho colores originales del sistema.'],
 ['Colores funcionales','brand','discipline','Resultado, advertencia, información y estado.'],
 ['Sistema tipográfico','brand','guide','Manrope, Inter y JetBrains Mono.'],
 ['Familia de iconos','brand','guide','Iconos coherentes para cada sección.'],
 ['Elementos gráficos auxiliares','brand','summary','Brújula, retícula, arcos y curvas de evidencia.'],
 ['Temas claro y oscuro','brand','settings','Dos temas con el mismo contenido y jerarquía.'],
 ['Movimiento y transiciones','brand','settings','Transiciones breves y preferencia de movimiento reducido.'],
 ['Mapa de navegación','flows','summary','Diario, mercados, EA, laboratorio, cuenta y planes.'],
 ['Registro y configuración inicial','flows','settings','Perfil, entorno, cuenta y reglas de disciplina.'],
 ['Flujo del diario','flows','journal','Registro, importación, contexto y revisión semanal.'],
 ['Flujo de los EA','flows','library','Conceptos en desarrollo; ejecución futura externa en MT5 de escritorio.'],
 ['Flujo de suscripción','flows','plans','Propuesta de planes y gestión; los pagos requieren integración.'],
 ['Diseño adaptable','flows','summary','Una misma aplicación para teléfono, tableta y computadora.'],
 ['Botones y formularios','components','journal','Campos etiquetados, validación y confirmación de guardado.'],
 ['Componentes de navegación','components','summary','Navegación principal y accesos a todas las secciones.'],
 ['Tarjetas y tablas','components','journal','Métricas, operaciones, cuentas y conceptos EA.'],
 ['Sistema de gráficos','components','reports','Saldo, drawdown y comparación de resultados.'],
 ['Avisos, ventanas y ayuda','components','docs','Confirmaciones, errores y ayuda contextual.'],
 ['Estados de pantalla','components','journal','Diario vacío, carga, errores y datos disponibles.'],
 ['Accesibilidad','components','settings','Foco visible, etiquetas, objetivos táctiles y movimiento reducido.'],
 ['Página comercial','product','welcome','Presentación del diario, sus beneficios y sus planes.'],
 ['Dashboard','product','summary','Resumen de resultados, disciplina y actividad reciente.'],
 ['Diario','product','journal','Operaciones, filtros, contexto, emociones y checklist.'],
 ['Mercados','product','markets','Lista de seguimiento y gráficos ilustrativos, como en la guía.'],
 ['Biblioteca de EA','product','library','Cinco conceptos de estrategias, todos en desarrollo.'],
 ['Detalle de un EA','product','library','Lógica propuesta, límites y validación pendiente.'],
 ['Laboratorio','product','laboratory','Documentación de pruebas históricas y forward en demo.'],
 ['Planes y facturación','product','plans','TradeFree y propuesta TradePro; exportación del historial incluida.'],
 ['Cuenta y conexiones','product','settings','Perfil, preferencias, cuentas e importación de archivos.'],
 ['Plantillas de correo','communications','communications','Bienvenida, recuperación de acceso y confirmación de plan.'],
 ['Informes exportados','communications','reports','Resumen del diario y evaluación de estrategias.'],
 ['Mockup comercial de web y dashboard','communications','welcome','Coherencia entre presentación y espacio de trabajo.'],
 ['Mockup de aplicación móvil','communications','summary','Resumen, diario y biblioteca en formato de teléfono.'],
 ['Plantillas de comunicaciones','communications','communications','Presentación del producto, estrategia y novedades.'],
 ['Instalación y documentación','communications','docs','Guías de uso, importación y futuro flujo de EA en MT5.'],
 ['Presencia digital','communications','welcome','Identidad del icono, acceso y presentación digital.'],
 ['Manual breve de marca','communications','guide','Logo, color, tipografía y componentes reunidos.'],
 ['Especificaciones para desarrollo','communications','guide','Retícula de 8 px, controles y objetivos táctiles de 44 px.'],
].map(([title,category,route,description],index)=>({id:index+1,title,category,route,description}));
export const guideEntries = entries;
const categories = [['all','Todas','All'],['brand','Identidad','Identity'],['flows','Flujos','Flows'],['components','Componentes','Components'],['product','Producto','Product'],['communications','Comunicación','Communication']];
const colors = [['Fondo','#101214'],['Superficie','#1C2023'],['Elevación','#2A3033'],['Texto','#F3F5F1'],['Lima','#C1FF5E'],['Ganancia','#65D99A'],['Pérdida','#F18D8D'],['Advertencia','#EAC66D']];
let category = 'all';
let search = '';
const source = id => `./reference/${String(id).padStart(2,'0')}.webp`;
const page = id => id < 47 ? Math.ceil(id / 2) : 24;
const folded = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const matches = entry => (category === 'all' || entry.category === category) && folded(`${entry.id} ${entry.title} ${entry.description}`).includes(folded(search));

export function renderGuide(ctx) {
 const t = ctx.t;
 return `<div class="guide-view"><div class="page-intro"><div><p class="eyebrow">${t('EL SISTEMA COMPLETO','THE COMPLETE SYSTEM')}</p><h1>${t('49 referencias. Una identidad.','49 references. One identity.')}</h1><p class="muted">${t('Explora cada imagen original y abre su sección en TradeCompass.','Explore every original image and open its section in TradeCompass.')}</p></div><span class="pill guide-total">49 / 49</span></div>
 <section class="card guide-explanation"><div class="guide-explanation-icon">${icon('compass',28)}</div><div><h2>${t('De la guía a tu diario','From the guide to your journal')}</h2><p class="muted">${t('El documento reúne identidad, componentes, pantallas y comunicación. Aquí se conservan las 49 composiciones originales. Los EA, pagos y conexiones automáticas mantienen su estado conceptual o pendiente de integración.','The document includes identity, components, screens and communication. All 49 original compositions are preserved here. EAs, payments and automatic connections retain their conceptual or integration-pending status.')}</p></div></section>
 <div class="guide-tools"><label class="guide-search">${icon('search',18)}<span class="sr-only">${t('Buscar referencias','Search references')}</span><input id="guide-search" type="search" placeholder="${t('Buscar por nombre o número…','Search name or number…')}" value="${esc(search)}" autocomplete="off"></label><span id="guide-count" class="muted" aria-live="polite">${entries.filter(matches).length} ${t('referencias','references')}</span></div>
 <div class="guide-filters" aria-label="${t('Categorías de referencias','Reference categories')}">${categories.map(([key,es,en])=>`<button class="guide-filter ${category===key?'is-active':''}" data-guide-category="${key}" aria-pressed="${category===key}">${t(es,en)}</button>`).join('')}</div>
 <div class="guide-grid">${entries.map(entry=>`<article class="card guide-reference" data-guide-card="${entry.id}" ${matches(entry)?'':'hidden'}><button class="guide-image-button" data-guide-open="${entry.id}" aria-label="${t('Ampliar','Enlarge')} ${String(entry.id).padStart(2,'0')} · ${esc(entry.title)}"><img src="${source(entry.id)}" alt="${String(entry.id).padStart(2,'0')} / ${esc(entry.title)} — ${t('composición original del PDF','original PDF composition')}" loading="lazy" decoding="async"><span class="guide-image-enlarge">${icon('search',16)} ${t('Ver original','View original')}</span></button><div class="guide-reference-copy"><div class="guide-reference-heading"><span class="guide-reference-number">${String(entry.id).padStart(2,'0')}</span><h2>${esc(entry.title)}</h2></div><p class="muted">${esc(entry.description)}</p><button class="guide-route-link" data-guide-route="${entry.route}">${t('Abrir sección','Open section')} <span aria-hidden="true">↗</span></button></div></article>`).join('')}</div>
 <p id="guide-empty" class="guide-empty muted" ${entries.some(matches)?'hidden':''}>${t('No hay referencias con esa búsqueda. Prueba otro nombre o número.','No references match. Try another name or number.')}</p>
 <section class="card guide-brand"><div class="card-head"><div><p class="eyebrow">${t('MANUAL DE MARCA','BRAND GUIDE')}</p><h2>${t('Carbón y lima','Carbon and lime')}</h2></div><button class="btn btn-secondary" id="guide-download-logo">${icon('download',16)} ${t('Descargar logo SVG','Download SVG logo')}</button></div><div class="guide-palette">${colors.map(([label,color])=>`<div class="guide-swatch"><span style="background:${color}" aria-hidden="true"></span><strong>${label}</strong><code>${color}</code></div>`).join('')}</div><div class="guide-brand-notes"><div><h3>${t('Tipografía','Typography')}</h3><p class="guide-type-heading">Manrope <span>${t('Títulos','Headings')}</span></p><p class="guide-type-ui">Inter <span>${t('Interfaz y lectura','Interface and reading')}</span></p><p class="guide-type-data">JetBrains Mono <span>${t('Datos y código','Data and code')}</span></p></div><div><h3>${t('Espacio y accesibilidad','Spacing and accessibility')}</h3><p class="muted">${t('Retícula de 8 px · espacios 8, 16, 24 y 32 px. Objetivos táctiles de al menos 44 px. Mantén la orientación y el espacio de protección de la brújula.','8 px grid · 8, 16, 24 and 32 px spacing. Touch targets of at least 44 px. Preserve compass orientation and clear space.')}</p><button class="guide-route-link" data-guide-route="settings">${t('Tema y movimiento reducido','Theme and reduced motion')} ↗</button></div></div></section></div>`;
}

function openReference(ctx, id) {
 let current = Math.max(1,Math.min(49,Number(id)));
 const visibleIds = entries.filter(matches).map(entry=>entry.id);
 const collection = visibleIds.includes(current) ? visibleIds : entries.map(entry=>entry.id);
 const body = () => {
  const entry = entries[current-1];
  return `<div class="guide-lightbox-head"><p class="eyebrow">${ctx.t('COMPOSICIÓN ORIGINAL','ORIGINAL COMPOSITION')} · ${String(current).padStart(2,'0')} / 49</p><h2 id="guide-lightbox-title">${esc(entry.title)}</h2></div><div class="guide-lightbox-image"><img src="${source(current)}" alt="${String(current).padStart(2,'0')} / ${esc(entry.title)}"></div><div class="guide-lightbox-controls"><button class="btn btn-secondary" data-guide-prev aria-label="${ctx.t('Referencia anterior','Previous reference')}">← <span>${ctx.t('Anterior','Previous')}</span></button><span class="muted">${ctx.t('Página','Page')} ${page(current)} / 24</span><button class="btn btn-secondary" data-guide-next aria-label="${ctx.t('Siguiente referencia','Next reference')}"><span>${ctx.t('Siguiente','Next')}</span> →</button></div><p class="muted guide-lightbox-description">${esc(entry.description)}</p><button class="btn btn-primary guide-lightbox-route" data-guide-view-route>${ctx.t('Abrir sección en la app','Open section in the app')} ↗</button>`;
 };
 ctx.modal(`<div class="guide-lightbox" aria-labelledby="guide-lightbox-title">${body()}</div>`,dialog=>{
  const refresh = direction => {
   const index=collection.indexOf(current);
   current=collection[(index+direction+collection.length)%collection.length];
   dialog.querySelector('.guide-lightbox').innerHTML=body();
   bind();
   dialog.querySelector(direction<0?'[data-guide-prev]':'[data-guide-next]')?.focus({preventScroll:true});
  };
  const bind=()=>{
   dialog.querySelector('[data-guide-prev]').addEventListener('click',()=>refresh(-1));
   dialog.querySelector('[data-guide-next]').addEventListener('click',()=>refresh(1));
   dialog.querySelector('[data-guide-view-route]').addEventListener('click',()=>{ctx.closeModal();ctx.navigate(entries[current-1].route);});
  };
  bind();
  const keys=event=>{if(event.key==='ArrowLeft'){event.preventDefault();refresh(-1);}if(event.key==='ArrowRight'){event.preventDefault();refresh(1);}};
  const lightbox=dialog.querySelector('.guide-lightbox');
  const cleanup=()=>{dialog.removeEventListener('keydown',keys);dialog.removeEventListener('close',cleanup);observer.disconnect();};
  const observer=new MutationObserver(()=>{if(!dialog.contains(lightbox))cleanup();});
  observer.observe(dialog,{childList:true});
  dialog.addEventListener('keydown',keys);
  dialog.addEventListener('close',cleanup,{once:true});
 });
}

export function bindGuide(ctx) {
 const apply=()=>{
  let count=0;
  document.querySelectorAll('[data-guide-card]').forEach(card=>{const show=matches(entries[Number(card.dataset.guideCard)-1]);card.hidden=!show;if(show)count++;});
  const counter=document.querySelector('#guide-count');if(counter)counter.textContent=`${count} ${ctx.t('referencias','references')}`;
  const empty=document.querySelector('#guide-empty');if(empty)empty.hidden=!!count;
  document.querySelectorAll('[data-guide-category]').forEach(button=>{const active=button.dataset.guideCategory===category;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
 };
 document.querySelector('#guide-search')?.addEventListener('input',event=>{search=event.target.value;apply();});
 document.querySelectorAll('[data-guide-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.guideCategory;apply();}));
 document.querySelectorAll('[data-guide-open]').forEach(button=>button.addEventListener('click',()=>openReference(ctx,button.dataset.guideOpen)));
 document.querySelectorAll('[data-guide-route]').forEach(button=>button.addEventListener('click',()=>ctx.navigate(button.dataset.guideRoute)));
 document.querySelector('#guide-download-logo')?.addEventListener('click',async event=>{
  const button=event.currentTarget;button.disabled=true;
  try {
   const response=await fetch('./icon.svg');if(!response.ok)throw new Error('logo');
   const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='TradeCompass_Isotipo.svg';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
   ctx.toast(ctx.t('Logo preparado para descargar','Logo ready to download'));
  } catch {ctx.toast(ctx.t('No se pudo descargar el logo. Vuelve a intentarlo.','Could not download the logo. Try again.'));}
  finally {button.disabled=false;}
 });
}
