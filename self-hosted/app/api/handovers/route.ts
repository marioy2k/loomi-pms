import {access} from '@/lib/access';
import {requestedProperty} from '@/lib/properties';
import {store} from '@/runtime/core.mjs';
import {loadHandovers,saveHandover} from '@/runtime/handovers.mjs';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {readJson} from '@/runtime/request-json.mjs';
const error=(e:any)=>Response.json({error:e.status?e.message:'Shift handovers are unavailable'},{status:e.status||503});
export async function GET(req:Request){try{return Response.json(loadHandovers(store().db,await access(),requestedProperty(req)),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return error(e)}}
export async function POST(req:Request){try{if(!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});return Response.json(saveHandover(store().db,await access(),requestedProperty(req),await readJson(req,20000)))}catch(e){return error(e)}}
