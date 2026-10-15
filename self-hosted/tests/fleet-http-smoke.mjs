// Run after pnpm build: node tests/fleet-http-smoke.mjs
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID as uuid} from 'node:crypto';
const root=mkdtempSync(join(tmpdir(),'loomi-fleet-')),password=uuid(),secret=join(root,'password');writeFileSync(secret,password,{mode:0o600});
const base='http://127.0.0.1:3317';let cookie='',logs='';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3317'],{env:{...process.env,DATA_DIR:join(root,'data'),ADMIN_PASSWORD_FILE:secret,ADMIN_EMAIL:'qa@example.test',APP_URL:base},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
async function req(path,body,headers={}){const r=await fetch(base+path,{headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,...headers},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,x:await r.json(),headers:r.headers};}
async function login(email,password){const r=await req('/api/login',{email,password});assert.equal(r.status,200,JSON.stringify(r.x));cookie=r.headers.get('set-cookie').split(';')[0];}
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
try{
 for(let i=0;i<100;i++){try{await fetch(base+'/api/health');break;}catch{if(server.exitCode!==null||i===99)throw Error('Server did not start: '+logs);await new Promise(r=>setTimeout(r,100));}}
 assert.equal((await req('/api/vehicles?propertyId=1')).status,403);
 await login('qa@example.test',password);assert.equal((await req('/api/pms')).status,200);
 const api='/api/vehicles?propertyId=1',id=uuid(),trip=uuid(),d=uuid();
 let r=await req(api,{action:'vehicle',id,previous:0,name:'Pickup',plate:'QA-123',status:'Available',odometer:100,note:'Initial registration'});assert.equal(r.status,200,JSON.stringify(r.x));
 r=await req(api,{action:'depart',id:trip,vehicleId:id,previous:1,driver:'QA driver',destination:'Warehouse',purpose:'Delivery',odometer:100,note:''});assert.equal(r.status,200,JSON.stringify(r.x));
 r=await req(api,{action:'return',id:trip,previous:2,odometer:120,note:'Returned',hasDefect:true,defect:{id:d,description:'Scratched door',severity:'Minor',photos:[{mime:'image/png',data:png}]}});assert.equal(r.status,200,JSON.stringify(r.x));
 r=await req(api);assert.equal(r.x.vehicles[0].status,'Out of service');const photo=r.x.photos[0].id;
 const p=await fetch(base+api+'&photo='+photo,{headers:{Cookie:cookie}});assert.equal(p.status,200);assert.equal(p.headers.get('content-type'),'image/png');assert.equal((await p.arrayBuffer()).byteLength,68);
 assert.equal((await fetch(base+api+'&photo='+photo)).status,403);
 assert.equal((await req(api,{action:'defect',id:uuid(),vehicleId:id,description:'Bad origin',severity:'Minor',photos:[]},{Origin:'https://example.invalid'})).status,403);
 const backup=await req('/api/backup');assert.equal(backup.status,200);assert.equal(backup.x.tables.fleet_photos.length,1);r=await req('/api/backup',{action:'preview',backup:backup.x});assert.equal(r.status,200,JSON.stringify(r.x));assert.equal(r.x.summary.fleet_vehicles,1);
 const staff={email:'guard@example.test',name:'Security',role:'employee',team:'security',active:true,permissions:['vehicleView','vehicleDispatch'],propertyIds:[1],password:uuid()};r=await req('/api/staff',staff);assert.equal(r.status,200,JSON.stringify(r.x));await login(staff.email,staff.password);
 assert.equal((await req(api)).status,200);assert.equal((await req('/api/vehicles?propertyId=2')).status,403);assert.equal((await req(api,{action:'review',id:d,previous:1,status:'Resolved',resolution:'Unauthorized'})).status,403);
 console.log('PASS: production HTTP authentication, workflow, private photos, CSRF, backup preview, security preset and property/supervisor restrictions');
}finally{server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));rmSync(root,{recursive:true,force:true});}
