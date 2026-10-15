CREATE TABLE fleet_plans (
 vehicle_id TEXT PRIMARY KEY REFERENCES fleet_vehicles(id), property_id INTEGER NOT NULL REFERENCES property(id),
 next_date TEXT, next_km INTEGER, insurance_date TEXT, inspection_date TEXT, notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE fleet_services (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id),
 date TEXT NOT NULL, odometer INTEGER NOT NULL, description TEXT NOT NULL, supplier TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 actor TEXT NOT NULL, created TEXT NOT NULL, void_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE fleet_fuel (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id),
 date TEXT NOT NULL, odometer INTEGER NOT NULL, millilitres INTEGER NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 full_tank INTEGER NOT NULL, station TEXT NOT NULL, actor TEXT NOT NULL, created TEXT NOT NULL, void_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX fleet_fuel_history ON fleet_fuel(property_id,vehicle_id,date,odometer);
CREATE TABLE security_keys (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), label TEXT NOT NULL, target_type TEXT NOT NULL, target_ref TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, UNIQUE(property_id,label)
);
CREATE TABLE security_key_issues (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), key_id TEXT NOT NULL REFERENCES security_keys(id),
 holder TEXT NOT NULL, label_snapshot TEXT NOT NULL, ref_snapshot TEXT NOT NULL, note TEXT NOT NULL, issued_at TEXT NOT NULL, issued_by TEXT NOT NULL, returned_at TEXT, returned_by TEXT, return_note TEXT
);
CREATE UNIQUE INDEX security_key_one_issue ON security_key_issues(key_id) WHERE returned_at IS NULL;
CREATE TABLE security_entries (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), kind TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL,
 person TEXT NOT NULL, destination TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
 created TEXT NOT NULL, actor TEXT NOT NULL, closed_at TEXT, closed_by TEXT, resolution TEXT NOT NULL DEFAULT '', reviewed_at TEXT, reviewed_by TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX security_entries_history ON security_entries(property_id,created);
CREATE TABLE security_photos (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id), entry_id TEXT NOT NULL REFERENCES security_entries(id), mime TEXT NOT NULL, data TEXT NOT NULL
);
