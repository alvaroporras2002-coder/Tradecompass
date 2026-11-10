/** Stable mobile navigation and motion. The shell and tab bar are never replaced. */
export const PRIMARY_ROUTES = Object.freeze(['summary','journal','analytics','review','settings']);
const aliases = {lab:'library',more:'tools',home:'summary',profile:'settings',analysis:'analytics',revision:'review'};
const sections = {
 summary:'summary', journal:'journal', import:'journal', discipline:'journal',
 comparison:'analytics', analytics:'analytics', 'analytics-details':'analytics', reports:'analytics',
 review:'review', settings:'settings', tools:'settings', library:'settings', 'ea-detail':'settings', laboratory:'settings', markets:'settings',
 'settings-details':'settings', welcome:'settings', plans:'settings', docs:'settings', communications:'settings', guide:'settings',
};
const depth = {comparison:1,tools:1,library:2,'ea-detail':3,laboratory:2,markets:2,'settings-details':1,welcome:1,plans:1,docs:1,communications:2,guide:2,import:1,discipline:1,'analytics-details':1,reports:1};
export function normalizeRoute(value) {
 const raw=String(value||'').replace(/^#/,'').trim();
 const route=aliases[raw]||raw;
 return Object.hasOwn(sections,route)?route:'summary';
}
export function sectionForRoute(value) { return sections[normalizeRoute(value)]; }
export function transitionDirection(from,to) {
 const a=normalizeRoute(from),b=normalizeRoute(to);
 if(a===b)return 0;
 const delta=PRIMARY_ROUTES.indexOf(sectionForRoute(b))-PRIMARY_ROUTES.indexOf(sectionForRoute(a));
 if(delta)return Math.sign(delta);
 return Math.sign((depth[b]||0)-(depth[a]||0))||1;
}

/** Tabs change context; details advance within the current context. */
export function transitionSpec(from,to) {
 const a=normalizeRoute(from),b=normalizeRoute(to);
 if(a===b)return {kind:'none',direction:0,outDistance:0,inDistance:0,exitDuration:0,enterDuration:0};
 const fromTab=PRIMARY_ROUTES.includes(a),toTab=PRIMARY_ROUTES.includes(b),sameSection=sectionForRoute(a)===sectionForRoute(b);
 if((fromTab&&toTab)||(!fromTab&&!sameSection)){
  const direction=transitionDirection(a,b);
  return {kind:'tab',direction,outDistance:-direction*8,inDistance:direction*10,exitDuration:70,enterDuration:170};
 }
 const returning=(depth[b]||0)<(depth[a]||0),direction=returning?-1:1;
 return {kind:returning?'pop':'push',direction,outDistance:-direction*(returning?40:24),inDistance:direction*(returning?24:40),exitDuration:70,enterDuration:220};
}

/** Each new request settles/cancels the previous one before it can mount old content. */
export function createNavigationMotion({reduced=()=>false}={}) {
 let active=null,sequence=0;
 const clean=job=>{
  if(active!==job)return;
  job.main?.classList?.remove('ip-screen-moving');
  job.main?.removeAttribute?.('aria-busy');
  job.main?.style?.removeProperty?.('opacity');
  job.main?.style?.removeProperty?.('transform');
  active=null;
 };
 const cancel=()=>{
  sequence++;
  const job=active;if(!job)return;
  job.canceled=true;
  for(const animation of job.animations){try{animation.cancel();}catch{}}
  job.releaseCancel();
  clean(job);
  if(!job.settled){job.settled=true;job.resolve({canceled:true,mounted:job.mounted});}
 };
 const transition=(main,{from,to,render}={})=>{
  cancel();
  const id=sequence;
  return new Promise((resolve,reject)=>{
   let releaseCancel;
   const canceled=new Promise(done=>{releaseCancel=done;});
   const job={id,main,resolve,reject,releaseCancel,canceled:false,mounted:false,settled:false,animations:new Set()};active=job;
   const current=()=>active===job&&sequence===id&&!job.canceled;
   const finish=()=>{if(!current())return;clean(job);if(!job.settled){job.settled=true;resolve({canceled:false,mounted:job.mounted});}};
   const animate=async(frames,duration)=>{
    if(!current())return;
    const animation=main.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.22,1)',fill:'none'});
    job.animations.add(animation);
    let finished;try{finished=animation.finished;}catch{finished=Promise.resolve();}
    await Promise.race([Promise.resolve(finished).catch(()=>{}),canceled]);
    job.animations.delete(animation);
   };
   const run=async()=>{
    const moving=normalizeRoute(from)!==normalizeRoute(to)&&!reduced()&&typeof main?.animate==='function';
    if(!moving){render?.();job.mounted=true;finish();return;}
    const spec=transitionSpec(from,to);
    main.classList?.add('ip-screen-moving');main.setAttribute?.('aria-busy','true');
    await animate([{opacity:1,transform:'translate3d(0,0,0)'},{opacity:0,transform:`translate3d(${spec.outDistance}px,0,0)`}],spec.exitDuration);
    if(!current())return;
    render?.();job.mounted=true;
    if(reduced()){finish();return;}
    await animate([{opacity:0,transform:`translate3d(${spec.inDistance}px,0,0)`},{opacity:1,transform:'translate3d(0,0,0)'}],spec.enterDuration);
    finish();
   };
   run().catch(error=>{if(!current())return;clean(job);if(!job.settled){job.settled=true;reject(error);}});
  });
 };
 return {transition,cancel};
}

