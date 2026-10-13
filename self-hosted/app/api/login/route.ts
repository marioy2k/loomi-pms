import {cookies} from 'next/headers';import {checkOrigin,store} from '@/runtime/core.mjs';
export async function POST(req:Request){try{checkOrigin(req);const {email,password}=await req.json();const token=store().login(email,password,'server');(await cookies()).set('loomi_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE!=='false',path:'/',maxAge:28800});return Response.json({ok:true})}catch(e){return Response.json({error:e instanceof Error?e.message:'Sign-in failed'},{status:401})}}

