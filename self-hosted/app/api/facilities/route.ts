import {access} from '@/lib/access';
import {requestedProperty} from '@/lib/properties';
import {store} from '@/runtime/core.mjs';
import {loadFacilities,saveFacility} from '@/runtime/facilities.mjs';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {readJson} from '@/runtime/request-json.mjs';
const error=(e:any)=>Response.json({error:e.status?e.message:'Facility tasks are unavailable'},{status:e.status||503});
export async function GET(req:Request){try{return Response.json(loadFacilities(store().db,await access(),requestedProperty(req),new URL(req.url).searchParams.get('kind')||'technical'),{headers:{'Cache-Control':'private, no-store'}})}catch(e){return error(e)}}
export async function POST(req:Request){try{if(!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});return Response.json(saveFacility(store().db,await access(),requestedProperty(req),await readJson(req,12000)))}catch(e){return error(e)}}
