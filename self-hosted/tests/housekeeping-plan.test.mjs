import {test} from 'node:test';
import assert from 'node:assert/strict';
import {housekeepingPlan} from '../runtime/housekeeping-plan.mjs';
const date='2026-10-14';
const room=(id,housekeeping='Dirty')=>({id,housekeeping});
const booking=(room,arrival,departure,status='Confirmed')=>({room,arrival,departure,status});
test('arrival rooms precede departing rooms and routine cleaning',()=>{
 const state={rooms:[room('10'),room('3'),room('2')],bookings:[booking('2',date,'2026-10-16'),booking('3','2026-10-12',date,'Checked out')]};
 assert.deepEqual(housekeepingPlan(state,date).map(t=>[t.room,t.reason]),[['2','Ready before arrival'],['3','Cleaning after departure'],['10','Cleaning needed']]);
});
test('clean rooms remain in the overview but are not cleaning tasks; unavailable rooms are excluded',()=>{
 assert.deepEqual(housekeepingPlan({rooms:[room('1','Clean'),room('2','Out of service')],bookings:[booking('1',date,'2026-10-16')]},date),[]);
});
test('checked-in departures remain pending even if room is currently clean',()=>{
 const tasks=housekeepingPlan({rooms:[room('1','Clean')],bookings:[booking('1','2026-10-12',date,'Checked in')]},date);
 assert.equal(tasks[0].occupied,true);assert.equal(tasks[0].reason,'Cleaning after departure');
});
test('cancelled arrivals and other dates do not create arrival priority',()=>{
 const tasks=housekeepingPlan({rooms:[room('1'),room('2','In progress')],bookings:[booking('1',date,'2026-10-16','Cancelled'),booking('2','2026-10-15','2026-10-17')]},date);
 assert.ok(tasks.every(t=>t.reason==='Cleaning needed'));
});
test('turnover rooms have one task and flag a guest who has not checked out',()=>{
 const tasks=housekeepingPlan({rooms:[room('1')],bookings:[booking('1','2026-10-12',date,'Checked in'),booking('1',date,'2026-10-16')]},date);
 assert.equal(tasks.length,1);assert.equal(tasks[0].priority,0);assert.equal(tasks[0].occupied,true);
});
test('room identifiers sort naturally within the same priority',()=>{
 assert.deepEqual(housekeepingPlan({rooms:[room('10'),room('2'),room('1')],bookings:[]},date).map(t=>t.room),['1','2','10']);
});
