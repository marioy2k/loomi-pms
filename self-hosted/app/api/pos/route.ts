import {moduleEnabled} from '@/lib/modules';
import {checkOrigin} from '@/runtime/core.mjs';
import {database} from '@/db/raw';
import {access} from '@/lib/access';
import {can,canAccessProperty} from '@/lib/permissions';
import {requestedProperty} from '@/lib/properties';
import {loadPos,savePos,posError} from '@/lib/pos-service';
export async function GET(req:Request){try{const user=await access();if(!moduleEnabled(user,'pos'))return Response.json({error:'This company feature is disabled or not included in the licence'},{status:403});if(!user||(!can(user,'pos')&&!can(user,'posManage')&&!can(user,'payments')))return Response.json({error:'POS permission required'},{status:403});const id=requestedProperty(req);if(!canAccessProperty(user,id))return Response.json({error:'Property access denied'},{status:403});return Response.json(await loadPos(database(),id));}catch(e){console.error(e);return posError(e);}}
export async function POST(req:Request){try{const user=await access();if(!moduleEnabled(user,'pos'))return Response.json({error:'This company feature is disabled or not included in the licence'},{status:403});if(!user)return Response.json({error:'Access denied'},{status:403});try{checkOrigin(req)}catch{return Response.json({error:'Invalid request origin'},{status:403})}const id=requestedProperty(req);if(!canAccessProperty(user,id))return Response.json({error:'Property access denied'},{status:403});return Response.json(await savePos(database(),id,await req.json(),user));}catch(e){console.error(e);return posError(e);}}
