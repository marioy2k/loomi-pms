import {chatContext} from '@/lib/chat-access';
import {isAllowedOrigin} from '@/runtime/origins.mjs';
import {pushKeys,pushNotice,subscribePush,unsubscribePush} from '@/runtime/chat-push.mjs';
const headers={'Cache-Control':'private, no-store'};
const error=(e:any)=>Response.json({error:e.status?e.message:'Browser notifications are unavailable'},{status:e.status||503,headers});
export async function GET(req:Request){try{const {s,token}=await chatContext(),id=new URL(req.url).searchParams.get('message');return Response.json(id?pushNotice(s,token,Number(id)):{publicKey:pushKeys(s).publicKey},{headers})}catch(e){return error(e)}}
export async function POST(req:Request){try{if(!isAllowedOrigin(req))return Response.json({error:'Invalid request origin'},{status:403,headers});const {s,token}=await chatContext();if(Number(req.headers.get('content-length'))>5000)throw Object.assign(Error('Subscription is too large'),{status:413});const text=await req.text();if(text.length>5000)throw Object.assign(Error('Subscription is too large'),{status:413});const x=JSON.parse(text);return Response.json(x.action==='unsubscribe'?unsubscribePush(s,token,x.endpoint):subscribePush(s,token,x.subscription),{headers})}catch(e){return error(e)}}
