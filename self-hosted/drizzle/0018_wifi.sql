CREATE TABLE wifi_settings(property_id INTEGER PRIMARY KEY, data TEXT NOT NULL, api_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE wifi_vouchers(property_id INTEGER NOT NULL, booking_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', updated INTEGER NOT NULL, PRIMARY KEY(property_id,booking_id));
