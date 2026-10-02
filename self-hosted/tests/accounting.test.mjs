import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
import {Store} from '../runtime/core.mjs';
const dir=mkdtempSync(join(tmpdir(),'loomi-accounting-'));
for(const name of ['company','pms','accounting-reports','accounting-service']){const src=readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8').replaceAll('@/lib/company','./company.mjs').replaceAll("@/lib/pms",'./pms.mjs').replaceAll('@/lib/accounting-reports','./accounting-reports.mjs');writeFileSync(join(dir,name+'.mjs'),ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
const {buildReports}=await import(join(dir,'accounting-reports.mjs'));
const {saveAccounting}=await import(join(dir,'accounting-service.mjs'));
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const state={hotel:'Test',currency:'USD',rooms:[],bookings:[]};
test('accrual nights cross months, advance payments and deposits stay outside profit',()=>{
 const booking={id:'B1',arrival:'2026-01-30',departure:'2026-02-03',rate:100,paid:400,status:'Checked out'};
 const properties=[{id:1,state:{...state,bookings:[booking,{...booking,id:'B2',arrival:'2026-03-01',departure:'2026-03-03',paid:200,status:'Confirmed'}]}},{id:2,state:{...state,currency:'EUR',bookings:[booking]}}];
 const records=[{id:'expense',kind:'Expense',category:'Utilities',amount:5000,currency:'USD',date:'2026-02-01'},{id:'deposit',kind:'Security deposit',amount:10000,currency:'USD',date:'2026-01-01'},{id:'credit',kind:'Expense credit',category:'Utilities',amount:1000,currency:'USD',date:'2026-02-02'}];
 const cash=[{property_id:1,booking:'B1',kind:'Opening balance',amount:40000,currency:'USD',date:'2026-01-01'},{property_id:1,booking:'B2',kind:'Payment',amount:20000,currency:'USD',date:'2026-02-01'},{record_id:'deposit',kind:'Deposit received',amount:10000,currency:'USD',date:'2026-02-01'}];
 const r=buildReports(properties,records,cash,'USD','2026-01-01','2026-02-28','2026-02-10');
 assert.equal(r.totalIncome,40000);assert.equal(r.totalExpenses,4000);assert.equal(r.profit,36000);assert.equal(r.netCash,30000);assert.equal(r.securityDeposits,10000);assert.equal(r.advances,20000);assert.deepEqual(r.months.map(x=>x.income),[20000,20000]);assert.equal(r.unpaid.find(x=>x.id==='expense').outstanding,5000);
 const feb=buildReports(properties,records,cash,'USD','2026-02-01','2026-02-28','2026-02-10');assert.equal(feb.totalIncome,20000);
});
test('records and settlements are idempotent; partial bills, caps, refunds and date validation',async()=>{
 const s=new Store(join(dir,'db.sqlite'),'drizzle');s.db.prepare('INSERT INTO property(id,data) VALUES (?,?)').run(1,JSON.stringify(state));
 const create=(kind,amount=100)=>({action:'create-record',id:randomUUID(),date:'2026-01-01',kind,category:kind==='Security deposit'?'Security deposits':'Utilities',amount,currency:'USD',description:'Test bill',party:'Supplier',paidAmount:0});
 const settle=(r,amount,date='2026-01-02',direction='receive')=>({action:'settle-record',id:randomUUID(),recordId:r.id,date,amount,method:'Cash',direction});
 try{const r=create('Expense');await saveAccounting(s,1,r,'owner');await saveAccounting(s,1,r,'owner');assert.equal(s.db.prepare('SELECT count(*) n FROM accounting_records').get().n,1);
 const p=settle(r,40);await saveAccounting(s,1,p,'owner');await saveAccounting(s,1,p,'owner');await assert.rejects(saveAccounting(s,1,settle(r,61),'owner'),/exceeds/);await saveAccounting(s,1,settle(r,60),'owner');assert.equal(s.db.prepare('SELECT SUM(amount) n FROM transactions').get().n,-10000);
 const d=create('Security deposit');await saveAccounting(s,1,d,'owner');await saveAccounting(s,1,settle(d,100,'2026-01-03'),'owner');await assert.rejects(saveAccounting(s,1,settle(d,10,'2026-01-02','refund'),'owner'),/exceeds/);await saveAccounting(s,1,settle(d,60,'2026-01-04','refund'),'owner');await assert.rejects(saveAccounting(s,1,settle(d,41,'2026-01-05','refund'),'owner'),/exceeds/);
 await assert.rejects(saveAccounting(s,1,settle(d,1,'2099-01-01'),'owner'),/valid/);await assert.rejects(saveAccounting(s,2,r,'owner'),/not found/);
 const initial={...create('Expense'),paidAmount:25,paymentDate:'2026-01-01',method:'Card'};await saveAccounting(s,1,initial,'owner');await saveAccounting(s,1,initial,'owner');assert.equal(s.db.prepare('SELECT amount FROM transactions WHERE record_id=?').get(initial.id).amount,-2500);await assert.rejects(saveAccounting(s,1,{...initial,paidAmount:30},'owner'),/differs/);
 const [records,cash]=[s.db.prepare('SELECT * FROM accounting_records').all(),s.db.prepare('SELECT * FROM transactions').all()];const report=buildReports([{id:1,state}],records,cash,'USD','2026-01-01','2026-01-31','2026-01-31');assert.equal(report.totalExpenses,20000);assert.equal(report.securityDeposits,4000);assert.equal(report.netCash,-8500);
 }finally{s.db.close();}
});
