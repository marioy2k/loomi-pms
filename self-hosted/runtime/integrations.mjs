import {createHash, randomBytes, randomUUID, createHmac} from 'node:crypto';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
export const scopeLabels = {
  'rooms:read': 'View rooms and availability',
  'reservations:read': 'View stays (no guest contact details)',
  'guests:read': 'View guest names and contact details',
  'reports:read': 'View occupancy and outstanding balances',
  'reservations:write': 'Create and edit reservations',
  'housekeeping:write': 'Change room cleaning status',
};
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const hash = value => createHash('sha256').update(value).digest('hex');
export function transaction(s, work) {
  s.db.exec('BEGIN IMMEDIATE');
  try { const result = work(); s.db.exec('COMMIT'); return result; }
  catch (e) { s.db.exec('ROLLBACK'); throw e; }
}
export function propertyIds(s, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1 || !s.db.prepare('SELECT id FROM property WHERE id=?').get(id)))
    throw new ApiError(400, 'Select existing properties');
  return [...new Set(ids)];
}
export function createToken(s, x, actor) {
  if (typeof x.name !== 'string' || !x.name.trim() || x.name.length > 100 || !Array.isArray(x.scopes) || !x.scopes.length || x.scopes.some(v => !Object.hasOwn(scopeLabels, v)))
    throw new ApiError(400, 'Enter a name and supported permissions');
  const expires = Date.parse(x.expiresAt);
  if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 366 * 86400000) throw new ApiError(400, 'Choose an expiry within one year');
  if (x.approvalRequired !== undefined && typeof x.approvalRequired !== 'boolean') throw new ApiError(400, 'Invalid approval setting');
  const ids = propertyIds(s, x.propertyIds), id = randomUUID(), token = 'loomi_' + randomBytes(32).toString('base64url');
  const approval = x.approvalRequired !== false;
  s.db.prepare('INSERT INTO api_tokens(id,name,token_hash,scopes,property_ids,expires,approval_required,created) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, x.name.trim(), hash(token), JSON.stringify([...new Set(x.scopes)]), JSON.stringify(ids), expires, Number(approval), new Date().toISOString());
  s.audit('api-token-created', actor, {tokenId:id, scopes:x.scopes, propertyIds:ids, approvalRequired:approval});
  return {id, token};
}
export function authenticate(s, request, licence) {
  const bearer = request.headers.get('authorization') || '';
  if (!/^Bearer loomi_[A-Za-z0-9_-]{43}$/.test(bearer)) throw new ApiError(401, 'A Loomi API bearer token is required');
  const row = s.db.prepare('SELECT * FROM api_tokens WHERE token_hash=?').get(hash(bearer.slice(7)));
  if (!row || row.revoked || row.expires <= Date.now()) throw new ApiError(401, 'API token expired or revoked');
  if (!licence().valid) throw new ApiError(403, 'A valid Loomi licence is required');
  const window = Math.floor(Date.now() / 60000);
  const rate = s.db.prepare('INSERT INTO api_rate_limits VALUES (?,?,1) ON CONFLICT(token_id) DO UPDATE SET window=excluded.window,count=CASE WHEN api_rate_limits.window=excluded.window THEN api_rate_limits.count+1 ELSE 1 END RETURNING count').get(row.id, window);
  if (rate.count > 120) throw new ApiError(429, 'API rate limit reached; retry in one minute');
  s.db.prepare('UPDATE api_tokens SET last_used=? WHERE id=?').run(new Date().toISOString(), row.id);
  return {...row, scopes:JSON.parse(row.scopes), propertyIds:JSON.parse(row.property_ids)};
}
export function permit(token, scope, propertyId) {
  if (!token.scopes.includes(scope)) throw new ApiError(403, 'API permission required: ' + scope);
  if (!token.propertyIds.includes(propertyId)) throw new ApiError(403, 'This property is outside the token permissions');
}
export function webhookTarget(value, allowed = process.env.LOOMI_WEBHOOK_ALLOWED_ORIGINS || '') {
  let url; try { url = new URL(value); } catch { throw new ApiError(400, 'Enter a valid webhook URL'); }
  const origins = allowed.split(',').map(x => x.trim()).filter(Boolean);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || !origins.includes(url.origin))
    throw new ApiError(400, 'Webhook origin must be explicitly allowed by the server operator');
  return url;
}
export function createWebhook(s, x, actor) {
  if (typeof x.name !== 'string' || !x.name.trim() || x.name.length > 100 || typeof x.url !== 'string' || x.url.length > 2048) throw new ApiError(400, 'Enter a webhook name and URL');
  const url = webhookTarget(x.url), ids = propertyIds(s, x.propertyIds), id = randomUUID(), secret = randomBytes(32).toString('base64url');
  s.db.prepare('INSERT INTO webhook_subscriptions(id,name,url,secret,property_ids,created) VALUES (?,?,?,?,?,?)')
    .run(id, x.name.trim(), url.href, secret, JSON.stringify(ids), new Date().toISOString());
  s.audit('webhook-created', actor, {webhookId:id, propertyIds:ids});
  return {id, secret};
}
// Only identifiers and operational status leave the PMS. Receivers fetch details with a scoped token.
export function changeEvents(old, next, propertyId) {
  const events = [];
  for (const booking of next.bookings) {
    const before = old.bookings.find(b => b.id === booking.id);
    if (JSON.stringify(before) !== JSON.stringify(booking)) events.push({type:before ? 'reservation.updated' : 'reservation.created', data:{bookingId:booking.id, status:booking.status}});
  }
  for (const booking of old.bookings) if (!next.bookings.some(b => b.id === booking.id)) events.push({type:'reservation.deleted', data:{bookingId:booking.id}});
  for (const room of next.rooms) {
    const before = old.rooms.find(r => r.id === room.id);
    if (before && room.housekeeping !== before.housekeeping) events.push({type:'housekeeping.updated', data:{roomId:room.id, status:room.housekeeping}});
  }
  return events.map(e => ({id:randomUUID(), occurredAt:new Date().toISOString(), propertyId, ...e}));
}
export function webhookStatements(s, old, next, propertyId) {
  const subscribers = s.db.prepare('SELECT * FROM webhook_subscriptions WHERE active=1').all().filter(x => JSON.parse(x.property_ids).includes(propertyId));
  if (!subscribers.length) return [];
  const statements = [];
  for (const event of changeEvents(old, next, propertyId)) for (const sub of subscribers) statements.push(s.prepare('INSERT INTO webhook_deliveries(id,subscription_id,event_id,body,next_attempt,created) VALUES (?,?,?,?,?,?)').bind(randomUUID(), sub.id, event.id, JSON.stringify(event), Date.now(), event.occurredAt));
  return statements;
}
export function queueChanges(s, old, next, propertyId) { for (const statement of webhookStatements(s, old, next, propertyId)) statement.runSync(); }
export function sendWebhook(url, body, headers) {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {method:'POST', headers:{...headers, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body)}, timeout:10000}, res => {
      // Redirects are failures, never followed to a different destination.
      res.resume(); res.on('end', () => resolve(res.statusCode || 0));
    });
    req.setTimeout(10000, () => req.destroy(Error('Webhook timed out')));
    const deadline = setTimeout(() => req.destroy(Error('Webhook timed out')), 10000);
    req.on('close', () => clearTimeout(deadline)); req.on('error', reject); req.end(body);
  });
}
export async function dispatchOne(s, licence, send = sendWebhook) {
  if (!licence().valid) return false;
  const delivery = transaction(s, () => {
    s.db.prepare("UPDATE webhook_deliveries SET status='disabled' WHERE status='pending' AND subscription_id IN (SELECT id FROM webhook_subscriptions WHERE active=0)").run();
    const row = s.db.prepare("SELECT d.*,w.url,w.secret FROM webhook_deliveries d JOIN webhook_subscriptions w ON w.id=d.subscription_id WHERE d.status='pending' AND w.active=1 AND d.next_attempt<=? AND d.lease_until<=? ORDER BY d.next_attempt LIMIT 1").get(Date.now(), Date.now());
    if (row) s.db.prepare('UPDATE webhook_deliveries SET lease_until=? WHERE id=?').run(Date.now() + 30000, row.id);
    return row;
  });
  if (!delivery) return false;
  let error = '';
  try {
    const url = webhookTarget(delivery.url), timestamp = String(Math.floor(Date.now()/1000));
    const signature = createHmac('sha256', delivery.secret).update(timestamp + '.' + delivery.body).digest('hex');
    const status = await send(url, delivery.body, {'X-Loomi-Event-Id':delivery.event_id, 'X-Loomi-Timestamp':timestamp, 'X-Loomi-Signature':'sha256=' + signature});
    if (status < 200 || status >= 300) throw Error('HTTP ' + status);
  } catch { error = 'Delivery failed; check target connectivity, allowlist and receiver response'; }
  const attempts = delivery.attempts + 1;
  s.db.prepare('UPDATE webhook_deliveries SET status=?,attempts=?,next_attempt=?,lease_until=0,last_error=? WHERE id=?')
    .run(error ? attempts >= 8 ? 'failed' : 'pending' : 'delivered', attempts, Date.now() + Math.min(3600000, 30000 * 2 ** (attempts - 1)), error || null, delivery.id);
  // Retain operational metadata for 30 days; pending work is preserved.
  s.db.prepare("DELETE FROM webhook_deliveries WHERE status!='pending' AND created<?").run(new Date(Date.now()-30*86400000).toISOString());
  return true;
}
