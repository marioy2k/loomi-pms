import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../runtime/core.mjs';
import helper from './helpers/load-ts.cjs';
const {loadTs}=helper;
const {saveAccounting}=loadTs('lib/accounting-service.ts');
const {paymentChanges,initializeLedger}=loadTs('lib/ledger.ts');
const {buildReports,guestBalanceRows,paidFor}=loadTs('lib/accounting-reports.ts');
const booking={id:'B1',guest:'QA Guest',email:'',phone:'',room:'101',arrival:'2026-10-01',departure:'2026-10-03',status:'Checked out',rate:100,paid:50,paymentMethod:'Cash',notes:'',currency:'USD'};
const state={hotel:'Accounting QA',currency:'USD',rooms:[{id:'101',type:'Standard',rate:100,housekeeping:'Clean'}],bookings:[booking]};
function fixture(){const dir=mkdtempSync(join(tmpdir(),'loomi-accounting-audit-'));const db=new Store(join(dir,'test.sqlite'),new URL('../drizzle',import.meta.url).pathname);for(const id of [1,2])db.db.prepare('INSERT INTO property(id,data) VALUES(?,?)').run(id,JSON.stringify(state));return {db,close(){db.db.close();rmSync(dir,{recursive:true,force:true})}};}
const create=(patch={})=>({action:'create-record',id:randomUUID(),date:'2026-10-01',kind:'Expense',category:'Utilities',amount:100,currency:'USD',description:'QA bill',party:'QA supplier',booking:'',paidAmount:0,...patch});
const settle=(recordId,amount,date,patch={})=>({action:'settle-record',id:randomUUID(),recordId,amount,date,method:'Cash',...patch});
test('reservation receipts use Paramaribo day while retaining UTC audit timestamps',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T01:30:00Z')});
 const next={...state,bookings:[{...booking,paid:75}]};
 const [row]=paymentChanges(state,next,'qa');assert.equal(row.date,'2026-10-27');assert.equal(row.created,'2026-10-28T01:30:00.000Z');assert.equal(row.amount,2500);
});
test('opening accommodation balances use the same local business date',async t=>{
 const f=fixture();try{t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T01:30:00Z')});await initializeLedger(f.db,state,1);const row=f.db.db.prepare('SELECT date,amount FROM transactions').get();assert.equal(row.date,'2026-10-27');assert.equal(row.amount,5000);}finally{f.close();}
});
test('manual payments cannot be dated tomorrow during the UTC/local-day boundary',async t=>{
 const f=fixture();try{t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-28T01:30:00Z')});const x=create({paidAmount:10,paymentDate:'2026-10-28',method:'Card'});await assert.rejects(saveAccounting(f.db,1,x,'qa'),/initial payment/);const bill=create();await saveAccounting(f.db,1,bill,'qa');await assert.rejects(saveAccounting(f.db,1,settle(bill.id,10,'2026-10-28'),'qa'),/payment date/);await saveAccounting(f.db,1,settle(bill.id,10,'2026-10-27'),'qa');}finally{f.close();}
});
test('income, expenses and credits settle once with correct cash signs and independent currencies',async()=>{
 const f=fixture();try{for(const [kind,category,sign,currency] of [['Income','Other income',1,'USD'],['Expense','Utilities',-1,'EUR'],['Income credit','Other income',-1,'SRD'],['Expense credit','Utilities',1,'USD']]){
  const x=create({kind,category,currency,amount:123.45,paidAmount:23.45,paymentDate:'2026-10-01',method:'Card'});await saveAccounting(f.db,1,x,'qa');await saveAccounting(f.db,1,x,'qa');const p=settle(x.id,100,'2026-10-02');await saveAccounting(f.db,1,p,'qa');await saveAccounting(f.db,1,p,'qa');const rows=f.db.db.prepare('SELECT * FROM transactions WHERE record_id=?').all(x.id);assert.equal(rows.length,2);assert.equal(rows.reduce((n,r)=>n+r.amount,0),sign*12345);assert(rows.every(r=>r.currency===currency));assert.equal(paidFor(f.db.db.prepare('SELECT * FROM accounting_records WHERE id=?').get(x.id),rows),12345);await assert.rejects(saveAccounting(f.db,1,settle(x.id,0.01,'2026-10-03'),'qa'),/exceeds/);
 }}finally{f.close();}
});
test('security deposits are excluded from profit, accept partial refunds, and reject over-refunds',async()=>{
 const f=fixture();try{const x=create({kind:'Security deposit',category:'Security deposits',amount:200,paidAmount:200,paymentDate:'2026-10-01',method:'Cash'});await saveAccounting(f.db,1,x,'qa');const refund=settle(x.id,50,'2026-10-02',{direction:'refund'});await saveAccounting(f.db,1,refund,'qa');await saveAccounting(f.db,1,refund,'qa');const rows=f.db.db.prepare('SELECT * FROM transactions').all(),records=f.db.db.prepare('SELECT * FROM accounting_records').all();const report=buildReports([],records,rows,'USD','2026-10-01','2026-10-31','2026-10-27');assert.equal(report.totalIncome,0);assert.equal(report.totalExpenses,0);assert.equal(report.securityDeposits,15000);assert.equal(report.inflows,20000);assert.equal(report.outflows,5000);await assert.rejects(saveAccounting(f.db,1,settle(x.id,151,'2026-10-03',{direction:'refund'}),'qa'),/exceeds/);}finally{f.close();}
});
test('backdated deposit refunds cannot create negative intermediate balances',async()=>{
 const f=fixture();try{const x=create({kind:'Security deposit',category:'Security deposits',amount:100,paidAmount:100,paymentDate:'2026-10-01',method:'Cash'});await saveAccounting(f.db,1,x,'qa');await saveAccounting(f.db,1,settle(x.id,100,'2026-10-20',{direction:'refund'}),'qa');await saveAccounting(f.db,1,settle(x.id,100,'2026-10-25',{direction:'receive'}),'qa');await assert.rejects(saveAccounting(f.db,1,settle(x.id,50,'2026-10-15',{direction:'refund'}),'qa'),/balance|exceeds/);assert.equal(f.db.db.prepare('SELECT sum(amount) n FROM transactions WHERE record_id=?').get(x.id).n,10000);}finally{f.close();}
});
test('backdated deposit receipts cannot exceed the required amount at an intermediate date',async()=>{
 const f=fixture();try{const x=create({kind:'Security deposit',category:'Security deposits',amount:100,paidAmount:100,paymentDate:'2026-10-01',method:'Cash'});await saveAccounting(f.db,1,x,'qa');await saveAccounting(f.db,1,settle(x.id,100,'2026-10-20',{direction:'refund'}),'qa');await assert.rejects(saveAccounting(f.db,1,settle(x.id,50,'2026-10-15',{direction:'receive'}),'qa'),/balance|exceeds/);}finally{f.close();}
});
test('cancelled unpaid fees and foreign POS charges agree between guest rows and summary totals',()=>{
 const cancelled={...booking,status:'Cancelled',cancellationFee:80,cancelledAt:'2026-10-01',paid:20},s={...state,bookings:[cancelled]};
 const records=[{id:'pos-order-C1-Food',property_id:1,booking:'B1',currency:'EUR',amount:1200,date:'2026-10-01',kind:'Income',category:'Food',description:'Food'}];
 for(const currency of ['USD','EUR']){const rows=guestBalanceRows([{id:1,state:s}],records,[],currency),report=buildReports([{id:1,state:s}],records,[],currency,'','','2026-10-27');assert.equal(rows.reduce((n,r)=>n+r.outstanding,0),report.guestOutstanding);}
 const row=guestBalanceRows([{id:1,state:s}],records,[],'USD')[0];assert.equal(row.total,8000);assert.equal(row.outstanding,6000);
});
test('unpaid expenses affect profit on incurred dates and cash only after settlement',async()=>{
 const f=fixture();try{const x=create({currency:'EUR',amount:75});await saveAccounting(f.db,1,x,'qa');let records=f.db.db.prepare('SELECT * FROM accounting_records').all();let report=buildReports([],records,[],'EUR','2026-10-01','2026-10-31','2026-10-27');assert.equal(report.totalExpenses,7500);assert.equal(report.outflows,0);assert.equal(report.unpaid[0].outstanding,7500);await saveAccounting(f.db,1,settle(x.id,30,'2026-10-03'),'qa');const cash=f.db.db.prepare('SELECT * FROM transactions').all();report=buildReports([],records,cash,'EUR','2026-10-01','2026-10-31','2026-10-27');assert.equal(report.totalExpenses,7500);assert.equal(report.outflows,3000);assert.equal(report.unpaid[0].outstanding,4500);}finally{f.close();}
});
test('accounting rejects reused IDs, excess initial payments and cross-property settlement',async()=>{
 const f=fixture();try{const x=create();await saveAccounting(f.db,1,x,'qa');await assert.rejects(saveAccounting(f.db,1,{...x,amount:200},'qa'),/already/);await assert.rejects(saveAccounting(f.db,2,settle(x.id,10,'2026-10-02'),'qa'),/not found/);await assert.rejects(saveAccounting(f.db,1,create({paidAmount:101,paymentDate:'2026-10-01',method:'Cash'}),'qa'),/initial payment/);}finally{f.close();}
});
test('valid backdated deposit mutations remain allowed and sub-cent initial payments are rejected',async()=>{
 const f=fixture();try{const x=create({kind:'Security deposit',category:'Security deposits',amount:200,paidAmount:100,paymentDate:'2026-10-01',method:'Cash'});await saveAccounting(f.db,1,x,'qa');await saveAccounting(f.db,1,settle(x.id,50,'2026-10-10',{direction:'refund'}),'qa');await saveAccounting(f.db,1,settle(x.id,20,'2026-10-05',{direction:'refund'}),'qa');assert.equal(f.db.db.prepare('SELECT sum(amount) n FROM transactions WHERE record_id=?').get(x.id).n,3000);await assert.rejects(saveAccounting(f.db,1,create({paidAmount:0.001,paymentDate:'2026-10-01',method:'Cash'}),'qa'),/initial payment/);}finally{f.close();}
});
test('date repair is a reviewed dry-run by default and applies an audited idempotent correction',async()=>{
 const {spawnSync}=await import('node:child_process');const f=fixture();try{const id=randomUUID(),created='2026-10-28T01:30:00.000Z';f.db.db.prepare('INSERT INTO transactions(id,property_id,date,created,kind,amount,currency,booking,guest,description,actor) VALUES(?,1,?,?,?,?,?,?,?,?,?)').run(id,'2026-10-28',created,'Payment',1234,'USD','B1','QA Guest','Reservation payment recorded','qa');const tool=new URL('../tools/repair-reservation-dates.mjs',import.meta.url).pathname;
 const path=f.db.db.prepare('PRAGMA database_list').get().file;
 const run=extra=>spawnSync(process.execPath,[tool,'--database',path,...extra],{encoding:'utf8'});
 const dry=run([]);assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).corrections[0].correctedDate,'2026-10-27');assert.equal(f.db.db.prepare('SELECT date FROM transactions WHERE id=?').get(id).date,'2026-10-28');
 assert.notEqual(run(['--apply']).status,0);
 const applied=run(['--apply','--id',id]);assert.equal(applied.status,0,applied.stderr);const row=f.db.db.prepare('SELECT * FROM transactions WHERE id=?').get(id);assert.equal(row.date,'2026-10-27');assert.equal(row.amount,1234);assert.equal(row.created,created);assert.equal(f.db.db.prepare("SELECT count(*) n FROM activity_log WHERE event='accounting.reservation-date-corrected'").get().n,1);
 const retry=run(['--apply','--id',id]);assert.equal(retry.status,0,retry.stderr);assert.deepEqual(JSON.parse(retry.stdout).alreadyCorrect,[id]);assert.equal(f.db.db.prepare('SELECT count(*) n FROM accounting_audit').get().n,1);
 }finally{f.close();}
});
