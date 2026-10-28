import webpush from 'web-push';
import {chatVisible,chatQuiet,isChatGroup} from './chat.mjs';
import {isChatQuiet} from './chat-quiet.mjs';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
function user(s,token){const u=s.user(token);if(!u)fail(401,'Sign in required');return u}
export function pushKeys(s){let keys=s.setting('chatVapidKeys');if(!keys){keys=JSON.stringify(webpush.generateVAPIDKeys());s.setSetting('chatVapidKeys',keys)}return JSON.parse(keys)}
export function validSubscription(x){try{const u=new URL(x.endpoint);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||x.endpoint.length>2048)return false;return /^[A-Za-z0-9_-]{87}$/.test(x.keys.p256dh)&&Buffer.from(x.keys.p256dh,'base64url').length===65&&/^[A-Za-z0-9_-]{22}$/.test(x.keys.auth)&&Buffer.from(x.keys.auth,'base64url').length===16}catch{return false}}
export function subscribePush(s,token,subscription,rememberDevice=false){
 const u=user(s,token);if(!validSubscription(subscription)||typeof rememberDevice!=='boolean')fail(400,'Invalid browser subscription');
 s.db.exec('BEGIN IMMEDIATE');try{
  s.db.prepare('DELETE FROM chat_push_subscriptions WHERE NOT EXISTS(SELECT 1 FROM sessions se WHERE se.token_hash=chat_push_subscriptions.token_hash AND se.expires>?) AND NOT EXISTS(SELECT 1 FROM chat_push_devices d WHERE d.endpoint=chat_push_subscriptions.endpoint AND d.email=chat_push_subscriptions.email)').run(Date.now());
  if(s.db.prepare('SELECT count(*) n FROM chat_push_subscriptions WHERE email=? AND endpoint<>?').get(u.email,subscription.endpoint).n>=10)fail(400,'Use at most ten notification devices');
  s.db.prepare('INSERT INTO chat_push_subscriptions(endpoint,email,token_hash,p256dh,auth,created) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET email=excluded.email,token_hash=excluded.token_hash,p256dh=excluded.p256dh,auth=excluded.auth,created=excluded.created').run(subscription.endpoint,u.email,hash(token),subscription.keys.p256dh,subscription.keys.auth,Date.now());
  if(rememberDevice)s.db.prepare('INSERT INTO chat_push_devices VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET email=excluded.email,created=excluded.created').run(subscription.endpoint,u.email,Date.now());
  else s.db.prepare('DELETE FROM chat_push_devices WHERE endpoint=?').run(subscription.endpoint);
  s.db.exec('COMMIT');return {enabled:true,rememberDevice};
 }catch(e){if(s.db.isTransaction)s.db.exec('ROLLBACK');throw e}
}
export function unsubscribePush(s,token,endpoint){const u=user(s,token);s.db.prepare('DELETE FROM chat_push_subscriptions WHERE endpoint=? AND email=?').run(endpoint,u.email);return {enabled:false}}
export function pushNotice(s,token,id){const u=user(s,token);if(!Number.isSafeInteger(id)||id<1)fail(400,'Invalid message');const m=s.db.prepare('SELECT m.*,r.read_at receipt_read FROM chat_messages m JOIN chat_receipts r ON r.message_id=m.id AND r.email=? WHERE m.id=?').get(u.email,id);if(!m||m.receipt_read!==null||!chatVisible(s,u,m)||isChatQuiet(chatQuiet(s,u.email)))fail(404,'Message unavailable');const sender=s.db.prepare('SELECT COALESCE(f.name,a.name) name FROM accounts a LEFT JOIN staff f ON f.email=a.email WHERE a.email=?').get(m.sender),group=isChatGroup(m.recipient)?s.db.prepare('SELECT name FROM chat_groups WHERE id=?').get(m.recipient):null;return {id:m.id,sender:m.sender,peer:group?m.recipient:m.sender,name:group?group.name+' · '+(sender?.name||m.sender):sender?.name||m.sender,body:m.body?m.body.slice(0,120):'📎 Attachment',created:m.created}}
export async function deliverChatPush(s,message,send=webpush.sendNotification.bind(webpush)){
 const recipients=s.db.prepare('SELECT email FROM chat_receipts WHERE message_id=? AND read_at IS NULL').all(message.id).map(r=>r.email).filter(email=>chatVisible(s,{email},message)&&!isChatQuiet(chatQuiet(s,email))&&s.db.prepare('SELECT 1 FROM accounts a LEFT JOIN staff f ON f.email=a.email WHERE a.email=? AND (a.email=? OR f.active=1)').get(email,s.setting('ownerEmail')));if(!recipients.length)return;
 const subscriptions=s.db.prepare('SELECT p.*,EXISTS(SELECT 1 FROM chat_push_devices d WHERE d.endpoint=p.endpoint AND d.email=p.email) remembered FROM chat_push_subscriptions p WHERE p.email IN ('+recipients.map(()=>'?').join(',')+') AND (EXISTS(SELECT 1 FROM sessions se WHERE se.token_hash=p.token_hash AND se.email=p.email AND se.expires>?) OR EXISTS(SELECT 1 FROM chat_push_devices d WHERE d.endpoint=p.endpoint AND d.email=p.email))').all(...recipients,Date.now());if(!subscriptions.length)return;
 const keys=pushKeys(s);s.db.prepare('DELETE FROM chat_push_deliveries WHERE created<?').run(Date.now()-86400000);
 await Promise.allSettled(subscriptions.map(async p=>{const claimed=s.db.prepare('INSERT OR IGNORE INTO chat_push_deliveries VALUES(?,?,?)').run(message.id,p.endpoint,Date.now());if(!claimed.changes)return;try{await send({endpoint:p.endpoint,keys:{p256dh:p.p256dh,auth:p.auth}},JSON.stringify({id:message.id,...(p.remembered?{generic:true}:{})}),{vapidDetails:{subject:'mailto:'+s.setting('ownerEmail'),...keys},TTL:300,urgency:'high',timeout:5000,topic:'loomi-'+message.id})}catch(e){if(e.statusCode===404||e.statusCode===410)s.db.prepare('DELETE FROM chat_push_subscriptions WHERE endpoint=?').run(p.endpoint);else s.db.prepare('DELETE FROM chat_push_deliveries WHERE message_id=? AND endpoint=?').run(message.id,p.endpoint)}}));
}
