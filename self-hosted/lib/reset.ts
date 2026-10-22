import {isSuperAdmin,type Access} from '@/lib/permissions';
// D1 batches are atomic. Preserve staff, licence, company switches, policies and audit.
export async function resetHotelData(db:any,user:Access|null,confirmation:unknown){
 if(!isSuperAdmin(user))return Response.json({error:'Super admin access required'},{status:403});
 if(confirmation!=='RESET ALL HOTEL DATA')return Response.json({error:'Type RESET ALL HOTEL DATA to confirm'},{status:400});
 const tables=['wifi_vouchers','housekeeping_assignments','housekeeping_issues','transactions','accounting_records','pos_orders','pos_closings','swimming_vouchers','inventory_requests','inventory_movements','inventory_items'];
 const statements=tables.map(table=>db.prepare('DELETE FROM '+table));
 statements.push(db.prepare("DELETE FROM operations WHERE kind NOT IN ('policy','supplier')"));
 statements.push(db.prepare('INSERT OR IGNORE INTO ledger_meta(id) SELECT id FROM property'));
 statements.push(db.prepare("UPDATE property SET data=json_set(data,'$.rooms',CASE WHEN json_extract(data,'$.propertyType')='house' THEN json('[{\"id\":\"HOUSE\",\"type\":\"Whole house\",\"rate\":0,\"housekeeping\":\"Clean\"}]') ELSE json('[]') END,'$.bookings',json('[]'))"));
 statements.push(db.prepare("INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES(0,'hotel.data-reset',?,?,'all-properties','Operational data cleared; staff, licence, property settings and audit retained')").bind(user!.email,new Date().toISOString()));
 await db.batch(statements);return Response.json({ok:true});
}
