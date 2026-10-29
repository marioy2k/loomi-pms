import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {moduleEnabled} from '@/lib/modules';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {access} from '@/lib/access';
import {type Access,allPermissions,isSuperAdmin} from '@/lib/permissions';
import {database} from '@/db/raw';
import {moduleAccess} from '@/lib/module-access';
import {saveOperation} from '@/lib/operations-service';
import {deliverReminder} from '@/lib/email-dispatch';
import {emailConfigured} from '@/lib/email';
import {localDay} from '@/lib/operations';
// This unattended writer relies on the owner-private Sites dispatch boundary.
// Dispatch consumes its service bearer token before forwarding the request.
export async function POST(req:Request){try{const visitor=await getChatGPTUser();if(!visitor||!isSuperAdmin(await access()))return Response.json({error:'Super Admin access required'},{status:403});if(visitor&&!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});const db=database(),actor:Access={email:'System',name:'Scheduled reminders',role:'owner',permissions:allPermissions,propertyIds:null,...await moduleAccess()};if(!moduleEnabled(actor,'reminders'))return Response.json({prepared:0,sent:0,skipped:'Guest reminders disabled, or licence inactive',errors:[]});const properties=(await db.prepare('SELECT id,data FROM property ORDER BY id').all()).results;let prepared=0,sent=0;const errors:string[]=[];for(const p of properties){const state=JSON.parse(p.data as string);const result=await saveOperation(db,actor,p.id as number,{action:'generate-reminders',id:crypto.randomUUID(),version:0});prepared+=result?.generated||0;const policy=await db.prepare("SELECT data FROM operations WHERE property_id=? AND kind='policy'").bind(p.id).first<{data:string}>();if(!emailConfigured(p.id as number)||!policy||!JSON.parse(policy.data).autoEmail)continue;const drafts=(await db.prepare("SELECT * FROM operations WHERE property_id=? AND kind='reminder' AND json_extract(data,'$.status') IN ('Draft','Sending') AND json_extract(data,'$.date')=? LIMIT 25").bind(p.id,localDay()).all()).results;for(const r of drafts){const data=JSON.parse(r.data as string),b=state.bookings.find((b:any)=>b.id===data.bookingId);if(!b||b.email!==data.email||['Cancelled','Checked out'].includes(b.status))continue;try{await deliverReminder(db,p.id as number,r.id as string,'System');sent++}catch{errors.push('Email provider rejected a reminder for property '+p.id);break;}}}return Response.json({prepared,sent,emailConfigured:emailConfigured(),errors});}catch(e){return Response.json({error:e instanceof Error?e.message:'Reminder run failed'},{status:500});}}
