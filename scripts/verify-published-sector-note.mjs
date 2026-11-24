import fs from 'node:fs';
const id='issue-'+JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).issue.number;
const expected=JSON.parse(fs.readFileSync('src/data/sector-notes.json','utf8')).entries.find(n=>n.id===id);
if(!expected)throw Error('SECTOR_NOTE_EXPECTED_MISSING');
for(let attempt=0;attempt<12;attempt++){
 try{
  const r=await fetch('https://codingzoaa.github.io/market-mood-desk/sector-notes.json?verify='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(r.ok){const doc=await r.json();const actual=doc.entries?.find(n=>n.id===id);if(JSON.stringify(actual)===JSON.stringify(expected)){console.log('SECTOR_NOTE_PUBLISHED '+id);process.exit(0);}}
 }catch{}
 if(attempt<11)await new Promise(r=>setTimeout(r,5000));
}
throw Error('SECTOR_NOTE_PUBLICATION_NOT_CONFIRMED');
