import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('17:00 review status exists for 2026-11-06 and does not invent sectors',()=>{
 const json=JSON.parse(readFileSync('public/sector-review-status.json','utf8'));
 assert.match(json.date,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(['pending','published'].includes(json.status));
 assert.ok(json.reason.length>5);
 assert.ok(Array.isArray(json.sources));
 const calendar=readFileSync('src/close-calendar.tsx','utf8');
 assert.ok(calendar.includes("sector-review-status.json"));
 assert.ok(calendar.includes("reviewStatus?.status==='pending'"));
 assert.ok(calendar.includes("!closeReviews.some(r=>r.date===reviewStatus.date)"));
});
