import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoState, createEmptyState } from '../src/demo.js';
import { metrics, filterTrades } from '../src/domain.js';
import { esc, icon } from '../src/ui.js';
import { renderSummary } from '../src/views/summary.js';
import { renderSettings, renderImport } from '../src/views/manage.js';
import { renderJournal, openTradeForm, openTradeDetail } from '../src/views/journal.js';
import { renderAnalytics, renderDiscipline, renderReview, renderLab } from '../src/views/insights.js';

const renderers = {summary:renderSummary, settings:renderSettings, import:renderImport, journal:renderJournal, analytics:renderAnalytics, discipline:renderDiscipline, review:renderReview, lab:renderLab};
function context(state) {
  const account = state.accounts[0];
  const language = state.settings.language;
  const trades = filterTrades(state,{accountId:account.id,period:'all'});
  return {state, account, trades, stats:metrics(trades,account.initialBalance,state.cashflows.filter(x=>x.accountId===account.id)),period:'all',t:(es,en)=>language==='en'?en:es,esc,icon,sync:{status:'local'},money:value=>new Intl.NumberFormat(language==='en'?'en-US':'es-CR',{style:'currency',currency:account.currency}).format(value),date:value=>{const date=new Date(value);return Number.isNaN(+date)?'—':date.toISOString().slice(0,10);}};
}
for (const [kind,makeState] of [['demo',createDemoState],['empty',createEmptyState]]) {
  for (const language of ['es','en']) {
    test(`${kind} ${language}: every screen renders usable finite content`,()=>{
      const state=makeState();state.settings.language=language;
      const ctx=context(state);
      for(const [name,render] of Object.entries(renderers)) {
        const html=render(ctx);
        assert.ok(typeof html==='string'&&html.length>300,`${name}: output missing`);
        assert.match(html,/<h1>/,`${name}: page heading missing`);
        assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/,`${name}: invalid runtime value`);
        assert.doesNotMatch(html,/(?:[xy]|width|height)="(?:NaN|undefined)/,`${name}: invalid SVG geometry`);
      }
      assert.match(renderSettings(ctx),language==='en'?/Preferences/:/Preferencias/);
      assert.match(renderJournal(ctx),language==='en'?/Your trading journal/:/Tu diario de trading/);
      assert.match(renderImport(ctx),language==='en'?/Dates without an explicit timezone are interpreted as UTC/:/Las fechas sin zona explícita se interpretan como UTC/);
      if(kind==='empty') {
        assert.match(renderAnalytics(ctx),language==='en'?/Your history starts here/:/Tu historial empieza aquí/);
        assert.match(renderJournal(ctx),language==='en'?/Record my first trade/:/Registrar mi primera operación/);
      }
    });
  }
}

test('user-controlled labels are escaped across journal, analytics and management screens',()=>{
  const state=createDemoState();const payload='\"><img src=x onerror=alert(1)>';
  const account=state.accounts[0];account.name=payload;account.platform=payload;
  state.rules[0].text=payload;state.rules[0].strategy=payload;
  const trade=state.trades.find(x=>x.accountId===account.id);trade.symbol=payload;trade.strategy=payload;trade.notes=payload;trade.tags=[payload];
  state.reviews.push({id:'untrusted-review',accountId:account.id,week:'2026-10-05',answers:Array(6).fill(payload),action:payload,completed:false,createdAt:'2026-10-05T12:00:00Z'});
  state.imports.push({id:'untrusted-import',accountId:account.id,name:payload,createdAt:'2026-10-05T12:00:00Z',count:1,net:10});
  const ctx=context(state);
  for(const [name,render] of Object.entries(renderers)) {
    const html=render(ctx);
    assert.ok(!html.includes(payload),`${name}: raw payload is present`);
    assert.ok(!html.includes('<img src=x onerror'),`${name}: executable injected markup is present`);
    if(name!=='lab')assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),`${name}: expected user field was not rendered/escaped`);
  }
});

test('all cached app resources exist and all linked modules/styles are cached',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const worker=await readFile(resolve(root,'public/sw.js'),'utf8');
  const cached=[...worker.matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]).filter(Boolean);
  assert.ok(cached.includes('src/views/journal.js'));
  for(const path of new Set(cached)) {
    const local=path.startsWith('src/')?resolve(root,path):resolve(root,'public',path);
    await assert.doesNotReject(access(local),`Missing cached asset ${path}`);
  }
  const index=await readFile(resolve(root,'public/index.html'),'utf8');
  for(const match of index.matchAll(/(?:href|src)="\.\/([^"#]+)"/g)) {
    const path=match[1];
    if(path.endsWith('.css')||path.endsWith('.js'))assert.ok(cached.includes(path),`Linked resource not cached: ${path}`);
  }
});

for(const language of ['es','en']) {
  test(`${language}: journal detail and edit form escape notes, attachments and import originals`,()=>{
    const state=createDemoState();state.settings.language=language;
    const ctx=context(state);const trade=state.trades.find(x=>x.accountId===ctx.account.id);
    const payload='"><script>alert(1)</script>';
    trade.notes=payload;trade.reason=payload;trade.lesson=payload;trade.symbol=payload;
    trade.source='mt5';trade.original={row:[payload]};trade.attachments=[{id:'image-test',name:payload,data:'data:image/png;base64,YQ=='}];
    const outputs=[];ctx.modal=html=>outputs.push(html);
    openTradeDetail(ctx,trade.id);openTradeForm(ctx,trade);
    assert.equal(outputs.length,2);
    for(const html of outputs) {
      assert.ok(!html.includes('<script>'), 'Raw script was rendered');
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'Expected escaped notes');
      assert.doesNotMatch(html,/\b(?:undefined|NaN)\b/);
    }
    assert.match(outputs[0],language==='en'?/Original MT5 data/:/Datos originales de MT5/);
    assert.match(outputs[1],language==='en'?/Imported figures are preserved/:/Los datos importados se conservan/);
  });
}
