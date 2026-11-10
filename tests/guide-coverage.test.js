import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {guideEntries,renderGuide} from '../src/views/guide.js';

const root=new URL('../',import.meta.url);

test('every one of the 49 PDF compositions has its actual image asset and a real app route',async()=>{
 const app=await readFile(new URL('src/app.js',root),'utf8');
 const declaration=app.match(/const routes=\{([^\n]+)\};/);
 assert.ok(declaration,'Application route registry could not be found');
 const routes=new Set([...declaration[1].matchAll(/(?:^|,)\s*(?:'([^']+)'|([A-Za-z][\w-]*))\s*:/g)].map(match=>match[1]||match[2]));
 assert.ok(routes.size>=15,'Expected complete application route registry');
 assert.deepEqual(guideEntries.map(entry=>entry.id),Array.from({length:49},(_,i)=>i+1),'A reference is missing, duplicated or out of order');
 for(const entry of guideEntries){
  assert.ok(routes.has(entry.route),`Reference ${entry.id} links to unknown route ${entry.route}`);
  const file=await readFile(new URL(`public/reference/${String(entry.id).padStart(2,'0')}.webp`,root));
  assert.ok(file.length>1000,`Reference ${entry.id} image is empty or too small`);
  assert.equal(file.subarray(0,4).toString(),'RIFF',`Reference ${entry.id} is not a WebP container`);
  assert.equal(file.subarray(8,12).toString(),'WEBP',`Reference ${entry.id} has incorrect WebP signature`);
 }
});

test('gallery renders all 49 originals and keeps integration-dependent features transparent',()=>{
 for(const language of ['es','en']){
  const html=renderGuide({t:(es,en)=>language==='en'?en:es});
  const images=[...html.matchAll(/<img src="\.\/reference\/(\d{2})\.webp"[^>]+loading="lazy"/g)];
  assert.deepEqual(images.map(match=>Number(match[1])),Array.from({length:49},(_,i)=>i+1));
  assert.equal((html.match(/data-guide-card=/g)||[]).length,49);
  assert.match(html,language==='en'?/integration-pending/:/pendiente de integración/);
  assert.match(html,/id="guide-search"/);
  assert.match(html,/id="guide-download-logo"/);
  assert.doesNotMatch(html,/\b(?:undefined|NaN|Infinity)\b/);
 }
});

test('brand download and PWA icon resources are available',async()=>{
 const svg=await readFile(new URL('public/icon.svg',root),'utf8');
 assert.match(svg,/<svg/);
 const manifest=JSON.parse(await readFile(new URL('public/manifest.webmanifest',root),'utf8'));
 assert.ok(manifest.icons?.length>=2);
 for(const item of manifest.icons){
  assert.ok(!/^(?:https?:|\/\/)/.test(item.src),'PWA icons must work without external requests');
  const path=item.src.replace(/^\.\//,'');
  const file=await stat(new URL(`public/${path}`,root));
  assert.ok(file.size>100);
 }
});
