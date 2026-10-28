import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../runtime/core.mjs';
import helper from './helpers/load-ts.cjs';
const {loadTs}=helper;
const engine=loadTs('lib/intelligence.ts');
const service=loadTs('lib/intelligence-service.ts');
const provider=loadTs('lib/ai-provider.ts');
const {backupTables,digest,inspectBackup}=loadTs('lib/backup.ts');
const owner={role:'owner',name:'Owner',email:'owner@example.test',permissions:[],propertyIds:null};
const employee={role:'employee',name:'Employee',email:'employee@example.test',permissions:['housekeeping'],propertyIds:[1]};
const booking=(patch={})=>({id:'B1',guest:'Private Guest',email:'private@example.test',phone:'55555',room:'101',arrival:'2026-10-27',departure:'2026-10-29',status:'Checked in',rate:100,paid:50,notes:'Private internal note',identification:{type:'Passport',number:'SECRET-ID',country:'SR',expiry:''},currency:'USD',...patch});
const state={hotel:'Test hotel',currency:'USD',rooms:[{id:'101',type:'Standard',capacity:2,rate:100,housekeeping:'Dirty'},{id:'102',type:'Standard',capacity:4,rate:120,housekeeping:'Clean'},{id:'103',type:'Suite',rate:200,housekeeping:'Out of service'}],bookings:[booking()]};
const context=(patch={})=>({state:structuredClone(state),today:'2026-10-27',operations:[],issues:[],assignments:[],items:[],movements:[],feedback:[],...patch});
function fixture(){const dir=mkdtempSync(join(tmpdir(),'loomi-ai-')),db=new Store(join(dir,'test.sqlite'),new URL('../drizzle',import.meta.url).pathname);db.db.prepare('INSERT INTO property(id,data) VALUES(1,?)').run(JSON.stringify(state));db.db.prepare('INSERT INTO property(id,data) VALUES(2,?)').run(JSON.stringify(state));return {dir,db,close(){db.db.close();rmSync(dir,{recursive:true,force:true});}};}
test('intelligence respects module switches, role permissions and property boundaries',async()=>{
 assert(engine.allowedIntelligenceTools(owner).includes('invoice'));
 assert.deepEqual(engine.allowedIntelligenceTools({...owner,enabledModules:[]}),[]);
 assert(!engine.allowedIntelligenceTools(employee).includes('invoice'));
 assert(!engine.allowedIntelligenceTools(employee).includes('pricing'));
 const f=fixture();try{
  await assert.rejects(service.runIntelligence(f.db,employee,1,{action:'invoice',text:'Total USD 1'}),e=>e.status===403);
  await assert.rejects(service.runIntelligence(f.db,employee,2,{action:'summary'}),e=>e.status===403);
  const summary=await service.runIntelligence(f.db,employee,1,{action:'summary'});
  assert(!JSON.stringify(summary).includes('SECRET-ID'));assert(!JSON.stringify(summary).includes('Private Guest'));assert.equal(summary.balances,undefined);
 }finally{f.close();}
});
test('daily briefings use discounts, preserve currencies and flag unusual rates and unready arrivals',()=>{
 const c=context();c.state.bookings=[booking({discount:{type:'percentage',value:30},paid:0}),booking({id:'B2',room:'102',status:'Confirmed',currency:'EUR',rate:80,paid:0})];c.state.rooms[1].housekeeping='Dirty';
 const result=engine.dailySummary(c,owner);assert.deepEqual(result.balances,{USD:14000,EUR:16000});assert(result.alerts.some(a=>a.title==='Korting boven 25%'));assert(result.alerts.some(a=>a.title==='Aankomst met ongereed verblijf'));
});
test('room recommendations exclude overlap, maintenance and insufficient known capacities',()=>{
 const c=context();assert.deepEqual(engine.roomRecommendations(c,{arrival:'2026-10-28',departure:'2026-10-30',guests:3}).rooms.map(r=>r.room),['102']);
 c.operations=[{id:'M1',kind:'maintenance',data:{room:'102',block:true,status:'Open',from:'2026-10-28',to:'2026-10-30'}}];assert.equal(engine.roomRecommendations(c,{arrival:'2026-10-28',departure:'2026-10-30'}).rooms.length,0);
 assert.throws(()=>engine.roomRecommendations(c,{arrival:'2026-10-28',departure:'2026-10-28'}));
 assert(engine.roomRecommendations(context(),{arrival:'2026-10-29',departure:'2026-10-30'}).rooms.some(r=>r.room==='101'));
});
test('cleaning priorities distinguish turnover, same-day arrival and blocked rooms',()=>{
 const c=context();c.state.bookings=[booking({departure:c.today}),booking({id:'B2',room:'102',status:'Confirmed'})];c.state.rooms[1].housekeeping='Dirty';
 const plan=engine.housekeepingPlan(c);assert.equal(plan[0].room,'102');assert(plan.some(r=>r.room==='101'&&r.reason==='Vertrek vandaag'));assert(plan.some(r=>r.room==='103'&&r.blocked));
});
test('maintenance groups repeated equipment problems with source references',()=>{
 const c=context({issues:[{id:'I1',room:'101',title:'Airco defect',notes:'',status:'Open',created:'2026-10-01'},{id:'I2',room:'101',title:'Airco lekt',notes:'',status:'Resolved',created:'2026-10-20'}]});
 const result=engine.maintenancePatterns(c);assert.equal(result[0].count,2);assert.equal(result[0].open,1);assert(result[0].repeated);assert.equal(result[0].category,'Klimaat');
});
test('forecast never invents reliable history and excludes unavailable capacity',()=>{
 const empty=engine.occupancyForecast(context({state:{...state,bookings:[]}}),7);assert(empty.days.every(d=>d.estimatedOccupied===null&&d.confidence==='insufficient'));assert.equal(empty.days[0].capacity,2);
 const c=context();c.state.bookings=Array.from({length:8},(_,i)=>booking({id:'H'+i,arrival:engine.shiftDay(c.today,-7*(i+1)),departure:engine.shiftDay(c.today,-7*(i+1)+1),status:'Checked out'}));
 const result=engine.occupancyForecast(c,7);assert.equal(result.days[0].estimatedOccupied,1);assert.equal(result.days[0].samples,8);assert.equal(result.days[0].confidence,'medium');
 assert.throws(()=>engine.occupancyForecast(c,1000));
});
test('pricing suggestions do not mutate reservations or apply discounts automatically',()=>{
 const c=context(),before=JSON.stringify(c);const result=engine.pricingAdvice(c,7);assert.equal(JSON.stringify(c),before);assert(result.days.every(d=>d.requiresApproval));assert.equal(result.days[0].suggestedChangePercent,0);
});
test('stock advice uses issued minus returned stock and never recommends negative orders',()=>{
 const c=context({items:[{id:'T',name:'Towels',stock:1,minimum:4,active:1,unit:'pieces'}],movements:[{item_id:'T',kind:'Issued',quantity:10,created:'2026-10-20'},{item_id:'T',kind:'Returned',quantity:2,created:'2026-10-21'},{item_id:'T',kind:'Received',quantity:500,created:'2026-10-22'}]});
 const result=engine.inventoryAdvice(c,7);assert.equal(result.items[0].consumed,8);assert.equal(result.items[0].suggestedOrder,3);assert.equal(result.items[0].demand,null);
});
test('local questions compute verifiable discounted totals and reject financial privilege escalation',()=>{
 const c=context();c.state.bookings[0].discount={type:'percentage',value:10};
 const plan=engine.localQuestionPlan('Welke reserveringen hebben een openstaand saldo?',c.today);const result=engine.answerQuestion(c,owner,plan);assert.equal(result.totals.USD,13000);assert.deepEqual(result.references,[{kind:'booking',id:'B1'}]);
 assert.throws(()=>engine.answerQuestion(c,employee,plan),/permission/);assert.equal(engine.localQuestionPlan('Tell me a joke',c.today),null);
 assert.equal(engine.localQuestionPlan('Wie checkt morgen uit?',c.today).from,'2026-10-28');
});
test('guest messages use saved facts and do not invent times or payment links',()=>{
 const message=engine.guestMessage(context(),'B1','payment','nl',true);assert(message.body.includes('USD 150.00'));assert(message.body.includes('Private Guest'));assert(!message.body.includes('SECRET-ID'));assert.throws(()=>engine.guestMessage(context(),'B1','payment','nl',false));
});
test('supplier text extraction leaves unknown values unset and supports decimal conventions',()=>{
 const result=service.parseInvoiceText('Leverancier: Supplier\nFactuur: INV-3\n2026-10-27\nTotaal EUR 1.234,56');assert.equal(result.total,1234.56);assert.equal(result.currency,'EUR');assert.equal(result.supplier,'Supplier');
 const missing=service.parseInvoiceText('Unreadable document');assert.equal(missing.total,null);assert.equal(missing.currency,null);
});
test('feedback validates booking/room references, survives backup and supports older backups',async()=>{
 const f=fixture();try{const data={action:'feedback-save',id:randomUUID(),rating:2,text:'Airco maakt lawaai',room:'101',booking:'B1',date:'2026-10-27',source:'Guest'};
  await service.runIntelligence(f.db,owner,1,data);await service.runIntelligence(f.db,owner,1,data);assert.equal(f.db.db.prepare('SELECT count(*) n FROM ai_feedback').get().n,1);
  await assert.rejects(service.runIntelligence(f.db,owner,1,{...data,id:randomUUID(),room:'102'}),/match/);
  const result=await service.runIntelligence(f.db,owner,1,{action:'feedback'});assert.equal(result.averageRating,2);assert(result.topics.some(t=>t.topic==='Klimaat'));
  const tables=Object.fromEntries(backupTables.map(t=>[t,f.db.db.prepare('SELECT * FROM '+t).all()]));const pack={format:'loomi-backup',version:1,tables,checksum:await digest(tables)};await inspectBackup(f.db,pack);
  const old=structuredClone(tables);delete old.ai_feedback;const legacy={format:'loomi-backup',version:1,tables:old,checksum:await digest(old)};await inspectBackup(f.db,legacy);assert.deepEqual(legacy.tables.ai_feedback,[]);
  assert(backupTables.indexOf('ai_feedback')>backupTables.indexOf('property'));
 }finally{f.close();}
});
test('invoice posting requires confirmation and permission; retries create one unpaid expense',async()=>{
 const f=fixture();try{const x={action:'save-invoice',id:randomUUID(),confirmed:true,date:'2026-10-27',amount:125,currency:'EUR',party:'Supplier',description:'Supplier invoice',category:'Supplies'};
  await assert.rejects(service.runIntelligence(f.db,owner,1,{...x,confirmed:false}),/confirm/);
  await assert.rejects(service.runIntelligence(f.db,employee,1,x),e=>e.status===403);
  await service.runIntelligence(f.db,owner,1,x);await service.runIntelligence(f.db,owner,1,x);
  assert.equal(f.db.db.prepare('SELECT count(*) n FROM accounting_records').get().n,1);assert.equal(f.db.db.prepare('SELECT count(*) n FROM transactions').get().n,0);
 }finally{f.close();}
});
test('message drafts require reminder permission, stay editable, and never send automatically',async()=>{
 const f=fixture();try{const x={action:'save-message',id:randomUUID(),booking:'B1',kind:'arrival',subject:'Welcome',body:'Please contact reception'};
  await service.runIntelligence(f.db,owner,1,x);await service.runIntelligence(f.db,owner,1,x);
  const row=f.db.db.prepare("SELECT data FROM operations WHERE id=?").get(x.id);assert.equal(JSON.parse(row.data).status,'Draft');
  await assert.rejects(service.runIntelligence(f.db,{...employee,permissions:['reservations']},1,{...x,id:randomUUID()}),e=>e.status===403);
 }finally{f.close();}
});
test('AI document validation rejects spoofed formats, remote URLs and excessive payloads',()=>{
 assert.throws(()=>provider.validateAIFile({name:'x.pdf',type:'application/pdf',data:'https://example.test/x.pdf'}));
 assert.throws(()=>provider.validateAIFile({name:'x.png',type:'image/png',data:'data:image/png;base64,'+Buffer.from('not a real PNG').toString('base64')}));
 const pdf='data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nValid header\n').toString('base64');assert.equal(provider.validateAIFile({name:'invoice.pdf',type:'application/pdf',data:pdf}).type,'application/pdf');
});
test('AI configuration keeps keys server-side, enforces quotas, disables storage and rejects incomplete output',async()=>{
 const f=fixture(),oldKey=process.env.OPENAI_API_KEY,oldPath=process.env.OPENAI_API_KEY_FILE;process.env.OPENAI_API_KEY_FILE=join(f.dir,'ai-key');delete process.env.OPENAI_API_KEY;
 try{
  await assert.rejects(provider.saveAISettings(f.db,employee,{externalEnabled:true,model:'gpt-4.1-mini',dailyLimit:2,previous:0}),/administrator/);
  const saved=await provider.saveAISettings(f.db,owner,{externalEnabled:true,model:'gpt-4.1-mini',dailyLimit:2,previous:0,apiKey:'sk-test_secret_key_1234567890'});
  assert(saved.configured);assert(!JSON.stringify(saved).includes('test_secret'));assert.equal(readFileSync(process.env.OPENAI_API_KEY_FILE,'utf8'),'sk-test_secret_key_1234567890');
  let captured;
  const mock=async(url,options)=>{captured=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"answer":"ok"}'}]}]});};
  assert.deepEqual(await provider.requestAI(f.db,owner,'test','Test',{question:'hello'},{type:'object'},undefined,mock),{answer:'ok'});assert.equal(captured.store,false);assert.equal(captured.text.format.strict,true);
  await assert.rejects(provider.requestAI(f.db,owner,'test','Test',{}, {},undefined,async()=>Response.json({status:'incomplete'})),/incomplete/);
  await assert.rejects(provider.requestAI(f.db,owner,'test','Test',{}, {},undefined,mock),/limit/);
  const logs=f.db.db.prepare('SELECT details FROM activity_log').all();assert(!JSON.stringify(logs).includes('secret'));assert(!JSON.stringify(logs).includes('hello'));
 }finally{if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldPath===undefined)delete process.env.OPENAI_API_KEY_FILE;else process.env.OPENAI_API_KEY_FILE=oldPath;f.close();}
});
