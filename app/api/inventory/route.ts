import {database} from '@/db/raw';
import {access} from '@/lib/access';
import {requestedProperty} from '@/lib/properties';
import {loadInventory,saveInventory,inventoryError} from '@/lib/inventory-service';
export async function GET(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403});return Response.json(await loadInventory(database(),requestedProperty(req),user));}catch(e){console.error(e);return inventoryError(e);}}
export async function POST(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin'},{status:403});return Response.json(await saveInventory(database(),requestedProperty(req),await req.json(),user));}catch(e){console.error(e);return inventoryError(e);}}
