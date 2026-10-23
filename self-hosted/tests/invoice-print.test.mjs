import test from 'node:test';
import assert from 'node:assert/strict';
import helper from './helpers/load-ts.cjs';
const {reservationInvoice,invoiceHTML,invoiceText,invoiceDetails}=helper.loadTs('lib/invoices.ts');
const {printInvoice}=helper.loadTs('lib/print-invoice.ts');
const booking={id:'PRINT-QA',guest:'Test Guest',email:'guest@example.test',phone:'+597 123456',room:'101',arrival:'2026-10-23',departure:'2026-10-26',status:'Checked in',rate:100,paid:50,paymentMethod:'Card',notes:'Internal note'};
const state={hotel:'Test Hotel',currency:'USD',rooms:[{id:'101',type:'Deluxe'}],bookings:[booking],company:{address:'Test address',invoiceNotes:'Last page terms',paymentDetails:'Last page bank details'}};
test('print and download contain guest, stay, employee, totals and footer details',()=>{
 const invoice={...reservationInvoice(state,booking,[],1),handledBy:'Medewerker <Test>'};
 for(const render of [invoiceText,invoiceHTML]){
  const output=render(invoice,'nl');
  for(const value of ['+597 123456','2026-10-23','2026-10-26','101','Deluxe','Last page terms','Last page bank details'])assert.ok(output.includes(value),value);
  assert.ok(output.includes('Geholpen door (ingelogde medewerker)'));
  assert.ok(!output.includes('Internal note'));
 }
 const html=invoiceHTML(invoice,'nl');assert.ok(html.includes('Medewerker &lt;Test&gt;'));assert.ok(!html.includes('Medewerker <Test>'));
 assert.equal(invoice.total,30000);assert.equal(invoice.paid,5000);assert.equal(invoice.outstanding,25000);
 assert.ok(!invoiceDetails({...invoice,handledBy:undefined,phone:undefined}).some(([key])=>key==='Phone'||key.startsWith('Handled by')));
});
test('print uses its complete HTML document and waits for images before printing',async()=>{
 const invoice={...reservationInvoice(state,booking,[],1),handledBy:'Test medewerker'};
 let printed=false,afterPrint,loaded=false;
 const frame={style:{},remove(){},contentDocument:{images:[{async decode(){loaded=true}}],fonts:{ready:Promise.resolve()}},contentWindow:{addEventListener(event,callback){assert.equal(event,'afterprint');afterPrint=callback},focus(){},print(){assert.ok(loaded);printed=true}}};
 const original=globalThis.document;
 globalThis.document={createElement(tag){assert.equal(tag,'iframe');return frame},body:{appendChild(element){assert.equal(element,frame)}}};
 try{printInvoice(invoice,'nl');assert.equal(frame.srcdoc,invoiceHTML(invoice,'nl'));await frame.onload();assert.ok(printed);assert.equal(typeof afterPrint,'function')}finally{globalThis.document=original}
});
