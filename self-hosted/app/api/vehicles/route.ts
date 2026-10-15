import {access} from '@/lib/access';
import {can} from '@/lib/permissions';
import {requestedProperty} from '@/lib/properties';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {store} from '@/runtime/core.mjs';
import {loadFleet,saveFleet,fleetPhoto,FleetError} from '@/runtime/fleet.mjs';
export const runtime='nodejs';
function error(e:unknown){if(e instanceof FleetError)return Response.json({error:e.message},{status:e.status});console.error('Vehicle service failure',e);return Response.json({error:'Vehicle service unavailable. Refresh before retrying.'},{status:503});}
export async function GET(req:Request){try{
 const user=await access();if(!user||!can(user,'vehicleView'))return Response.json({error:'Vehicle access required'},{status:403});
 const propertyId=requestedProperty(req),photo=new URL(req.url).searchParams.get('photo');
 if(photo){const p=fleetPhoto(store().db,propertyId,photo,user);return new Response(Buffer.from(p.data,'base64'),{headers:{'Content-Type':p.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="vehicle-photo"'}});}
 return Response.json(loadFleet(store().db,propertyId,user),{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return error(e);}}
export async function POST(req:Request){try{
 const user=await access();if(!user||!can(user,'vehicleView'))return Response.json({error:'Vehicle access required'},{status:403});
 if(!isAllowedOrigin(req)||!req.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Invalid request origin or content type'},{status:403});
 // Bound streamed bodies as well as requests with Content-Length.
 const reader=req.body?.getReader();if(!reader)return Response.json({error:'Request body required'},{status:400});
 const chunks:Uint8Array[]=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>6000000){await reader.cancel();return Response.json({error:'Maximum request size is 6 MB; use up to four photos of 1 MB each'},{status:413});}chunks.push(value);}
 let x;try{x=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return Response.json({error:'Invalid JSON request'},{status:400});}
 return Response.json(saveFleet(store().db,requestedProperty(req),x,user));
 }catch(e){return error(e);}}
