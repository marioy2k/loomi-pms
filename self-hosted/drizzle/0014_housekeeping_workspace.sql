CREATE TABLE housekeeping_assignments (
 property_id INTEGER NOT NULL REFERENCES property(id), day TEXT NOT NULL, room TEXT NOT NULL,
 assignee TEXT NOT NULL, assignee_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Assigned',
 version INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL, actor TEXT NOT NULL,
 PRIMARY KEY(property_id,day,room)
);
CREATE TABLE housekeeping_issues (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), room TEXT NOT NULL,
 title TEXT NOT NULL, notes TEXT NOT NULL, photo TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Open', reporter TEXT NOT NULL, reporter_name TEXT NOT NULL,
 created TEXT NOT NULL, updated TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX housekeeping_issues_property ON housekeeping_issues(property_id,created);
