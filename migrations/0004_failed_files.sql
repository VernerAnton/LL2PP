-- CV files that couldn't be processed, kept so they can be retried without uploading again.
-- The PDF itself is in R2 under failed/<search_id>/<id>. Removed when a retry succeeds, when the
-- owner removes it or finishes the search, and after 30 days at the latest.
CREATE TABLE failed_files (
  id TEXT PRIMARY KEY,
  search_id TEXT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX failed_files_by_search ON failed_files (search_id, created_at);
