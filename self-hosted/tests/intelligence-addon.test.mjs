import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../runtime/core.mjs';
import helper from './helpers/load-ts.cjs';
const {loadTs}=helper;
const {addOnPackages,packageModules,packagePrice}=loadTs('lib/packages.ts');
const {validateLicence}=loadTs('lib/licence.ts');
const {runIntelligence,intelligenceOverview}=loadTs('lib/intelligence-service.ts');
const config={packageVersion:2,roomPlan:'small',plan:'small',company:'QA',period:'monthly',startsOn:'2026-10-28',endsOn:null,modules:[],addOns:[]};
test('Intelligence is a separate $50 monthly add-on, with twelve months costing $600',()=>{
 assert.equal(addOnPackages.intelligence.monthlyUsd,50);assert.equal(addOnPackages.intelligence.yearlyUsd,600);
 for(const extras of [[],['chat'],['operations']])assert(!packageModules(extras).includes('integrations'));
 const licensed=validateLicence({...config,addOns:['intelligence']});assert(licensed.modules.includes('integrations'));assert(!licensed.modules.includes('chat'));
 assert.deepEqual(packagePrice('small',['intelligence']),{currency:'USD',monthlyUsd:99,yearlyUsd:1090});
 assert(validateLicence({...config,plan:'demo',period:'21-days'}).modules.includes('integrations'));
});
test('the service denies base-package questions and grants independently licensed Intelligence without team chat',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'loomi-intelligence-addon-')),db=new Store(join(dir,'test.sqlite'),new URL('../drizzle',import.meta.url).pathname);
 const owner={role:'owner',name:'Owner',email:'qa@example.test',permissions:[],propertyIds:null};
 try{
  db.db.prepare('INSERT INTO property(id,data) VALUES(1,?)').run(JSON.stringify({hotel:'QA',currency:'USD',rooms:[],bookings:[]}));
  const base={...owner,enabledModules:validateLicence(config).modules};
  await assert.rejects(runIntelligence(db,base,1,{action:'ask',question:'Who arrives today?'}),e=>e.status===403);
  await assert.rejects(intelligenceOverview(db,base,1),e=>e.status===403);
  const licensed={...owner,enabledModules:validateLicence({...config,addOns:['intelligence']}).modules};
  assert(!licensed.enabledModules.includes('chat'));assert((await intelligenceOverview(db,licensed,1)).tools.includes('ask'));
  assert.equal((await runIntelligence(db,licensed,1,{action:'ask',question:'Who arrives today?'})).count,0);
  await assert.rejects(runIntelligence(db,{...licensed,enabledModules:licensed.enabledModules.filter(m=>m!=='integrations')},1,{action:'summary'}),e=>e.status===403);
 }finally{db.db.close();rmSync(dir,{recursive:true,force:true})}
});
