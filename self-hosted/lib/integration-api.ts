import {moduleAllowed} from '@/runtime/module-policy.mjs';
import {randomUUID} from 'node:crypto';
import {store, licenceStatus} from '@/runtime/core.mjs';
import {ApiError, authenticate, permit, hash, transaction, queueChanges} from '@/runtime/integrations.mjs';
import {Booking, State, isHouse, propertyType, validateState, nights} from '@/lib/pms';
import {guestKey} from '@/lib/guests';

type Token = {id:string; scopes:string[]; propertyIds:number[]; approval_required:number};
type Operation = {kind:string; propertyId:number; target?:string; body:Record<string,unknown>};
const active = (b:Booking) => !['Cancelled','Checked out'].includes(b.status);
function error(status:number,message:string):never { throw new ApiError(status,message); }
function date(value:unknown):string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) error(400,'Use a valid YYYY-MM-DD date');
  return value as string;
}
function text(value:unknown, max:number, required=false):string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) error(400,'Invalid text field');
  return (value as string).trim();
}
function fields(body:Record<string,unknown>, allowed:string[]) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k=>!allowed.includes(k))) error(400,'Unsupported request fields');
}
function json(data:unknown,status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store'}}); }
export function apiFailure(e:unknown) {
  if (e instanceof ApiError) return json({error:e.message},e.status);
  console.error('Integration request failed', e);
  return json({error:'Unable to process integration request'},500);
}
export async function readBody(req:Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) error(415,'JSON request required');
  const reader=req.body?.getReader(); let bytes=0; const chunks:Uint8Array[]=[];
  if (!reader) error(400,'JSON body required');
  while (true) { const result=await reader!.read(); if(result.done) break; bytes+=result.value.byteLength; if(bytes>16384){await reader!.cancel();error(413,'Request body exceeds 16 KB');} chunks.push(result.value); }
  try { const x=JSON.parse(Buffer.concat(chunks).toString()); if(!x || typeof x!=='object' || Array.isArray(x)) error(400,'JSON object required'); return x as Record<string,unknown>; }
  catch { return error(400,'Invalid JSON object'); }
}
function snapshot(s:any,id:number) {
  const row=s.db.prepare('SELECT data FROM property WHERE id=?').get(id);
  if(!row) error(404,'Property not found');
  return {raw:row.data as string,state:JSON.parse(row.data) as State};
}
function safeBooking(b:Booking,token:Token) {
  const result:Record<string,unknown>={id:b.id,room:b.room,arrival:b.arrival,departure:b.departure,status:b.status,rate:b.rate,paid:b.paid};
  if(token.scopes.includes('guests:read')) Object.assign(result,{guestId:guestKey(b),guest:b.guest,email:b.email,phone:b.phone});
  // Notes and identification are deliberately excluded: both can hold sensitive data.
  return result;
}
function scopeFor(kind:string) { return kind==='housekeeping'?'housekeeping:write':'reservations:write'; }
export function buildChange(state:State,op:Operation,housekeepingEnabled=true):{next:State;result:Record<string,unknown>} {
  const next=structuredClone(state), x=op.body;
  let result:Record<string,unknown>={};
  if(op.kind==='housekeeping') {
    fields(x,['status']);
    if(!['Clean','Dirty','In progress','Out of service'].includes(String(x.status))) error(400,'Invalid housekeeping status');
    const room=next.rooms.find(r=>r.id===op.target); if(!room) error(404,'Room not found');
    room!.housekeeping=String(x.status); result={roomId:room!.id,housekeepingStatus:room!.housekeeping};
  } else if(op.kind==='create') {
    fields(x,['guest','email','phone','room','arrival','departure','notes']);
    const room=next.rooms.find(r=>r.id===(isHouse(next)&&x.room===undefined?'HOUSE':x.room)); if(!room || room.housekeeping==='Out of service') error(409,'Room unavailable');
    const b:Booking={id:'LM-'+randomUUID(),guestId:randomUUID(),guest:text(x.guest,200,true),email:x.email===undefined?'':text(x.email,254),phone:x.phone===undefined?'':text(x.phone,50),room:room!.id,arrival:date(x.arrival),departure:date(x.departure),notes:x.notes===undefined?'':text(x.notes,2000),status:'Confirmed',rate:room!.rate,paid:0};
    next.bookings.push(b); result={bookingId:b.id,bookingStatus:b.status};
  } else {
    const b=next.bookings.find(b=>b.id===op.target); if(!b) error(404,'Reservation not found');
    if(op.kind==='update') {
      fields(x,['guest','email','phone','room','arrival','departure','notes']);
      if(!active(b!)) error(409,'Only active reservations can be edited');
      for(const key of ['guest','email','phone','notes'] as const) if(x[key]!==undefined) b![key]=text(x[key],key==='notes'?2000:key==='email'?254:key==='phone'?50:200,key==='guest');
      for(const key of ['arrival','departure'] as const) if(x[key]!==undefined) b![key]=date(x[key]);
      if(x.room!==undefined) { const room=next.rooms.find(r=>r.id===(isHouse(next)&&x.room===undefined?'HOUSE':x.room)); if(!room || room.housekeeping==='Out of service') error(409,'Room unavailable'); if(room!.id!==b!.room){b!.room=room!.id;b!.rate=room!.rate;} }
    } else {
      fields(x,[]);
      if(op.kind==='check-in') {
        if(b!.status!=='Confirmed') error(409,'Only confirmed stays can check in');
        if(housekeepingEnabled&&next.rooms.find(r=>r.id===b!.room)?.housekeeping!=='Clean') error(409,'Mark the room clean before check-in');
        b!.status='Checked in';
      } else if(op.kind==='check-out') {
        if(b!.status!=='Checked in') error(409,'Only checked-in stays can check out');
        b!.status='Checked out'; next.rooms.find(r=>r.id===b!.room)!.housekeeping='Dirty';
      } else if(op.kind==='cancel') {
        if(b!.status!=='Confirmed') error(409,'Only confirmed stays can be cancelled');
        b!.status='Cancelled';
      } else error(404,'Unknown operation');
    }
    result={bookingId:b!.id,bookingStatus:b!.status};
  }
  try { validateState(next); } catch(e) { error(409,e instanceof Error?e.message:'Invalid hotel records'); }
  return {next,result};
}
function apply(s:any,action:any,token:Token,actor:string) {
  const licence=licenceStatus();if(!moduleAllowed(s,licence,'integrations'))error(403,'Integrations are disabled or not licensed');if(action.operation==='housekeeping'&&!moduleAllowed(s,licence,'housekeeping'))error(403,'Housekeeping is disabled or not licensed');
  permit(token,scopeFor(action.operation),action.property_id);
  const {raw,state}=snapshot(s,action.property_id);
  if(hash(raw)!==action.base_version) error(409,'Hotel records changed; submit a fresh request');
  const {next,result}=buildChange(state,JSON.parse(action.payload),moduleAllowed(s,licence,'housekeeping'));
  s.db.prepare('UPDATE property SET data=? WHERE id=?').run(JSON.stringify(next),action.property_id);
  queueChanges(s,state,next,action.property_id,licence);
  const response={actionId:action.id,status:'applied',...result};
  s.db.prepare("UPDATE api_actions SET status='applied',response=? WHERE id=?").run(JSON.stringify(response),action.id);
  s.audit('api-action-applied',actor,{actionId:action.id,tokenId:token.id,propertyId:action.property_id,operation:action.operation});
  return response;
}
export function decideAction(s:any,id:string,decision:string,actor:string) {
  return transaction(s,()=>{
    const action=s.db.prepare('SELECT * FROM api_actions WHERE id=?').get(id);
    if(!action) error(404,'Action not found');
    if(action.status!=='pending') error(409,'Action already decided');
    if(decision==='reject') {
      const response={actionId:id,status:'rejected'};
      s.db.prepare("UPDATE api_actions SET status='rejected',response=? WHERE id=?").run(JSON.stringify(response),id);
      s.audit('api-action-rejected',actor,{actionId:id}); return response;
    }
    if(decision!=='approve') error(400,'Choose approve or reject');
    if(Date.parse(action.created)<Date.now()-86400000) error(409,'Approval request expired; submit a fresh request');
    const row=s.db.prepare('SELECT * FROM api_tokens WHERE id=?').get(action.token_id);
    if(!row || row.revoked || row.expires<=Date.now()) error(403,'The requesting API token is no longer active');
    const token={...row,scopes:JSON.parse(row.scopes),propertyIds:JSON.parse(row.property_ids)};
    return apply(s,action,token,actor);
  });
}
function mutate(s:any,req:Request,token:Token,op:Operation) {
  permit(token,scopeFor(op.kind),op.propertyId);
  const key=req.headers.get('idempotency-key');
  if(!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) error(400,'Supply an Idempotency-Key of 8–128 letters, digits, dots, colons, underscores or hyphens');
  const fingerprint=hash(JSON.stringify(op));
  return transaction(s,()=>{
    const previous=s.db.prepare('SELECT * FROM api_actions WHERE token_id=? AND idempotency_key=?').get(token.id,key);
    if(previous) { if(previous.request_hash!==fingerprint) error(409,'Idempotency-Key was used for another request'); return json(JSON.parse(previous.response),previous.status==='pending'?202:200); }
    const {raw,state}=snapshot(s,op.propertyId); buildChange(state,op,moduleAllowed(s,licenceStatus(),'housekeeping'));
    const id=randomUUID(), response={actionId:id,status:'pending',approvalRequired:true};
    s.db.prepare('INSERT INTO api_actions(id,token_id,idempotency_key,request_hash,property_id,operation,payload,base_version,status,created,response) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,token.id,key,fingerprint,op.propertyId,op.kind,JSON.stringify(op),hash(raw),'pending',new Date().toISOString(),JSON.stringify(response));
    s.audit('api-action-requested','api:'+token.id,{actionId:id,propertyId:op.propertyId,operation:op.kind});
    if(token.approval_required) return json(response,202);
    const action=s.db.prepare('SELECT * FROM api_actions WHERE id=?').get(id);
    return json(apply(s,action,token,'api:'+token.id),op.kind==='create'?201:200);
  });
}
export async function handleIntegration(req:Request,path:string[]) {
  try {
    const s=store(), token=authenticate(s,req,licenceStatus) as Token;
    if(path.length===1 && path[0]==='properties' && req.method==='GET') {
      const properties=s.db.prepare("SELECT id,json_extract(data,'$.hotel') AS name,COALESCE(json_extract(data,'$.propertyType'),'hotel') AS propertyType FROM property ORDER BY id").all().filter((p:any)=>token.propertyIds.includes(p.id));
      s.audit('api-read','api:'+token.id,{resource:'properties'}); return json({properties});
    }
    if(path.length===2 && path[0]==='actions' && req.method==='GET') {
      const row=s.db.prepare('SELECT * FROM api_actions WHERE id=? AND token_id=?').get(path[1],token.id);
      if(!row) error(404,'Action not found'); return json(JSON.parse(row.response as string));
    }
    if(path[0]!=='properties' || !/^[1-9]\d*$/.test(path[1]||'')) error(404,'API endpoint not found');
    const propertyId=Number(path[1]); if(!Number.isSafeInteger(propertyId)) error(400,'Invalid property ID');
    const resource=path[2];
    if(req.method==='GET') {
      const scope=resource==='rooms'||resource==='availability'?'rooms:read':resource==='reservations'?'reservations:read':resource==='guests'?'guests:read':resource==='reports'?'reports:read':'';
      if(!scope) error(404,'API endpoint not found'); permit(token,scope,propertyId);
      const {state}=snapshot(s,propertyId), url=new URL(req.url),housekeepingEnabled=moduleAllowed(s,licenceStatus(),'housekeeping');const roomView=(r:State['rooms'][number])=>housekeepingEnabled?r:{id:r.id,type:r.type,rate:r.rate}; let result:unknown;
      if(resource==='rooms' && path.length===3) result={propertyType:propertyType(state),rooms:state.rooms.map(roomView),currency:state.currency};
      else if(resource==='availability' && path.length===3) {
        const arrival=date(url.searchParams.get('arrival')),departure=date(url.searchParams.get('departure'));
        if(departure<=arrival) error(400,'Departure must follow arrival');
        result={propertyType:propertyType(state),arrival,departure,currency:state.currency,rooms:state.rooms.map(r=>({...roomView(r),available:r.housekeeping!=='Out of service'&&!state.bookings.some(b=>active(b)&&b.room===r.id&&b.arrival<departure&&b.departure>arrival)}))};
      } else if(resource==='reservations' && (path.length===3||path.length===4)) {
        const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);
        if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200) error(400,'Use offset >= 0 and limit 1–200');
        const rows=state.bookings.filter(b=>(!path[3]||b.id===path[3])&&(!url.searchParams.has('status')||b.status===url.searchParams.get('status')));
        if(path[3]&&!rows.length) error(404,'Reservation not found');
        result=path[3]?{reservation:safeBooking(rows[0],token)}:{reservations:rows.slice(offset,offset+limit).map(b=>safeBooking(b,token)),total:rows.length,offset,limit};
      } else if(resource==='guests' && path.length===3) {
        const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||100);
        if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200) error(400,'Use offset >= 0 and limit 1–200');
        const groups=new Map<string,{id:string;name:string;email:string;phone:string;visits:number}>();
        for(const b of state.bookings) { const id=guestKey(b), previous=groups.get(id); groups.set(id,{id,name:b.guest,email:b.email,phone:b.phone,visits:(previous?.visits||0)+1}); }
        result={guests:[...groups.values()].slice(offset,offset+limit),total:groups.size,offset,limit};
      } else if(resource==='reports' && path.length===4 && path[3]==='daily') {
        const day=date(url.searchParams.get('date')),occupied=state.bookings.filter(b=>active(b)&&b.arrival<=day&&b.departure>day).length;
        result={date:day,currency:state.currency,rooms:state.rooms.length,reservedRooms:occupied,occupancyPercent:Math.round(occupied/Math.max(1,state.rooms.length)*100),arrivals:state.bookings.filter(b=>b.arrival===day&&b.status==='Confirmed').length,departures:state.bookings.filter(b=>b.departure===day&&b.status==='Checked in').length,...(housekeepingEnabled?{dirtyRooms:state.rooms.filter(r=>r.housekeeping==='Dirty').length}:{}),outstandingAllStays:state.bookings.filter(b=>b.status!=='Cancelled').reduce((sum,b)=>sum+Math.max(0,nights(b)*b.rate-b.paid),0)};
      } else error(404,'API endpoint not found');
      s.audit('api-read','api:'+token.id,{resource,propertyId}); return json(result);
    }
    let kind='';
    if(resource==='reservations' && path.length===3 && req.method==='POST') kind='create';
    if(resource==='reservations' && path.length===4 && req.method==='PATCH') kind='update';
    if(resource==='reservations' && path.length===5 && req.method==='POST' && ['check-in','check-out','cancel'].includes(path[4])) kind=path[4];
    if(resource==='rooms' && path.length===5 && path[4]==='housekeeping' && req.method==='PATCH') kind='housekeeping';
    if(!kind) error(404,'API endpoint not found');if(kind==='housekeeping'&&!moduleAllowed(s,licenceStatus(),'housekeeping'))error(403,'Housekeeping is disabled or not licensed');
    permit(token,scopeFor(kind),propertyId);
    return mutate(s,req,token,{kind,propertyId,target:path[3],body:await readBody(req)});
  } catch(e) { return apiFailure(e); }
}
