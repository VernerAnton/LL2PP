-- Saved searches: individual CVs added in batches over time. Only the extracted data is stored
-- (never the PDF or CV text), and a search is deleted with all its candidates when finished.
CREATE TABLE searches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  position TEXT NOT NULL DEFAULT '',
  extra_fields TEXT NOT NULL DEFAULT '[]',   -- JSON array of extra detail ids, fixed at creation
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  data TEXT NOT NULL,                        -- JSON: name, work history, education, extra details
  source_file TEXT NOT NULL DEFAULT '',      -- PDF file name, to recognise repeats
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX candidates_by_search ON candidates (search_id, sort_order);
