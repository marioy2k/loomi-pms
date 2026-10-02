CREATE TABLE api_tokens (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
 scopes TEXT NOT NULL, property_ids TEXT NOT NULL, expires INTEGER NOT NULL,
 approval_required INTEGER NOT NULL DEFAULT 1, revoked INTEGER NOT NULL DEFAULT 0,
 created TEXT NOT NULL, last_used TEXT
);
CREATE TABLE api_rate_limits (token_id TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE api_actions (
 id TEXT PRIMARY KEY, token_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 request_hash TEXT NOT NULL, property_id INTEGER NOT NULL, operation TEXT NOT NULL,
 payload TEXT NOT NULL, base_version TEXT NOT NULL, status TEXT NOT NULL,
 created TEXT NOT NULL, response TEXT, UNIQUE(token_id,idempotency_key)
);
CREATE TABLE webhook_subscriptions (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL,
 property_ids TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL
);
CREATE TABLE webhook_deliveries (
 id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL, event_id TEXT NOT NULL,
 body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 last_error TEXT, created TEXT NOT NULL
);
CREATE INDEX webhook_due ON webhook_deliveries(status,next_attempt,lease_until);
