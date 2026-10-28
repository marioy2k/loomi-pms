CREATE TABLE chat_push_devices(endpoint TEXT PRIMARY KEY REFERENCES chat_push_subscriptions(endpoint) ON DELETE CASCADE,email TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX chat_push_devices_email ON chat_push_devices(email,endpoint);
