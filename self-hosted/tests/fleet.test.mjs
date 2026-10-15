import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {loadFleet,saveFleet,fleetPhoto} from '../runtime/fleet.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const p of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+p,import.meta.url),'utf8'));db.prepare('INSERT INTO property VALUES(?,?)').run(1,'{}');db.prepare('INSERT INTO property VALUES(?,?)').run(2,'{}');const owner={role:'owner',email:'owner@example.com',name:'Owner',permissions:[],propertyIds:null,enabledModules:['vehicles']};const security={role:'employee',email:'guard@example.com',name:'Security',permissions:['vehicleView','vehicleDispatch'],propertyIds:[1],enabledModules:['vehicles']};const supervisor={...security,email:'supervisor@example.com',name:'Supervisor',permissions:['vehicleView','vehicleDispatch','vehicleManage','vehicleReview']};const id=randomUUID();saveFleet(db,1,{action:'vehicle',id,name:'Company pickup',plate:'12-34 AB',status:'Available',odometer:100,previous:0,note:'Initial registration'},owner);return {db,owner,security,supervisor,id};}
const vehicle=(db,id)=>db.prepare('SELECT * FROM fleet_vehicles WHERE id=?').get(id);
const departure=(id,previous=1)=>({action:'depart',id:randomUUID(),vehicleId:id,driver:'Romario',destination:'Warehouse',purpose:'Collect supplies',odometer:100,note:'Checked at gate',previous});
const defect=()=>({id:randomUUID(),description:'Brake warning light',severity:'Critical',photos:[{mime:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}]});
test('departure and return preserve driver, plate, actors, automatic times and distance; duplicate issuance blocked',()=>{
 const {db,id,security}=setup(),trip=departure(id);saveFleet(db,1,trip,security);assert.equal(vehicle(db,id).status,'On trip');
 assert.throws(()=>saveFleet(db,1,departure(id),security),/unavailable/);
 assert.throws(()=>saveFleet(db,1,{action:'return',id:trip.id,odometer:99,note:'',hasDefect:false,previous:2},security),/odometer/);
 saveFleet(db,1,{action:'return',id:trip.id,odometer:150,note:'Parked',hasDefect:false,previous:2},security);
 const r=loadFleet(db,1,security).trips[0];assert.equal(r.driver,'Romario');assert.equal(r.plate,'12-34 AB');assert.equal(r.departed_by,security.email);assert.equal(r.returned_by,security.email);assert.equal(r.end_km-r.start_km,50);assert.ok(Date.parse(r.departed_at));assert.ok(Date.parse(r.returned_at));assert.equal(vehicle(db,id).status,'Available');
 assert.throws(()=>saveFleet(db,1,{action:'return',id:trip.id,odometer:151,note:'',hasDefect:false,previous:3},security),/already returned/);db.close();
});
test('damaged return stores private photos, requires supervisor review and separate release',()=>{
 const {db,id,security,supervisor}=setup(),trip=departure(id),d=defect();saveFleet(db,1,trip,security);
 saveFleet(db,1,{action:'return',id:trip.id,odometer:120,note:'Warning reported',hasDefect:true,defect:d,previous:2},security);
 assert.equal(vehicle(db,id).status,'Out of service');const data=loadFleet(db,1,security);assert.equal(data.defects[0].trip_id,trip.id);assert.equal(data.photos.length,1);assert.equal(fleetPhoto(db,1,data.photos[0].id,security).mime,'image/png');assert.throws(()=>fleetPhoto(db,2,data.photos[0].id,supervisor),/access/);
 assert.throws(()=>saveFleet(db,1,{action:'review',id:d.id,previous:1,status:'Resolved',resolution:'Repaired'},security),/permission/);
 const release={action:'vehicle',id,name:'Company pickup',plate:'12-34 AB',odometer:120,status:'Available',note:'Release after repair',previous:vehicle(db,id).version};
 assert.throws(()=>saveFleet(db,1,release,supervisor),/Resolve all defects/);
 saveFleet(db,1,{action:'review',id:d.id,previous:1,status:'Under review',resolution:'Workshop inspection'},supervisor);
 assert.throws(()=>saveFleet(db,1,{action:'review',id:d.id,previous:1,status:'Resolved',resolution:'Repaired'},supervisor),/changed/);
 saveFleet(db,1,{action:'review',id:d.id,previous:2,status:'Resolved',resolution:'Sensor replaced and brakes checked'},supervisor);
 assert.equal(vehicle(db,id).status,'Out of service');saveFleet(db,1,release,supervisor);assert.equal(vehicle(db,id).status,'Available');assert.equal(loadFleet(db,1,security).defects[0].reviewed_by,supervisor.email);db.close();
});
test('malformed or oversized photos roll back the entire return transaction',()=>{
 const {db,id,security}=setup(),trip=departure(id);saveFleet(db,1,trip,security);
 for(const photos of [[{mime:'image/png',data:'aGVsbG8='}],[{mime:'image/svg+xml',data:'AAAA'}],[{mime:'image/png',data:'A'.repeat(1500000)}],Array(5).fill(defect().photos[0])]){
 assert.throws(()=>saveFleet(db,1,{action:'return',id:trip.id,odometer:110,note:'',hasDefect:true,defect:{...defect(),photos},previous:2},security));
 assert.equal(vehicle(db,id).status,'On trip');assert.equal(loadFleet(db,1,security).trips[0].returned_at,null);assert.equal(loadFleet(db,1,security).defects.length,0);
 }db.close();
});
test('property isolation, disabled module and granular permissions enforced',()=>{
 const {db,id,security,owner}=setup();assert.throws(()=>loadFleet(db,2,security),/access/);assert.throws(()=>loadFleet(db,1,{...owner,enabledModules:[]}),/access/);assert.throws(()=>saveFleet(db,1,departure(id),{...security,permissions:['vehicleView']}),/permission/);assert.throws(()=>saveFleet(db,2,departure(id),owner),/not found/);
 assert.throws(()=>saveFleet(db,1,{action:'vehicle',id:randomUUID(),name:'Duplicate',plate:'12-34 ab',odometer:0,status:'Available',previous:0,note:'Test'},owner),/already registered/);assert.equal(loadFleet(db,1,owner).vehicles.length,1);db.close();
});
test('maintenance, out-of-service, stale changes and all unresolved defects block dispatch',()=>{
 const {db,id,owner}=setup();for(const status of ['Maintenance','Out of service']){saveFleet(db,1,{action:'vehicle',id,name:'Pickup',plate:'12-34 AB',odometer:100,status,previous:vehicle(db,id).version,note:'Workshop'},owner);assert.throws(()=>saveFleet(db,1,departure(id,vehicle(db,id).version),owner),/unavailable/);}
 assert.throws(()=>saveFleet(db,1,{action:'vehicle',id,name:'Pickup',plate:'12-34 AB',odometer:100,status:'Available',previous:1,note:'Stale release'},owner),/changed/);db.close();
});
test('defects reported during a trip survive return and block next departure',()=>{
 const {db,id,security}=setup(),trip=departure(id),d=defect();saveFleet(db,1,trip,security);saveFleet(db,1,{action:'defect',vehicleId:id,...d},security);assert.equal(vehicle(db,id).status,'On trip');saveFleet(db,1,{action:'return',id:trip.id,odometer:120,note:'',hasDefect:false,previous:2},security);assert.equal(vehicle(db,id).status,'Out of service');assert.throws(()=>saveFleet(db,1,departure(id,3),security),/unavailable/);db.close();
});
