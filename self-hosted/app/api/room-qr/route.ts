import {access} from '@/lib/access';
import {requestedProperty} from '@/lib/properties';
import {store} from '@/runtime/core.mjs';
import {operationsGuard} from '@/runtime/operations-hub.mjs';
import {roomQR} from '@/runtime/room-qr.mjs';
export async function GET(req:Request){try{const id=requestedProperty(req),room=new URL(req.url).searchParams.get('room'),state=operationsGuard(store().db,await access(),id);if(!room||!state.rooms.some((r:any)=>r.id===room))return Response.json({error:'Room not found'},{status:404});const origin=process.env.APP_URL;if(!origin)return Response.json({error:'Server address is not configured'},{status:503});return new Response(await roomQR(origin,id,room),{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}})}catch(e:any){return Response.json({error:e.status?e.message:'QR code is unavailable'},{status:e.status||503})}}
