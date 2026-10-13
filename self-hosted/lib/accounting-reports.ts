import {State,day,nights,bookingCurrency} from '@/lib/pms';
import {Transaction} from '@/lib/ledger';
export const incomeCategories=['Swimming day passes','Food','Beverage','Cleaning fees','Transfers','Food and beverage','Other income'];
export const expenseCategories=['Cleaning','Utilities','Repairs and maintenance','Salaries','Supplies','Booking commissions','Insurance','Rent','Marketing','Professional fees','Other expenses'];
export const recordKinds=['Income','Expense','Income credit','Expense credit','Security deposit'];
export type AccountingRecord={id:string;property_id:number;date:string;created:string;kind:string;category:string;amount:number;currency:string;description:string;party:string;booking:string;actor:string};
export type CashRow=Transaction&{property_id:number;record_id?:string;category?:string};
export type PropertySnapshot={id:number;state:State};
export const isExpense=(kind:string)=>kind==='Expense'||kind==='Expense credit';
export const isCredit=(kind:string)=>kind==='Income credit'||kind==='Expense credit';
export const categoriesFor=(kind:string)=>kind==='Security deposit'?['Security deposits']:isExpense(kind)?expenseCategories:incomeCategories;
export function validDate(value:unknown):value is string{return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export const cents=(amount:number)=>Math.round(amount*100);
export function paidFor(record:AccountingRecord,rows:CashRow[],through?:string){if(record.id.startsWith('pass-order-'))return rows.filter(r=>(r.record_id===record.id||r.record_id==='pass-refund-'+record.id)&&(!through||r.date<=through)).reduce((n,r)=>n+r.amount,0);if(record.id.startsWith('pass-refund-')&&(!through||record.date<=through))return record.amount;if(record.id.startsWith('pos-order-')&&rows.some(r=>r.record_id==='pos-refund-'+record.id&&(!through||r.date<=through)))return record.amount;if(record.id.startsWith('pos-refund-')&&(!through||record.date<=through))return record.amount;return rows.filter(r=>r.record_id===record.id&&(!through||r.date<=through)).reduce((sum,r)=>sum+(record.kind==='Security deposit'?r.amount:Math.abs(r.amount)),0);}
function between(date:string,from:string,to:string){return (!from||date>=from)&&(!to||date<=to);}
const nextMonth=(date:string)=>{const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,1);return d.toISOString().slice(0,10);};
export function buildReports(properties:PropertySnapshot[],records:AccountingRecord[],cash:CashRow[],currency:string,from:string,to:string,asOf=day()){
 const income=new Map<string,number>(),expenses=new Map<string,number>(),months=new Map<string,{income:number;expenses:number}>();
 const add=(category:string,amount:number,expense:boolean,date:string)=>{const target=expense?expenses:income;target.set(category,(target.get(category)||0)+amount);const month=date.slice(0,7),old=months.get(month)||{income:0,expenses:0};old[expense?'expenses':'income']+=amount;months.set(month,old);};
 const earnedBookings=new Map<string,number>();
 for(const p of properties){for(const b of p.state.bookings){if(bookingCurrency(b,p.state)!==currency)continue;if(b.status==='Cancelled'&&b.cancelledAt&&b.cancellationFee){const earned=b.cancelledAt<=asOf?cents(b.cancellationFee):0;earnedBookings.set(p.id+':'+b.id,earned);if(earned&&between(b.cancelledAt,from,to))add('Cancellation fees',earned,false,b.cancelledAt);}if(!['Checked in','Checked out'].includes(b.status)||!validDate(b.arrival)||!validDate(b.departure))continue;
  const start=[b.arrival,from||b.arrival].sort().at(-1)!;let end=[b.departure,asOf,to?new Date(Date.parse(to)+86400000).toISOString().slice(0,10):asOf].sort()[0];
  let cursor=start,total=0;
  while(cursor<end){const stop=[nextMonth(cursor),end].sort()[0],n=Math.round((Date.parse(stop)-Date.parse(cursor))/86400000),amount=n*cents(b.rate);add('Accommodation',amount,false,cursor);total+=amount;cursor=stop;}
  const allEnd=[b.departure,asOf].sort()[0];earnedBookings.set(p.id+':'+b.id,Math.max(0,Math.round((Date.parse(allEnd)-Date.parse(b.arrival))/86400000))*cents(b.rate));
 }}
 for(const r of records){if(r.currency!==currency||r.kind==='Security deposit'||!between(r.date,from,to)||r.date>asOf)continue;add(r.category,r.amount*(isCredit(r.kind)?-1:1),isExpense(r.kind),r.date);}
 // Legacy manual cash entries have no incurred date. Keep them visible using their original date.
 const legacy=cash.filter(r=>r.currency===currency&&!r.record_id&&['Income','Expense'].includes(r.kind)&&between(r.date,from,to)&&r.date<=asOf);
 for(const r of legacy)add(r.category||'Uncategorized',Math.abs(r.amount),r.kind==='Expense',r.date);
 const inflows=cash.filter(r=>r.currency===currency&&r.kind!=='Opening balance'&&between(r.date,from,to)&&r.date<=asOf&&r.amount>0).reduce((sum,r)=>sum+r.amount,0);
 const outflows=-cash.filter(r=>r.currency===currency&&r.kind!=='Opening balance'&&between(r.date,from,to)&&r.date<=asOf&&r.amount<0).reduce((sum,r)=>sum+r.amount,0);
 const depositRecords=records.filter(r=>r.currency===currency&&r.kind==='Security deposit');
 const securityDeposits=depositRecords.reduce((sum,r)=>sum+paidFor(r,cash,asOf),0);
 let advances=records.filter(r=>r.currency===currency&&r.kind==='Income'&&r.date>asOf).reduce((sum,r)=>sum+paidFor(r,cash,asOf),0),guestOutstanding=0;
 for(const p of properties){for(const b of p.state.bookings){if(bookingCurrency(b,p.state)!==currency)continue;const paid=Math.max(0,cash.filter(r=>r.property_id===p.id&&r.booking===b.id&&!r.record_id&&r.currency===currency&&['Payment','Refund','Opening balance'].includes(r.kind)&&r.date<=asOf).reduce((sum,r)=>sum+r.amount,0));const earned=earnedBookings.get(p.id+':'+b.id)||0;advances+=Math.max(0,paid-earned);guestOutstanding+=Math.max(0,cents(b.status==='Cancelled'?(b.cancellationFee||0):b.rate*nights(b))-cents(b.paid));}}
 guestOutstanding+=records.filter(r=>r.currency===currency&&r.booking&&r.id.startsWith('pos-order-')).reduce((sum,r)=>sum+Math.max(0,r.amount-paidFor(r,cash,asOf)-(records.some(c=>c.id==='pos-refund-'+r.id)?r.amount:0)),0);
 const totalIncome=[...income.values()].reduce((a,b)=>a+b,0),totalExpenses=[...expenses.values()].reduce((a,b)=>a+b,0);
 const unpaid=records.filter(r=>r.currency===currency&&r.date<=asOf&&r.kind!=='Security deposit').map(r=>({...r,paid:(r.id.startsWith('pos-order-')||r.id.startsWith('pass-order-'))&&records.some(c=>c.id===(r.id.startsWith('pass-')?'pass-refund-':'pos-refund-')+r.id&&c.date<=asOf)?r.amount:paidFor(r,cash,asOf),outstanding:(r.id.startsWith('pos-order-')||r.id.startsWith('pass-order-'))&&records.some(c=>c.id===(r.id.startsWith('pass-')?'pass-refund-':'pos-refund-')+r.id&&c.date<=asOf)?0:Math.max(0,r.amount-paidFor(r,cash,asOf))}));
 return {income:[...income].map(([category,amount])=>({category,amount})),expenses:[...expenses].map(([category,amount])=>({category,amount})),totalIncome,totalExpenses,profit:totalIncome-totalExpenses,inflows,outflows,netCash:inflows-outflows,securityDeposits,advances,guestOutstanding,unpaid,legacyCount:legacy.length,months:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,x])=>({month,...x,profit:x.income-x.expenses})),asOf};
}

export function guestBalanceRows(properties:PropertySnapshot[],records:AccountingRecord[],cash:CashRow[],currency:string){return properties.flatMap(p=>p.state.bookings.filter(b=>b.status!=='Cancelled').flatMap(b=>{const stayMatches=bookingCurrency(b,p.state)===currency;const charges=records.filter(r=>r.property_id===p.id&&r.booking===b.id&&r.currency===currency&&r.id.startsWith('pos-order-')).reduce((sum,r)=>sum+Math.max(0,r.amount-paidFor(r,cash)-(records.some(c=>c.id==='pos-refund-'+r.id)?r.amount:0)),0);if(!stayMatches&&!charges)return [];const total=stayMatches?cents(b.rate*nights(b)):0,paid=stayMatches?cents(b.paid):0;return [{property:p,booking:b,total,paid,roomCharges:charges,outstanding:Math.max(0,total-paid)+charges,stayMatches}];}));}
