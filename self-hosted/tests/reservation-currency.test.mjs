import test from 'node:test';
import assert from 'node:assert/strict';
import helper from './helpers/load-ts.cjs';
const {loadTs}=helper;
const {bookingCurrency,bookingAmountsByCurrency,validateState}=loadTs('lib/pms.ts');
const {paymentChanges}=loadTs('lib/ledger.ts');
const {authorizeUpdate}=loadTs('lib/authorize.ts');
const {buildReports,guestBalanceRows}=loadTs('lib/accounting-reports.ts');
const {reservationInvoice}=loadTs('lib/invoices.ts');
const currencies=['USD','EUR','SRD'];
const rooms=currencies.map((_,i)=>({id:'R'+i,type:'Standard',rate:100,housekeeping:'Clean'}));
const bookings=currencies.map((currency,i)=>({id:'B'+i,guest:'Guest '+i,email:'guest'+i+'@example.test',phone:'',room:'R'+i,arrival:'2026-10-01',departure:'2026-10-03',status:'Checked in',rate:[100,80,3000][i],paid:[50,40,1000][i],paymentMethod:'Card',notes:'',currency}));
const state={hotel:'QA Hotel',currency:'USD',propertyType:'hotel',rooms,bookings};
const owner={role:'owner',name:'QA',email:'qa@example.test',permissions:[],propertyIds:null};
test('New reservation currencies validate; legacy reservations keep the property currency',()=>{
 assert.doesNotThrow(()=>validateState(state));
 assert.equal(bookingCurrency({...bookings[0],currency:undefined},state),'USD');
 assert.throws(()=>validateState({...state,bookings:[{...bookings[0],currency:'GBP'}]}),/Choose USD, EUR or SRD/);
 assert.throws(()=>validateState({...state,bookings:[{...bookings[1],rate:NaN}]}),/dates, room and amounts/);
 assert.deepEqual(bookingAmountsByCurrency(bookings,state,b=>b.paid),[['USD',50],['EUR',40],['SRD',1000]]);
});
test('Payments and refunds retain the reservation currency and exact cents',()=>{
 const rows=paymentChanges({...state,bookings:[]},state,'qa@example.test');
 assert.deepEqual(rows.map(r=>[r.currency,r.amount]),[['USD',5000],['EUR',4000],['SRD',100000]]);
 const next={...state,bookings:bookings.map(b=>b.id==='B1'?{...b,paid:20}:b)};
 assert.deepEqual(paymentChanges(state,next,'qa@example.test').map(r=>[r.currency,r.amount]),[['EUR',-2000]]);
 const legacy={...bookings[0],currency:undefined,paid:10};
 assert.equal(paymentChanges({...state,bookings:[legacy]},{...state,bookings:[{...legacy,paid:20}]},'qa')[0].currency,'USD');
});
test('Saved currency cannot be relabeled, even by an owner or with no paid balance',()=>{
 for(const paid of [0,40]){const old={...state,bookings:[{...bookings[1],paid}]};const next={...old,bookings:[{...old.bookings[0],currency:'SRD'}]};
 assert.throws(()=>authorizeUpdate(owner,old,next),/currency cannot be changed/);
 assert.throws(()=>paymentChanges(old,next,'qa'),/currency cannot be changed/);}
 const employee={...owner,role:'employee',permissions:['reservations'],propertyIds:[1]};
 assert.throws(()=>authorizeUpdate(employee,{...state,bookings:[]},{...state,bookings:[{...bookings[1],rate:100,paid:0}]}),/permission/);
});
test('Revenue and guest balances are grouped by booking currency, including foreign POS charges',()=>{
 const properties=[{id:1,state}];
 const records=[{id:'pos-order-QA-Food',property_id:1,booking:'B1',currency:'USD',amount:3000,date:'2026-10-02',kind:'Income',category:'Food',description:'Food',party:'Guest 1'}];
 const reports=currencies.map(currency=>buildReports(properties,records,[],currency,'2026-10-01','2026-10-31','2026-11-01'));
 assert.deepEqual(reports.map(r=>r.totalIncome),[23000,16000,600000]);
 assert.deepEqual(reports.map(r=>r.guestOutstanding),[18000,12000,500000]);
 const usd=guestBalanceRows(properties,records,[],'USD');
 assert.equal(usd.length,2);const euroGuest=usd.find(row=>row.booking.id==='B1');
 assert.equal(euroGuest.stayMatches,false);assert.equal(euroGuest.total,0);assert.equal(euroGuest.paid,0);assert.equal(euroGuest.outstanding,3000);
 assert.deepEqual(guestBalanceRows(properties,records,[],'EUR').map(r=>[r.total,r.paid,r.outstanding]),[[16000,4000,12000]]);
});
test('Invoices never add EUR accommodation to USD room charges',()=>{
 const order={id:'ORDER',booking:'B1',currency:'USD',status:'posted',items:[{name:'Lunch',quantity:1,price:3000}],paid:500,total:3000};
 const euro=reservationInvoice(state,bookings[1],[order],1);
 assert.equal(euro.currency,'EUR');assert.equal(euro.total,16000);assert.equal(euro.paid,4000);assert.equal(euro.outstanding,12000);
 assert.deepEqual(euro.availableCurrencies,['EUR','USD']);assert.equal(euro.lines.length,1);
 const usd=reservationInvoice(state,bookings[1],[order],1,'USD');
 assert.equal(usd.total,3000);assert.equal(usd.paid,500);assert.equal(usd.outstanding,2500);assert.equal(usd.lines[0].description,'Lunch · POS ORDER');
 assert.notEqual(usd.number,euro.number);
 const legacy=reservationInvoice(state,{...bookings[0],currency:undefined},[],1);
 assert.equal(legacy.currency,'USD');assert.equal(legacy.total,20000);assert.equal(legacy.number,'INV-1-B0');
});
