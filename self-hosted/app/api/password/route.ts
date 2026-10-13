import {cookies} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {checkOrigin,store} from '@/runtime/core.mjs';
export async function POST(req:Request){
  try{
    checkOrigin(req);
    const user=await getChatGPTUser();
    if(!user)return Response.json({error:'Please sign in again'},{status:401});
    const {currentPassword,newPassword}=await req.json();
    store().changePassword(user.email,currentPassword,newPassword);
    (await cookies()).delete('loomi_session');
    return Response.json({ok:true});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to change password'},{status:400})}
}
