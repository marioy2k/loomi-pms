const ts=require('typescript');
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let actor,existing='employee',writes=0;
const db={prepare(sql){return {bind(...args){return this},async first(){return {role:existing}},async all(){return {results:[{id:1}]}},async run(){writes++;return {meta:{changes:1}}}}}};
const modules={};
function load(file){if(modules[file])return modules[file];const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});const errors=(code.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);assert.equal(errors.length,0,JSON.stringify(errors));vm.runInNewContext(code.outputText,{exports,require(name){if(name==='@/lib/access')return {access:async()=>actor,ownerEmail:'owner@example.test'};if(name==='@/db/raw')return {database:()=>db};return load(name.replace('@/','')+'.ts')},Response,Request,URL,console,crypto});modules[file]=exports;return exports;}
for(const file of ['app/page.tsx','app/staff-permissions.tsx','app/pos.tsx','app/api/staff/route.ts','app/api/properties/route.ts','app/api/modules/route.ts','lib/access.ts','lib/permissions.ts','lib/pos-service.ts']){const r=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});assert.equal((r.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,file);}
const p=load('lib/permissions.ts'),inv=load('lib/inventory.ts'),route=load('app/api/staff/route.ts');
const user=(role,permissions=[])=>({email:'admin@example.test',name:'Admin',role,permissions,propertyIds:[1]});
assert.equal(p.can(user('admin'),'pos'),false);assert.equal(p.can(user('superadmin'),'pos'),true);assert.equal(inv.canViewInventory(user('employee',['housekeeping'])),false);
assert.equal(p.can(user('employee',['payments']),'pos'),false);assert.equal(p.can(user('employee',['pos']),'payments'),false);
assert.equal(p.can({...user('superadmin'),enabledModules:[]},'pos'),false);
assert.equal(JSON.stringify(p.permissionGroups.flatMap(g=>g.permissions).sort()),JSON.stringify([...p.allPermissions].sort()));
const person={email:'staff@example.test',name:'Staff',role:'employee',permissions:['housekeeping'],propertyIds:[1],active:true};
const req=body=>new Request('https://loomi.test/api/staff',{method:'POST',headers:{origin:'https://loomi.test','content-type':'application/json'},body:JSON.stringify(body)});
(async()=>{actor=user('admin',['housekeeping']);assert.equal((await route.POST(req(person))).status,200);
assert.equal((await route.POST(req({...person,role:'superadmin'}))).status,403);
assert.equal((await route.POST(req({...person,role:'admin'}))).status,403);
assert.equal((await route.POST(req({...person,permissions:['pos']}))).status,403);
existing='superadmin';assert.equal((await route.POST(req(person))).status,403);
actor=user('superadmin');assert.equal((await route.POST(req({...person,role:'admin',permissions:['pos']}))).status,200);
assert.equal((await route.POST(req({...person,email:'owner@example.test'}))).status,403);
assert.equal(writes,4);console.log('Syntax checks, module isolation, Super Admin/Admin hierarchy, escalation denials and protected owner tests passed.');})().catch(e=>{console.error(e);process.exit(1)});
