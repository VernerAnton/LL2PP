-- Clients and their logos. The logo images live in R2 (logos/<id>/original and logos/<id>/logo.png);
-- this table holds the crop and the placement on the first slide.
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  has_logo INTEGER NOT NULL DEFAULT 0,
  logo_version INTEGER NOT NULL DEFAULT 0,      -- bumped on every logo save, for cache busting
  logo_width_px INTEGER,                        -- size of the cropped logo image
  logo_height_px INTEGER,
  crop TEXT,                                    -- JSON {x,y,w,h} in pixels of the original image
  placement TEXT,                               -- JSON {x,y,w,h} in inches on the first slide
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
