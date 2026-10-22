import {cookies} from 'next/headers';
import {access} from '@/lib/access';
import {moduleEnabled} from '@/lib/modules';
import {store} from '@/runtime/core.mjs';
export async function chatContext(){const user=await access();if(!user||!moduleEnabled(user,'chat'))throw Object.assign(Error('Chat add-on is not enabled'),{status:403});const token=(await cookies()).get('loomi_session')?.value;if(!token)throw Object.assign(Error('Sign in required'),{status:401});return {s:store(),token,user}}
