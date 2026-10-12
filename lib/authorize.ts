import {moduleEnabled} from '@/lib/modules';
import {State,propertyType,isHouse} from '@/lib/pms';
import {Access,can,Permission} from '@/lib/permissions';
export function authorizeUpdate(a:Access,old:State,next:State){
 if(propertyType(old)!==propertyType(next))throw Error('Property type cannot be changed after creation');
 const deny=(permission:Permission)=>{if(!can(a,permission))throw Error('You do not have permission to make this change.');};
 if(old.currency!==next.currency&&old.bookings.length)throw Error('Currency cannot be changed after reservations exist. Create a separate property for another currency.');
 if(old.hotel!==next.hotel||old.currency!==next.currency||JSON.stringify(old.company)!==JSON.stringify(next.company)||JSON.stringify(old.appearance)!==JSON.stringify(next.appearance))deny('property');
 const roomDetails=(s:State)=>s.rooms.map(({housekeeping,...r})=>r);
 if(JSON.stringify(roomDetails(old))!==JSON.stringify(roomDetails(next))){if(!moduleEnabled(a,'rooms'))throw Error('Room management is disabled for this company');deny(isHouse(old)?'property':'rooms');}
 for(const r of next.rooms){const before=old.rooms.find(x=>x.id===r.id);if(!before&&!moduleEnabled(a,'housekeeping')&&r.housekeeping!=='Clean')throw Error('Housekeeping is disabled for this company');if(before&&r.housekeeping!==before.housekeeping){const checkout=can(a,'reservations')&&r.housekeeping==='Dirty'&&next.bookings.some(b=>b.room===r.id&&b.status==='Checked out'&&old.bookings.some(o=>o.id===b.id&&o.status==='Checked in'));if(!checkout)deny('housekeeping');}}
 const details=(s:State)=>s.bookings.map(({rate,paid,paymentMethod,...b})=>b);
 if(JSON.stringify(details(old))!==JSON.stringify(details(next)))deny('reservations');
 for(const b of next.bookings){const before=old.bookings.find(x=>x.id===b.id);const standard=next.rooms.find(r=>r.id===b.room)?.rate;const roomReassignment=before&&before.room!==b.room&&can(a,'reservations')&&b.rate===standard;if(before){if(b.paymentMethod!==before.paymentMethod)deny('payments');if(b.paid!==before.paid||b.rate!==before.rate&&!roomReassignment)deny('payments');}else if(b.paid!==0||b.rate!==standard)deny('payments');}
 for(const b of old.bookings)if(b.paid>0&&!next.bookings.some(n=>n.id===b.id))deny('payments');
}
