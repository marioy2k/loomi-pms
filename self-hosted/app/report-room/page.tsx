import {redirect} from 'next/navigation';
import {getChatGPTUser} from '../chatgpt-auth';
import RoomReadiness from '../room-readiness';
export const dynamic='force-dynamic';
export default async function Report({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const p=await searchParams,propertyId=Number(p.propertyId),room=typeof p.room==='string'?p.room:'';if(!await getChatGPTUser())redirect('/login?next='+encodeURIComponent('/report-room?propertyId='+propertyId+'&room='+encodeURIComponent(room)));return <main style={{padding:20,maxWidth:1100,margin:'0 auto'}}><a href="/">← Loomi Home</a><RoomReadiness propertyId={propertyId} initialRoom={room} standalone/></main>}
