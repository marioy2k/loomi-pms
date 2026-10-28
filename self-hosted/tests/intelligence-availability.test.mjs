import test from 'node:test';
import assert from 'node:assert/strict';
import helper from './helpers/load-ts.cjs';
const {localQuestionPlan,answerQuestion}=helper.loadTs('lib/intelligence.ts');
const owner={role:'owner',email:'qa@example.test',name:'QA',permissions:[],propertyIds:null};
const today='2026-10-28';
const room=(id,housekeeping='Clean')=>({id,type:'Standard',rate:100,housekeeping});
const booking=(id,patch={})=>({id,room:id,guest:'Private Guest',arrival:'2026-10-27',departure:'2026-10-30',status:'Checked in',rate:100,paid:0,...patch});
const context={today,state:{hotel:'QA',currency:'USD',rooms:[room('101'),room('102'),room('103'),room('104','Dirty'),room('105','Out of service'),room('106'),room('107')],bookings:[booking('101'),booking('102',{departure:today}),booking('103',{status:'Cancelled'}),booking('107',{arrival:'2026-10-29',departure:'2026-10-30',status:'Confirmed'})]},operations:[{kind:'maintenance',data:{room:'106',block:true,status:'Open',from:today,to:'2026-10-30'}}],issues:[],assignments:[],items:[],movements:[],feedback:[]};
test('common Dutch and English questions recognize room availability and relative dates',()=>{
 for(const q of ['hoeveel kamers zijn vandaag vrij','Welke kamers zijn beschikbaar vandaag?','How many rooms are available today?','Any vacant rooms today?'])assert.deepEqual(localQuestionPlan(q,today),{intent:'availability',from:today,to:today,search:''});
 assert.equal(localQuestionPlan('Welke kamers zijn overmorgen vrij?',today).from,'2026-10-30');
 assert.equal(localQuestionPlan('Available rooms tomorrow?',today).from,'2026-10-29');
 assert.equal(localQuestionPlan('Welke saldi staan open?',today).intent,'balances');
});
test('availability excludes stays, maintenance and out-of-service rooms; checkout today releases the room',()=>{
 const answer=answerQuestion(context,owner,localQuestionPlan('hoeveel kamers zijn vandaag vrij',today));assert.equal(answer.count,4);assert.deepEqual(answer.rooms.map(r=>r.room),['102','103','104','107']);assert.equal(answer.rooms.find(r=>r.room==='104').ready,false);assert(answer.references.every(r=>r.kind==='room'));assert(!JSON.stringify(answer).includes('Private Guest'));assert(!JSON.stringify(answer).includes('nightlyRate'));
 const tomorrow=answerQuestion(context,owner,localQuestionPlan('Welke kamers zijn morgen vrij?',today));assert.equal(tomorrow.count,3);assert(!tomorrow.rooms.some(r=>r.room==='107'));
 const range=answerQuestion(context,owner,localQuestionPlan('Vrije kamers 2026-10-28 tot 2026-10-29',today));assert.equal(range.count,3);
});
test('availability honors module permissions and validates the requested date range',()=>{
 const plan=localQuestionPlan('Vrije kamers vandaag?',today);assert.throws(()=>answerQuestion(context,{...owner,role:'employee',permissions:[]},plan),/permission/);assert.throws(()=>answerQuestion(context,owner,{...plan,from:'2026-02-30'}),/valid date range/);
 const overview={...owner,role:'employee',permissions:['overview']};assert.equal(answerQuestion(context,overview,plan).count,4);
});
