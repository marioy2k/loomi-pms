import {redirect} from 'next/navigation';
import {getChatGPTUser} from './chatgpt-auth';
import PMS from './pms-client';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getChatGPTUser())redirect('/login');return <PMS/>}
