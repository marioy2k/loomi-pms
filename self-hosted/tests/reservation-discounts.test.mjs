import test from 'node:test';
import assert from 'node:assert/strict';
import helper from './helpers/load-ts.cjs';
const {loadTs}=helper;
const {bookingTotalCents,bookingDiscountCents,validateState}=loadTs('lib/pms.ts');
const {reservationInvoice}=loadTs('lib/invoices.ts');
const {authorizeUpdate}=loadTs('lib/authorize.ts');
const {buildReports,guestBalanceRows}=loadTs('lib/accounting-reports.ts');
const {applyBookingPolicies}=loadTs('lib/booking-policy.ts');
const {policyAmounts}=loadTs('lib/operations.ts');
const booking={id:'B1',guest:'Guest',email:'guest@example.test',phone:'',room:'R1',arrival:'2026-10-30',departure:'2026-11-02',status:'Checked in',rate:100,paid:50,paymentMethod:'Card',notes:'',currency:'EUR'};
const state={hotel:'Test',currency:'USD',rooms:[{id:'R1',type:'Standard',rate:100,housekeeping:'Clean'}],bookings:[booking]};
const withBooking=b=>({...state,bookings:[b]});
test('Percentage and fixed stay discounts agree across invoices and balances in reservation currency',()=>{
 for(const discount of [{type:'percentage',value:10},{type:'fixed',value:30}]){
  const b={...booking,discount},s=withBooking(b);
  assert.doesNotThrow(()=>validateState(s));
  assert.equal(bookingTotalCents(b),27000);
  const invoice=reservationInvoice(s,b,[],1);
  assert.equal(invoice.currency,'EUR');assert.equal(invoice.total,27000);assert.equal(invoice.outstanding,22000);
  assert.deepEqual(invoice.lines.map(l=>l.amount),[30000,-3000]);
  assert.equal(guestBalanceRows([{id:1,state:s}],[],[],'EUR')[0].outstanding,22000);
  assert.equal(buildReports([{id:1,state:s}],[],[],'EUR','','','2026-11-03').guestOutstanding,22000);
  assert.equal(reservationInvoice(s,{...b,paid:300},[],1).accommodationCredit,3000);
 }
 assert.equal(bookingTotalCents(booking),30000);
});
test('Reject malformed, negative, nonfinite and excessive discounts; allow free stays',()=>{
 for(const discount of [null,{}, {type:'other',value:2},{type:'percentage',value:-1},{type:'percentage',value:101},{type:'fixed',value:300.01},{type:'fixed',value:Infinity},{type:'fixed',value:'10'}]){
  assert.throws(()=>validateState(withBooking({...booking,discount})),/discount/);
 }
 for(const discount of [{type:'percentage',value:100},{type:'fixed',value:300}])assert.equal(bookingTotalCents({...booking,discount}),0);
 assert.equal(bookingDiscountCents({...booking,rate:0.05,discount:{type:'percentage',value:10}}),2);
});
test('Discount changes require nightly-rate permission, including creation and removal',()=>{
 const employee={role:'employee',email:'test@example.test',name:'Test',permissions:['reservations'],propertyIds:[1]};
 const discounted=withBooking({...booking,discount:{type:'fixed',value:30}});
 assert.throws(()=>authorizeUpdate(employee,state,discounted),/permission/);
 assert.throws(()=>authorizeUpdate(employee,discounted,state),/permission/);
 assert.throws(()=>authorizeUpdate(employee,{...state,bookings:[]},discounted),/permission/);
 assert.doesNotThrow(()=>authorizeUpdate({...employee,permissions:['bookingRates']},state,discounted));
 assert.doesNotThrow(()=>authorizeUpdate(employee,discounted,withBooking({...discounted.bookings[0],notes:'Updated'})));
});
test('Discounted income allocates exact cents across month boundaries and partial stays',()=>{
 const b={...booking,discount:{type:'fixed',value:0.01}},properties=[{id:1,state:withBooking(b)}];
 const report=(from,to,asOf='2026-11-03')=>buildReports(properties,[],[],'EUR',from,to,asOf);
 assert.equal(report('','').totalIncome,29999);
 assert.equal(report('2026-10-01','2026-10-31').totalIncome+report('2026-11-01','2026-11-30').totalIncome,29999);
 assert.equal(report('','','2026-10-31').totalIncome,10000);
 assert.deepEqual(report('','').months.map(m=>m.income),[19999,10000]);
});
test('Deposits and cancellation fees use the discounted stay; cancellation invoice applies no second discount',()=>{
 const policy={depositPercent:25,cancellationPercent:50,freeCancellationDays:7,terms:''};
 const b={...booking,discount:{type:'fixed',value:60},policy};
 assert.deepEqual(policyAmounts(b,policy),{total:24000,depositDue:6000,cancellationFee:12000});
 const next=applyBookingPolicies(withBooking(b),withBooking({...b,status:'Cancelled'}),policy,'2026-10-29');
 assert.equal(next.bookings[0].cancellationFee,120);
 assert.equal(reservationInvoice(next,next.bookings[0],[],1).total,12000);
});
