import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgram,programWindow} from '../worker/program-flow.mjs';
const row=(time,bcha3)=>({time,bcha3,bcha1:10000+bcha3,bcha2:10000});
test('program time series uses exact five-minute observations, signed net amounts and matching index',()=>{
 const p=normalizeProgram([row('091000',-200),row('090500',300),row('090600',500),row('161500',0)],[{time:'090500',close:102},{time:'091000',close:99}],100);
 assert.deepEqual(p.map(p=>[p.time,p.netBuy]),[['0905',3],['0910',-2],['1615',0]]);assert.ok(Math.abs(p[0].changePct-2)<1e-8);assert.equal(p[2].changePct,null);
});
test('program rejects invalid amounts and duplicate slots, preserves missing times',()=>{
 assert.throws(()=>normalizeProgram([{...row('090500',2),bcha1:500}],[],100),/IDENTITY/);
 assert.throws(()=>normalizeProgram([row('090500',2),row('090500',2)],[],100),/DUPLICATE/);
 assert.deepEqual(normalizeProgram([row('090500',2),row('091500',5)],[],100).map(p=>p.time),['0905','0915']);
});
test('program collection includes 16:15 and stops after it and on weekends',()=>{
 for(const [date,time,expected] of [['2026-11-16','16:15:59',true],['2026-11-16','16:16:00',false],['2026-11-15','12:00:00',false]])assert.equal(programWindow(new Date(date+'T'+time+'+09:00')),expected);
});
