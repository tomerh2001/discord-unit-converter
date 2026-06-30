/**
 * Persist the latest exchange-rate snapshot so the bot can convert currencies
 * immediately on startup (and survive a temporary API outage) before the first
 * live refresh completes.
 */
import { getRatesSnapshot, setRates, type RatesSnapshot } from '../conversion/index.js';
import { getDb } from './db.js';

const KEY = 'currency_rates';

/** Save the in-memory rates snapshot to the database. */
export function saveRates(): void {
  const snapshot = getRatesSnapshot();
  if (snapshot.fetchedAt === 0) return;
  getDb()
    .prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .run(KEY, JSON.stringify(snapshot));
}

/** Load a persisted rates snapshot into memory. Returns true if one was found. */
export function loadRates(): boolean {
  const row = getDb().prepare(`SELECT value FROM app_meta WHERE key = ?`).get(KEY) as
    | { value: string }
    | undefined;
  if (!row) return false;
  try {
    const snap = JSON.parse(row.value) as RatesSnapshot;
    if (snap?.perUsd && typeof snap.fetchedAt === 'number') {
      setRates(snap.perUsd, snap.fetchedAt);
      return true;
    }
  } catch {
    // corrupt cache — ignore and let a live fetch repopulate it
  }
  return false;
}