const pulseTimers=new WeakMap();
const indicatorMotions=new WeakMap();
function glideIndicator(nav,index,prior,{animate,reduced}){
 const indicator=nav.querySelector?.('.ip-tab-indicator');
 if(!indicator)return;
 let start;try{start=nav.ownerDocument?.defaultView?.getComputedStyle(indicator).transform;}catch{}
 try{indicatorMotions.get(nav)?.cancel();}catch{}
 indicatorMotions.delete(nav);
 if(!animate||reduced||!prior||prior===PRIMARY_ROUTES[index]||typeof indicator.animate!=='function')return;
 const before=PRIMARY_ROUTES.indexOf(prior),middle=(before+index)/2;
 try{
  const animation=indicator.animate([
   {transform:start&&start!=='none'?start:`translate3d(${before*100}%,0,0) scaleX(1)`},
   {transform:`translate3d(${middle*100}%,0,0) scaleX(1.28)`,offset:.48},
   {transform:`translate3d(${index*100}%,0,0) scaleX(1)`}
  ],{duration:340,easing:'cubic-bezier(.22,.75,.22,1)'});
  indicatorMotions.set(nav,animation);
  Promise.resolve(animation.finished).catch(()=>{}).finally(()=>{if(indicatorMotions.get(nav)===animation)indicatorMotions.delete(nav);});
 }catch{/* Existing CSS transition remains available. */}
}
function pulseTab(tab,reduced) {
 if(!tab||reduced)return;
 clearTimeout(pulseTimers.get(tab));
 tab.classList.remove('is-activated');
 // A selected option can be tapped repeatedly; restart this small icon response.
 void tab.offsetWidth;
 tab.classList.add('is-activated');
 pulseTimers.set(tab,setTimeout(()=>tab.classList.remove('is-activated'),380));
}
export function updateTabbar(nav,route,{animate=true,reduced=false}={}) {
 if(!nav)return;
 const section=sectionForRoute(route),index=PRIMARY_ROUTES.indexOf(section),prior=nav.dataset.activeSection;
 glideIndicator(nav,index,prior,{animate,reduced});
 nav.classList.toggle('ip-tabs-static',!animate||reduced);
 nav.style.setProperty('--tab-index',String(index));nav.dataset.activeSection=section;
 nav.querySelectorAll('[data-primary-route]').forEach(tab=>{
  const on=normalizeRoute(tab.dataset.primaryRoute)===section;
  tab.classList.toggle('is-active',on);
  if(on)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  if(on&&['journal','analytics','review'].includes(section))tab.querySelectorAll('svg path').forEach(path=>path.setAttribute('pathLength','1'));
  if(on&&prior&&prior!==section&&animate&&!reduced)pulseTab(tab,false);
 });
}
export function bindTabbarFeedback(nav,{reduced=()=>false,activate=()=>{}}={}) {
 if(!nav)return ()=>{};
 const timers=new Set();
 const tabFor=event=>{const tab=event.target?.closest?.('[data-primary-route]');return tab&&nav.contains(tab)?tab:null;};
 const pressed=event=>{const tab=tabFor(event);if(tab&&!reduced())tab.classList.add('is-pressing');};
 const released=()=>nav.querySelectorAll('.is-pressing').forEach(tab=>tab.classList.remove('is-pressing'));
 const click=event=>{
  const tab=tabFor(event);if(!tab||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
  event.preventDefault();released();
  if(!reduced()){
   pulseTab(tab,false);
   tab.querySelectorAll('.ip-tab-ripple').forEach(ripple=>ripple.remove());
   const ripple=nav.ownerDocument?.createElement?.('span');
   if(ripple){
    ripple.className='ip-tab-ripple';ripple.setAttribute('aria-hidden','true');
    const box=tab.getBoundingClientRect();
    const x=event.detail===0?box.width/2:Math.max(0,Math.min(box.width,event.clientX-box.left));
    const y=event.detail===0?box.height/2:Math.max(0,Math.min(box.height,event.clientY-box.top));
    ripple.style.setProperty('--ripple-x',`${x}px`);ripple.style.setProperty('--ripple-y',`${y}px`);tab.append(ripple);
    const timer=setTimeout(()=>{ripple.remove();timers.delete(timer);},320);timers.add(timer);
   }
  }
  activate(normalizeRoute(tab.dataset.primaryRoute));
 };
 nav.addEventListener('pointerdown',pressed);nav.addEventListener('pointerup',released);nav.addEventListener('pointercancel',released);nav.addEventListener('pointerleave',released);nav.addEventListener('click',click);
 return ()=>{
  nav.removeEventListener('pointerdown',pressed);nav.removeEventListener('pointerup',released);nav.removeEventListener('pointercancel',released);nav.removeEventListener('pointerleave',released);nav.removeEventListener('click',click);
  released();for(const timer of timers)clearTimeout(timer);
  nav.querySelectorAll('[data-primary-route]').forEach(tab=>{clearTimeout(pulseTimers.get(tab));tab.classList.remove('is-activated');tab.querySelectorAll('.ip-tab-ripple').forEach(ripple=>ripple.remove());});
 };
}
