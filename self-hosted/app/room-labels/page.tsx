import {redirect} from 'next/navigation';
import {getChatGPTUser} from '../chatgpt-auth';
import RoomLabels from './labels';
export const dynamic='force-dynamic';
export default async function Labels({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await searchParams,id=Number(p.propertyId);if(!await getChatGPTUser())redirect('/login?next='+encodeURIComponent('/room-labels?propertyId='+id));return <RoomLabels propertyId={id}/>}
