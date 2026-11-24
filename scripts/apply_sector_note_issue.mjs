import fs from 'node:fs';
import {acceptNoteIssue} from '../src/sector-notes.mjs';
const file='src/data/sector-notes.json';
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
const output=acceptNoteIssue(event,JSON.parse(fs.readFileSync(file,'utf8')));
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
