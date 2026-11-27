-- Files bound together as one candidate stay together when they fail, so a retry reads them as one.
ALTER TABLE failed_files ADD COLUMN group_id TEXT;
