import { db } from './connection.js';

export function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mocks (
      id         TEXT PRIMARY KEY,
      name       TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mock_resources (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mock_id     TEXT NOT NULL REFERENCES mocks(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      config_json TEXT DEFAULT '{}',
      UNIQUE(mock_id, name)
    );
  `);
}
