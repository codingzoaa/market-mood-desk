import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
/** SQLite functional adapter. No fabricated D1 scanned-row billing metadata. */
export class SQLiteD1 {
 constructor(path=':memory:'){this.sqlite=new DatabaseSync(path);this.sqlite.exec(readFileSync(new URL('../../worker/pipeline/schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const self=this;function bound(values=[]){return {sql,values,bind(...args){return bound(args);},async all(){const before=self.sqlite.prepare('SELECT total_changes() AS n').get().n;const results=self.sqlite.prepare(sql).all(...values);const after=self.sqlite.prepare('SELECT total_changes() AS n').get().n;return {success:true,results,meta:{changes:after-before,rows_written:after-before,size_after:self.bytes()}};},async run(){return this.all();},async first(){return (await this.all()).results[0]??null;}};}return bound();}
 async batch(statements){this.sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());this.sqlite.exec('COMMIT');return results;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
 bytes(){return this.sqlite.prepare('PRAGMA page_count').get().page_count*this.sqlite.prepare('PRAGMA page_size').get().page_size;}
 close(){this.sqlite.close();}
}
export class MemoryR2 {
 constructor(){this.objects=new Map();this.corrupt=false;this.fail=false;this.requests={put:0,get:0,head:0};}
 async put(key,data){this.requests.put++;if(this.fail)throw Error('unavailable');const bytes=typeof data==='string'?new TextEncoder().encode(data):new Uint8Array(data);this.objects.set(key,bytes.slice());}
 async head(key){this.requests.head++;if(this.fail)throw Error('unavailable');return this.objects.has(key)?{}:null;}
 async get(key){this.requests.get++;if(this.fail)throw Error('unavailable');const original=this.objects.get(key);if(!original)return null;const bytes=this.corrupt?new TextEncoder().encode('corrupted'):original;return {async arrayBuffer(){return bytes.slice().buffer;},async text(){return new TextDecoder().decode(bytes);}};}
}
