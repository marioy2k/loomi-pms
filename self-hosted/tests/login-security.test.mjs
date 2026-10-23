import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from '../runtime/core.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
function fixture(){const dir=mkdtempSync(join(tmpdir(),'loomi-login-')),s=new Store(join(dir,'test.sqlite'),new URL('../drizzle',import.meta.url).pathname),password='isolated-login-password';s.bootstrap('owner@example.test',password,'Owner');s.db.prepare("INSERT INTO staff(email,name,role,permissions,active,property_ids,team) VALUES('staff@example.test','Staff','employee','[]',1,'[1]','custom')").run();s.setPassword('staff@example.test',password,'Staff');return {s,password,close(){s.db.close();rmSync(dir,{recursive:true,force:true})}}}
test('failed login locks the targeted account without locking every other employee',()=>{const f=fixture();try{for(let n=0;n<10;n++)assert.throws(()=>f.s.login('staff@example.test','wrong-password'));assert.throws(()=>f.s.login('staff@example.test',f.password),e=>e.status===429);assert(f.s.login('owner@example.test',f.password));assert.throws(()=>f.s.login('staff@example.test',f.password),e=>e.status===429)}finally{f.close()}});
test('global login flood protection survives successful logins and recovers after its window',()=>{const f=fixture();try{const key=hash('login:global-minute');f.s.db.prepare('INSERT INTO attempts VALUES(?,119,?)').run(key,Date.now()+60000);assert(f.s.login('owner@example.test',f.password));assert.throws(()=>f.s.login('owner@example.test',f.password),e=>e.status===429);f.s.db.prepare('UPDATE attempts SET until=0 WHERE key=?').run(key);assert(f.s.login('owner@example.test',f.password));assert.equal(f.s.db.prepare('SELECT count FROM attempts WHERE key=?').get(key).count,1)}finally{f.close()}});
test('oversized credentials are rejected without creating a session',()=>{const f=fixture();try{for(const [email,password] of [['x'.repeat(255),f.password],['owner@example.test','x'.repeat(129)],[{},f.password],['owner@example.test',{}]])assert.throws(()=>f.s.login(email,password));assert.equal(f.s.db.prepare('SELECT count(*) n FROM sessions').get().n,0)}finally{f.close()}});
