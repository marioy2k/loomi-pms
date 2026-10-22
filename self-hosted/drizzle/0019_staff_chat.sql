CREATE TABLE chat_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,client_id TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created INTEGER NOT NULL,read_at INTEGER,UNIQUE(sender,client_id));
CREATE INDEX chat_messages_recipient ON chat_messages(recipient,read_at,id);
CREATE INDEX chat_messages_thread ON chat_messages(sender,recipient,id);
CREATE TABLE chat_presence(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,last_seen INTEGER NOT NULL);
CREATE INDEX chat_presence_seen ON chat_presence(email,last_seen);
