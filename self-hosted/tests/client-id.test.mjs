import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {clientId} from '../runtime/client-id.mjs';
test('record IDs work on HTTP without randomUUID',()=>{
 const httpCrypto={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
 const ids=Array.from({length:1000},()=>clientId(httpCrypto));
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('secure contexts use native UUID generation',()=>assert.equal(clientId({randomUUID:()=> 'native-id'}),'native-id'));
