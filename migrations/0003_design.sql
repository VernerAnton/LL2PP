-- The slide design (size, backgrounds, box positions) as one JSON document. No row = built-in design.
-- Uploaded backgrounds live in R2 under design/<first|content|last>.
CREATE TABLE design (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
