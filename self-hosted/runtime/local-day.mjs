export function localDayOffset(offset=0,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Paramaribo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const date=new Date(today+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+offset);
 return date.toISOString().slice(0,10);
}
