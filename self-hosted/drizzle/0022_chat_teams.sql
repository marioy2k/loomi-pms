CREATE TABLE chat_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,creator TEXT NOT NULL,created INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE chat_group_members(group_id TEXT NOT NULL,email TEXT NOT NULL,PRIMARY KEY(group_id,email));
CREATE INDEX chat_group_member_email ON chat_group_members(email,group_id);
CREATE TABLE chat_receipts(message_id INTEGER NOT NULL,email TEXT NOT NULL,delivered_at INTEGER,read_at INTEGER,PRIMARY KEY(message_id,email));
CREATE INDEX chat_receipts_user ON chat_receipts(email,read_at,message_id);
INSERT INTO chat_receipts SELECT id,recipient,read_at,read_at FROM chat_messages;
CREATE TABLE chat_pins(message_id INTEGER PRIMARY KEY,conversation TEXT NOT NULL,pinned_by TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE chat_references(message_id INTEGER PRIMARY KEY,kind TEXT NOT NULL,property_id INTEGER NOT NULL,record_id TEXT NOT NULL,label TEXT NOT NULL);
CREATE TABLE chat_quiet_preferences(email TEXT PRIMARY KEY,enabled INTEGER NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,timezone TEXT NOT NULL);
