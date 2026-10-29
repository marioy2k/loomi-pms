import {access} from '@/lib/access';
import {requestedProperty} from '@/lib/properties';
import {store} from '@/runtime/core.mjs';
import {can,canAccessProperty,canViewAccounting} from '@/lib/permissions';
import {canViewInventory} from '@/lib/inventory';
import {canViewPasses} from '@/lib/swimming';
import {operationKinds,canOperate} from '@/lib/operations';
import {loadFacilities} from '@/runtime/facilities.mjs';
import {fieldDay} from '@/runtime/field-operations.mjs';
export async function GET(req:Request){try{const u=await access(),id=requestedProperty(req);if(!u||!canAccessProperty(u,id))return Response.json({error:'Access denied'},{status:403});const db=store().db,row=db.prepare('SELECT data FROM property WHERE id=?').get(id);if(!row)return Response.json({error:'Property not found'},{status:404});const s=JSON.parse(row.data as string),today=fieldDay(),result:Record<string,any>={};const put=(name:string,en:string,nl:string,alert=false)=>result[name]={en,nl,alert};const count=(sql:string,...args:any[])=>Number(db.prepare(sql).get(...args)?.n||0);const active=s.bookings.filter((b:any)=>!['Cancelled','Checked out'].includes(b.status)&&b.arrival<=today&&b.departure>today);const arrivals=s.bookings.filter((b:any)=>b.arrival===today&&b.status==='Confirmed').length;
 if(can(u,'overview'))put('Overview',`${arrivals} arrivals today · ${active.length} occupied`,`${arrivals} aankomsten vandaag · ${active.length} bezet`);
 if(can(u,'reservations')||can(u,'bookingPayments')||can(u,'bookingRefunds')||can(u,'bookingRates'))put('Reservations',`${arrivals} expected arrivals today`,`${arrivals} verwachte aankomsten vandaag`);
 if(can(u,'calendar'))put('Room calendar',`${s.rooms.length-active.length} available today`,`${s.rooms.length-active.length} beschikbaar vandaag`);
 if(can(u,'guests')){const n=new Set(s.bookings.map((b:any)=>b.guestId||b.email||b.guest)).size;put('Guests',`${n} guest profiles`,`${n} gastprofielen`)}
 if(can(u,'housekeeping')){const n=s.rooms.filter((r:any)=>!['Clean','Out of service'].includes(r.housekeeping)).length;for(const name of ['Rooms','Housekeeping'])put(name,`${n} rooms need cleaning`,`${n} kamers moeten schoon`,n>0)}
 for(const [kind,name] of [['water','Water tanks'],['technical','Technical department']] as const){if(kind==='water'?(can(u,'waterChecks')||can(u,'maintenance')):can(u,'maintenance')){const {tasks}=loadFacilities(db,u,id,kind),legacy=kind==='technical'?count("SELECT count(*) n FROM operations WHERE property_id=? AND kind='maintenance' AND json_extract(data,'$.status')<>'Resolved'",id):0,due=tasks.filter((r:any)=>r.needsCheck).length+legacy,alerts=tasks.filter((r:any)=>['Low','Empty','Problem','Needs attention'].includes(r.status)).length;put(name,`${due} due · ${alerts} need attention`,`${due} te doen · ${alerts} aandacht nodig`,due+alerts>0)}}
 if(canViewInventory(u)){const n=count('SELECT count(*) n FROM inventory_items WHERE property_id=? AND active=1 AND stock<=minimum',id);put('Inventory',`${n} items at low stock`,`${n} artikelen met lage voorraad`,n>0)}
 if(can(u,'vehicleView')){const n=count("SELECT count(*) n FROM fleet_defects WHERE property_id=? AND status<>'Resolved'",id);put('Vehicles',`${n} unresolved defects`,`${n} openstaande defecten`,n>0)}
 if(can(u,'securityView')){const n=count("SELECT count(*) n FROM security_entries WHERE property_id=? AND status<>'Closed'",id);put('Security & keys',`${n} open security entries`,`${n} open beveiligingsmeldingen`,n>0)}
 if(canViewPasses(u)){const n=count("SELECT count(*) n FROM swimming_vouchers WHERE property_id=? AND valid_date=? AND status<>'Refunded'",id,today);put('Swimming day passes',`${n} passes today`,`${n} dagpassen vandaag`)}
 if(can(u,'pos')||can(u,'posManage')){const n=count("SELECT count(*) n FROM pos_orders WHERE property_id=? AND status='Open'",id);put('Point of sale',`${n} open orders`,`${n} open bestellingen`,n>0)}
 if(canViewAccounting(u))put('Accounting','Accounts and reports available','Boekhouding en rapporten beschikbaar');
 const kinds=operationKinds.filter(k=>canOperate(u,k));if(kinds.length){const rows=db.prepare('SELECT kind,data FROM operations WHERE property_id=?').all(id);const n=rows.filter((r:any)=>kinds.includes(r.kind)&&!['Resolved','Received','Closed','Sent','Dismissed','Cancelled'].includes(JSON.parse(r.data).status)&&JSON.parse(r.data).status).length;put('Operations',`${n} open work items`,`${n} open werkzaamheden`,n>0)}
 if(can(u,'dashboard')){const n=count('SELECT count(*) n FROM property');put('All properties',`${n} properties`,`${n} accommodaties`)}
 if(can(u,'audit')){const n=count('SELECT count(*) n FROM activity_log WHERE property_id=? AND date(created,'-3 hours')=?',id,today);put('Activity history',`${n} updates today`,`${n} wijzigingen vandaag`)}
 put('Settings','Property and account preferences','Accommodatie- en accountinstellingen');return Response.json({statuses:result,updated:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Status previews are unavailable'},{status:503})}}
