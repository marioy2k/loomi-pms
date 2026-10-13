import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText,dutch} from '../runtime/translations.mjs';
test('Dutch labels cover navigation, reservation payments and staff permissions',()=>{
 for(const key of ['Overview','Reservations','Room calendar','Guests','Housekeeping','Accounting','Settings','Accommodation paid (','Cash','Card','Collect reservation payments','View accounting and payment reports'])assert(dutch[key],key);
 assert.equal(translateText('Cash','nl'),'Contant');assert.equal(translateText('Card','nl'),'Kaart');assert.equal(translateText(' New reservation ','nl'),' Nieuwe reservering ');
});
test('English and unknown business text remain unchanged',()=>{
 for(const value of ['Cash','Card','Jimmy','PH-12345678','75.00','USD'])assert.equal(translateText(value,'en'),value);
 for(const value of ['Jimmy','PH-12345678','75.00','USD'])assert.equal(translateText(value,'nl'),value);
});
