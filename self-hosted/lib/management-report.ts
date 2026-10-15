import {can,canAccessProperty,type Access} from '@/lib/permissions';
import {buildReports,validDate} from '@/lib/accounting-reports';
import {fleetAlerts} from '@/runtime/field-operations.mjs';
export async function managementReport(db:any,user:Access,from:string,to:string){
 if(!can(user,'dashboard'))throw Object.assign(Error('Dashboard permission required'),{status:403});
 if(!validDate(from)||!validDate(to)||from>to)throw Object.assign(Error('Choose a valid date range'),{status:400});
 const properties=(await db.prepare('SELECT id,data FROM property ORDER BY id').all()).results.filter((p:any)=>canAccessProperty(user,p.id));
 const out=[];
 for(const p of properties){
  const state=JSON.parse(p.data),records=(await db.prepare('SELECT * FROM accounting_records WHERE property_id=?').bind(p.id).all()).results,cash=(await db.prepare('SELECT * FROM transactions WHERE property_id=?').bind(p.id).all()).results;
  const finances=Object.fromEntries(['USD','SRD','EUR'].map(c=>{const r=buildReports([{id:p.id,state}],records,cash,c,from,to,to);return [c,{income:r.totalIncome,expenses:r.totalExpenses,profit:r.profit,outstanding:r.guestOutstanding,received:r.inflows,paid:r.outflows}]}));
  const active=state.bookings.filter((b:any)=>b.status!=='Cancelled'&&b.arrival<=to&&b.departure>to),occupied=new Set(active.map((b:any)=>b.room)).size;
  let vehicleCosts=null,vehicleAlerts=null,security=null;
  if(can(user,'vehicleView')){
   const vehicles=(await db.prepare('SELECT * FROM fleet_vehicles WHERE property_id=?').bind(p.id).all()).results,plans=(await db.prepare('SELECT * FROM fleet_plans WHERE property_id=?').bind(p.id).all()).results;
   // Operational costs are displayed separately and never added to ledger expenses.
   const costs=(await db.prepare("SELECT currency,amount,'fuel' kind FROM fleet_fuel WHERE property_id=? AND date>=? AND date<=? AND void_reason='' UNION ALL SELECT currency,amount,'service' kind FROM fleet_services WHERE property_id=? AND date>=? AND date<=? AND void_reason=''").bind(p.id,from,to,p.id,from,to).all()).results;
   vehicleCosts=Object.fromEntries(['USD','SRD','EUR'].map(c=>[c,{fuel:costs.filter((r:any)=>r.currency===c&&r.kind==='fuel').reduce((n:number,r:any)=>n+r.amount,0),service:costs.filter((r:any)=>r.currency===c&&r.kind==='service').reduce((n:number,r:any)=>n+r.amount,0)}]));vehicleAlerts=fleetAlerts(vehicles,plans,to);
  }
  if(can(user,'securityView'))security={keysOut:(await db.prepare('SELECT count(*) n FROM security_key_issues WHERE property_id=? AND returned_at IS NULL').bind(p.id).first()).n,visitorsInside:(await db.prepare("SELECT count(*) n FROM security_entries WHERE property_id=? AND kind='visitor' AND status<>'Closed'").bind(p.id).first()).n,openIncidents:(await db.prepare("SELECT count(*) n FROM security_entries WHERE property_id=? AND kind='incident' AND status<>'Closed'").bind(p.id).first()).n};
  out.push({id:p.id,name:state.hotel,rooms:state.rooms.length,occupied,occupancy:state.rooms.length?Math.round(100*occupied/state.rooms.length):0,arrivals:state.bookings.filter((b:any)=>b.arrival===to&&b.status!=='Cancelled').length,departures:state.bookings.filter((b:any)=>b.departure===to&&b.status!=='Cancelled').length,finances,vehicleCosts,vehicleAlerts,security});
 }
 return {from,to,properties:out};
}
