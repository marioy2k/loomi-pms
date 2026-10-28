import {type Booking,type State,bookingTotalCents,bookingSubtotalCents,bookingDiscountCents,bookingCurrency,nights} from '@/lib/pms';
import {type Access,can,canViewAccounting} from '@/lib/permissions';
import {moduleEnabled} from '@/lib/modules';
import {validDate} from '@/lib/accounting-reports';

export const intelligenceTools=['ask','summary','messages','reservation','rooms','housekeeping','maintenance','invoice','forecast','pricing','inventory','feedback'] as const;
export type IntelligenceTool=typeof intelligenceTools[number];
export type IntelligenceContext={state:State;today:string;operations:any[];issues:any[];assignments:any[];items:any[];movements:any[];feedback:any[]};
export type Evidence={kind:'booking'|'room'|'operation'|'inventory'|'feedback'|'issue';id:string};
export type Insight={title:string;detail:string;severity:'info'|'warning';references:Evidence[]};
export const shiftDay=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const daysBetween=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/86400000);
const active=(b:Booking)=>b.status!=='Cancelled';
const occupies=(b:Booking,date:string)=>active(b)&&b.arrival<=date&&b.departure>date;
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
const ref=(kind:Evidence['kind'],id:string):Evidence=>({kind,id});
const money=(amount:number,currency:string)=>`${currency} ${(amount/100).toFixed(2)}`;
export const financialAccess=(user:Access)=>can(user,'bookingPayments')||can(user,'bookingRefunds')||can(user,'bookingRates')||canViewAccounting(user);
export function allowedIntelligenceTools(user:Access):IntelligenceTool[]{
 if(!moduleEnabled(user,'integrations'))return [];
 return intelligenceTools.filter(tool=>{
  switch(tool){
   case 'ask':case 'summary':return can(user,'overview')||can(user,'reservations')||can(user,'housekeeping')||financialAccess(user);
   case 'messages':return can(user,'reminders')||can(user,'reservations');
   case 'reservation':case 'rooms':return can(user,'reservations');
   case 'housekeeping':return can(user,'housekeeping');
   case 'maintenance':return can(user,'maintenance');
   case 'invoice':return can(user,'payments');
   case 'forecast':return can(user,'dashboard')||can(user,'overview');
   case 'pricing':return can(user,'bookingRates');
   case 'inventory':return can(user,'inventoryManage')||can(user,'inventoryApprove');
   case 'feedback':return can(user,'guests');
  }
 });
}
export function checkRange(from:unknown,to:unknown,max=366):{from:string;to:string}{
 if(typeof from!=='string'||typeof to!=='string'||!validDate(from)||!validDate(to)||from>to||daysBetween(from,to)>max)throw Error('Choose a valid date range');
 return {from,to};
}
export function dailySummary(c:IntelligenceContext,user:Access){
 const s=c.state,today=c.today,showGuests=can(user,'reservations')||can(user,'guests'),finance=financialAccess(user);
 const describe=(b:Booking)=>({id:b.id,room:b.room,arrival:b.arrival,departure:b.departure,status:b.status,...(showGuests?{guest:b.guest}:{}),...(finance?{currency:bookingCurrency(b,s),total:bookingTotalCents(b),paid:Math.round(b.paid*100),outstanding:Math.max(0,bookingTotalCents(b)-Math.round(b.paid*100))}:{})});
 const stays=s.bookings.filter(active),occupied=stays.filter(b=>occupies(b,today)&&b.status!=='Checked out');
 const alerts:Insight[]=[];
 if(finance)for(const b of stays){
  const balance=bookingTotalCents(b)-Math.round(b.paid*100);
  if(b.status==='Checked in'&&balance>0)alerts.push({title:'Openstaand saldo tijdens verblijf',detail:`${b.id} · ${money(balance,bookingCurrency(b,s))}`,severity:'warning',references:[ref('booking',b.id)]});
  if(b.paid*100>bookingTotalCents(b))alerts.push({title:'Verblijfstegoed',detail:`${b.id} · ${money(Math.round(b.paid*100)-bookingTotalCents(b),bookingCurrency(b,s))}`,severity:'info',references:[ref('booking',b.id)]});
  if(bookingDiscountCents(b)>bookingSubtotalCents(b)*.25)alerts.push({title:'Korting boven 25%',detail:b.id,severity:'warning',references:[ref('booking',b.id)]});
 }
 if(can(user,'housekeeping')||can(user,'reservations'))for(const b of stays.filter(b=>b.arrival===today&&b.status==='Confirmed')){
  const room=s.rooms.find(r=>r.id===b.room);if(room&&room.housekeeping!=='Clean')alerts.push({title:'Aankomst met ongereed verblijf',detail:`${b.id} · ${b.room}`,severity:'warning',references:[ref('booking',b.id),ref('room',b.room)]});
 }
 const balances:Record<string,number>={};if(finance)for(const b of stays){const currency=bookingCurrency(b,s);balances[currency]=(balances[currency]||0)+Math.max(0,bookingTotalCents(b)-Math.round(b.paid*100));}
 return {date:today,rooms:s.rooms.length,occupied:occupied.length,occupancy:s.rooms.length?Math.round(occupied.length/s.rooms.length*100):0,arrivals:stays.filter(b=>b.arrival===today&&b.status==='Confirmed').map(describe),departures:stays.filter(b=>b.departure===today&&b.status==='Checked in').map(describe),...(finance?{balances}:{}),alerts};
}
export function housekeepingPlan(c:IntelligenceContext){
 return c.state.rooms.flatMap(room=>{
  const departure=c.state.bookings.find(b=>active(b)&&b.room===room.id&&b.departure===c.today&&b.status==='Checked in');
  const arrival=c.state.bookings.filter(b=>active(b)&&b.status==='Confirmed'&&b.room===room.id&&b.arrival>=c.today).sort((a,b)=>a.arrival.localeCompare(b.arrival))[0];
  const inHouse=c.state.bookings.some(b=>b.room===room.id&&occupies(b,c.today)&&b.status==='Checked in'&&b.departure!==c.today);
  const issue=c.issues.some(i=>i.room===room.id&&i.status!=='Resolved');
  if(room.housekeeping==='Clean'&&!departure&&!issue)return [];
  const blocked=room.housekeeping==='Out of service'||c.operations.some(o=>o.kind==='maintenance'&&o.data.room===room.id&&o.data.block&&o.data.status!=='Resolved'&&o.data.from<=c.today&&o.data.to>c.today);
  const priority=blocked?0:arrival?.arrival===c.today?100:departure?80:room.housekeeping==='Dirty'?60:30;
  const assignment=c.assignments.find(a=>a.room===room.id&&a.day===c.today);
  return [{room:room.id,priority,status:room.housekeeping,blocked,reason:blocked?'Onderhoud: vrijgave nodig':arrival?.arrival===c.today?'Aankomst vandaag':departure?'Vertrek vandaag':inHouse?'Verblijf bezig; stem schoonmaak af':'Kamer gereedmaken',arrival:arrival?.arrival||null,departure:departure?.id||null,assignee:assignment?.assignee_name||'',assignmentVersion:assignment?.version||0,estimatedMinutes:departure?45:inHouse?20:30,references:[ref('room',room.id),...(arrival?[ref('booking',arrival.id)]:[])]}];
 }).sort((a,b)=>b.priority-a.priority||a.room.localeCompare(b.room));
}
export type RoomRequest={arrival:string;departure:string;preferredType?:string;excludeBooking?:string;guests?:number};
export function roomRecommendations(c:IntelligenceContext,request:RoomRequest){
 checkRange(request.arrival,request.departure,365);if(request.arrival>=request.departure)throw Error('Departure must be after arrival');
 const reasons:string[]=[];
 const rooms=c.state.rooms.flatMap(room=>{
  if(room.housekeeping==='Out of service')return [];
  if(c.state.bookings.some(b=>b.id!==request.excludeBooking&&active(b)&&!['Checked out'].includes(b.status)&&b.room===room.id&&b.arrival<request.departure&&b.departure>request.arrival))return [];
  if(c.operations.some(o=>o.kind==='maintenance'&&o.data.room===room.id&&o.data.block&&o.data.status!=='Resolved'&&o.data.from<request.departure&&o.data.to>request.arrival))return [];
  const adjacent=c.state.bookings.filter(b=>active(b)&&b.room===room.id&&(b.departure===request.arrival||b.arrival===request.departure)).length;
  const preferred=!request.preferredType||room.type.toLowerCase().includes(request.preferredType.toLowerCase());
  return [{room:room.id,type:room.type,capacity:room.capacity??null,nightlyRate:room.rate,currency:c.state.currency,ready:room.housekeeping==='Clean',score:(preferred?50:0)+adjacent*15+(room.housekeeping==='Clean'?10:0),reason:preferred?(adjacent?'Gewenst kamertype; sluit aan op bestaande boekingen':'Passend kamertype'):'Ander kamertype',references:[ref('room',room.id)]}];
 }).sort((a,b)=>b.score-a.score||a.nightlyRate-b.nightlyRate);
 reasons.push('Beschikbaarheid gecontroleerd tegen reserveringen en onderhoudsblokkades.');
 reasons.push(rooms.some(r=>r.capacity===null)?'Niet alle kamercapaciteiten zijn ingevuld; controleer capaciteit en bedvoorkeuren vóór bevestigen.':'Capaciteit is gebaseerd op de opgeslagen kamerinstellingen. Controleer ook de bedvoorkeuren.');
 const people=request.guests||1;
 const combinations=new Map<number,typeof rooms>([[0,[]]]);
 for(const room of rooms.filter(r=>r.capacity!==null))for(const [capacity,selected] of [...combinations]){const next=capacity+room.capacity!;if(next>people+100)continue;const candidate=[...selected,room],before=combinations.get(next);if(!before||candidate.length<before.length)combinations.set(next,candidate);}
 const best=[...combinations].filter(([capacity])=>capacity>=people).sort((a,b)=>a[1].length-b[1].length||a[0]-b[0])[0];
 return {rooms:rooms.filter(r=>!request.guests||r.capacity===null||r.capacity>=people),allocation:best?{rooms:best[1].map(r=>r.room),capacity:best[0],guests:people}:null,reasons};
}
export function maintenancePatterns(c:IntelligenceContext){
 const events=[...c.issues.map(i=>({id:i.id,room:i.room,title:i.title,notes:i.notes||'',created:i.created,status:i.status,kind:'issue'})),...c.operations.filter(o=>o.kind==='maintenance').map(o=>({id:o.id,room:o.data.room,title:o.data.title,notes:o.data.notes||'',created:o.created,status:o.data.status,kind:'operation'}))];
 const categories:Record<string,RegExp>={Klimaat:/airco|air.?condition|cool|warm|heat|klimaat/i,Water:/water|lekk|leak|toilet|douche|shower|plumb/i,Elektriciteit:/licht|lamp|light|electr|stroom|power/i,Toegang:/deur|door|slot|lock|sleutel|key/i,Netwerk:/wifi|internet|network|netwerk/i};
 const groups=new Map<string,typeof events>();
 for(const e of events){const category=Object.entries(categories).find(([,re])=>re.test(e.title+' '+e.notes))?.[0]||'Overig';const key=e.room+'|'+category;groups.set(key,[...(groups.get(key)||[]),e]);}
 return [...groups].map(([key,list])=>({room:key.split('|')[0],category:key.split('|')[1],count:list.length,open:list.filter(x=>x.status!=='Resolved').length,repeated:list.length>=2,last:list.map(x=>x.created).sort().at(-1),recommendation:list.length>=2?'Onderzoek de terugkerende oorzaak en plan een inspectie.':'Volg de openstaande melding op.',references:list.map(e=>ref(e.kind==='operation'?'operation':'issue',e.id))})).sort((a,b)=>b.count-a.count);
}
export function occupancyForecast(c:IntelligenceContext,horizon=14){
 if(!Number.isSafeInteger(horizon)||horizon<1||horizon>90)throw Error('Choose a forecast horizon of 1–90 days');
 const all=c.state.bookings.filter(active),earliest=all.filter(b=>['Checked in','Checked out'].includes(b.status)).map(b=>b.arrival).filter(d=>d<c.today).sort()[0];
 const historyDays=earliest?Math.min(84,daysBetween(earliest,c.today)):0;
 const knownHistory=all.filter(b=>['Checked in','Checked out'].includes(b.status));
 const days=Array.from({length:horizon},(_,i)=>{
  const date=shiftDay(c.today,i),weekday=new Date(date+'T12:00:00Z').getUTCDay();
  const blocked=new Set(c.state.rooms.filter(r=>r.housekeeping==='Out of service').map(r=>r.id));
  for(const o of c.operations.filter(o=>o.kind==='maintenance'&&o.data.block&&o.data.status!=='Resolved'&&o.data.from<=date&&o.data.to>date))blocked.add(o.data.room);
  const capacity=c.state.rooms.filter(r=>!blocked.has(r.id)).length;
  const booked=new Set(all.filter(b=>b.status!=='Checked out'&&occupies(b,date)&&!blocked.has(b.room)).map(b=>b.room)).size;
  const samples:number[]=[];
  for(let n=1;n<=historyDays;n++){const d=shiftDay(c.today,-n);if(new Date(d+'T12:00:00Z').getUTCDay()===weekday)samples.push(new Set(knownHistory.filter(b=>occupies(b,d)).map(b=>b.room)).size);}
  const baseline=samples.length?sum(samples)/samples.length:null;
  const estimated=baseline===null?null:Math.min(capacity,Math.max(booked,Math.round(baseline)));
  return {date,capacity,booked,available:Math.max(0,capacity-booked),bookedPercent:capacity?Math.round(booked/capacity*100):0,estimatedOccupied:estimated,estimatedPercent:estimated!==null&&capacity?Math.round(estimated/capacity*100):null,samples:samples.length,confidence:samples.length>=8?'medium':samples.length>=4?'low':'insufficient'};
 });
 return {historyDays,method:'On-the-books bookings plus weekday averages from up to 12 weeks of completed/checked-in stays. No market, holiday or booking-lead-time model.',warning:historyDays<28?'Te weinig historie voor een betrouwbare voorspelling. Bestaande boekingen zijn wel zichtbaar.':'Dit is een schatting, geen gegarandeerde bezetting. Historische kamercapaciteit is niet opgeslagen.',days};
}
export function pricingAdvice(c:IntelligenceContext,horizon=14){
 const forecast=occupancyForecast(c,horizon);
 return {currency:c.state.currency,method:'Transparante bezettingsregels; geen concurrentieprijzen of marktanalyse.',days:forecast.days.map(d=>{
  const factor=d.bookedPercent>=85?1.1:d.bookedPercent>=65?1.05:d.bookedPercent<35&&daysBetween(c.today,d.date)<=7?.95:1;
  return {date:d.date,occupancy:d.bookedPercent,suggestedChangePercent:Math.round((factor-1)*100),reason:factor>1?'Hoge reeds geboekte bezetting':factor<1?'Lage bezetting binnen zeven dagen':'Standaardtarief aanhouden',rooms:c.state.rooms.filter(r=>r.housekeeping!=='Out of service').map(r=>({room:r.id,currentRate:r.rate,suggestedRate:Math.round(r.rate*factor*100)/100})),requiresApproval:true};
 })};
}
export function inventoryAdvice(c:IntelligenceContext,horizon=14){
 const forecast=occupancyForecast(c,horizon),expectedRoomNights=sum(forecast.days.map(d=>d.estimatedOccupied??d.booked));
 const pastRoomNights=sum(Array.from({length:28},(_,i)=>new Set(c.state.bookings.filter(b=>['Checked in','Checked out'].includes(b.status)&&occupies(b,shiftDay(c.today,-i-1))).map(b=>b.room)).size));
 const cutoff=shiftDay(c.today,-28),movementKinds=new Set(['Issued','Issue','Handed out','Approved','Return','Returned']);
 return {horizon,expectedRoomNights,pastRoomNights,method:'28 dagen verstrekkingen minus retouren, geschaald op verwachte kamernachten; minimumvoorraad blijft de ondergrens.',items:c.items.filter(i=>i.active).map(i=>{
  const movements=c.movements.filter(m=>m.item_id===i.id&&m.created.slice(0,10)>=cutoff&&m.created.slice(0,10)<c.today&&movementKinds.has(m.kind));
  const consumed=Math.max(0,sum(movements.map(m=>/return/i.test(m.kind)?-Math.abs(m.quantity):Math.abs(m.quantity))));
  const demand=pastRoomNights>0?Math.ceil(consumed/pastRoomNights*expectedRoomNights):null;
  const target=Math.max(i.minimum,demand??0),order=Math.max(0,target-i.stock);
  return {id:i.id,name:i.name,unit:i.unit,stock:i.stock,minimum:i.minimum,consumed,demand,target,suggestedOrder:order,confidence:pastRoomNights>=14&&movements.length>=3?'medium':'insufficient',references:[ref('inventory',i.id)]};
 }).sort((a,b)=>b.suggestedOrder-a.suggestedOrder)};
}
export type FeedbackInput={room:string;booking:string;rating:number;text:string;date:string;source:string};
export function validateFeedback(input:any,state:State):FeedbackInput{
 if(!input||typeof input.text!=='string'||input.text.trim().length<3||input.text.length>5000||!Number.isSafeInteger(input.rating)||input.rating<1||input.rating>5||!validDate(input.date)||typeof input.source!=='string'||input.source.length>100||typeof input.room!=='string'||input.room&&!state.rooms.some(r=>r.id===input.room)||typeof input.booking!=='string'||input.booking&&!state.bookings.some(b=>b.id===input.booking))throw Error('Enter feedback, a rating from 1–5 and a valid room or reservation');
 if(input.booking&&input.room&&state.bookings.find(b=>b.id===input.booking)?.room!==input.room)throw Error('Feedback room must match its reservation');
 return {room:input.room,booking:input.booking,rating:input.rating,text:input.text.trim(),date:input.date,source:input.source.trim()};
}
export function feedbackAnalysis(rows:any[]){
 const topics:Record<string,RegExp>={Schoonmaak:/clean|dirty|schoon|vuil|hygi/i,Personeel:/staff|service|personeel|vriend|friendly|recept/i,Slaapcomfort:/bed|sleep|slap|noise|lawaai|geluid/i,Klimaat:/airco|warm|cold|cool|heat/i,Ontbijt:/breakfast|ontbijt|food|eten/i,Wifi:/wifi|internet/i};
 return {count:rows.length,averageRating:rows.length?Math.round(sum(rows.map(r=>r.rating))/rows.length*10)/10:null,method:'Beoordelingsscores en trefwoordgroepen; één beoordeling kan meerdere onderwerpen bevatten.',topics:Object.entries(topics).map(([topic,re])=>{const matches=rows.filter(r=>re.test(r.text));return {topic,count:matches.length,negative:matches.filter(r=>r.rating<=2).length,positive:matches.filter(r=>r.rating>=4).length,references:matches.map(r=>ref('feedback',r.id))};}).filter(x=>x.count).sort((a,b)=>b.negative-a.negative||b.count-a.count)};
}
export type QuestionPlan={intent:'availability'|'arrivals'|'departures'|'balances'|'discounts'|'occupancy'|'reservations';from:string;to:string;search:string};
export function localQuestionPlan(question:string,today:string):QuestionPlan|null{
 const q=question.toLowerCase();let intent:QuestionPlan['intent']|undefined;
 if(/vrij|beschikbaar|available|vacan|free rooms?|rooms? free/.test(q)&&/kamer|room|verblijf|accommod/.test(q))intent='availability';else if(/korting|discount/.test(q))intent='discounts';else if(/saldo|balance|openstaand|unpaid|betaling|payment/.test(q))intent='balances';else if(/vertrek|uitcheck|check.*uit|check.?out|depart/.test(q))intent='departures';else if(/aankomst|incheck|check.?in|arriv/.test(q))intent='arrivals';else if(/bezet|occup/.test(q))intent='occupancy';else if(/reserver|booking|reservation/.test(q))intent='reservations';
 if(!intent)return null;
 const dates=q.match(/\d{4}-\d{2}-\d{2}/g)||[];let from=dates[0]||(/overmorgen|day after tomorrow/.test(q)?shiftDay(today,2):/morgen|tomorrow/.test(q)?shiftDay(today,1):today),to=dates[1]||from;
 if(/maand|month/.test(q)&&!dates.length){from=today.slice(0,7)+'-01';to=shiftDay(new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),1)).toISOString().slice(0,10),-1);}
 return {intent,from,to,search:''};
}
export function answerQuestion(c:IntelligenceContext,user:Access,plan:QuestionPlan){
 checkRange(plan.from,plan.to);if(!['availability','arrivals','departures','balances','discounts','occupancy','reservations'].includes(plan.intent)||typeof plan.search!=='string'||plan.search.length>200)throw Error('Invalid question plan');
 if(['balances','discounts'].includes(plan.intent)&&!financialAccess(user))throw Error('Payment or rate permission required for this question');
 if(!can(user,'reservations')&&!can(user,'guests')&&!can(user,'overview')&&!financialAccess(user))throw Error('Reservation or overview permission required');
 if(plan.intent==='availability'){
  const departure=shiftDay(plan.to,1);
  const rooms=c.state.rooms.filter(room=>(!plan.search||[room.id,room.type].join(' ').toLowerCase().includes(plan.search.toLowerCase()))&&room.housekeeping!=='Out of service'&&!c.state.bookings.some(b=>active(b)&&b.status!=='Checked out'&&b.room===room.id&&b.arrival<departure&&b.departure>plan.from)&&!c.operations.some(o=>o.kind==='maintenance'&&o.data.room===room.id&&o.data.block&&o.data.status!=='Resolved'&&o.data.from<departure&&o.data.to>plan.from)).map(room=>({room:room.id,type:room.type,ready:room.housekeeping==='Clean'}));
  return {plan,count:rooms.length,rooms,rows:[],references:rooms.map(room=>ref('room',room.room)),note:'Vrij gedurende de hele gekozen periode, inclusief de einddatum. Vertrek op de begindatum blokkeert niet. Kamers met onderhoud of buiten gebruik tellen niet mee; controleer de schoonmaakstatus voor aankomst.'};
 }
 let bookings=c.state.bookings.filter(active).filter(b=>!plan.search||[b.id,b.room,...(can(user,'reservations')||can(user,'guests')?[b.guest]:[])].join(' ').toLowerCase().includes(plan.search.toLowerCase()));
 if(plan.intent==='arrivals')bookings=bookings.filter(b=>b.arrival>=plan.from&&b.arrival<=plan.to&&b.status!=='Checked out');
 else if(plan.intent==='departures')bookings=bookings.filter(b=>b.departure>=plan.from&&b.departure<=plan.to);
 else if(plan.intent==='balances')bookings=bookings.filter(b=>bookingTotalCents(b)>Math.round(b.paid*100));
 else bookings=bookings.filter(b=>b.arrival<=plan.to&&b.departure>plan.from);
 if(plan.intent==='discounts')bookings=bookings.filter(b=>bookingDiscountCents(b)>0);
 const totals:Record<string,number>={};
 if(['balances','discounts'].includes(plan.intent))for(const b of bookings){const currency=bookingCurrency(b,c.state);totals[currency]=(totals[currency]||0)+(plan.intent==='discounts'?bookingDiscountCents(b):Math.max(0,bookingTotalCents(b)-Math.round(b.paid*100)));}
 return {plan,count:bookings.length,totals,rows:bookings.slice(0,100).map(b=>({id:b.id,room:b.room,arrival:b.arrival,departure:b.departure,status:b.status,...(can(user,'reservations')||can(user,'guests')?{guest:b.guest}:{}),...(financialAccess(user)?{currency:bookingCurrency(b,c.state),total:bookingTotalCents(b),balance:Math.max(0,bookingTotalCents(b)-Math.round(b.paid*100)),discount:bookingDiscountCents(b)}:{})})),references:bookings.slice(0,100).map(b=>ref('booking',b.id)),note:plan.intent==='balances'?'Alle actuele openstaande verblijfssaldi; POS-kosten zijn apart.':plan.intent==='occupancy'?'Reserveringen die de gekozen periode overlappen; gebruik Bezetting voor percentages per dag.':'Periode gebaseerd op de opgeslagen verblijfsdatums.'};
}
export function guestMessage(c:IntelligenceContext,id:string,kind:string,locale:string,finance:boolean){
 const b=c.state.bookings.find(b=>b.id===id);if(!b)throw Error('Reservation not found');if(!['arrival','confirmation','payment','checkout'].includes(kind))throw Error('Choose a message type');if(kind==='payment'&&!finance)throw Error('Payment permission required');
 const nl=locale==='nl',balance=money(Math.max(0,bookingTotalCents(b)-Math.round(b.paid*100)),bookingCurrency(b,c.state));
 const text=kind==='arrival'?(nl?`We verwelkomen u graag op ${b.arrival} bij ${c.state.hotel}. Uw vertrekdatum is ${b.departure}. Neem gerust contact op als u vragen heeft.`:`We look forward to welcoming you on ${b.arrival} at ${c.state.hotel}. Your departure date is ${b.departure}. Please contact us with any questions.`):kind==='payment'?(nl?`Voor uw verblijf ${b.id} staat nog ${balance} open. Neem contact op met de receptie om uw betaling te regelen.`:`Your stay ${b.id} has an accommodation balance of ${balance}. Please contact reception to arrange payment.`):kind==='checkout'?(nl?`Uw vertrekdatum bij ${c.state.hotel} is ${b.departure}. Neem voor vragen of hulp contact op met de receptie.`:`Your departure date at ${c.state.hotel} is ${b.departure}. Please contact reception if you need assistance.`):(nl?`Uw reservering ${b.id} bij ${c.state.hotel} is ${b.status}. Aankomst: ${b.arrival}. Vertrek: ${b.departure}.`:`Your reservation ${b.id} at ${c.state.hotel} is ${b.status}. Arrival: ${b.arrival}. Departure: ${b.departure}.`);
 return {subject:(nl?'Uw verblijf bij ':'Your stay at ')+c.state.hotel,body:(nl?'Beste ':'Hello ')+b.guest+',\n\n'+text+'\n\n'+c.state.hotel,email:b.email,booking:id,kind,locale,references:[ref('booking',id)],requiresApproval:true};
}
