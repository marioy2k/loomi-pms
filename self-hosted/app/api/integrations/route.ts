import {moduleEnabled} from '@/lib/modules';
import {access} from '@/lib/access';
import {store,checkOrigin} from '@/runtime/core.mjs';
import {ApiError,createToken,createWebhook,scopeLabels,transaction} from '@/runtime/integrations.mjs';
import {apiFailure,decideAction,readBody} from '@/lib/integration-api';
export const dynamic='force-dynamic';
async function owner(){const user=await access();if(!user||user.role!=='owner')throw new ApiError(403,'Owner access required');if(!moduleEnabled(user,'integrations'))throw new ApiError(403,'Integrations are disabled or not licensed');return user;}
export async function GET(){try{await owner();const s=store();return Response.json({
 scopes:scopeLabels,
 tokens:s.db.prepare('SELECT id,name,scopes,property_ids,expires,approval_required,revoked,created,last_used FROM api_tokens ORDER BY created DESC').all(),
 webhooks:s.db.prepare('SELECT id,name,url,property_ids,active,created FROM webhook_subscriptions ORDER BY created DESC').all(),
 actions:s.db.prepare("SELECT a.id,a.operation,a.payload,a.property_id,a.created,t.name AS token_name FROM api_actions a JOIN api_tokens t ON t.id=a.token_id WHERE a.status='pending' ORDER BY a.created DESC LIMIT 100").all(),
 deliveries:s.db.prepare('SELECT d.id,w.name,d.event_id,d.status,d.attempts,d.last_error,d.created FROM webhook_deliveries d JOIN webhook_subscriptions w ON w.id=d.subscription_id ORDER BY d.created DESC LIMIT 50').all(),
 allowedOrigins:(process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean),
 });}catch(e){return apiFailure(e);}}
export async function POST(req:Request){try{const user=await owner();try{checkOrigin(req)}catch{throw new ApiError(403,'Request origin rejected')}const x=await readBody(req),s=store();
 if(x.action==='create-token')return Response.json(transaction(s,()=>createToken(s,x,user.email)),{status:201});
 if(x.action==='revoke-token'){transaction(s,()=>{const r=s.db.prepare('UPDATE api_tokens SET revoked=1 WHERE id=?').run(String(x.id));if(!r.changes)throw new ApiError(404,'Token not found');s.audit('api-token-revoked',user.email,{tokenId:x.id});});return Response.json({saved:true});}
 if(x.action==='create-webhook')return Response.json(transaction(s,()=>createWebhook(s,x,user.email)),{status:201});
 if(x.action==='disable-webhook'){transaction(s,()=>{const r=s.db.prepare('UPDATE webhook_subscriptions SET active=0,secret=? WHERE id=?').run('',String(x.id));if(!r.changes)throw new ApiError(404,'Webhook not found');s.db.prepare("UPDATE webhook_deliveries SET status='disabled' WHERE subscription_id=? AND status='pending'").run(String(x.id));s.audit('webhook-disabled',user.email,{webhookId:x.id});});return Response.json({saved:true});}
 if(x.action==='approve'||x.action==='reject')return Response.json(decideAction(s,String(x.id),x.action,user.email));
 throw new ApiError(400,'Unknown integration setting');
 }catch(e){return apiFailure(e);}}
