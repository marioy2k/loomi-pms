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

test('Dutch covers notifications, settings, errors and fixed status labels',()=>{
 for(const key of ['Language','Changes saved','Accounting saved','Staff permissions saved','Issued','Cancelled','Awaiting payment','Check reservation dates, room and amounts','Choose a valid date','Unable to sign in. Please try again.','Front desk date','Choose a room'])assert(dutch[key],key);
 assert.equal(translateText('Changes saved','nl'),'Wijzigingen opgeslagen');
 assert.equal(translateText('Choose a valid date','nl'),'Kies een geldige datum');
 assert.equal(translateText('Income, ','nl'),'Inkomsten, ');
});
test('Generated stay descriptions translate without changing room references or dates',()=>{
 assert.equal(translateText('Room QA-101 · 2026-10-13 to 2026-10-14','nl'),'Kamer QA-101 · 2026-10-13 tot 2026-10-14');
 for(const text of ['Wizard QA Guest','guest@example.test','PH-12345678','INV-1-PH-12345678','My custom notes'])assert.equal(translateText(text,'nl'),text);
});
test('Every company module description and package name has a Dutch translation',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const file of ['modules.ts','packages.ts']){
  const source=await readFile(new URL('../lib/'+file,import.meta.url),'utf8');
  for(const [,text] of source.matchAll(/(?:name|description):'([^']+)'/g))assert(dutch[text],text);
 }
});

test('Availability states and fixed inventory categories have Dutch labels',async()=>{
 const {readFile}=await import('node:fs/promises');
 const availability=await readFile(new URL('../lib/room-availability.ts',import.meta.url),'utf8');
 for(const [,label] of availability.matchAll(/(?:return|\?)'([^']+)'/g))assert(dutch[label],label);
 for(const label of ['Busy','Available','Maintenance','Out of service','Linens','Cleaning supplies','Amenities','Other'])assert(dutch[label],label);
 assert.equal(translateText('Busy','nl'),'Bezet');
 assert.equal(translateText('This room is already reserved for those dates','nl'),'Deze kamer is al gereserveerd voor deze datums');
});
test('Every application toast goes through the localized notification adapter',async()=>{
 const {readdir,readFile}=await import('node:fs/promises');
 for(const file of await readdir(new URL('../app/',import.meta.url))){
  if(!file.endsWith('.tsx'))continue;
  const source=await readFile(new URL('../app/'+file,import.meta.url),'utf8');
  assert(!/import\s*\{[^}]*\btoast\b[^}]*\}\s*from\s*['"]sonner['"]/.test(source),file);
 }
});
