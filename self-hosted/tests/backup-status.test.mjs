import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readBackupStatus} from '../runtime/backup-status.mjs';
test('backup status reports missing, valid, stale and malformed metadata without leaking extra fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'loomi-status-')),path=join(dir,'status.json'),now=Date.now();
 try{
  assert.deepEqual(await readBackupStatus(path,now),{available:false});
  const x={version:1,updatedAt:new Date(now).toISOString(),lastSuccessfulAt:new Date(now-60000).toISOString(),sizeBytes:258048,nextScheduledAt:new Date(now+3600000).toISOString(),scheduleActive:true,lastAttemptFailed:false,running:false,secret:'excluded'};
  await writeFile(path,JSON.stringify(x));let result=await readBackupStatus(path,now);assert.equal(result.available,true);assert.equal(result.stale,false);assert.equal(result.sizeBytes,258048);assert.equal('secret' in result,false);
  result=await readBackupStatus(path,now+300001);assert.equal(result.stale,true);
  await writeFile(path,JSON.stringify({...x,lastAttemptFailed:true,scheduleActive:false}));result=await readBackupStatus(path,now);assert.equal(result.lastAttemptFailed,true);assert.equal(result.scheduleActive,false);assert.equal(result.lastSuccessfulAt,x.lastSuccessfulAt);
  await writeFile(path,JSON.stringify({...x,nextScheduledAt:'invalid'}));assert.deepEqual(await readBackupStatus(path,now),{available:false});
  await writeFile(path,'{');assert.deepEqual(await readBackupStatus(path,now),{available:false});
 }finally{await rm(dir,{recursive:true,force:true})}
});
