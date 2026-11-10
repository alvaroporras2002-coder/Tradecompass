import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyState} from '../src/demo.js';
import {validateBackup} from '../src/domain.js';
import {validState} from '../server/worker.js';
const fixture=()=>{const s=createEmptyState();s.evaluations=[{id:'eval-1',accountId:s.accounts[0].id,title:'Own evaluation',kind:'historical',from:'2026-01-01',to:'2026-02-01',sample:80,costs:10,result:-15,drawdown:30,limitations:'Demo data only',currency:'USD'}];return s;};
test('client and cloud accept the same manual evaluation and preference extension',()=>{const s=fixture();s.settings.theme='light';s.settings.eaNotes={'trend-navigator':'Notes <test>'};s.settings.planInterest={plan:'pro',billing:'month'};assert.equal(validateBackup(s),true);assert.equal(validState(s),true);});
test('restored malformed module values are rejected both locally and in the cloud',()=>{for(const mutate of [s=>s.evaluations[0].sample='<img src=x>',s=>s.evaluations[0].from='2026-02-30',s=>s.evaluations[0].accountId='unknown',s=>s.evaluations.push(structuredClone(s.evaluations[0])),s=>s.settings.eaNotes={id:{}},s=>s.settings.marketWatchlist='bad',s=>s.evaluations[0].report={name:'x',text:'x'.repeat(102401)}]){const s=fixture();mutate(s);assert.throws(()=>validateBackup(s));assert.equal(validState(s),false);}});
