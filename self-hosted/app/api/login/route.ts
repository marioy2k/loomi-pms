import {readJson} from '@/runtime/request-json.mjs';
import {secureSessionCookie} from '@/runtime/origins.mjs';
import {cookies} from 'next/headers';import {checkOrigin,store} from '@/runtime/core.mjs';
export async function POST(req:Request){try{checkOrigin(req);const {email,password}=await readJson(req);const token=store().login(email,password);(await cookies()).set('loomi_session',token,{httpOnly:true,sameSite:'strict',secure:secureSessionCookie(req),path:'/',maxAge:28800});return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:'Sign-in failed'},{status:(e as {status?:number}).status||401})}}

