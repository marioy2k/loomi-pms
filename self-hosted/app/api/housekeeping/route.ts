import {access} from '@/lib/access';
import {database} from '@/db/raw';
import {requestedProperty} from '@/lib/properties';
import {day} from '@/lib/pms';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {loadHousekeeping,saveHousekeeping,issuePhoto,HousekeepingError} from '@/lib/housekeeping-service';
const error=(e:unknown)=>Response.json({error:e instanceof Error?e.message:'Housekeeping unavailable'},{status:e instanceof HousekeepingError?e.status:400});
export async function GET(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403});const url=new URL(req.url),id=requestedProperty(req);if(url.searchParams.get('scope')==='photo'){const photo=await issuePhoto(database(),user,id,url.searchParams.get('id')||'');const [header,data]=photo.split(',');return new Response(Buffer.from(data,'base64'),{headers:{'Content-Type':header.slice(5,-7),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}return Response.json(await loadHousekeeping(database(),user,id,url.searchParams.get('date')||day()),{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
export async function POST(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403});if(!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});if(Number(req.headers.get('content-length')||0)>2200000)return Response.json({error:'Photo is too large'},{status:413});return Response.json(await saveHousekeeping(database(),user,requestedProperty(req),await req.json()));}catch(e){return error(e);}}
