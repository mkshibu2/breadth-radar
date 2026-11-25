-- M.Radar Cloudflare D1 Schema (replaces 100 KB single-blob JSONBin)

CREATE TABLE IF NOT EXISTS sync_sections (
  user_id TEXT NOT NULL DEFAULT 'default',
  section TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, section)
);

CREATE TABLE IF NOT EXISTS chart_drawings (
  user_id TEXT NOT NULL DEFAULT 'default',
  symbol TEXT NOT NULL,
  drawings_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS layouts (
  user_id TEXT NOT NULL DEFAULT 'default',
  layout_name TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, layout_name)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  symbol TEXT,
  r2_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
