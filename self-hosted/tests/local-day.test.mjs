import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDayOffset} from '../runtime/local-day.mjs';
test('hotel dates use Paramaribo midnight rather than UTC midnight',()=>{
 assert.equal(localDayOffset(0,new Date('2026-10-13T01:00:00Z')),'2026-10-12');
 assert.equal(localDayOffset(0,new Date('2026-10-13T02:59:59Z')),'2026-10-12');
 assert.equal(localDayOffset(0,new Date('2026-10-13T03:00:00Z')),'2026-10-13');
 assert.equal(localDayOffset(1,new Date('2026-10-13T01:00:00Z')),'2026-10-13');
});
test('hotel date offsets cross month, year and leap-day boundaries',()=>{
 assert.equal(localDayOffset(1,new Date('2026-12-31T12:00:00Z')),'2027-01-01');
 assert.equal(localDayOffset(-1,new Date('2026-01-01T12:00:00Z')),'2025-12-31');
 assert.equal(localDayOffset(1,new Date('2028-02-28T12:00:00Z')),'2028-02-29');
 assert.equal(localDayOffset(2,new Date('2028-02-28T12:00:00Z')),'2028-03-01');
});
