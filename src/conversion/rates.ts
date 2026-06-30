/**
 * Live exchange rates. The in-memory cache holds "units per USD" (the shape the
 * upstream API returns); persistence and the refresh schedule are wired up at
 * the bot layer so this module stays free of I/O dependencies.
 *
 * A currency UnitDef's `toBase` is USD-per-unit (= 1 / ratePerUsd), so currency
 * conversion rides the same affine machinery as everything else, with USD as
 * the dimension's base unit.
 */
import { BASE_CURRENCY, CURRENCIES } from './currencies.js';
import type { UnitDef } from './types.js';

export interface RatesSnapshot {
  /** code -> units of that currency per 1 USD. Always includes USD: 1. */
  perUsd: Record<string, number>;
  /** Epoch millis the rates were fetched. */
  fetchedAt: number;
}

let snapshot: RatesSnapshot = { perUsd: { [BASE_CURRENCY]: 1 }, fetchedAt: 0 };

export function getRatesSnapshot(): RatesSnapshot {
  return snapshot;
}

/** Replace the in-memory rates (from a fetch or from persisted storage). */
export function setRates(perUsd: Record<string, number>, fetchedAt: number): void {
  if (perUsd[BASE_CURRENCY] !== 1) perUsd = { ...perUsd, [BASE_CURRENCY]: 1 };
  snapshot = { perUsd, fetchedAt };
}

export function ratesAgeMs(): number {
  return snapshot.fetchedAt === 0 ? Infinity : Date.now() - snapshot.fetchedAt;
}

export function hasRates(): boolean {
  return Object.keys(snapshot.perUsd).length > 1;
}

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

/** Fetch fresh rates from the upstream API. Throws on failure. */
export async function fetchRates(): Promise<RatesSnapshot> {
  const res = await fetch(RATES_URL);
  if (!res.ok) throw new Error(`Rates API returned HTTP ${res.status}`);
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (data.result !== 'success' || !data.rates) {
    throw new Error('Rates API returned an unexpected payload');
  }
  const fetchedAt = Date.now();
  setRates(data.rates, fetchedAt);
  return snapshot;
}

/**
 * Build UnitDefs for every curated currency we currently have a rate for.
 * `toBase` is USD per unit; the display symbol is the sign when one exists, else
 * the code (so output is `$5` or `5 CAD`).
 */
export function getCurrencyUnits(): UnitDef[] {
  const units: UnitDef[] = [];
  for (const { code, sign, names } of CURRENCIES) {
    const perUsd = snapshot.perUsd[code];
    if (!perUsd || !Number.isFinite(perUsd)) continue; // no rate yet
    const aliases = new Set<string>([code.toLowerCase(), ...(names ?? [])]);
    if (sign) aliases.add(sign.toLowerCase());
    units.push({
      id: `currency:${code}`,
      dimension: 'currency',
      system: 'currency',
      symbol: sign ?? code,
      aliases: [...aliases],
      toBase: 1 / perUsd,
      offset: 0,
    });
  }
  return units;
}

/** The UnitDef for a currency code, if we have a rate for it. */
export function currencyUnit(code: string): UnitDef | undefined {
  return getCurrencyUnits().find((u) => u.id === `currency:${code.toUpperCase()}`);
}
