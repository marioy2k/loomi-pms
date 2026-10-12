import {redirect} from 'next/navigation';
import {getChatGPTUser} from './chatgpt-auth';
import {licenceStatus,store} from '@/runtime/core.mjs';
import PMS from './pms-client';
import Activation from './activation';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();if(!user)redirect('/login');const license=licenceStatus();return license.valid?<PMS/>:<Activation license={license} superAdmin={user.email===store().setting('ownerEmail')}/>}

