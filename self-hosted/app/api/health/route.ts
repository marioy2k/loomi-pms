import {store} from '@/runtime/core.mjs';
export const dynamic='force-dynamic';
export function GET(){try{store().db.prepare('SELECT 1').get();return Response.json({status:'ok'});}catch{return Response.json({status:'unavailable'},{status:503});}}
