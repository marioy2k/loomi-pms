import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {generateKeyPairSync,sign} from 'node:crypto';
test('production integration API: scoping, approvals, idempotency, conflicts, browser events, privacy and revocation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loomi-integration-http-')),origin='http://127.0.0.1:3110',keys=generateKeyPairSync('ed25519');
 writeFileSync(join(dir,'password'),'owner-password-123');writeFileSync(join(dir,'public'),keys.publicKey.export({type:'spki',format:'pem'}));
 const child=spawn(process.execPath,['.next/standalone/server.js'],{env:{...process.env,APP_URL:origin,PORT:'3110',HOSTNAME:'127.0.0.1',ADMIN_EMAIL:'owner@example.com',ADMIN_PASSWORD_FILE:join(dir,'password'),LICENSE_PUBLIC_KEY_FILE:join(dir,'public'),DATA_DIR:dir,COOKIE_SECURE:'false',LOOMI_WEBHOOK_ALLOWED_ORIGINS:'https://n8n.example'},stdio:['ignore','ignore','inherit']});
 let cookie='',token='';
 async function browser(path,body){return fetch(origin+path,{headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(body?{method:'POST',body:JSON.stringify(body)}:{})})}
 async function api(path,method='GET',body,key='request-0001'){return fetch(origin+'/api/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':key},...(body?{body:JSON.stringify(body)}:{})})}
 async function create(scopes,approvalRequired=true){const r=await browser('/api/integrations',{action:'create-token',name:'n8n',scopes,propertyIds:[1],approvalRequired,expiresAt:new Date(Date.now()+86400000).toISOString()});assert.equal(r.status,201);const t=await r.json();token=t.token;return t;}
 async function bodyStatus(r,status){const x=await r.json();assert.equal(r.status,status,JSON.stringify(x));return x;}
 try{
  for(let i=0;i<80;i++){try{if((await browser('/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
  let r=await browser('/api/login',{email:'owner@example.com',password:'owner-password-123'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
  const html=await(await browser('/')).text(),id=html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)[0];
  const bytes=Buffer.from(JSON.stringify({product:'Loomi PMS',installationId:id,company:'Test',term:'monthly',maxProperties:2,issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}));
  assert.equal((await browser('/api/license',{payload:bytes.toString('base64url'),signature:sign(null,bytes,keys.privateKey).toString('base64url')})).status,200);
  let x=await(await browser('/api/pms')).json();const state={...x.state,rooms:[{id:'101',type:'Standard',rate:100,housekeeping:'Clean'},{id:'102',type:'Twin',rate:80,housekeeping:'Clean'}]};
  assert.equal((await browser('/api/pms?propertyId=1',{state,previous:JSON.stringify(x.state)})).status,200);
  await bodyStatus(await browser('/api/properties',{name:'Other',currency:'USD'}),201);
  await bodyStatus(await browser('/api/integrations',{action:'create-webhook',name:'n8n events',url:'https://n8n.example/webhook/test',propertyIds:[1]}),201);
  const read=await create(['rooms:read','reservations:read','reports:read']);
  await bodyStatus(await api('properties/2/rooms'),403);await bodyStatus(await api('properties/1/guests'),403);
  await bodyStatus(await api('properties/1/availability?arrival=2026-02-30&departure=2026-03-04'),400);
  await bodyStatus(await api('properties/1/rooms/101/housekeeping','PATCH',{status:'Dirty'}),403);
  const writer=await create(['rooms:read','reservations:read','reservations:write','housekeeping:write','reports:read']);
  const booking={guest:'Private Guest',email:'private@example.com',phone:'555',room:'101',arrival:'2026-10-10',departure:'2026-10-12'};
  const pending=await bodyStatus(await api('properties/1/reservations','POST',booking,'create-00001'),202);
  assert.equal((await(await api('properties/1/reservations')).json()).total,0);
  assert.equal((await bodyStatus(await api('properties/1/reservations','POST',booking,'create-00001'),202)).actionId,pending.actionId);
  await bodyStatus(await api('properties/1/reservations','POST',{...booking,guest:'Changed'},'create-00001'),409);
  const applied=await bodyStatus(await browser('/api/integrations',{action:'approve',id:pending.actionId}),200);
  assert.equal((await bodyStatus(await api('actions/'+pending.actionId),200)).status,'applied');
  assert.equal((await bodyStatus(await api('properties/1/reservations','POST',booking,'create-00001'),200)).bookingId,applied.bookingId);
  const masked=await bodyStatus(await api('properties/1/reservations'),200);assert.equal(masked.total,1);assert.equal(masked.reservations[0].guest,undefined);assert.equal(masked.reservations[0].email,undefined);
  const change=await bodyStatus(await api('properties/1/rooms/101/housekeeping','PATCH',{status:'Dirty'},'dirty-00001'),202);
  await bodyStatus(await browser('/api/integrations',{action:'reject',id:change.actionId}),200);
  assert.equal((await bodyStatus(await api('actions/'+change.actionId),200)).status,'rejected');
  const stale=await bodyStatus(await api('properties/1/rooms/101/housekeeping','PATCH',{status:'Dirty'},'stale-00001'),202);
  x=await(await browser('/api/pms')).json();x.state.bookings[0].identification={type:'Passport',number:'PASSPORT-PRIVATE',country:'SR',expiry:''};x.state.bookings[0].notes='PRIVATE-NOTE';
  await bodyStatus(await browser('/api/pms?propertyId=1',{state:x.state,previous:JSON.stringify({...x.state,bookings:[{...x.state.bookings[0],identification:undefined,notes:''}]})}),200);
  await bodyStatus(await browser('/api/integrations',{action:'approve',id:stale.actionId}),409);
  const reader=await create(['guests:read','reservations:read']);
  const guests=await bodyStatus(await api('properties/1/guests'),200);assert.equal(guests.guests[0].email,'private@example.com');assert.ok(!JSON.stringify(guests).includes('PASSPORT-PRIVATE'));
  const stays=await bodyStatus(await api('properties/1/reservations'),200);assert.equal(stays.reservations[0].notes,undefined);assert.equal(stays.reservations[0].identification,undefined);
  const auto=await create(['rooms:read','reservations:write','housekeeping:write'],false);
  await bodyStatus(await api('properties/1/reservations','POST',{...booking,guest:'Other'},'overlap-0001'),409);
  await bodyStatus(await api('properties/1/reservations','POST',{...booking,room:'102',paid:1},'payment-0001'),400);
  await bodyStatus(await api('properties/1/reservations','POST',{...booking,room:'102',notes:'x'.repeat(17000)},'oversize-001'),413);
  const checkin=await bodyStatus(await api('properties/1/reservations/'+applied.bookingId+'/check-in','POST',{},'checkin-0001'),200);assert.equal(checkin.bookingStatus,'Checked in');
  await bodyStatus(await api('properties/1/reservations/'+applied.bookingId+'/cancel','POST',{},'cancel-00001'),409);
  await bodyStatus(await api('properties/1/reservations/'+applied.bookingId+'/check-out','POST',{},'checkout-001'),200);
  const rooms=await bodyStatus(await api('properties/1/rooms'),200);assert.equal(rooms.rooms[0].housekeeping,'Dirty');
  await bodyStatus(await api('properties/1/rooms/101/housekeeping','PATCH',{status:'Clean'},'clean-000001'),200);
  const settings=await bodyStatus(await browser('/api/integrations'),200);assert.ok(settings.deliveries.length>=5);assert.ok(!JSON.stringify(settings.tokens).includes('loomi_'));assert.ok(settings.deliveries.some(d=>d.status==='pending'));
  await bodyStatus(await browser('/api/integrations',{action:'revoke-token',id:auto.id}),200);await bodyStatus(await api('properties/1/rooms'),401);
  token=read.token;assert.equal((await bodyStatus(await api('properties'),200)).properties.length,1);
  // Employee sessions cannot issue integration tokens or approve changes.
  await bodyStatus(await browser('/api/staff',{email:'cleaner@example.com',password:'cleaner-password-123',name:'Cleaner',role:'employee',active:true,propertyIds:[1],permissions:['housekeeping']}),200);
  r=await browser('/api/login',{email:'cleaner@example.com',password:'cleaner-password-123'});const ownerCookie=cookie;cookie=r.headers.get('set-cookie').split(';')[0];await bodyStatus(await browser('/api/integrations'),403);await bodyStatus(await browser('/api/integrations',{action:'approve',id:stale.actionId}),403);cookie=ownerCookie;
  const db=new DatabaseSync(join(dir,'loomi.sqlite'));db.prepare("UPDATE settings SET value='{}' WHERE key='licence'").run();db.close();
  await bodyStatus(await api('properties/1/rooms'),403);
 }finally{if(child.exitCode===null){child.kill();await new Promise(r=>{child.once('exit',r);setTimeout(r,1000)})}rmSync(dir,{recursive:true,force:true});}
});
