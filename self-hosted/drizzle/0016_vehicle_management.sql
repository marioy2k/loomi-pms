CREATE TABLE fleet_vehicles (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id),
 name TEXT NOT NULL, plate TEXT NOT NULL COLLATE NOCASE,
 status TEXT NOT NULL CHECK(status IN ('Available','On trip','Maintenance','Out of service')),
 odometer INTEGER NOT NULL CHECK(odometer>=0), version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(property_id,plate)
);
CREATE TABLE fleet_trips (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id),
 vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id), plate TEXT NOT NULL, vehicle_name TEXT NOT NULL,
 driver TEXT NOT NULL, destination TEXT NOT NULL, purpose TEXT NOT NULL,
 departed_at TEXT NOT NULL, departed_by TEXT NOT NULL, departed_by_name TEXT NOT NULL,
 start_km INTEGER NOT NULL, departure_note TEXT NOT NULL,
 returned_at TEXT, returned_by TEXT, returned_by_name TEXT, end_km INTEGER, return_note TEXT
);
CREATE UNIQUE INDEX fleet_one_open_trip ON fleet_trips(vehicle_id) WHERE returned_at IS NULL;
CREATE INDEX fleet_trip_history ON fleet_trips(property_id,departed_at);
CREATE TABLE fleet_defects (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id),
 vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id), trip_id TEXT REFERENCES fleet_trips(id),
 description TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('Minor','Critical')),
 status TEXT NOT NULL CHECK(status IN ('Reported','Under review','Resolved')),
 reported_at TEXT NOT NULL, reported_by TEXT NOT NULL, reported_by_name TEXT NOT NULL,
 reviewed_at TEXT, reviewed_by TEXT, reviewed_by_name TEXT, resolution TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX fleet_defect_history ON fleet_defects(property_id,reported_at);
CREATE TABLE fleet_photos (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id),
 defect_id TEXT NOT NULL REFERENCES fleet_defects(id), mime TEXT NOT NULL, data TEXT NOT NULL
);
