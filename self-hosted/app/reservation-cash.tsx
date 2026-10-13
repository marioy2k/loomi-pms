'use client';
import {useEffect,useState} from 'react';
import {cashPayment} from '@/runtime/cash-payment.mjs';
export default function ReservationCash({total,alreadyPaid,paid,currency,disabled,onPaid}:{total:number;alreadyPaid:number;paid:number;currency:string;disabled:boolean;onPaid:(value:number)=>void}){
 const [received,setReceived]=useState('');
 const valid=Number.isFinite(total)&&total>=0;
 const payment=cashPayment(total,alreadyPaid,received);
 const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value);
 // Stay/date changes recalculate the amount applied, while cash returned is never revenue.
 useEffect(()=>{if(received!==''&&valid&&!disabled&&paid!==payment.paid)onPaid(payment.paid)},[received,valid,disabled,paid,payment.paid,onPaid]);
 return <div className="full reservation-cash panel">
  <div className="section-heading"><h3>Cash payment</h3><span>Amount due: <strong>{money(payment.due)}</strong></span></div>
  <label>Cash received ({currency})<input type="number" min="0" max="100000000000" step="0.01" placeholder="Amount handed over by guest" disabled={disabled||!valid} value={received} onChange={e=>setReceived(e.target.value)} /></label>
  {received!==''&&valid&&<div className="cash-change-summary" role="status" aria-live="polite"><div><span>Payment applied</span><strong>{money(payment.applied)}</strong></div><div><span>Change to return</span><strong>{money(payment.change)}</strong></div>{payment.remaining>0&&<div><span>Remaining balance</span><strong>{money(payment.remaining)}</strong></div>}</div>}
  <small>Cash received applies to the outstanding accommodation balance. Change is returned to the guest and is not recorded as payment.</small>
 </div>;
}
