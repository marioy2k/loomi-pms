import {isSuperAdmin} from '@/lib/permissions';
import {access} from '@/lib/access';
import {database} from '@/db/raw';
import {moduleEntitlements} from '@/lib/module-access';
import {loadModuleSettings,saveModuleSettings} from '@/lib/module-service';
export async function GET(){try{const user=await access();if(!user||!isSuperAdmin(user))return Response.json({error:'Company administrator access required'},{status:403});return Response.json(await loadModuleSettings(database(),await moduleEntitlements()),{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'Unable to load company features'},{status:503});}}
export async function POST(req:Request){try{const user=await access();if(!user||!isSuperAdmin(user))return Response.json({error:'Company administrator access required'},{status:403});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin'},{status:403});return await saveModuleSettings(database(),user,await req.json(),await moduleEntitlements());}catch(e){console.error(e);return Response.json({error:'Unable to save company features. Refresh and try again'},{status:503});}}
