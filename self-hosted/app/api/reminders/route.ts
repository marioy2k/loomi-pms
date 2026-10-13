import {canOperate} from '@/lib/operations';
import {access} from '@/lib/access';
import {can,canAccessProperty} from '@/lib/permissions';
import {database} from '@/db/raw';
import {requestedProperty} from '@/lib/properties';
import {deliverReminder} from '@/lib/email-dispatch';
export async function POST(req:Request){try{const user=await access(),id=requestedProperty(req);if(!user||!canOperate(user,'reminder')||!canAccessProperty(user,id))return Response.json({error:'Reservation permission required'},{status:403});if(req.headers.get('origin')!==new URL(process.env.APP_URL!).origin)return Response.json({error:'Invalid request'},{status:403});const x=await req.json() as any;if(typeof x.id!=='string'||!Number.isSafeInteger(x.version))throw Error('Invalid reminder reference');return Response.json(await deliverReminder(database(),id,x.id,user.email,x.version));}catch(e){return Response.json({error:e instanceof Error?e.message:'Email unavailable'},{status:400});}}
