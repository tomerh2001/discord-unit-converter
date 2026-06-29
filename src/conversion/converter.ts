/**
 * Pure conversion math: value <-> base, target selection, and display
 * formatting. No Discord or I/O concerns live here.
 */
import type { ConversionResult, DimensionName, UnitDef } from './types.js';
import {
  UNITS,
  UNIT_BY_ID,
  fixedCounterpartOf,
  isAutoTarget,
  oppositeSide,
  sideOf,
} from './units.js';

/** value -> base unit of the dimension (affine: base = v*toBase + offset). */
export function toBase(value: number, unit: UnitDef): number {
  return value * unit.toBase + (unit.offset ?? 0);
}

/** base unit of the dimension -> value in `unit`. */
export function fromBase(base: number, unit: UnitDef): number {
  return (base - (unit.offset ?? 0)) / unit.toBase;
}

/** Convert a value between two units of the same dimension. */
export function convert(value: number, from: UnitDef, to: UnitDef): number {
  if (from.dimension !== to.dimension) {
    throw new Error(
      `Cannot convert ${from.symbol} (${from.dimension}) to ${to.symbol} (${to.dimension}): different dimensions.`,
    );
  }
  return fromBase(toBase(value, from), to);
}

/**
 * Magnitude-aware target within a size ladder: pick the largest opposite-side
 * unit that still leaves the displayed number >= 1 (so 10 km -> mi, not yd),
 * falling back to the smallest unit when the quantity is tiny.
 */
function pickLadderTarget(
  base: number,
  dimension: DimensionName,
  targetSide: 'metric' | 'imperial',
): UnitDef | null {
  const candidates = UNITS.filter(
    (u) =>
      u.dimension === dimension &&
      sideOf(u.system) === targetSide &&
      isAutoTarget(u.id),
  );
  if (candidates.length === 0) return null;

  const scored = candidates.map((u) => ({ u, v: Math.abs(fromBase(base, u)) }));
  const atLeastOne = scored.filter((s) => s.v >= 1);
  if (atLeastOne.length > 0) {
    // Largest unit keeping value >= 1  ==  smallest value among those >= 1.
    atLeastOne.sort((a, b) => a.v - b.v);
    return atLeastOne[0]!.u;
  }
  // Everything rounds below 1 -> smallest unit (largest displayed value).
  scored.sort((a, b) => b.v - a.v);
  return scored[0]!.u;
}

/**
 * Choose the unit a quantity should be auto-converted into: its fixed
 * counterpart (temperature, speed, pressure) or a magnitude-fitted unit from
 * the opposite-side size ladder (length, mass, volume, area). Returns null when
 * there is no sensible opposite-side target.
 */
export function autoTarget(value: number, from: UnitDef): UnitDef | null {
  const fixed = fixedCounterpartOf(from.id);
  if (fixed) return UNIT_BY_ID.get(fixed) ?? null;

  const base = toBase(value, from);
  return pickLadderTarget(base, from.dimension, oppositeSide(from.system));
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 20,
  useGrouping: true,
});

/** Format a bare number: sensible precision, trimmed zeros, thousands commas. */
export function formatNumber(n: number, precision: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0';

  // Clamp to a safe range: toPrecision/toFixed throw outside 0..100, and the
  // env-configured precision is otherwise unbounded.
  const p = Math.min(Math.max(Math.trunc(precision), 0), 12);
  const abs = Math.abs(n);
  let rounded: number;
  if (abs < 1) {
    // Keep significant figures for small magnitudes (e.g. 0.0394 in).
    rounded = Number(n.toPrecision(Math.min(Math.max(p, 2), 100)));
  } else {
    // Honour the requested precision at every magnitude (the per-guild setting
    // and explicit /convert intent should not be silently overridden).
    const factor = 10 ** p;
    rounded = Math.round(n * factor) / factor;
  }
  // Intl gives grouping + trims trailing zeros automatically.
  return decimalFormatter.format(rounded);
}

/** Render a quantity for display, e.g. `6.21 mi`, `86°F`, `5 m²`. */
export function formatQuantity(
  value: number,
  unit: UnitDef,
  precision: number,
): string {
  const num = formatNumber(value, precision);
  // Degree symbols attach with no space (86°F); everything else gets a space.
  const space = unit.symbol.startsWith('°') ? '' : ' ';
  return `${num}${space}${unit.symbol}`;
}

/** Convert and package a result for display (explicit target). */
export function convertTo(
  value: number,
  from: UnitDef,
  to: UnitDef,
  precision: number,
): ConversionResult {
  const converted = convert(value, from, to);
  return {
    value,
    from,
    to,
    converted,
    display: formatQuantity(converted, to, precision),
  };
}

/** Convert a quantity to its automatic counterpart. Null if none applies. */
export function convertAuto(
  value: number,
  from: UnitDef,
  precision: number,
): ConversionResult | null {
  const to = autoTarget(value, from);
  if (!to || to.id === from.id) return null;
  return convertTo(value, from, to, precision);
}
