ALTER TABLE facility_tasks ADD COLUMN anchor_day INTEGER NOT NULL DEFAULT 1;
UPDATE facility_tasks SET anchor_day=CAST(substr(due,9,2) AS INTEGER);
CREATE TABLE shift_handovers(id TEXT PRIMARY KEY,property_id INTEGER NOT NULL REFERENCES property(id),team TEXT NOT NULL,shift TEXT NOT NULL,notes TEXT NOT NULL,tasks TEXT NOT NULL,outgoing TEXT NOT NULL,incoming TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,acknowledged_by TEXT,acknowledged_at TEXT,version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX shift_handovers_property ON shift_handovers(property_id,team,created);
CREATE TABLE discord_bridge_state(property_id INTEGER PRIMARY KEY REFERENCES property(id),channel_id TEXT NOT NULL,group_id TEXT NOT NULL,inbound_cursor TEXT NOT NULL,outbound_cursor INTEGER NOT NULL,last_error TEXT NOT NULL DEFAULT '',updated TEXT NOT NULL);
CREATE TABLE discord_bridge_messages(property_id INTEGER NOT NULL,discord_id TEXT NOT NULL,loomi_id INTEGER NOT NULL,PRIMARY KEY(property_id,discord_id));
CREATE TRIGGER operational_activity_notification AFTER INSERT ON activity_log WHEN NEW.property_id>0 AND EXISTS(SELECT 1 FROM property WHERE id=NEW.property_id) AND COALESCE((SELECT value FROM settings WHERE key='notification-suppress'),'0')<>'1' AND NEW.event NOT LIKE 'facility.%' AND NEW.event NOT LIKE 'handover.%' AND NEW.event NOT LIKE 'chat.%' AND NEW.event NOT LIKE 'notification.%' BEGIN
 INSERT INTO notification_outbox(id,property_id,event,message,created) VALUES('activity:'||NEW.id,NEW.property_id,NEW.event,'Loomi · '||NEW.event||' · '||NEW.reference||' · '||NEW.details,NEW.created);
END;

CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
UPDATE staff SET permissions=json_insert(permissions,'$[#]','shiftHandover') WHERE NOT EXISTS(SELECT 1 FROM json_each(staff.permissions) WHERE value='shiftHandover');
INSERT OR IGNORE INTO settings(key,value) SELECT 'notification-fanout-cursor',CAST(COALESCE(max(rowid),0) AS TEXT) FROM notification_outbox;
