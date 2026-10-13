import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {access} from '@/lib/access';
import {database} from '@/db/raw';
import {resetHotelData} from '@/lib/reset';
export async function POST(req:Request){try{if(!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});const user=await access();const x=await req.json() as {confirmation?:unknown};return await resetHotelData(database(),user,x.confirmation);}catch{return Response.json({error:'Unable to reset hotel data. No changes were committed.'},{status:400});}}
