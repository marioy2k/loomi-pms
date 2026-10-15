import {randomUUID} from 'node:crypto';
import {FleetError} from './fleet.mjs';
const fail=(status,message)=>{throw new FleetError(status,message)};
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
export const fieldDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Paramaribo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const fieldDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim());
const integer=(v,max=99999999)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const currencies=['USD','SRD','EUR'];
export function fieldGuard(db,id,user,scope,key){
 const module=scope==='fleet'?'vehicles':'security';
 if(!['fleet','security'].includes(scope)||!Number.isSafeInteger(id)||id<1||!user||!user.enabledModules?.includes(module)||(user.role==='employee'&&!user.propertyIds?.includes(id))||(!['owner','superadmin'].includes(user.role)&&!user.permissions?.includes(key)))fail(403,'Access to this feature and property is required');
 if(!db.prepare('SELECT id FROM property WHERE id=?').get(id))fail(404,'Property not found');
}
export function validateFieldPhotos(photos){
 if(!Array.isArray(photos)||photos.length>4)fail(400,'Use up to four photos');
 for(const p of photos){
  if(!p||!['image/jpeg','image/png','image/webp'].includes(p.mime)||typeof p.data!=='string'||p.data.length>1398104||p.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(p.data))fail(400,'Use JPEG, PNG or WebP photos of at most 1 MB');
  const b=Buffer.from(p.data,'base64');const valid=p.mime==='image/jpeg'?b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255:p.mime==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  if(!valid||!b.length||b.length>1048576)fail(400,'Invalid photo');
 }
 return photos;
}
export function fleetAlerts(vehicles,plans,today=fieldDay()){
 const soon=new Date(Date.parse(today)+30*86400000).toISOString().slice(0,10),alerts=[];
 for(const p of plans){const v=vehicles.find(v=>v.id===p.vehicle_id);if(!v)continue;
  for(const [kind,date] of [['service',p.next_date],['insurance',p.insurance_date],['inspection',p.inspection_date]])if(date&&date<=soon)alerts.push({vehicleId:v.id,plate:v.plate,kind,date,km:null,level:date<=today?'due':'soon'});
  if(p.next_km!==null&&p.next_km<=v.odometer+1000)alerts.push({vehicleId:v.id,plate:v.plate,kind:'service',date:null,km:p.next_km,level:p.next_km<=v.odometer?'due':'soon'});
 }
 return alerts;
}
export function fuelConsumption(rows){
 // A complete interval starts and ends at a full tank; partial fills in between count.
 const sorted=rows.filter(r=>!r.void_reason).sort((a,b)=>a.odometer-b.odometer||a.date.localeCompare(b.date)||a.created.localeCompare(b.created));
 let anchor=null,litres=0,totalLitres=0,distance=0;
 for(const r of sorted){if(anchor!==null)litres+=r.millilitres/1000;if(r.full_tank){if(anchor!==null&&r.odometer>anchor){totalLitres+=litres;distance+=r.odometer-anchor;}anchor=r.odometer;litres=0;}}
 return {distance,litres:totalLitres,litresPer100:distance?Math.round(totalLitres/distance*10000)/100:null};
}
export function loadField(db,id,user,scope){
 fieldGuard(db,id,user,scope,scope==='fleet'?'vehicleView':'securityView');
 const rows=table=>db.prepare('SELECT * FROM '+table+' WHERE property_id=? ORDER BY rowid DESC').all(id);
 if(scope==='fleet'){const vehicles=rows('fleet_vehicles'),plans=rows('fleet_plans'),fuel=rows('fleet_fuel');return {vehicles,plans,fuel,services:rows('fleet_services'),alerts:fleetAlerts(vehicles,plans),consumption:vehicles.map(v=>({vehicleId:v.id,...fuelConsumption(fuel.filter(r=>r.vehicle_id===v.id))}))};}
 const state=JSON.parse(db.prepare('SELECT data FROM property WHERE id=?').get(id).data);
 return {keys:rows('security_keys'),issues:rows('security_key_issues'),entries:rows('security_entries'),photos:db.prepare('SELECT id,entry_id FROM security_photos WHERE property_id=?').all(id),vehicles:user.enabledModules.includes('vehicles')?db.prepare('SELECT id,plate,name FROM fleet_vehicles WHERE property_id=?').all(id):[],rooms:state.rooms.map(r=>r.id)};
}
export function fieldPhoto(db,id,user,photo){fieldGuard(db,id,user,'security','securityView');const p=db.prepare('SELECT mime,data FROM security_photos WHERE id=? AND property_id=?').get(photo,id);if(!p)fail(404,'Photo not found');return p;}
export function validateFieldBackup(t){
 const vehicle=(r)=>t.fleet_vehicles.some(v=>v.id===r.vehicle_id&&v.property_id===r.property_id);
 for(const p of t.fleet_plans){if(!vehicle(p)||!integer(p.version)||p.version<1||p.next_km!==null&&!integer(p.next_km)||!text(p.notes,2000))fail(400,'Invalid vehicle maintenance plan in backup');for(const d of [p.next_date,p.insurance_date,p.inspection_date])if(d!==null&&!fieldDate(d))fail(400,'Invalid maintenance date in backup');}
 for(const r of [...t.fleet_fuel,...t.fleet_services])if(!vehicle(r)||!fieldDate(r.date)||!integer(r.odometer)||!integer(r.amount,10000000000)||!currencies.includes(r.currency))fail(400,'Invalid vehicle cost in backup');
 for(const r of t.fleet_fuel)if(!integer(r.millilitres,2000000)||!r.millilitres||![0,1].includes(r.full_tank))fail(400,'Invalid fuel quantity in backup');
 const open=new Set();for(const r of t.security_key_issues){if(!t.security_keys.some(k=>k.id===r.key_id&&k.property_id===r.property_id)||!Number.isFinite(Date.parse(r.issued_at))||r.returned_at!==null&&(!Number.isFinite(Date.parse(r.returned_at))||r.returned_at<r.issued_at))fail(400,'Invalid key issue in backup');if(r.returned_at===null){if(open.has(r.key_id))fail(400,'Duplicate open key issue in backup');open.add(r.key_id);}}
 for(const r of t.security_keys){if(!['room','vehicle','other'].includes(r.target_type)||![0,1].includes(r.active))fail(400,'Invalid key in backup');if(r.target_type==='vehicle'&&!t.fleet_vehicles.some(v=>v.id===r.target_ref&&v.property_id===r.property_id))fail(400,'Unknown key vehicle in backup');if(r.target_type==='room'&&!JSON.parse(t.property.find(p=>p.id===r.property_id)?.data||'{}').rooms?.some(v=>v.id===r.target_ref))fail(400,'Unknown key room in backup');}
 for(const r of t.security_entries)if(!['incident','visitor','handover'].includes(r.kind)||!['Low','Medium','High'].includes(r.severity)||!['Open','Under review','Closed'].includes(r.status)||!Number.isFinite(Date.parse(r.created)))fail(400,'Invalid security entry in backup');
 for(const r of t.security_photos){if(!t.security_entries.some(e=>e.id===r.entry_id&&e.property_id===r.property_id))fail(400,'Unknown security photo reference in backup');validateFieldPhotos([r]);}
}
export function saveField(db,id,user,scope,x){
 fieldGuard(db,id,user,scope,scope==='fleet'?'vehicleView':'securityView');
 const keys={plan:'vehicleManage',service:'vehicleManage',fuel:'vehicleDispatch',voidFuel:'vehicleManage',voidService:'vehicleManage',key:'securityManage',issue:'securityRegister',keyReturn:'securityRegister',entry:'securityRegister',close:'securityReview',visitorReturn:'securityRegister'};
 const fleetActions=['plan','service','fuel','voidFuel','voidService'];
 if(!x||!uuid(x.id)||!Object.hasOwn(keys,x.action)||(scope==='fleet')!==fleetActions.includes(x.action))fail(400,'Invalid operation');
 fieldGuard(db,id,user,scope,keys[x.action]);
 db.exec('BEGIN IMMEDIATE');
 try{
  const now=new Date().toISOString();
  const row=(table,ref)=>{const r=db.prepare('SELECT * FROM '+table+' WHERE id=? AND property_id=?').get(ref,id);if(!r)fail(404,'Record not found');return r;};
  const version=r=>{if(x.previous!==r.version)fail(409,'This record changed. Refresh before saving');};
  const amount=()=>{if(!integer(x.amount,10000000000)||!currencies.includes(x.currency))fail(400,'Enter a valid amount and currency');};
  const history=()=>{if(!fieldDate(x.date)||x.date>fieldDay()||!integer(x.odometer))fail(400,'Enter a valid date and odometer');};
  if(x.action==='plan'){
   const v=row('fleet_vehicles',x.id),old=db.prepare('SELECT * FROM fleet_plans WHERE vehicle_id=?').get(v.id);
   if(x.previous!==(old?.version||0))fail(409,'Maintenance plan changed. Refresh before saving');
   for(const k of ['nextDate','insuranceDate','inspectionDate'])if(x[k]!==null&&!fieldDate(x[k]))fail(400,'Enter valid reminder dates');
   if(x.nextKm!==null&&!integer(x.nextKm)||!text(x.notes,2000))fail(400,'Check maintenance interval and notes');
   db.prepare('INSERT INTO fleet_plans(vehicle_id,property_id,next_date,next_km,insurance_date,inspection_date,notes) VALUES(?,?,?,?,?,?,?) ON CONFLICT(vehicle_id) DO UPDATE SET next_date=excluded.next_date,next_km=excluded.next_km,insurance_date=excluded.insurance_date,inspection_date=excluded.inspection_date,notes=excluded.notes,version=version+1').run(v.id,id,x.nextDate,x.nextKm,x.insuranceDate,x.inspectionDate,x.notes);
  }else if(x.action==='fuel'||x.action==='service'){
   const v=row('fleet_vehicles',x.vehicleId);history();amount();
   if(x.action==='fuel'){
    if(!integer(x.millilitres,2000000)||x.millilitres===0||!text(x.station,200)||typeof x.fullTank!=='boolean')fail(400,'Enter fuel quantity, station and tank status');
    const last=db.prepare("SELECT date,odometer FROM fleet_fuel WHERE vehicle_id=? AND void_reason='' ORDER BY date DESC,odometer DESC LIMIT 1").get(v.id);
    if(last&&(x.date<last.date||x.odometer<last.odometer))fail(400,'Record fuel chronologically with a non-decreasing odometer');
    db.prepare('INSERT INTO fleet_fuel(id,property_id,vehicle_id,date,odometer,millilitres,amount,currency,full_tank,station,actor,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(x.id,id,v.id,x.date,x.odometer,x.millilitres,x.amount,x.currency,Number(x.fullTank),x.station,user.email,now);
   }else{
    if(v.status==='On trip')fail(409,'Register the vehicle return before recording maintenance');
    if(!text(x.description,2000,true)||!text(x.supplier,200))fail(400,'Enter maintenance description and supplier');
    db.prepare('INSERT INTO fleet_services(id,property_id,vehicle_id,date,odometer,description,supplier,amount,currency,actor,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(x.id,id,v.id,x.date,x.odometer,x.description,x.supplier,x.amount,x.currency,user.email,now);
   }
   if(x.odometer>v.odometer)db.prepare('UPDATE fleet_vehicles SET odometer=?,version=version+1 WHERE id=?').run(x.odometer,v.id);
  }else if(x.action==='voidFuel'||x.action==='voidService'){
   const table=x.action==='voidFuel'?'fleet_fuel':'fleet_services',r=row(table,x.id);if(r.void_reason)fail(409,'Record was already voided');if(!text(x.reason,1000,true))fail(400,'Enter a correction reason');db.prepare('UPDATE '+table+' SET void_reason=? WHERE id=?').run(x.reason,x.id);
  }else if(x.action==='key'){
   if(!text(x.label,100,true)||!['room','vehicle','other'].includes(x.targetType)||!text(x.targetRef,150,true)||typeof x.active!=='boolean')fail(400,'Enter key label and linked room or vehicle');
   if(x.targetType==='vehicle'){if(!user.enabledModules.includes('vehicles'))fail(403,'Vehicle management is disabled');row('fleet_vehicles',x.targetRef);}
   if(x.targetType==='room'&&!JSON.parse(db.prepare('SELECT data FROM property WHERE id=?').get(id).data).rooms.some(r=>r.id===x.targetRef))fail(400,'Room not found');
   const old=db.prepare('SELECT * FROM security_keys WHERE id=?').get(x.id);
   if(old){if(old.property_id!==id)fail(404,'Key not found');version(old);if(db.prepare('SELECT 1 FROM security_key_issues WHERE key_id=? AND returned_at IS NULL').get(x.id))fail(409,'Return this key before editing or disabling it');db.prepare('UPDATE security_keys SET label=?,target_type=?,target_ref=?,active=?,version=version+1 WHERE id=?').run(x.label.trim(),x.targetType,x.targetRef,Number(x.active),x.id);}
   else{if(x.previous!==0)fail(409,'Key changed');db.prepare('INSERT INTO security_keys(id,property_id,label,target_type,target_ref,active) VALUES(?,?,?,?,?,?)').run(x.id,id,x.label.trim(),x.targetType,x.targetRef,Number(x.active));}
  }else if(x.action==='issue'){
   const k=row('security_keys',x.keyId);if(!k.active||db.prepare('SELECT 1 FROM security_key_issues WHERE key_id=? AND returned_at IS NULL').get(k.id))fail(409,'Key is unavailable or already issued');if(!text(x.holder,150,true)||!text(x.note,1000))fail(400,'Enter the key holder and note');db.prepare('INSERT INTO security_key_issues(id,property_id,key_id,holder,label_snapshot,ref_snapshot,note,issued_at,issued_by) VALUES(?,?,?,?,?,?,?,?,?)').run(x.id,id,k.id,x.holder,k.label,k.target_ref,x.note,now,user.email);
  }else if(x.action==='keyReturn'){
   const r=row('security_key_issues',x.id);if(r.returned_at)fail(409,'Key was already returned');if(!text(x.note,1000))fail(400,'Check return note');db.prepare('UPDATE security_key_issues SET returned_at=?,returned_by=?,return_note=? WHERE id=?').run(now,user.email,x.note,x.id);
  }else if(x.action==='entry'){
   if(!['incident','visitor','handover'].includes(x.kind)||!text(x.title,150,true)||!text(x.details,3000,true)||!text(x.person,200,x.kind==='visitor')||!text(x.destination,200,x.kind==='visitor')||!['Low','Medium','High'].includes(x.severity))fail(400,'Enter the log entry details');
   const photos=validateFieldPhotos(x.photos);
   db.prepare('INSERT INTO security_entries(id,property_id,kind,title,details,person,destination,severity,status,created,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(x.id,id,x.kind,x.title,x.details,x.person,x.destination,x.severity,'Open',now,user.email);
   for(const p of photos)db.prepare('INSERT INTO security_photos VALUES(?,?,?,?,?)').run(randomUUID(),id,x.id,p.mime,p.data);
  }else if(x.action==='close'||x.action==='visitorReturn'){
   const r=row('security_entries',x.id);version(r);if(r.status==='Closed')fail(409,'Entry was already closed');
   if(x.action==='visitorReturn'&&r.kind!=='visitor')fail(400,'This is not a visitor entry');
   if(x.action==='close'&&r.kind==='visitor')fail(400,'Use visitor departure to register the departure time');
   if(!text(x.resolution,2000,true)||!['Under review','Closed'].includes(x.status)||(x.action==='visitorReturn'&&x.status!=='Closed'))fail(400,'Enter follow-up details and status');
   db.prepare('UPDATE security_entries SET status=?,resolution=?,closed_at=?,closed_by=?,reviewed_at=?,reviewed_by=?,version=version+1 WHERE id=?').run(x.status,x.resolution,x.status==='Closed'?now:null,x.status==='Closed'?user.email:null,now,user.email,x.id);
  }
  db.prepare('INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES(?,?,?,?,?,?)').run(id,'field.'+x.action,user.email,now,x.id,JSON.stringify({scope,action:x.action,reason:x.reason||null}));
  db.exec('COMMIT');return {saved:true};
 }catch(e){db.exec('ROLLBACK');if(e instanceof FleetError)throw e;if(/UNIQUE constraint/.test(e.message))fail(409,'This record is already registered. Refresh before retrying');throw e;}
}
