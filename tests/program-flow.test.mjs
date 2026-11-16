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
test('as-of join takes latest preceding non-round sample and preserves provenance',()=>{
 const p=normalizeProgram([row('090459',100),row('090001',20),row('090459',100)].slice(0,2),[{time:'090430',close:101}],100,{endTime:'0905'});
 assert.equal(p.length,1);assert.equal(p[0].time,'0905');assert.equal(p[0].netBuy,1);assert.equal(p[0].sourceTime,'090459');assert.equal(p[0].sourceAgeSeconds,1);assert.equal(p[0].indexSourceTime,'090430');
});
test('future values never fill an earlier frame and expired samples stay missing',()=>{
 const data=[row('090459',100),row('090501',800),row('091501',900)];
 const p=normalizeProgram(data,[],100,{endTime:'0920'});
 assert.deepEqual(p.map(p=>[p.time,p.netBuy,p.sourceTime]),[['0905',1,'090459'],['0910',8,'090501'],['0920',9,'091501']]);
 assert.equal(p.some(p=>p.time==='0915'),false);
 assert.deepEqual(normalizeProgram([row('090500',100)],[],100,{endTime:'0910'}).map(p=>p.time),['0905']);
});
test('unsorted source and index rows select independently freshest observations without future index',()=>{
 const p=normalizeProgram([row('091001',900),row('090800',400),row('090700',300)],[{time:'091001',close:200},{time:'090900',close:102}],100,{endTime:'0910'});
 assert.equal(p[0].netBuy,4);assert.equal(p[0].sourceAgeSeconds,120);assert.ok(Math.abs(p[0].changePct-2)<1e-8);assert.equal(p[0].indexSourceTime,'090900');
 const missing=normalizeProgram([row('090900',400)],[{time:'090500',close:102}],100,{endTime:'0910'});assert.equal(missing[0].changePct,null);
});
