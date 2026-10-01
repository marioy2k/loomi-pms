import type {State} from '@/lib/pms';
import {Access,can} from '@/lib/permissions';
export function visibleState(state:State,user:Access):State{if(can(user,'reservations'))return state;return {...state,bookings:state.bookings.map(({identification,...b})=>b)};}
export function preserveIdentification(old:State,next:State,user:Access){if(can(user,'reservations'))return next;return {...next,bookings:next.bookings.map(b=>{const before=old.bookings.find(o=>o.id===b.id);const {identification,...rest}=b;return before?.identification?{...rest,identification:before.identification}:rest})};}
