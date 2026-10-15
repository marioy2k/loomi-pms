import {access} from '@/lib/access';
import {database} from '@/db/raw';
import {managementReport} from '@/lib/management-report';
import {localDay} from '@/lib/operations';
export async function GET(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403});const u=new URL(req.url),to=u.searchParams.get('to')||localDay(),from=u.searchParams.get('from')||to.slice(0,7)+'-01';return Response.json(await managementReport(database(),user,from,to),{headers:{'Cache-Control':'private, no-store'}})}catch(e){const x=e as Error&{status?:number};if(x.status)return Response.json({error:x.message},{status:x.status});console.error('Management report failed',e);return Response.json({error:'Unable to load management report'},{status:503})}}
