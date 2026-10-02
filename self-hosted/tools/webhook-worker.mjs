import {Store} from '../runtime/core.mjs';
import {dispatchOne} from '../runtime/integrations.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const path=join(process.env.DATA_DIR||'data','loomi.sqlite');
let stopping=false;
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
while(!existsSync(path)&&!stopping)await new Promise(r=>setTimeout(r,1000));
if(!stopping){
 const s=new Store(path,'drizzle');
 const licence=()=>{try{return s.licence(readFileSync(process.env.LICENSE_PUBLIC_KEY_FILE||'/run/secrets/licence_public_key','utf8'))}catch{return {valid:false}}};
 console.log('Loomi webhook worker started');
 while(!stopping){try{if(await dispatchOne(s,licence))continue;}catch(e){console.error('Webhook worker failed:',e.message)}await new Promise(r=>setTimeout(r,1000));}
 s.db.close();
}
