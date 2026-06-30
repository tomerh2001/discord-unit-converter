/**
 * Core type definitions for the unit-conversion engine.
 *
 * A unit is described by an affine transform to the *base unit* of its
 * dimension:  base = value * toBase + offset.  The inverse recovers a value in
 * the unit from a base value:  value = (base - offset) / toBase.
 *
 * Affine (rather than purely multiplicative) handling is what lets temperature
 * units live in the same machinery as everything else.
 */

/** Dimensions the engine knows how to convert. */
export type DimensionName =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'volume'
  | 'area'
  | 'speed'
  | 'pressure'
  | 'currency';

/**
 * Which measurement system a unit belongs to.  For auto-conversion the engine
 * treats `metric` as one side and `imperial`/`us` as the other.  `us` exists
 * because US customary volumes (gallon, pint, cup, fluid ounce) differ from
 * the imperial ones; we standardise on US customary for those. `currency` is a
 * world of its own — converted to a configurable base, not a metric/imperial
 * counterpart — and its `toBase` is USD per unit (dynamic for fiat, fixed for
 * custom currencies).
 */
export type UnitSystem = 'metric' | 'imperial' | 'us' | 'currency';

export interface UnitDef {
  /** Canonical identifier, e.g. `meter`. Unique across the registry. */
  id: string;
  dimension: DimensionName;
  system: UnitSystem;
  /** Symbol used when displaying a converted value, e.g. `m`, `°C`, `mi`. */
  symbol: string;
  /**
   * All lowercase strings that should match this unit in text. Includes the
   * symbol, the full name, and common plurals / spellings.
   * e.g. `['m', 'meter', 'meters', 'metre', 'metres']`.
   */
  aliases: string[];
  /** Multiplicative factor to the dimension's base unit. */
  toBase: number;
  /** Additive offset to the base unit (used for temperature). Defaults to 0. */
  offset?: number;
  /** Optional: marks a unit defined at runtime by a server (custom unit). */
  custom?: boolean;
  /** Optional: guild that owns this custom unit. */
  guildId?: string;
}

/** A quantity found in text: a numeric value plus the unit it was written in. */
export interface ParsedQuantity {
  /** Character index where the match begins in the source text. */
  start: number;
  /** Character index just past the end of the match. */
  end: number;
  /** The exact substring matched, e.g. `10 km` or `5'11"`. */
  raw: string;
  value: number;
  unit: UnitDef;
}

/** The result of converting a single quantity to a target unit. */
export interface ConversionResult {
  value: number;
  from: UnitDef;
  to: UnitDef;
  converted: number;
  /** Human-friendly rendering of the converted quantity, e.g. `6.21 mi`. */
  display: string;
}

/** A conversion tied back to its location in the original text. */
export interface Annotation extends ConversionResult {
  start: number;
  end: number;
  raw: string;
}

export type ConversionMode = 'auto' | 'explicit';
