export function cashPayment(total,alreadyPaid,received){
 const cents=value=>Math.round(Math.max(0,Number(value)||0)*100);
 const due=Math.max(0,cents(total)-cents(alreadyPaid));
 const cash=cents(received),applied=Math.min(due,cash);
 return {due:due/100,applied:applied/100,change:Math.max(0,cash-applied)/100,remaining:(due-applied)/100,paid:(cents(alreadyPaid)+applied)/100};
}
