import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const source='LS증권 KRX t1511 + t1601(기금 06)';
const script=new URL('../scripts/update-kospi-pension.mjs',import.meta.url).href;
function run(date,{knownSource=source,observedTime='16:15:05'}={}){
 const dir=mkdtempSync(join(tmpdir(),'pension-refresh-'));mkdirSync(join(dir,'public'));
 const path=join(dir,'public/kospi-pension-rsi.json');
 const before={schemaVersion:1,pensionUnit:'십억원',rows:[[date,5000,10]],latestDataSource:knownSource,latestDataObservedAt:date+'T16:10:00+09:00'};
 writeFileSync(path,JSON.stringify(before));
 const body={date,kospiClose:5000,pensionNetBuyBillion:11,regularSessionClosed:true,source,pensionUnit:'십억원',observedAt:date+'T'+observedTime+'+09:00'};
 const code=`globalThis.fetch=async()=>Response.json(${JSON.stringify(body)});await import(${JSON.stringify(script)});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,env:{...process.env,PENSION_DAILY_FEED_URL:'https://feed.test'},encoding:'utf8'});
 const saved=JSON.parse(readFileSync(path));rmSync(dir,{recursive:true,force:true});return {result,saved};
}
test('newer verified same-day LS observation refreshes a provisional pension row',()=>{
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
 const {result,saved}=run(date);assert.equal(result.status,0,result.stderr);assert.equal(saved.rows.length,1);assert.equal(saved.rows[0][2],11);
});
test('historical or unknown-source pension rows cannot be silently revised',()=>{
 for(const [date,options] of [['2020-01-02',{}],[new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),{knownSource:'user final data'}]]){
 const {result,saved}=run(date,options);assert.notEqual(result.status,0);assert.equal(saved.rows[0][2],10);
 }
});
