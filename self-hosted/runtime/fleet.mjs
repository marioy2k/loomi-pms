import {randomUUID} from 'node:crypto';
export class FleetError extends Error {
 constructor(status,message){super(message);this.status=status;}
}
const fail=(status,message)=>{throw new FleetError(status,message)};
const statuses=['Available','On trip','Maintenance','Out of service'];
const uuid=v=>typeof v==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
const text=(v,max,required=true)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
const km=v=>Number.isSafeInteger(v)&&v>=0&&v<=99999999;
function permission(user,key){return ['owner','superadmin'].includes(user.role)||user.permissions.includes(key);}
function guard(db,propertyId,user,key='vehicleView'){
 if(!user||!Number.isSafeInteger(propertyId)||propertyId<1||
   (user.enabledModules&&!user.enabledModules.includes('vehicles'))||
   (user.role==='employee'&&!user.propertyIds?.includes(propertyId))||!permission(user,key))fail(403,'Vehicle or property access required');
 if(!db.prepare('SELECT id FROM property WHERE id=?').get(propertyId))fail(404,'Property not found');
}
export function loadFleet(db,propertyId,user){
 guard(db,propertyId,user);
 return {
  vehicles:db.prepare('SELECT * FROM fleet_vehicles WHERE property_id=? ORDER BY plate').all(propertyId),
  trips:db.prepare('SELECT * FROM fleet_trips WHERE property_id=? ORDER BY departed_at DESC,id').all(propertyId),
  defects:db.prepare('SELECT * FROM fleet_defects WHERE property_id=? ORDER BY reported_at DESC,id').all(propertyId),
  photos:db.prepare('SELECT id,defect_id FROM fleet_photos WHERE property_id=?').all(propertyId)
 };
}
export function fleetPhoto(db,propertyId,id,user){
 guard(db,propertyId,user);
 const p=db.prepare('SELECT mime,data FROM fleet_photos WHERE id=? AND property_id=?').get(id,propertyId);
 if(!p)fail(404,'Photo not found');
 return p;
}
// Synchronous SQLite transactions keep status, trip, defect, photos and audit atomic.
export function saveFleet(db,propertyId,x,user){
 guard(db,propertyId,user);
 if(!x||!uuid(x.id))fail(400,'Invalid vehicle operation reference');
 const key={vehicle:'vehicleManage',depart:'vehicleDispatch',return:'vehicleDispatch',defect:'vehicleDispatch',review:'vehicleReview'}[x.action];
 if(!key||!permission(user,key))fail(403,'Vehicle action permission required');
 db.exec('BEGIN IMMEDIATE');
 try {
  const now=new Date().toISOString(),actor=user.email,actorName=user.name||actor;
  const audit=(reference,details)=>db.prepare('INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES(?,?,?,?,?,?)').run(propertyId,'vehicle.'+x.action,actor,now,reference,JSON.stringify(details));
  const getVehicle=id=>{const v=db.prepare('SELECT * FROM fleet_vehicles WHERE id=? AND property_id=?').get(id,propertyId);if(!v)fail(404,'Vehicle not found');return v;};
  const version=(row)=>{if(!Number.isSafeInteger(x.previous)||x.previous!==row.version)fail(409,'This record changed. Refresh before saving');};
  const report=(vehicle,tripId,defect)=>{
   if(!defect||!uuid(defect.id)||!text(defect.description,2000)||!['Minor','Critical'].includes(defect.severity)||!Array.isArray(defect.photos)||defect.photos.length>4)fail(400,'Enter a defect description, severity and up to four photos');
   const photos=defect.photos.map(p=>{
    if(!p||!['image/jpeg','image/png','image/webp'].includes(p.mime)||typeof p.data!=='string'||p.data.length>1398104||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.data))fail(400,'Photos must be JPEG, PNG or WebP, at most 1 MB each');
    const b=Buffer.from(p.data,'base64');
    const valid=p.mime==='image/jpeg'?b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255:p.mime==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
    if(!valid||!b.length||b.length>1048576)fail(400,'Invalid photo file');
    return p;
   });
   db.prepare("INSERT INTO fleet_defects(id,property_id,vehicle_id,trip_id,description,severity,status,reported_at,reported_by,reported_by_name) VALUES(?,?,?,?,?,?,'Reported',?,?,?)").run(defect.id,propertyId,vehicle.id,tripId,defect.description.trim(),defect.severity,now,actor,actorName);
   for(const p of photos)db.prepare('INSERT INTO fleet_photos VALUES(?,?,?,?,?)').run(randomUUID(),propertyId,defect.id,p.mime,p.data);
   // Every newly reported defect needs a supervisor's release before the next trip.
   if(vehicle.status!=='On trip')db.prepare("UPDATE fleet_vehicles SET status='Out of service',version=version+1 WHERE id=?").run(vehicle.id);
   return defect.id;
  };
  if(x.action==='vehicle'){
   if(!text(x.name,120)||!text(x.plate,30)||!statuses.includes(x.status)||x.status==='On trip'||!km(x.odometer)||!text(x.note,1000))fail(400,'Enter vehicle name, plate, status, odometer and change reason');
   const old=db.prepare('SELECT * FROM fleet_vehicles WHERE id=?').get(x.id);
   if(old){if(old.property_id!==propertyId)fail(404,'Vehicle not found');version(old);if(old.status==='On trip')fail(409,'Register the return before changing this vehicle');if(x.odometer<old.odometer)fail(400,'Odometer cannot decrease');
    if(x.status==='Available'&&db.prepare("SELECT 1 FROM fleet_defects WHERE vehicle_id=? AND status<>'Resolved'").get(x.id))fail(409,'Resolve all defects before releasing this vehicle');
    db.prepare('UPDATE fleet_vehicles SET name=?,plate=?,status=?,odometer=?,version=version+1 WHERE id=?').run(x.name.trim(),x.plate.trim().toUpperCase(),x.status,x.odometer,x.id);
   }else{if(x.previous!==0)fail(409,'Vehicle no longer exists');db.prepare('INSERT INTO fleet_vehicles(id,property_id,name,plate,status,odometer) VALUES(?,?,?,?,?,?)').run(x.id,propertyId,x.name.trim(),x.plate.trim().toUpperCase(),x.status,x.odometer);}
   audit(x.id,{before:old||null,name:x.name,plate:x.plate,status:x.status,odometer:x.odometer,note:x.note});
  }else if(x.action==='depart'){
   const v=getVehicle(x.vehicleId);
   if(!text(x.driver,150)||!text(x.destination,250)||!text(x.purpose,500)||!text(x.note,1000,false)||!km(x.odometer))fail(400,'Enter driver, destination, trip purpose and odometer');
   if(v.status!=='Available'||db.prepare("SELECT 1 FROM fleet_defects WHERE vehicle_id=? AND status<>'Resolved'").get(v.id))fail(409,'Vehicle is unavailable or has an unresolved defect');
   version(v);if(x.odometer<v.odometer)fail(400,'Odometer cannot decrease');
   db.prepare('INSERT INTO fleet_trips(id,property_id,vehicle_id,plate,vehicle_name,driver,destination,purpose,departed_at,departed_by,departed_by_name,start_km,departure_note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(x.id,propertyId,v.id,v.plate,v.name,x.driver.trim(),x.destination.trim(),x.purpose.trim(),now,actor,actorName,x.odometer,x.note.trim());
   db.prepare("UPDATE fleet_vehicles SET status='On trip',odometer=?,version=version+1 WHERE id=?").run(x.odometer,v.id);
   audit(x.id,{vehicleId:v.id,plate:v.plate,driver:x.driver});
  }else if(x.action==='return'){
   const trip=db.prepare('SELECT * FROM fleet_trips WHERE id=? AND property_id=?').get(x.id,propertyId);
   if(!trip)fail(404,'Trip not found');if(trip.returned_at)fail(409,'This trip was already returned');
   const v=getVehicle(trip.vehicle_id);version(v);
   if(!km(x.odometer)||x.odometer<Math.max(trip.start_km,v.odometer)||!text(x.note,1000,false))fail(400,'Return odometer must be at least the departure reading');
   if(typeof x.hasDefect!=='boolean'||(x.hasDefect&&!x.defect))fail(400,'Confirm the vehicle condition');
   db.prepare('UPDATE fleet_trips SET returned_at=?,returned_by=?,returned_by_name=?,end_km=?,return_note=? WHERE id=?').run(now,actor,actorName,x.odometer,x.note.trim(),x.id);
   db.prepare("UPDATE fleet_vehicles SET status='Available',odometer=?,version=version+1 WHERE id=?").run(x.odometer,v.id);
   if(x.hasDefect)report({...v,status:'Available'},trip.id,x.defect);
   if(db.prepare("SELECT 1 FROM fleet_defects WHERE vehicle_id=? AND status<>'Resolved'").get(v.id))db.prepare("UPDATE fleet_vehicles SET status='Out of service' WHERE id=?").run(v.id);
   audit(x.id,{vehicleId:v.id,odometer:x.odometer,hasDefect:x.hasDefect});
  }else if(x.action==='defect'){
   const v=getVehicle(x.vehicleId);
   const trip=db.prepare('SELECT id FROM fleet_trips WHERE vehicle_id=? AND returned_at IS NULL').get(v.id);
   report(v,trip?.id||null,{...x,id:x.id});audit(x.id,{vehicleId:v.id,severity:x.severity});
  }else if(x.action==='review'){
   const d=db.prepare('SELECT * FROM fleet_defects WHERE id=? AND property_id=?').get(x.id,propertyId);
   if(!d)fail(404,'Defect not found');version(d);
   if(d.status==='Resolved')fail(409,'This defect was already resolved');
   if(!['Under review','Resolved'].includes(x.status)||!text(x.resolution,2000))fail(400,'Enter the assessment or repair details');
   db.prepare('UPDATE fleet_defects SET status=?,resolution=?,reviewed_at=?,reviewed_by=?,reviewed_by_name=?,version=version+1 WHERE id=?').run(x.status,x.resolution.trim(),now,actor,actorName,x.id);
   audit(x.id,{vehicleId:d.vehicle_id,status:x.status,resolution:x.resolution});
  }
  db.exec('COMMIT');return {saved:true};
 }catch(e){db.exec('ROLLBACK');if(e instanceof FleetError)throw e;if(String(e.code).startsWith('ERR_SQLITE')&&/UNIQUE constraint/.test(e.message))fail(409,'This plate or operation is already registered. Refresh before retrying');throw e;}
}
