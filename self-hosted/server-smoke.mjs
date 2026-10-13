import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const origin='http://127.0.0.1:3000';let cookie='';
async function req(path,body){return fetch(origin+path,{headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(body?{method:'POST',body:JSON.stringify(body)}:{})})}
async function login(email,password){const r=await req('/api/login',{email,password});assert.equal(r.status,200,await r.clone().text());cookie=r.headers.get('set-cookie').split(';')[0]}
await login('qa@example.test',readFileSync('/run/secrets/admin_password','utf8'));
let r=await req('/api/pms');let x=await r.json();
const state={...x.state,rooms:[{id:'101',type:'Standard',rate:100,housekeeping:'Dirty'}],bookings:[{id:'QA-1',guest:'Test Guest',email:'guest@example.test',phone:'',room:'101',arrival:'2026-12-01',departure:'2026-12-03',status:'Confirmed',rate:100,paid:50,paymentMethod:'Cash',notes:''}]};
r=await req('/api/pms?propertyId=1',{state,previous:JSON.stringify(x.state)});assert.equal(r.status,200,await r.clone().text());
assert.equal((await req('/api/pms?propertyId=1',{state,previous:JSON.stringify(x.state)})).status,409);
const ledger=await (await req('/api/accounting?propertyId=1')).json();assert(ledger.transactions.some(t=>t.amount===5000));
r=await req('/api/staff',{email:'cleaner@example.test',name:'Cleaner',password:'qa-cleaner-password-123',role:'employee',active:true,propertyIds:[1],permissions:['housekeeping']});assert.equal(r.status,200,await r.clone().text());
await login('cleaner@example.test','qa-cleaner-password-123');assert.equal((await req('/api/staff')).status,403);assert.equal((await req('/api/license')).status,403);assert.equal((await req('/api/pos?propertyId=1')).status,403);assert.equal((await req('/api/pms?propertyId=2')).status,403);
x=await (await req('/api/pms?propertyId=1')).json();const previous=JSON.stringify(x.state);x.state.rooms[0].housekeeping='Clean';r=await req('/api/pms?propertyId=1',{state:x.state,previous});assert.equal(r.status,200,await r.clone().text());
console.log('PASS: reservation save, stale-write denial, payment ledger, local staff account and employee restrictions');
// The authenticated account is selected from its session, never from request input.
assert.equal((await req('/api/password',{currentPassword:'wrong',newPassword:'qa-new-password-123'})).status,400);
assert.equal((await req('/api/password',{email:'qa@example.test',currentPassword:'qa-cleaner-password-123',newPassword:'qa-new-password-123'})).status,200);
assert.equal((await req('/api/pms')).status,403);
const oldLogin=await req('/api/login',{email:'cleaner@example.test',password:'qa-cleaner-password-123'});assert.equal(oldLogin.status,401);
await login('cleaner@example.test','qa-new-password-123');
await login('qa@example.test',readFileSync('/run/secrets/admin_password','utf8'));
console.log('PASS: own password route, wrong current password denial, session revocation, new password login, protected other account');
