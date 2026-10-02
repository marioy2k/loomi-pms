import {validDate,cents,categoriesFor,recordKinds,AccountingRecord} from '@/lib/accounting-reports';
const currencies=['USD','SRD','EUR'];
class AccountingError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const fail=(status:number,message:string):never=>{throw new AccountingError(status,message)};
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const money=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1e9&&cents(v)>0;
const auditSQL="INSERT OR IGNORE INTO accounting_audit(id,property_id,event,actor,created,reference) SELECT ?,?,?,?,?,? WHERE changes()=1";
export function accountingError(e:unknown){return Response.json({error:e instanceof AccountingError?e.message:'Unable to save accounting records'},{status:e instanceof AccountingError?e.status:503});}
export async function saveAccounting(db:any,propertyId:number,x:any,actor:string){
 const property=await db.prepare('SELECT data FROM property WHERE id=?').bind(propertyId).first();if(!property)fail(404,'Property not found');
 const now=new Date().toISOString();
 if(x.action==='create-record'){
  if(!uuid(x.id)||!validDate(x.date)||!recordKinds.includes(x.kind)||!categoriesFor(x.kind).includes(x.category)||!money(x.amount)||!currencies.includes(x.currency)||typeof x.description!=='string'||!x.description.trim()||x.description.length>2000||typeof x.party!=='string'||x.party.length>200)fail(400,'Enter a valid date, category, amount and description');
  const booking=String(x.booking||'');if(booking&&!JSON.parse(property.data).bookings.some((b:any)=>b.id===booking))fail(400,'Reservation must belong to this property');
  const paid=Number(x.paidAmount||0);if(!Number.isFinite(paid)||paid<0||paid>x.amount||paid>0&&(!validDate(x.paymentDate)||x.paymentDate>now.slice(0,10)||!['Cash','Card','Bank transfer'].includes(x.method)))fail(400,'Check the initial payment date, method and amount');
  const normalized={id:x.id,property_id:propertyId,date:x.date,kind:x.kind,category:x.category,amount:cents(x.amount),currency:x.currency,description:x.description.trim(),party:x.party.trim(),booking};
  const existing=await db.prepare('SELECT * FROM accounting_records WHERE id=?').bind(x.id).first();
  if(existing){if(Object.entries(normalized).some(([k,v])=>existing[k]!==v))fail(409,'This record ID already belongs to another entry');const initial=await db.prepare('SELECT * FROM transactions WHERE id=?').bind('initial-'+x.id).first();if((initial?Math.abs(initial.amount):0)!==cents(paid)||initial&&(initial.date!==x.paymentDate||initial.method!==x.method))fail(409,'Initial payment differs from the saved request');return {saved:true,id:x.id};}
  const n=normalized;const statements=[db.prepare('INSERT OR IGNORE INTO accounting_records(id,property_id,date,created,kind,category,amount,currency,description,party,booking,actor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(n.id,propertyId,n.date,now,n.kind,n.category,n.amount,n.currency,n.description,n.party,n.booking,actor),db.prepare(auditSQL).bind('create-'+x.id,propertyId,'record-created',actor,now,x.id)];
  if(paid>0){const sign=x.kind==='Expense'||x.kind==='Income credit'?-1:1;const kind=x.kind==='Security deposit'?'Deposit received':x.kind==='Income credit'?'Income refund':x.kind==='Expense credit'?'Expense refund':x.kind;statements.push(db.prepare("INSERT OR IGNORE INTO transactions(id,property_id,date,created,kind,method,amount,currency,booking,guest,description,actor,record_id,category) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM accounting_records WHERE id=? AND property_id=? AND kind=? AND amount=? AND category=? AND date=?)").bind('initial-'+x.id,propertyId,x.paymentDate,now,kind,x.method,sign*cents(paid),x.currency,booking,x.party,x.description.trim(),actor,x.id,x.category,x.id,propertyId,x.kind,cents(x.amount),x.category,x.date));}
  await db.batch(statements);const stored=await db.prepare('SELECT * FROM accounting_records WHERE id=?').bind(x.id).first();if(Object.entries(normalized).some(([k,v])=>stored[k]!==v))fail(409,'This record ID already belongs to another entry');const initial=await db.prepare('SELECT * FROM transactions WHERE id=?').bind('initial-'+x.id).first();if((initial?Math.abs(initial.amount):0)!==cents(paid)||initial&&(initial.date!==x.paymentDate||initial.method!==x.method))fail(409,'Initial payment differs from the saved request');return {saved:true,id:x.id};
 }
 if(x.action==='settle-record'){
  if(!uuid(x.id)||!validDate(x.date)||x.date>now.slice(0,10)||!money(x.amount)||!['Cash','Card','Bank transfer'].includes(x.method))fail(400,'Enter a valid payment date, amount and method');
  const r=await db.prepare('SELECT * FROM accounting_records WHERE id=? AND property_id=?').bind(String(x.recordId),propertyId).first() as AccountingRecord|null;if(!r)fail(404,'Accounting record not found');
  const refund=r!.kind==='Security deposit'&&x.direction==='refund';if(r!.kind==='Security deposit'&&!['receive','refund'].includes(x.direction))fail(400,'Choose receive or refund');
  const sign=refund||r!.kind==='Expense'||r!.kind==='Income credit'?-1:1,amount=sign*cents(x.amount);
  const kind=r!.kind==='Security deposit'?(refund?'Deposit refund':'Deposit received'):r!.kind==='Income credit'?'Income refund':r!.kind==='Expense credit'?'Expense refund':r!.kind;
  const existing=await db.prepare('SELECT * FROM transactions WHERE id=?').bind(x.id).first();if(existing){if(existing.property_id!==propertyId||existing.record_id!==r!.id||existing.amount!==amount||existing.date!==x.date||existing.method!==x.method)fail(409,'Payment ID already used for a different payment');return {saved:true};}
  const balance=r!.kind==='Security deposit'?"(SELECT COALESCE(SUM(amount),0) FROM transactions WHERE record_id=? AND property_id=?) + ? BETWEEN 0 AND accounting_records.amount":"(SELECT COALESCE(SUM(ABS(amount)),0) FROM transactions WHERE record_id=? AND property_id=?) + ? <= accounting_records.amount";
  const datedBalance=r!.kind==='Security deposit'?" AND (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE record_id=? AND property_id=? AND date<=?) + ? >= 0":'';
  const insert=db.prepare(`INSERT OR IGNORE INTO transactions(id,property_id,date,created,kind,method,amount,currency,booking,guest,description,actor,record_id,category) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM accounting_records WHERE id=? AND property_id=? AND ${balance}${datedBalance}`).bind(x.id,propertyId,x.date,now,kind,x.method,amount,r!.currency,r!.booking,r!.party,r!.description,actor,r!.id,r!.category,r!.id,propertyId,r!.id,propertyId,r!.kind==='Security deposit'?amount:Math.abs(amount),...(r!.kind==='Security deposit'?[r!.id,propertyId,x.date,amount]:[]));
  const result=await db.batch([insert,db.prepare(auditSQL).bind('payment-'+x.id,propertyId,'record-payment',actor,now,r!.id)]);if(!result[0].meta.changes)fail(409,'Payment exceeds the unpaid amount, or deposit refund exceeds money held');return {saved:true};
 }
 if(x.action==='categorize'){
  const r=await db.prepare('SELECT * FROM transactions WHERE id=? AND property_id=?').bind(String(x.id),propertyId).first();if(!r||r.record_id||!['Income','Expense'].includes(r.kind))fail(400,'Only legacy manual income and expenses can be recategorized here');
  if(x.category!=='Uncategorized'&&!categoriesFor(r.kind).includes(x.category))fail(400,'Choose a valid category');await db.batch([db.prepare('UPDATE transactions SET category=? WHERE id=? AND property_id=?').bind(x.category,r.id,propertyId),db.prepare(auditSQL).bind(crypto.randomUUID(),propertyId,'transaction-categorized',actor,now,r.id)]);return {saved:true};
 }
 // Preserve compatibility with older manual-cash clients.
 if(!uuid(x.id)||!validDate(x.date)||!['Income','Expense'].includes(x.kind)||!['Cash','Card','Bank transfer'].includes(x.method)||!money(x.amount)||!currencies.includes(x.currency)||!x.description?.trim())fail(400,'Enter valid transaction details');
 await db.prepare('INSERT OR IGNORE INTO transactions(property_id,id,date,created,kind,method,amount,currency,booking,guest,description,actor,category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(propertyId,x.id,x.date,now,x.kind,x.method,cents(x.amount)*(x.kind==='Expense'?-1:1),x.currency,'','',x.description.trim(),actor,'Uncategorized').run();return {saved:true};
}
