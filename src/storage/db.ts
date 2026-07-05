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

    CREATE TABLE IF NOT EXISTS app_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add base_currency to existing guild_config tables.
  const cols = db.prepare(`PRAGMA table_info(guild_config)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'base_currency')) {
    db.exec(`ALTER TABLE guild_config ADD COLUMN base_currency TEXT NOT NULL DEFAULT 'USD'`);
  }

  // One-time migration: auto-detection is now opt-in, so turn it off for every
  // server that already has a config row (servers with no row use the new
  // default of false). Guarded by a flag so admins can re-enable it afterwards.
  const AUTODETECT_MIGRATION = 'migration:autodetect_off_v1';
  const migrated = db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(AUTODETECT_MIGRATION);
  if (!migrated) {
    const info = db.prepare(`UPDATE guild_config SET auto_detect = 0`).run();
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(
      AUTODETECT_MIGRATION,
      `disabled ${info.changes} server(s)`,
    );
    if (info.changes > 0) console.log(`🔕 Auto-detect disabled for ${info.changes} existing server(s).`);
  }
  return db;
}

/** Close the database (used in tests / graceful shutdown). */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
