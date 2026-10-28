// Dry-run by default. Only explicit IDs of automatically UTC-dated reservation
// receipts can be repaired. Amounts, bookings, methods and creation times stay intact.
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {localDayOffset} from '../runtime/local-day.mjs';
const args=process.argv.slice(2),ids=[],apply=args.includes('--apply');
let path=join(process.env.DATA_DIR||'data','loomi.sqlite'),actor='system:accounting-date-repair';
for(let i=0;i<args.length;i++){
 if(args[i]==='--apply')continue;
 if(args[i]==='--id'&&args[i+1]){ids.push(args[++i]);continue;}
 if(args[i]==='--database'&&args[i+1]){path=args[++i];continue;}
 if(args[i]==='--actor'&&args[i+1]){actor=args[++i];continue;}
 throw Error('Use --database PATH, --id ID (repeatable), --actor ACTOR and optional --apply');
}
if(!existsSync(path))throw Error('Database not found');
if(apply&&!ids.length)throw Error('Apply requires explicit transaction IDs from a reviewed dry-run');
if(new Set(ids).size!==ids.length||ids.some(id=>id.length>250)||actor.length>200)throw Error('Invalid repair parameters');
const db=new DatabaseSync(path,{readOnly:!apply});
db.exec('PRAGMA busy_timeout=5000');
try{
 if(apply)db.exec('BEGIN IMMEDIATE');
 const rows=db.prepare("SELECT id,property_id,date,created,kind,amount,currency,description FROM transactions WHERE record_id='' AND kind IN ('Payment','Refund','Opening balance')").all();
 const automatic=row=>row.kind==='Payment'&&row.description==='Reservation payment recorded'||row.kind==='Refund'&&row.description==='Reservation payment reduced / refunded'||row.kind==='Opening balance'&&row.description==='Existing paid total when accounting was enabled; original payment dates are unavailable.';
 const candidate=row=>automatic(row)&&Number.isFinite(Date.parse(row.created))&&row.date===new Date(row.created).toISOString().slice(0,10)&&row.date!==localDayOffset(0,new Date(row.created));
 const selected=ids.length?ids.map(id=>rows.find(row=>row.id===id)):rows.filter(candidate);
 const corrections=[],alreadyCorrect=[];
 for(const row of selected){
  if(!row)throw Error('A selected transaction is missing or is not an automatic reservation receipt');
  if(!candidate(row)){
   const audited=db.prepare("SELECT id FROM accounting_audit WHERE id=? AND event='reservation-date-corrected' AND reference=?").get('reservation-local-date:'+row.id,row.id);
   if(automatic(row)&&row.date===localDayOffset(0,new Date(row.created))&&audited){alreadyCorrect.push(row.id);continue;}
   throw Error('A selected transaction changed or is not eligible for an automatic date repair');
  }
  const correctedDate=localDayOffset(0,new Date(row.created));
  const change={id:row.id,propertyId:row.property_id,storedDate:row.date,correctedDate,currency:row.currency,amount:row.amount};corrections.push(change);
  if(apply){
   const changed=db.prepare('UPDATE transactions SET date=? WHERE id=? AND date=? AND amount=? AND currency=? AND created=?').run(correctedDate,row.id,row.date,row.amount,row.currency,row.created);
   if(changed.changes!==1)throw Error('Transaction changed; repair rolled back');
   const now=new Date().toISOString();
   db.prepare('INSERT INTO accounting_audit(id,property_id,event,actor,created,reference) VALUES(?,?,?,?,?,?)').run('reservation-local-date:'+row.id,row.property_id,'reservation-date-corrected',actor,now,row.id);
   db.prepare('INSERT INTO activity_log(property_id,event,actor,created,reference,details) VALUES(?,?,?,?,?,?)').run(row.property_id,'accounting.reservation-date-corrected',actor,now,row.id,JSON.stringify({...change,reason:'Automatic UTC business date corrected to America/Paramaribo; amount unchanged'}));
  }
 }
 if(apply)db.exec('COMMIT');
 console.log(JSON.stringify({mode:apply?'applied':'dry-run',corrections,alreadyCorrect},null,2));
}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
