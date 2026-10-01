import type {Booking} from '@/lib/pms';
export type Identification={type:'ID card'|'Passport'|'Driver licence';number:string;country:string;expiry:string};
export function guestKey(b:Booking){return b.guestId||'legacy:'+((b.email?.trim().toLowerCase()&&'email:'+b.email.trim().toLowerCase())||(b.phone?.trim()&&'phone:'+b.phone.trim())||'name:'+b.guest.trim().toLowerCase());}
export function guestGroups(bookings:Booking[]){const groups=new Map<string,Booking[]>();for(const b of bookings){const key=guestKey(b);groups.set(key,[...(groups.get(key)||[]),b])}return [...groups].map(([id,stays])=>({id,guest:stays.at(-1)!,stays}));}
