import {randomUUID} from 'node:crypto';
import {fieldDay,fieldDate} from './field-operations.mjs';
export const failure=(status,message)=>{throw Object.assign(Error(message),{status})};
const validText=(x,max,required=false)=>typeof x==='string'&&x.length<=max&&(!required||!!x.trim());
export function facilityGuard(db,user,id,kind){
 if(!user||!Number.isSafeInteger(id)||id<1||(user.role==='employee'&&!user.propertyIds?.includes(id))||!user.enabledModules?.includes('maintenance')||!['owner','superadmin'].includes(user.role)&&!user.permissions?.includes('maintenance')&&!(kind==='water'&&user.permissions?.includes('waterChecks')))failure(403,'Facility task access is required for this property');
 if(!db.prepare('SELECT id FROM property WHERE id=?').get(id))failure(404,'Property not found');
}
export function taskStatus(task,checks,today=fieldDay()){
 const latest=checks.filter(c=>c.task_id===task.id).sort((a,b)=>b.created.localeCompare(a.created)||b.rowid-a.rowid)[0];
 const done=latest&&(task.recurrence==='once'||latest.day===today);
 return {latest:latest||null,status:done?(task.kind==='water'?latest.result:latest.result==='Done'?'Done':'Needs attention'):task.due>today?'Upcoming':task.recurrence==='daily'?'Due today':task.due<today?'Overdue':'Due today',needsCheck:task.due<=today&&(!done||task.kind==='technical'&&latest.result!=='Done')};
}
export function loadFacilities(db,user,id,kind){facilityGuard(db,user,id,kind);if(!['water','technical'].includes(kind))failure(400,'Choose water or technical tasks');const tasks=db.prepare('SELECT * FROM facility_tasks WHERE property_id=? AND kind=? AND active=1 ORDER BY due,title').all(id,kind);const checks=db.prepare('SELECT rowid,* FROM facility_checks WHERE property_id=? ORDER BY created DESC,rowid DESC').all(id);return {today:fieldDay(),tasks:tasks.map(t=>({...t,...taskStatus(t,checks)})),history:checks.filter(c=>tasks.some(t=>t.id===c.task_id)).slice(0,100)};}
export function queueNotice(db,id,event,message,key=randomUUID()){
 db.prepare('INSERT OR IGNORE INTO notification_outbox VALUES(?,?,?,?,?)').run(key,id,event,message,new Date().toISOString());
 const config=JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('notifications:'+id)?.value||'{}');
 for(const channel of ['discord','slack','teams','webhook','smtp'])if(config[channel]?.enabled)db.prepare('INSERT OR IGNORE INTO notification_deliveries(event_id,channel) VALUES(?,?)').run(key,channel);
 return key;
}
export function saveFacility(db,user,id,x){
 facilityGuard(db,user,id,x?.kind);if(!x||!['water','technical'].includes(x.kind))failure(400,'Choose a task type');
 db.exec('BEGIN IMMEDIATE');try{
 const now=new Date().toISOString(),today=fieldDay();
 if(x.action==='save'){
  if(!validText(x.title,150,true)||!validText(x.location,150)||!validText(x.assigned,200)||!validText(x.notes,2000)||!['Low','Normal','High','Urgent'].includes(x.priority)||!['once','daily'].includes(x.recurrence)||x.kind==='water'&&x.recurrence!=='daily'||!fieldDate(x.due))failure(400,'Check task title, date and details');
  if(x.assigned&&x.assigned!==db.prepare("SELECT value FROM settings WHERE key='ownerEmail'").get()?.value){const person=db.prepare('SELECT * FROM staff WHERE email=? AND active=1').get(x.assigned);if(!person||person.role==='employee'&&!JSON.parse(person.property_ids).includes(id)||!['owner','superadmin'].includes(person.role)&&!JSON.parse(person.permissions).includes('maintenance')&&!(x.kind==='water'&&JSON.parse(person.permissions).includes('waterChecks')))failure(400,'Assign a staff member with access to this task and property');}
  const old=x.id?db.prepare('SELECT * FROM facility_tasks WHERE id=? AND property_id=? AND kind=?').get(x.id,id,x.kind):null;
  if(x.id&&!old)failure(404,'Task not found');if(old&&x.version!==old.version)failure(409,'Task changed. Refresh before saving');
  const taskId=old?.id||randomUUID();if(old)db.prepare('UPDATE facility_tasks SET title=?,location=?,assigned=?,priority=?,recurrence=?,due=?,notes=?,version=version+1 WHERE id=?').run(x.title.trim(),x.location.trim(),x.assigned,x.priority,x.recurrence,x.due,x.notes,taskId);else db.prepare('INSERT INTO facility_tasks(id,property_id,kind,title,location,assigned,priority,recurrence,due,notes,created,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(taskId,id,x.kind,x.title.trim(),x.location.trim(),x.assigned,x.priority,x.recurrence,x.due,x.notes,now,user.email);
  queueNotice(db,id,'task.assigned',`${x.kind==='water'?'Water tank':'Technical task'}: ${x.title}. Due ${x.due}. Assigned: ${x.assigned||'unassigned'}.`);
 }else{
  const t=db.prepare('SELECT * FROM facility_tasks WHERE id=? AND property_id=? AND kind=? AND active=1').get(x.id,id,x.kind);if(!t)failure(404,'Task not found');if(t.version!==x.version)failure(409,'Task changed. Refresh before saving');
  if(x.action==='archive')db.prepare('UPDATE facility_tasks SET active=0,version=version+1 WHERE id=?').run(t.id);
  else if(x.action==='check'){
   const results=t.kind==='water'?['Full','Normal','Low','Empty','Problem']:['Done','In progress','Blocked'];
   if(!results.includes(x.result)||!validText(x.notes,2000)||x.level!==null&&(!Number.isInteger(x.level)||x.level<0||x.level>100))failure(400,'Choose a valid result and optional level from 0 to 100');
   if(t.due>today)failure(400,'This task is not due yet');
   db.prepare('INSERT INTO facility_checks VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),t.id,id,today,x.result,x.level,x.notes,now,user.email);
   db.prepare('UPDATE facility_tasks SET version=version+1 WHERE id=?').run(t.id);
   queueNotice(db,id,t.kind==='water'&&['Low','Empty','Problem'].includes(x.result)?'water.alert':'task.checked',`${t.title}: ${x.result}${x.level!==null?' ('+x.level+'%)':''}. Checked by ${user.name}. ${x.notes}`);
  }else failure(400,'Unknown task action');
 }
 db.prepare('INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES(?,?,?,?,?,?)').run(id,'facility.'+x.action,user.email,now,x.id||'',x.kind+' task');
 db.exec('COMMIT');return {saved:true};
 }catch(e){db.exec('ROLLBACK');throw e}
}
export function scheduleFacilityNotices(db,today=fieldDay()){
 for(const t of db.prepare('SELECT * FROM facility_tasks WHERE active=1 AND due<=?').all(today)){
  const checks=db.prepare('SELECT rowid,* FROM facility_checks WHERE task_id=?').all(t.id),s=taskStatus(t,checks,today);
  if(s.needsCheck||['Low','Empty','Problem','Needs attention'].includes(s.status))queueNotice(db,t.property_id,'task.daily',`${t.title}: ${s.status}. ${t.location}. Assigned: ${t.assigned||'unassigned'}.`,'daily:'+today+':'+t.id);
 }
}
