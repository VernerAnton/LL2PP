-- Running token and cost totals per search, kept while the search exists (deleted with it).
ALTER TABLE searches ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE searches ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE searches ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE searches ADD COLUMN cv_reads INTEGER NOT NULL DEFAULT 0;
