import {access} from '@/lib/access';
import {database} from '@/db/raw';
import {requestedProperty} from '@/lib/properties';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {IntelligenceError,intelligenceOverview,runIntelligence} from '@/lib/intelligence-service';
import {ZodError} from 'zod';
const headers={'Cache-Control':'no-store'};
function error(e:unknown){return Response.json({error:e instanceof ZodError?'Check the required fields and values':e instanceof Error?e.message:'Intelligence unavailable'},{status:e instanceof IntelligenceError?e.status:400,headers});}
export async function GET(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403,headers});return Response.json(await intelligenceOverview(database(),user,requestedProperty(req)),{headers});}catch(e){return error(e);}}
export async function POST(req:Request){try{const user=await access();if(!user)return Response.json({error:'Access denied'},{status:403,headers});if(!isAllowedOrigin(req)||!req.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Invalid request origin or content type'},{status:403,headers});const raw=await req.text();if(raw.length>5700000)return Response.json({error:'Request is too large'},{status:413,headers});return Response.json(await runIntelligence(database(),user,requestedProperty(req),JSON.parse(raw)),{headers});}catch(e){return error(e);}}
