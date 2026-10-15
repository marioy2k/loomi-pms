import {database} from '@/db/raw';
import {Access,can,canAccessProperty} from '@/lib/permissions';
type DB=ReturnType<typeof database>;
export const createDeletionTable="CREATE TABLE IF NOT EXISTS deleted_properties (id INTEGER PRIMARY KEY, name TEXT NOT NULL, actor TEXT NOT NULL, deleted_at TEXT NOT NULL, token TEXT NOT NULL)";
export const insertPropertySQL='INSERT INTO property (id,data) SELECT COALESCE(MAX(id),0)+1,? FROM (SELECT id FROM property UNION ALL SELECT id FROM deleted_properties) RETURNING id';
export const initializePropertySQL='INSERT INTO property (id,data) SELECT 1,? WHERE NOT EXISTS (SELECT 1 FROM property)';
export class PropertyDeletionError extends Error {constructor(message:string,public status:number){super(message)}}
export async function deleteProperty(db:DB,user:Access|null,input:{propertyId?:unknown;name?:unknown}){
 if(!user||user.role==='employee'||!can(user,'property'))throw new PropertyDeletionError('Administrator access required',403);
 const id=input.propertyId;
 if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1)throw new PropertyDeletionError('Invalid property',400);
 if(!canAccessProperty(user,id))throw new PropertyDeletionError('Access denied',403);
 await db.prepare(createDeletionTable).run();
 const row=await db.prepare('SELECT data FROM property WHERE id=?').bind(id).first<{data:string}>();
 if(!row)throw new PropertyDeletionError('Property not found',404);
 const state=JSON.parse(row.data);
 if(input.name!==state.hotel)throw new PropertyDeletionError('Enter the exact property name to confirm deletion.',400);
 if(!Array.isArray(state.bookings)||state.bookings.length)throw new PropertyDeletionError('This property has reservations and cannot be deleted.',409);
 const count=await db.prepare('SELECT COUNT(*) AS total FROM property').first<{total:number}>();
 if(!count||count.total<2)throw new PropertyDeletionError('Keep at least one property.',409);
 // Discover all installed modules, so future property-linked records are protected too.
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>();
 const linked:string[]=[];
 for(const {name} of tables.results){
  if(name==='activity_log'||!/^\w+$/.test(name))continue;
  const columns=await db.prepare(`PRAGMA table_info("${name}")`).all<{name:string}>();
  if(columns.results.some(c=>c.name==='property_id'))linked.push(name);
 }
 for(const name of linked){if(await db.prepare(`SELECT 1 FROM "${name}" WHERE property_id=? LIMIT 1`).bind(id).first())throw new PropertyDeletionError('This property has linked records. It cannot be deleted.',409);}
 const token=crypto.randomUUID();
 const guards=linked.map(name=>`AND NOT EXISTS (SELECT 1 FROM "${name}" WHERE property_id=property.id)`).join(' ');
 const results=await db.batch([
  db.prepare(`INSERT INTO deleted_properties (id,name,actor,deleted_at,token) SELECT id,?, ?, ?, ? FROM property WHERE id=? AND data=? AND json_array_length(data,'$.bookings')=0 AND (SELECT COUNT(*) FROM property)>1 ${guards}`).bind(state.hotel,user.email,new Date().toISOString(),token,id,row.data),
  db.prepare('DELETE FROM property WHERE id=? AND data=? AND EXISTS (SELECT 1 FROM deleted_properties WHERE id=? AND token=?)').bind(id,row.data,id,token),
  db.prepare("UPDATE staff SET property_ids=(SELECT COALESCE(json_group_array(value),'[]') FROM json_each(staff.property_ids) WHERE value<>?) WHERE EXISTS (SELECT 1 FROM deleted_properties WHERE id=? AND token=?)").bind(id,id,token)
 ]);
 if(!results[1].meta.changes)throw new PropertyDeletionError('Records changed in another session. Reload and try again.',409);
 return {deleted:true};
}
