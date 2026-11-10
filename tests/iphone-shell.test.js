import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRIMARY_ROUTES} from '../src/navigation.js';
test('persistent shell keeps the tabbar outside containment and account context visible',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const shell=app.slice(app.indexOf('function ensureShell(){'),app.indexOf('function updateShell('));
 assert.match(shell,/<main[^>]+data-current-route=/);assert.doesNotMatch(shell,/<main[^>]+\bdata-route=/);
 assert.match(shell,/<div class="ip-portal"><div class="ip-page">/);
 assert.match(shell,/<\/main><\/div><nav class="ip-tabbar"/);
 assert.match(shell,/data-global-account/);assert.match(shell,/ip-tab-indicator/);assert.match(shell,/data-sync-compact/);
 assert.deepEqual(PRIMARY_ROUTES,['summary','journal','analytics','review','settings']);
 assert.doesNotMatch(shell,/class="(?:sidebar|topbar|workspace-bar|desktop-tabs)/);
});
test('screen changes preserve the mounted navigation and scope action handlers to main',async()=>{
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const mount=app.slice(app.indexOf('function mountScreen('),app.indexOf('function render(){'));
 const render=app.slice(app.indexOf('function render(){'),app.indexOf('function accountSheet('));
 assert.doesNotMatch(mount,/app\.innerHTML/);assert.doesNotMatch(render,/app\.innerHTML/);
 assert.match(mount,/main\.querySelectorAll\('\[data-route\]'\)/);
 assert.match(render,/motion\.transition\(main/);assert.match(render,/motion\.cancel\(\)/);
 assert.match(mount,/classList\.toggle\('ip-secondary'/);
});
