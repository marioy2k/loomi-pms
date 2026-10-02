import {handleIntegration} from '@/lib/integration-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
async function handler(req:Request,context:Context){return handleIntegration(req,(await context.params).path);}
export {handler as GET,handler as POST,handler as PATCH};
