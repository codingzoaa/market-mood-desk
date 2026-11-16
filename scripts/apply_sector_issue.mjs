import fs from 'node:fs';
import {acceptSharedSectorIssue} from '../src/shared-sector-edits.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file='src/data/stock-sector-overrides.json';
const known=[...read('src/data/stock-map-verified.json').entries,...read('src/data/stock-sector-reviews.json'),...read('src/data/stock-map.json')];
const output=acceptSharedSectorIssue(read(process.env.GITHUB_EVENT_PATH),read(file),known);
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
