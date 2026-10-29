import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {failure,scheduleFacilityNotices} from './facilities.mjs';
const channels=['discord','slack','teams','webhook','smtp'];
const mail=v=>typeof v==='string'&&v.length<=254&&/^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(v);
export function notificationConfig(db,id){return JSON.parse(db.prepare('SELECT value FROM settings WHERE key=?').get('notifications:'+id)?.value||'{}')}
export function publicConfig(db,id){const c=notificationConfig(db,id);return Object.fromEntries(channels.map(k=>[k,k==='smtp'?{enabled:false,host:'',port:587,secure:false,user:'',from:'',to:'',...c[k],password:undefined,configured:!!c[k]?.host,hasPassword:!!c[k]?.password}:{enabled:!!c[k]?.enabled,configured:!!c[k]?.url}]))}
export function webhookURL(channel,value){let u;try{u=new URL(value)}catch{failure(400,'Enter a valid webhook URL')};if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443')failure(400,'Use an HTTPS webhook on port 443');if(channel==='discord'&&!['discord.com','discordapp.com'].includes(u.hostname)||channel==='slack'&&u.hostname!=='hooks.slack.com')failure(400,'Use the provider’s incoming webhook URL');return u;}
export function saveNotificationConfig(db,id,x){const old=notificationConfig(db,id),next={};
 for(const k of channels){const v=x[k];if(!v||typeof v.enabled!=='boolean')failure(400,'Check notification settings');
  if(k==='smtp'){
   const c={enabled:v.enabled,host:v.host,port:Number(v.port),secure:v.secure===true,user:v.user||'',password:v.password||old.smtp?.password||'',from:v.from,to:v.to};
   if(typeof c.host!=='string'||c.host.length>253||c.host&& !/^[a-zA-Z0-9.-]+$/.test(c.host)||![25,465,587,2525].includes(c.port)||typeof c.user!=='string'||c.user.length>254||typeof c.password!=='string'||c.password.length>1000||c.from&&!mail(c.from)||typeof c.to!=='string'||c.to.length>1500||c.to&&c.to.split(',').some(a=>!mail(a.trim()))||c.enabled&&(!c.host||!mail(c.from)||!c.to))failure(400,'Check SMTP host, port and email addresses');next[k]=c;
  }else{const url=v.url||old[k]?.url||'';if(url)webhookURL(k,url);if(v.enabled&&!url)failure(400,'Enter a webhook URL before enabling notifications');next[k]={enabled:v.enabled,url};}
 }
 db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('notifications:'+id,JSON.stringify(next));
 return publicConfig(db,id);
}
export function publicAddress(address){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a>=224||a===198&&(b===18||b===19));}
 return isIP(address)===6&&/^[23]/i.test(address)&&!['2001:db8:','2002:','2001:0:'].some(p=>address.toLowerCase().startsWith(p));
}
async function webhook(channel,config,message){const url=webhookURL(channel,config.url),addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Webhook must use a public address');const pinned=addresses[0];const payload=channel==='discord'?{content:message,allowed_mentions:{parse:[]}}:channel==='webhook'?{source:'Loomi PMS',message}: {text:message};
 return new Promise((resolve,reject)=>{const request=https.request(url,{method:'POST',lookup:(_host,_options,cb)=>{if(_options?.all)cb(null,[pinned]);else cb(null,pinned.address,pinned.family)},headers:{'Content-Type':'application/json'}},response=>{response.resume();response.on('end',()=>response.statusCode>=200&&response.statusCode<300?resolve(true):reject(Error('Provider rejected notification (HTTP '+response.statusCode+')')))});request.setTimeout(10000,()=>request.destroy(Error('Provider connection timed out')));request.on('error',()=>reject(Error('Provider connection failed')));request.end(JSON.stringify(payload));});
}
export async function smtpSend(config,to,subject,text){const {default:nodemailer}=await import('nodemailer');const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,auth:config.user?{user:config.user,pass:config.password}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});try{return await transport.sendMail({from:config.from,to,subject,text})}finally{transport.close()}}
export async function deliver(channel,config,message){if(channel==='smtp')return smtpSend(config,config.to.split(',').map(v=>v.trim()),'Loomi PMS notification',message);return webhook(channel,config,message);}
export async function processNotifications(db,now=Date.now(),send=deliver){
 // Claim each delivery before I/O. Expired claims retry after a worker crash.
 const pending=db.prepare("SELECT d.*,o.property_id,o.message FROM notification_deliveries d JOIN notification_outbox o ON o.id=d.event_id WHERE d.status IN ('pending','sending') AND d.next_attempt<=? AND d.attempts<5 LIMIT 30").all(now);
 for(const d of pending){const c=notificationConfig(db,d.property_id)[d.channel];if(!c?.enabled){db.prepare("UPDATE notification_deliveries SET status='skipped' WHERE event_id=? AND channel=?").run(d.event_id,d.channel);continue}
  const claim=db.prepare("UPDATE notification_deliveries SET status='sending',attempts=attempts+1,next_attempt=? WHERE event_id=? AND channel=? AND next_attempt<=? AND status IN ('pending','sending')").run(now+60000,d.event_id,d.channel,now);if(!claim.changes)continue;
  try{await send(d.channel,c,d.message);db.prepare("UPDATE notification_deliveries SET status='sent',last_error='' WHERE event_id=? AND channel=?").run(d.event_id,d.channel)}catch{db.prepare("UPDATE notification_deliveries SET status=?,last_error='Provider delivery failed. Check configuration and connection.',next_attempt=? WHERE event_id=? AND channel=?").run(d.attempts>=4?'failed':'pending',now+Math.min(3600000,60000*2**d.attempts),d.event_id,d.channel)}
 }
}
export async function facilityTick(db){const disabled=JSON.parse(db.prepare('SELECT disabled FROM company_modules WHERE id=1').get()?.disabled||'[]'),licence=JSON.parse(db.prepare('SELECT data FROM company_licence WHERE id=1').get()?.data||'null');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Paramaribo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(disabled.includes('maintenance')||licence&&(licence.startsOn>today||licence.endsOn&&licence.endsOn<today||licence.modules&&!licence.modules.includes('maintenance')))return;const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Paramaribo',hour:'numeric',hour12:false}).format(new Date()));if(hour>=7)scheduleFacilityNotices(db);await processNotifications(db);}
