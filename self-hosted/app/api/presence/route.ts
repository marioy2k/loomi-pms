import {cookies} from 'next/headers';
import {store,checkOrigin} from '@/runtime/core.mjs';
import {sessionHeartbeat} from '@/runtime/session-status.mjs';
export async function POST(req:Request){try{checkOrigin(req);const token=(await cookies()).get('loomi_session')?.value;return Response.json(sessionHeartbeat(store(),token),{headers:{'Cache-Control':'no-store'}})}catch(e:any){return Response.json({error:e.status===401?'Sign in required':'Presence unavailable'},{status:e.status||403,headers:{'Cache-Control':'no-store'}})}}
