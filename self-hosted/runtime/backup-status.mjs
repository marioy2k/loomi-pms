import {readFile} from 'node:fs/promises';
export async function readBackupStatus(path,now=Date.now()){
 try{
  const raw=await readFile(path,'utf8');if(raw.length>10000)return {available:false};
  const x=JSON.parse(raw),date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  if(x.version!==1||!date(x.updatedAt)||Date.parse(x.updatedAt)>now+300000||typeof x.scheduleActive!=='boolean'||typeof x.lastAttemptFailed!=='boolean'||typeof x.running!=='boolean'||(x.lastSuccessfulAt!==null&&!date(x.lastSuccessfulAt))||(x.nextScheduledAt!==null&&!date(x.nextScheduledAt))||(x.sizeBytes!==null&&(!Number.isSafeInteger(x.sizeBytes)||x.sizeBytes<0)))return {available:false};
  return {available:true,stale:now-Date.parse(x.updatedAt)>300000,updatedAt:x.updatedAt,lastSuccessfulAt:x.lastSuccessfulAt,sizeBytes:x.sizeBytes,nextScheduledAt:x.nextScheduledAt,scheduleActive:x.scheduleActive,lastAttemptFailed:x.lastAttemptFailed,running:x.running};
 }catch{return {available:false}}
}
