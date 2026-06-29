/**
 * SQLite handle + schema. Uses better-sqlite3 (synchronous, embedded) so there
 * is no external database to run — the data lives in a single file.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../config.js';

let db: Database.Database | null = null;

/** Open (once) and return the database, creating the schema on first use. */
export function getDb(): Database.Database {
  if (db) return db;

  const { dataDir } = loadConfig();
  const file = join(dataDir, 'units.db');
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_units (
      guild_id   TEXT NOT NULL,
      name       TEXT NOT NULL,
      symbol     TEXT NOT NULL,
      dimension  TEXT NOT NULL,
      system     TEXT NOT NULL,
      to_base    REAL NOT NULL,
      offset     REAL NOT NULL DEFAULT 0,
      aliases    TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, name)
    );

    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id    TEXT PRIMARY KEY,
      auto_detect INTEGER NOT NULL DEFAULT 1,
      precision   INTEGER NOT NULL DEFAULT 2
    );
  `);
  return db;
}

/** Close the database (used in tests / graceful shutdown). */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
