import {cookies} from 'next/headers';
import {store} from '@/runtime/core.mjs';
export async function getChatGPTUser(){const user=store().user((await cookies()).get('loomi_session')?.value);return user?{email:user.email,displayName:user.name,userId:user.email}:null;}
