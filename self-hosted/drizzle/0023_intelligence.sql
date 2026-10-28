CREATE TABLE ai_feedback (
 id TEXT PRIMARY KEY, property_id INTEGER NOT NULL REFERENCES property(id),
 room TEXT NOT NULL DEFAULT '', booking TEXT NOT NULL DEFAULT '', rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 text TEXT NOT NULL, date TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX ai_feedback_property ON ai_feedback(property_id,date);
CREATE TABLE ai_usage (
 day TEXT NOT NULL, actor TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,actor)
);
