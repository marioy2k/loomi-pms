import {createHash} from 'node:crypto';
export const ONLINE_TTL=180000;
const hash=token=>createHash('sha256').update(token).digest('hex');
// Authentication can remain valid for hours; online requires a browser heartbeat.
// Always join the heartbeat to its own live session, including on multiple devices.
export function loggedInEmails(store,now=Date.now()){
 return new Set(store.db.prepare(`SELECT DISTINCT se.email FROM chat_presence p JOIN sessions se ON se.token_hash=p.token_hash AND se.email=p.email JOIN accounts a ON a.email=se.email LEFT JOIN staff f ON f.email=se.email WHERE p.last_seen>? AND se.expires>? AND (se.email=? OR f.active=1)`).all(now-ONLINE_TTL,now,store.setting('ownerEmail')).map(row=>row.email));
}
export function sessionHeartbeat(store,token,now=Date.now()){
 const user=store.user(token);if(!user)throw Object.assign(Error('Sign in required'),{status:401});
 store.db.prepare('INSERT INTO chat_presence(token_hash,email,last_seen) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET email=excluded.email,last_seen=excluded.last_seen WHERE chat_presence.last_seen<?').run(hash(token),user.email,now,now-10000);
 store.db.prepare('DELETE FROM chat_presence WHERE last_seen<? OR NOT EXISTS(SELECT 1 FROM sessions se WHERE se.token_hash=chat_presence.token_hash AND se.email=chat_presence.email AND se.expires>?)').run(now-ONLINE_TTL*10,now);
 return {online:true};
}
