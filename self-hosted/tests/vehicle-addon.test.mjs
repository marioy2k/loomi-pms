import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {loadTs}=createRequire(import.meta.url)('./helpers/load-ts.cjs');
const {addOnPackages,allAddOns,packageModules,packagePrice,validatePackage}=loadTs('lib/packages.ts');
const {validateLicence,licenceEntitlements}=loadTs('lib/licence.ts');
const config={packageVersion:2,roomPlan:'small',plan:'small',company:'QA',period:'monthly',startsOn:'2026-10-15',endsOn:null,addOns:[],modules:[]};
test('vehicle add-on costs 15 monthly or 150 yearly and is independently licensed',()=>{
 assert.equal(addOnPackages.vehicles.monthlyUsd,15);
 assert.equal(addOnPackages.vehicles.yearlyUsd,150);
 assert.ok(!packageModules([]).includes('vehicles'));
 assert.ok(!packageModules(['operations']).includes('vehicles'));
 assert.ok(packageModules(['vehicles']).includes('vehicles'));
 assert.ok(!packageModules(['vehicles']).includes('inventory'));
 assert.deepEqual(packagePrice('small',['vehicles']),{currency:'USD',monthlyUsd:64,yearlyUsd:640});
 assert.deepEqual(packagePrice('small',['vehicles','operations']),{currency:'USD',monthlyUsd:84,yearlyUsd:840});
 const licensed=validateLicence({...config,addOns:['vehicles']});
 assert.ok(licensed.modules.includes('vehicles'));
 assert.deepEqual(licenceEntitlements(licensed,1,new Date('2026-10-15T12:00:00Z')).pricing,{currency:'USD',monthlyUsd:64,yearlyUsd:640});
 assert.ok(!validateLicence({...config,addOns:['operations']}).modules.includes('vehicles'));
});
test('free demo includes every add-on and invalid selections remain rejected',()=>{
 const demo=validateLicence({...config,plan:'demo',period:'21-days'});
 assert.deepEqual(demo.addOns,allAddOns);
 assert.ok(demo.modules.includes('vehicles'));
 assert.ok(demo.modules.includes('inventory'));
 assert.throws(()=>validatePackage({...config,addOns:['vehicles','vehicles']}));
 assert.throws(()=>validatePackage({...config,addOns:['unknown']}));
});
