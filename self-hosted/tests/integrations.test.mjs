import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {Store} from '../runtime/core.mjs';
import {createToken,authenticate,permit,transaction,createWebhook,webhookTarget,queueChanges,dispatchOne} from '../runtime/integrations.mjs';
function fixture(){const dir=mkdtempSync(join(tmpdir(),'loomi-api-'));const s=new Store(join(dir,'db.sqlite'),'drizzle');s.db.prepare('INSERT INTO property(id,data) VALUES (?,?)').run(1,JSON.stringify({hotel:'Hotel',currency:'USD',rooms:[],bookings:[]}));return {s,close(){s.db.close();rmSync(dir,{recursive:true,force:true})}};}
const expiresAt=()=>new Date(Date.now()+86400000).toISOString();
test('tokens are hashed, expiring, scoped, rate limited and immediately revoked',()=>{
 const {s,close}=fixture();try{
 const x=createToken(s,{name:'n8n',scopes:['rooms:read'],propertyIds:[1],expiresAt:expiresAt()},'owner');
 const row=s.db.prepare('SELECT * FROM api_tokens WHERE id=?').get(x.id);assert.notEqual(row.token_hash,x.token);assert.equal(row.approval_required,1);
 const req=new Request('https://hotel.test/api/v1/properties',{headers:{authorization:'Bearer '+x.token}});
 let t=authenticate(s,req,()=>({valid:true}));permit(t,'rooms:read',1);
 assert.throws(()=>permit(t,'guests:read',1),/permission/);assert.throws(()=>permit(t,'rooms:read',2),/property/);
 assert.throws(()=>authenticate(s,req,()=>({valid:false})),/licence/);
 assert.throws(()=>createToken(s,{name:'Bad',scopes:['owner'],propertyIds:[1],expiresAt:expiresAt()},'owner'));
 assert.throws(()=>createToken(s,{name:'Bad',scopes:['rooms:read'],propertyIds:[2],expiresAt:expiresAt()},'owner'));
 assert.throws(()=>createToken(s,{name:'Bad',scopes:['rooms:read'],propertyIds:[1],expiresAt:'2020-01-01'},'owner'));
 for(let i=1;i<120;i++)authenticate(s,req,()=>({valid:true}));assert.throws(()=>authenticate(s,req,()=>({valid:true})),/rate limit/);
 s.db.prepare('UPDATE api_tokens SET revoked=1 WHERE id=?').run(x.id);assert.throws(()=>authenticate(s,req,()=>({valid:true})),/revoked/);
 s.db.prepare('UPDATE api_tokens SET revoked=0,expires=1 WHERE id=?').run(x.id);assert.throws(()=>authenticate(s,req,()=>({valid:true})),/expired/);
 }finally{close()}
});
test('webhook allowlist, rollback, minimal payloads, HMAC, retries and licence gating',async()=>{
 const {s,close}=fixture();const before=process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS;process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS='https://n8n.example';try{
 assert.throws(()=>webhookTarget('http://127.0.0.1/admin'));assert.throws(()=>webhookTarget('https://n8n.example.evil.test/x'));assert.throws(()=>webhookTarget('https://user:pass@n8n.example/x'));assert.throws(()=>webhookTarget('https://n8n.example/x#fragment'));
 const w=createWebhook(s,{name:'Events',url:'https://n8n.example/webhook/test',propertyIds:[1]},'owner');
 const old={rooms:[{id:'101',housekeeping:'Clean'}],bookings:[]},next={rooms:[{id:'101',housekeeping:'Dirty'}],bookings:[{id:'B1',status:'Confirmed',guest:'Secret',identification:{number:'private'}}]};
 assert.throws(()=>transaction(s,()=>{queueChanges(s,old,next,1);throw Error('rollback')}));assert.equal(s.db.prepare('SELECT count(*) AS n FROM webhook_deliveries').get().n,0);
 transaction(s,()=>queueChanges(s,old,next,1));assert.equal(s.db.prepare('SELECT count(*) AS n FROM webhook_deliveries').get().n,2);
 const bodies=s.db.prepare('SELECT body FROM webhook_deliveries').all();assert.ok(bodies.every(x=>!x.body.includes('Secret')&&!x.body.includes('private')));
 let calls=0;assert.equal(await dispatchOne(s,()=>({valid:false}),()=>{calls++}),false);assert.equal(calls,0);
 const send=async(url,body,headers)=>{calls++;assert.equal(url.origin,'https://n8n.example');assert.equal(headers['X-Loomi-Signature'],'sha256='+createHmac('sha256',w.secret).update(headers['X-Loomi-Timestamp']+'.'+body).digest('hex'));return 503};
 await dispatchOne(s,()=>({valid:true}),send);const failed=s.db.prepare("SELECT * FROM webhook_deliveries WHERE attempts=1").get();assert.equal(failed.status,'pending');assert.ok(failed.next_attempt>Date.now());
 s.db.prepare('UPDATE webhook_deliveries SET next_attempt=0 WHERE id=?').run(failed.id);
 await dispatchOne(s,()=>({valid:true}),async()=>204);assert.equal(s.db.prepare('SELECT status FROM webhook_deliveries WHERE id=?').get(failed.id).status,'delivered');
 s.db.prepare('UPDATE webhook_subscriptions SET active=0').run();await dispatchOne(s,()=>({valid:true}),async()=>{throw Error('must not send')});assert.equal(s.db.prepare("SELECT count(*) AS n FROM webhook_deliveries WHERE status='disabled'").get().n,1);
 }finally{if(before===undefined)delete process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS;else process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS=before;close()}
});

test('actual webhook HTTP transport signs the payload and does not follow redirects',async()=>{
 const {createServer}=await import('node:http');const {sendWebhook}=await import('../runtime/integrations.mjs');
 let requests=0,received;
 const server=createServer((req,res)=>{requests++;let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{received={raw,headers:req.headers};res.writeHead(302,{Location:'/second'});res.end('redirect')})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const status=await sendWebhook(new URL('http://127.0.0.1:'+server.address().port+'/first'),'{"id":"event"}',{'X-Loomi-Signature':'sha256=test'});assert.equal(status,302);assert.equal(requests,1);assert.equal(received.raw,'{"id":"event"}');assert.equal(received.headers['x-loomi-signature'],'sha256=test');}
 finally{await new Promise(r=>server.close(r));}
});
