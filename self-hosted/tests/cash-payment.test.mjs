import test from 'node:test';
import assert from 'node:assert/strict';
import {cashPayment} from '../runtime/cash-payment.mjs';
test('80 cash for a 75 stay records 75 and returns 5',()=>assert.deepEqual(cashPayment(75,0,80),{due:75,applied:75,change:5,remaining:0,paid:75}));
test('deposits reduce the amount due; change is not overpayment',()=>assert.deepEqual(cashPayment(75,25,80),{due:50,applied:50,change:30,remaining:0,paid:75}));
test('partial and exact payments use cents without rounding drift',()=>{
 assert.deepEqual(cashPayment(75,0,50),{due:75,applied:50,change:0,remaining:25,paid:50});
 assert.equal(cashPayment(75,0,75).change,0);
 assert.equal(cashPayment(74.95,0,80).change,5.05);
 assert.deepEqual(cashPayment(75,75,80),{due:0,applied:0,change:80,remaining:0,paid:75});
});
