import type {Booking,Room} from '@/lib/pms';
export function roomAvailability(room:Room,bookings:Booking[],booking:Booking){if(room.housekeeping==='Out of service')return 'Out of service';return bookings.some(b=>b.id!==booking.id&&b.room===room.id&&!['Cancelled','Checked out'].includes(b.status)&&b.arrival<booking.departure&&b.departure>booking.arrival)?'Busy':'Available';}
