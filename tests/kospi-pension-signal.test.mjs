import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateKospiPensionDataset,withWilderRsi,signalDays,visiblePriceBounds,periodStartIndex,PENSION_MIN_BILLION} from '../src/kospi-pension-signal-data.mjs';

test('KRX historical data: 2006-2026 matching prices and pension flows', () => {
  const dataset = JSON.parse(readFileSync(new URL('../public/kospi-pension-rsi.json',import.meta.url),'utf8'));
  const rows = validateKospiPensionDataset(dataset);
  assert.ok(rows.length>=5135, 'daily history must be append-only');
  assert.equal(rows[0].date,'2006-01-02');
  assert.equal(rows[5134].date,'2026-10-30');
  assert.equal(rows[5134].close,5730.74);
  assert.equal(rows[5134].netBuyBillion,893);
  assert.ok(rows.at(-1).date>='2026-10-30');
  if(rows.at(-1).date==='2026-11-02'){
    assert.equal(rows.at(-1).close,5859.08);
    assert.equal(rows.at(-1).netBuyBillion,169.9);
  }
  assert.equal(PENSION_MIN_BILLION,100);
  const withRsi=withWilderRsi(rows);
  assert.equal(withRsi.slice(0,14).every(p=>p.rsi===null),true);
  const signals=signalDays(withRsi);
  if(rows.at(-1).date==='2026-11-02')assert.ok(withRsi.at(-1).rsi>35, '2026-11-02 must not be shaded');
  assert.ok(signals.length>=101, 'previous confirmed signals must be preserved');
  const lg=signals.find(p=>p.date==='2022-01-27');
  assert.equal(lg?.netBuyBillion,1223); // 1조 2,230억원, not 1,223억원
  assert.ok(Math.abs((lg?.rsi||0)-18.53)<.05);
  assert.ok(signals.some(p=>p.date==='2026-10-22'));
  assert.ok(signals.every(p=>p.rsi!==null && p.rsi<=35 && p.netBuyBillion>=100));
});

test('visible Y bounds refit only to chosen date range', () => {
  const sample=[{date:'2020-01-01',close:100},{date:'2020-01-02',close:200},{date:'2020-01-03',close:300},{date:'2020-01-04',close:1000}];
  const full=visiblePriceBounds(sample,0,3);
  const zoomed=visiblePriceBounds(sample,1,2);
  assert.ok(full[1]>1000);
  assert.ok(zoomed[1]<400);
  assert.ok(zoomed[0]<200 && zoomed[1]>300);
});

test('period ranges always anchor to newest data, not current local date', () => {
  const rows=[{date:'2025-05-01'},{date:'2025-12-01'},{date:'2026-02-01'},{date:'2026-10-30'}];
  assert.equal(periodStartIndex(rows,'ALL'),0);
  assert.equal(periodStartIndex(rows,'1Y'),1);
  assert.equal(periodStartIndex(rows,'3M'),3);
});

test('invalid units or duplicate dates reject dataset', () => {
  assert.throws(()=>validateKospiPensionDataset({schemaVersion:1,pensionUnit:'억원',rows:[]}));
  const rows=Array.from({length:16},(_,i)=>['2026-01-02',2500,i]);
  assert.throws(()=>validateKospiPensionDataset({schemaVersion:1,pensionUnit:'십억원',rows}));
});
