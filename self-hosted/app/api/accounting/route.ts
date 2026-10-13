import {moduleEnabled} from '@/lib/modules';
import {requestedProperty} from '@/lib/properties';
import {database} from '@/db/raw';
import {access} from '@/lib/access';
import {hasPermission,canAccessProperty} from '@/lib/permissions';
import {initializeLedger} from '@/lib/ledger';
import {saveAccounting,accountingError} from '@/lib/accounting-service';
export async function GET(req:Request){try{
 const user=await access();if(!moduleEnabled(user,'accounting'))return Response.json({error:'This company feature is disabled or not included in the licence'},{status:403});if(!hasPermission(user,'payments'))return Response.json({error:'Accounting permission required'},{status:403});
 const db=database();const all=new URL(req.url).searchParams.get('scope')==='all',id=requestedProperty(req);
 if(!all&&!canAccessProperty(user,id))return Response.json({error:'Property access denied'},{status:403});
 const list=await db.prepare('SELECT id,data FROM property ORDER BY id').all<{id:number;data:string}>();const allowed=list.results.filter(p=>canAccessProperty(user,p.id)&&(all||p.id===id));
 if(!allowed.length)return Response.json({error:'No accessible property found'},{status:404});
 for(const p of allowed)await initializeLedger(db,JSON.parse(p.data),p.id);
 const placeholders=allowed.map(()=>'?').join(','),ids=allowed.map(p=>p.id);
 const result=await db.batch([db.prepare(`SELECT id,data FROM property WHERE id IN (${placeholders}) ORDER BY id`).bind(...ids),db.prepare(`SELECT * FROM transactions WHERE property_id IN (${placeholders}) ORDER BY date DESC,created DESC,id DESC`).bind(...ids),db.prepare(`SELECT * FROM accounting_records WHERE property_id IN (${placeholders}) ORDER BY date DESC,created DESC`).bind(...ids)]);
 const properties=result[0].results.map((p:any)=>{const state=JSON.parse(p.data);return {id:p.id,state:{...state,bookings:state.bookings.map(({identification,notes,...b}:any)=>({...b,notes:''}))}}});
 return Response.json({transactions:result[1].results,records:result[2].results,properties});
 }catch(e){console.error(e);return Response.json({error:'Unable to load accounting records. Please retry.'},{status:503});}}
export async function POST(req:Request){try{
 const user=await access();if(!moduleEnabled(user,'accounting'))return Response.json({error:'This company feature is disabled or not included in the licence'},{status:403});if(!user||!hasPermission(user,'payments'))return Response.json({error:'Accounting permission required'},{status:403});
 if(req.headers.get('origin')&&new URL(process.env.APP_URL!).origin!==req.headers.get('origin'))return Response.json({error:'Invalid request origin'},{status:403});
 const propertyId=requestedProperty(req);if(!canAccessProperty(user,propertyId))return Response.json({error:'Property access denied'},{status:403});
 return Response.json(await saveAccounting(database(),propertyId,await req.json(),user.email));
 }catch(e){console.error(e);return accountingError(e);}}
