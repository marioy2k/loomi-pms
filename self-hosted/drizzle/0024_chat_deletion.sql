CREATE TABLE chat_deleted_threads(email TEXT NOT NULL,peer TEXT NOT NULL,through_id INTEGER NOT NULL CHECK(through_id>=0),PRIMARY KEY(email,peer));
