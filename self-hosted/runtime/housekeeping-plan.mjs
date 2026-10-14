export function housekeepingPlan(state,date){
 return state.rooms.flatMap(room=>{
  if(room.housekeeping==='Out of service')return [];
  const bookings=state.bookings.filter(b=>b.room===room.id&&b.status!=='Cancelled');
  const arrival=bookings.some(b=>b.arrival===date&&b.status==='Confirmed');
  const departure=bookings.some(b=>b.departure===date&&['Checked in','Checked out'].includes(b.status));
  const occupied=bookings.some(b=>b.status==='Checked in');
  const cleaning=['Dirty','In progress'].includes(room.housekeeping);
  if(!cleaning&&!(departure&&occupied))return [];
  const reason=arrival?'Ready before arrival':departure?'Cleaning after departure':'Cleaning needed';
  return [{room:room.id,priority:arrival?0:departure?1:2,reason,occupied,status:room.housekeeping}];
 }).sort((a,b)=>a.priority-b.priority||Number(a.occupied)-Number(b.occupied)||a.room.localeCompare(b.room,undefined,{numeric:true}));
}
