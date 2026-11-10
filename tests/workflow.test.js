import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState,createDemoState} from '../src/demo.js';
import {metrics,filterTrades} from '../src/domain.js';
import {esc,icon} from '../src/ui.js';
import {workflowProgress,renderPhoneSummary,renderPhoneJournal,renderPhoneAnalytics,renderPhoneSettings,renderPhoneReview,renderPhoneTools} from '../src/views/iphone.js';
function context(state){const account=state.accounts[0],trades=filterTrades(state,{accountId:account.id,period:'all'});return {state,account,trades,stats:metrics(trades,account.initialBalance,state.cashflows.filter(x=>x.accountId===account.id)),period:'all',esc,icon,t:(es,en)=>state.settings.language==='en'?en:es,money:n=>new Intl.NumberFormat('en-US',{style:'currency',currency:account.currency}).format(n),date:d=>new Date(d).toISOString().slice(5,10)};}
const text=html=>html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,'');
test('first home guides setup without inventing trading results or an empty graph',()=>{const c=context(createEmptyState()),html=renderPhoneSummary(c);assert.match(html,/Inicio/);assert.match(html,/Prepara tu cuenta/);assert.match(html,/Define tus reglas/);assert.match(html,/Empieza tu historial/);assert.match(html,/data-new-trade/);assert.doesNotMatch(html,/pc-chart|ip-kpi|Evolución del resultado/);const p=workflowProgress(c);assert.deepEqual([p.account,p.rules,p.trades],[false,false,false]);});
test('existing account records keep home useful even when the selected period is empty',()=>{const c=context(createDemoState());c.trades=[];c.stats=metrics([],c.account.initialBalance,[]);const html=renderPhoneSummary(c);assert.doesNotMatch(html,/wf-setup|Prepara tu cuenta/);assert.match(html,/Revisión semanal|revisión semanal/);});
test('empty analytics shows missing data instead of a measured zero or red drawdown',()=>{const html=renderPhoneAnalytics(context(createEmptyState()));assert.match(html,/Análisis/);assert.match(html,/0<\/strong> operaciones cerradas/);assert.match(html,/R necesita además el riesgo inicial/);assert.equal([...html.matchAll(/<strong(?: class="[^"]*")?>—<\/strong>/g)].length,4);assert.doesNotMatch(text(html),/\$0\.00|USD 0/);assert.doesNotMatch(html,/ip-negative|pc-chart/);});
test('profile keeps daily workflow out and exposes one grouped tools entry',()=>{const html=renderPhoneSettings(context(createEmptyState()));assert.match(html,/Perfil/);assert.equal([...html.matchAll(/href="#tools"/g)].length,1);for(const route of ['discipline','review','markets','laboratory','library','import'])assert.ok(!html.includes(`href="#${route}"`),route);assert.match(html,/data-phone-theme/);assert.match(html,/data-phone-sync/);});
test('review presents a progressive weekly form with one page heading; tools disclose their actual states',()=>{const c=context(createEmptyState()),review=renderPhoneReview(c),tools=renderPhoneTools(c);assert.equal([...review.matchAll(/<h1\b/g)].length,1);assert.match(review,/data-rv-form/);assert.equal([...review.matchAll(/data-rv-step="\d"/g)].length,3);assert.match(review,/wf-review ip-secondary/);assert.match(review,/data-phone-review-mode="discipline"/);for(const route of ['library','laboratory','markets'])assert.ok(tools.includes(`href="#${route}"`));assert.match(tools,/Datos simulados/);assert.match(tools,/Registro manual/);assert.match(tools,/En desarrollo/);});
test('all updated screens remain bilingual, escape labels and do not mutate source records',()=>{for(const lang of ['es','en']){const s=createDemoState();s.settings.language=lang;s.settings.name='<img src=x>';s.accounts[0].name='<img src=x>';s.reviews.push({id:'review-x',accountId:s.accounts[0].id,week:'2026-01-05',answers:[],action:'<img src=x>',createdAt:'2026-01-05'});const before=JSON.stringify(s),c=context(s);for(const render of [renderPhoneSummary,renderPhoneJournal,renderPhoneAnalytics,renderPhoneSettings,renderPhoneReview,renderPhoneTools]){const html=render(c);assert.ok(!html.includes('<img src=x>'));assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/);}assert.equal(JSON.stringify(s),before);}});

import {capturePhoneDraft,restorePhoneDraft} from '../src/views/iphone.js';
function draftForm(accountId,values={}){
 const elements=Object.fromEntries(['week','reviewId','action',...Array.from({length:6},(_,i)=>`answer${i}`)].map(key=>[key,{value:values[key]||'',addEventListener(){}}]));
 const form={dataset:{phoneReviewAccount:accountId},elements};return {form,root:{querySelector:()=>form}};
}
test('review draft survives replacement and restores values under the rendered account only',()=>{
 const ctx=context(createEmptyState()),a=draftForm('draft-account-a',{week:'2026-11-09'});restorePhoneDraft(ctx,a.root);
 a.form.elements.action.value='Esperar confirmación';a.form.elements.answer0.value='<script>draft text</script>';
 assert.equal(capturePhoneDraft(a.root),true);
 const b=draftForm('draft-account-b',{week:'2026-11-09'});assert.equal(restorePhoneDraft(ctx,b.root),false);assert.equal(b.form.elements.action.value,'');
 const restored=draftForm('draft-account-a',{week:'2026-11-09'});assert.equal(restorePhoneDraft(ctx,restored.root),true);assert.equal(restored.form.elements.action.value,'Esperar confirmación');assert.equal(restored.form.elements.answer0.value,'<script>draft text</script>');
});
test('unchanged saved review does not become a draft that could restore a deleted record',()=>{
 const ctx=context(createEmptyState()),saved={week:'2026-11-09',reviewId:'saved-review',action:'Plan cumplido',answer0:'Con calma'},a=draftForm('draft-account-saved',saved);restorePhoneDraft(ctx,a.root);assert.equal(capturePhoneDraft(a.root),false);
 const empty=draftForm('draft-account-saved',{week:'2026-11-09'});assert.equal(restorePhoneDraft(ctx,empty.root),false);assert.equal(empty.form.elements.action.value,'');
});
test('saving a pending draft clears it even when the newly saved review has a new id',()=>{
 const state=createEmptyState(),ctx=context(state),id='draft-account-new',a=draftForm(id,{week:'2026-11-09'});restorePhoneDraft(ctx,a.root);a.form.elements.action.value='  Respetar mi riesgo  ';a.form.elements.answer2.value='Revisar entradas';capturePhoneDraft(a.root);
 state.reviews.push({id:'fresh-id',accountId:id,week:'2026-11-09',action:'Respetar mi riesgo',answers:['','','Revisar entradas']});
 const saved=draftForm(id,{week:'2026-11-09',reviewId:'fresh-id',action:'Respetar mi riesgo',answer2:'Revisar entradas'});assert.equal(restorePhoneDraft(ctx,saved.root),false);assert.equal(saved.form.elements.reviewId.value,'fresh-id');assert.equal(capturePhoneDraft(saved.root),false);
});
