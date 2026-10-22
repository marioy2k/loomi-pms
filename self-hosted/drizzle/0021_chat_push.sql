CREATE TABLE chat_push_subscriptions(endpoint TEXT PRIMARY KEY,email TEXT NOT NULL,token_hash TEXT NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX chat_push_session ON chat_push_subscriptions(email,token_hash);
CREATE TABLE chat_push_deliveries(message_id INTEGER NOT NULL,endpoint TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(message_id,endpoint));
