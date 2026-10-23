import {Invoice,invoiceHTML} from '@/lib/invoices';

// Print a complete document outside the scrollable dialog and app print styles.
export function printInvoice(invoice:Invoice,locale='en'){
 const frame=document.createElement('iframe');
 frame.title=invoice.number;
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:1000px;height:1px;border:0';
 frame.onload=async()=>{
  const target=frame.contentWindow,doc=frame.contentDocument;
  if(!target||!doc){frame.remove();return;}
  await Promise.all(Array.from(doc.images).map(img=>img.decode().catch(()=>{})));
  await doc.fonts.ready;
  target.addEventListener('afterprint',()=>setTimeout(()=>frame.remove(),1000),{once:true});
  target.focus();
  target.print();
 };
 frame.srcdoc=invoiceHTML(invoice,locale);
 document.body.appendChild(frame);
}
