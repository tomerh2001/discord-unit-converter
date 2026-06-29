/**
 * The built-in unit registry.
 *
 * Conversion factors are exact wherever an exact definition exists (most
 * imperial<->metric relationships were *defined* exactly by the 1959
 * international yard-and-pound agreement, so e.g. 1 inch === 0.0254 m exactly).
 *
 * Base unit per dimension:
 *   length      -> meter
 *   mass        -> gram
 *   temperature -> degree Celsius   (affine: base = v*toBase + offset)
 *   volume      -> liter
 *   area        -> square meter
 *   speed       -> meter per second
 *   pressure    -> pascal
 */
import type { DimensionName, UnitDef, UnitSystem } from './types.js';

/**
 * Aliases that collide with everyday English words or notation. They only
 * auto-match when written *attached* to the number (e.g. `5in`, `72f`), never
 * as a bare spaced token, to avoid firing on normal prose. The `/convert`
 * command (explicit mode) accepts them freely.
 */
export const AMBIGUOUS_ALIASES = new Set(['in', 'c', 'f']);

interface RawUnit extends Omit<UnitDef, 'offset'> {
  offset?: number;
  /** Excluded from being *chosen* as an automatic target (still parseable). */
  autoTargetExclude?: boolean;
  /** Fixed counterpart unit id for dimensions without a clean size ladder. */
  fixedCounterpart?: string;
}

const C = 5 / 9; // Fahrenheit slope to Celsius

// prettier-ignore
const RAW_UNITS: RawUnit[] = [
  // ── Length (base: meter) ───────────────────────────────────────────────
  { id: 'millimeter', dimension: 'length', system: 'metric', symbol: 'mm', toBase: 0.001,    aliases: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'] },
  { id: 'centimeter', dimension: 'length', system: 'metric', symbol: 'cm', toBase: 0.01,     aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'] },
  { id: 'meter',      dimension: 'length', system: 'metric', symbol: 'm',  toBase: 1,        aliases: ['m', 'meter', 'meters', 'metre', 'metres'] },
  { id: 'kilometer',  dimension: 'length', system: 'metric', symbol: 'km', toBase: 1000,     aliases: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'] },
  { id: 'inch',       dimension: 'length', system: 'imperial', symbol: 'in', toBase: 0.0254, aliases: ['in', 'inch', 'inches', '"', '″'] },
  { id: 'foot',       dimension: 'length', system: 'imperial', symbol: 'ft', toBase: 0.3048, aliases: ['ft', 'foot', 'feet', "'", '′'] },
  { id: 'yard',       dimension: 'length', system: 'imperial', symbol: 'yd', toBase: 0.9144, aliases: ['yd', 'yard', 'yards'] },
  { id: 'mile',       dimension: 'length', system: 'imperial', symbol: 'mi', toBase: 1609.344, aliases: ['mi', 'mile', 'miles'] },
  { id: 'nauticalmile', dimension: 'length', system: 'imperial', symbol: 'nmi', toBase: 1852, aliases: ['nmi', 'nautical mile', 'nautical miles'], autoTargetExclude: true, fixedCounterpart: 'kilometer' },

  // ── Mass (base: gram) ──────────────────────────────────────────────────
  { id: 'milligram', dimension: 'mass', system: 'metric', symbol: 'mg', toBase: 0.001,        aliases: ['mg', 'milligram', 'milligrams'] },
  { id: 'gram',      dimension: 'mass', system: 'metric', symbol: 'g',  toBase: 1,            aliases: ['g', 'gram', 'grams', 'gramme', 'grammes'] },
  { id: 'kilogram',  dimension: 'mass', system: 'metric', symbol: 'kg', toBase: 1000,         aliases: ['kg', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes', 'kilo', 'kilos'] },
  { id: 'tonne',     dimension: 'mass', system: 'metric', symbol: 't',  toBase: 1_000_000,    aliases: ['t', 'tonne', 'tonnes', 'metric ton', 'metric tons'] },
  { id: 'ounce',     dimension: 'mass', system: 'us', symbol: 'oz', toBase: 28.349523125,     aliases: ['oz', 'ounce', 'ounces'] },
  { id: 'pound',     dimension: 'mass', system: 'us', symbol: 'lb', toBase: 453.59237,        aliases: ['lb', 'lbs', 'pound', 'pounds'] },
  { id: 'stone',     dimension: 'mass', system: 'imperial', symbol: 'st', toBase: 6350.29318, aliases: ['stone', 'stones'], autoTargetExclude: true },
  { id: 'shortton',  dimension: 'mass', system: 'us', symbol: 'ton', toBase: 907184.74,       aliases: ['ton', 'tons', 'short ton', 'short tons'] },

  // ── Temperature (base: degree Celsius, affine) ─────────────────────────
  { id: 'celsius',    dimension: 'temperature', system: 'metric', symbol: '°C', toBase: 1, offset: 0,
    aliases: ['°c', '℃', 'c', 'celsius', 'centigrade', 'degrees celsius', 'degree celsius'], fixedCounterpart: 'fahrenheit' },
  { id: 'fahrenheit', dimension: 'temperature', system: 'us', symbol: '°F', toBase: C, offset: -160 / 9,
    aliases: ['°f', '℉', 'f', 'fahrenheit', 'degrees fahrenheit', 'degree fahrenheit'], fixedCounterpart: 'celsius' },
  { id: 'kelvin',     dimension: 'temperature', system: 'metric', symbol: 'K', toBase: 1, offset: -273.15,
    aliases: ['°k', 'kelvin', 'kelvins'], autoTargetExclude: true, fixedCounterpart: 'fahrenheit' },

  // ── Volume (base: liter; US customary for imperial side) ───────────────
  { id: 'milliliter', dimension: 'volume', system: 'metric', symbol: 'ml', toBase: 0.001,     aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'] },
  { id: 'liter',      dimension: 'volume', system: 'metric', symbol: 'L',  toBase: 1,          aliases: ['l', 'liter', 'liters', 'litre', 'litres', 'ltr'] },
  { id: 'teaspoon',   dimension: 'volume', system: 'us', symbol: 'tsp', toBase: 0.00492892159375,  aliases: ['tsp', 'teaspoon', 'teaspoons'], autoTargetExclude: true },
  { id: 'tablespoon', dimension: 'volume', system: 'us', symbol: 'tbsp', toBase: 0.01478676478125, aliases: ['tbsp', 'tablespoon', 'tablespoons'], autoTargetExclude: true },
  { id: 'fluidounce', dimension: 'volume', system: 'us', symbol: 'fl oz', toBase: 0.0295735295625, aliases: ['fl oz', 'floz', 'fluid ounce', 'fluid ounces'] },
  { id: 'cup',        dimension: 'volume', system: 'us', symbol: 'cup', toBase: 0.2365882365,  aliases: ['cup', 'cups'] },
  { id: 'pint',       dimension: 'volume', system: 'us', symbol: 'pt', toBase: 0.473176473,    aliases: ['pint', 'pints'] },
  { id: 'quart',      dimension: 'volume', system: 'us', symbol: 'qt', toBase: 0.946352946,    aliases: ['qt', 'quart', 'quarts'] },
  { id: 'gallon',     dimension: 'volume', system: 'us', symbol: 'gal', toBase: 3.785411784,   aliases: ['gal', 'gallon', 'gallons'] },

  // ── Area (base: square meter) ──────────────────────────────────────────
  { id: 'sqmillimeter', dimension: 'area', system: 'metric', symbol: 'mm²', toBase: 1e-6, aliases: ['mm2', 'mm²', 'sq mm', 'square millimeter', 'square millimeters'], autoTargetExclude: true },
  { id: 'sqcentimeter', dimension: 'area', system: 'metric', symbol: 'cm²', toBase: 1e-4, aliases: ['cm2', 'cm²', 'sq cm', 'square centimeter', 'square centimeters'] },
  { id: 'sqmeter',      dimension: 'area', system: 'metric', symbol: 'm²',  toBase: 1,    aliases: ['m2', 'm²', 'sq m', 'sqm', 'square meter', 'square meters', 'square metre', 'square metres'] },
  { id: 'hectare',      dimension: 'area', system: 'metric', symbol: 'ha', toBase: 10_000,     aliases: ['ha', 'hectare', 'hectares'] },
  { id: 'sqkilometer',  dimension: 'area', system: 'metric', symbol: 'km²', toBase: 1e6,  aliases: ['km2', 'km²', 'sq km', 'square kilometer', 'square kilometers'] },
  { id: 'sqinch',  dimension: 'area', system: 'imperial', symbol: 'in²', toBase: 0.00064516, aliases: ['in2', 'in²', 'sq in', 'square inch', 'square inches'], autoTargetExclude: true },
  { id: 'sqfoot',  dimension: 'area', system: 'imperial', symbol: 'ft²', toBase: 0.09290304, aliases: ['ft2', 'ft²', 'sq ft', 'sqft', 'square foot', 'square feet'] },
  { id: 'sqyard',  dimension: 'area', system: 'imperial', symbol: 'yd²', toBase: 0.83612736, aliases: ['yd2', 'yd²', 'sq yd', 'square yard', 'square yards'] },
  { id: 'acre',    dimension: 'area', system: 'imperial', symbol: 'acre', toBase: 4046.8564224, aliases: ['acre', 'acres'] },
  { id: 'sqmile',  dimension: 'area', system: 'imperial', symbol: 'mi²', toBase: 2_589_988.110336, aliases: ['mi2', 'mi²', 'sq mi', 'square mile', 'square miles'] },

  // ── Speed (base: meter per second; fixed counterparts) ─────────────────
  { id: 'meterpersecond',   dimension: 'speed', system: 'metric', symbol: 'm/s',  toBase: 1,        aliases: ['m/s', 'mps', 'meter per second', 'meters per second', 'metre per second'], fixedCounterpart: 'milesperhour' },
  { id: 'kilometerperhour', dimension: 'speed', system: 'metric', symbol: 'km/h',  toBase: 1000 / 3600, aliases: ['km/h', 'kmh', 'kph', 'kilometer per hour', 'kilometers per hour', 'kilometres per hour'], fixedCounterpart: 'milesperhour' },
  { id: 'milesperhour',     dimension: 'speed', system: 'imperial', symbol: 'mph', toBase: 1609.344 / 3600, aliases: ['mph', 'mile per hour', 'miles per hour'], fixedCounterpart: 'kilometerperhour' },
  { id: 'footpersecond',    dimension: 'speed', system: 'imperial', symbol: 'ft/s', toBase: 0.3048,  aliases: ['ft/s', 'fps', 'foot per second', 'feet per second'], fixedCounterpart: 'meterpersecond', autoTargetExclude: true },
  { id: 'knot',             dimension: 'speed', system: 'imperial', symbol: 'kn',  toBase: 1852 / 3600, aliases: ['kn', 'knot', 'knots', 'kt', 'kts'], fixedCounterpart: 'kilometerperhour', autoTargetExclude: true },

  // ── Pressure (base: pascal; fixed counterparts) ────────────────────────
  { id: 'pascal',     dimension: 'pressure', system: 'metric', symbol: 'Pa',  toBase: 1,        aliases: ['pa', 'pascal', 'pascals'], fixedCounterpart: 'psi', autoTargetExclude: true },
  { id: 'kilopascal', dimension: 'pressure', system: 'metric', symbol: 'kPa', toBase: 1000,     aliases: ['kpa', 'kilopascal', 'kilopascals'], fixedCounterpart: 'psi' },
  { id: 'bar',        dimension: 'pressure', system: 'metric', symbol: 'bar', toBase: 100_000,  aliases: ['bar', 'bars'], fixedCounterpart: 'psi' },
  { id: 'millibar',   dimension: 'pressure', system: 'metric', symbol: 'mbar', toBase: 100,     aliases: ['mbar', 'millibar', 'millibars', 'hpa', 'hectopascal', 'hectopascals'], fixedCounterpart: 'psi', autoTargetExclude: true },
  { id: 'atmosphere', dimension: 'pressure', system: 'metric', symbol: 'atm', toBase: 101_325,  aliases: ['atm', 'atmosphere', 'atmospheres'], fixedCounterpart: 'psi', autoTargetExclude: true },
  { id: 'psi',        dimension: 'pressure', system: 'us', symbol: 'psi', toBase: 6894.757293168, aliases: ['psi', 'pounds per square inch'], fixedCounterpart: 'bar' },
];

export const UNITS: UnitDef[] = RAW_UNITS.map((u) => ({
  id: u.id,
  dimension: u.dimension,
  system: u.system,
  symbol: u.symbol,
  aliases: u.aliases,
  toBase: u.toBase,
  offset: u.offset ?? 0,
}));

/** id -> UnitDef */
export const UNIT_BY_ID = new Map<string, UnitDef>(UNITS.map((u) => [u.id, u]));

const RAW_BY_ID = new Map<string, RawUnit>(RAW_UNITS.map((u) => [u.id, u]));

/** Whether a unit may be chosen automatically as a conversion target. */
export function isAutoTarget(id: string): boolean {
  return !RAW_BY_ID.get(id)?.autoTargetExclude;
}

/** Fixed counterpart id for units in ladder-less dimensions, else undefined. */
export function fixedCounterpartOf(id: string): string | undefined {
  return RAW_BY_ID.get(id)?.fixedCounterpart;
}

/** The opposite measurement "side" used for automatic conversion. */
export function oppositeSide(system: UnitSystem): 'metric' | 'imperial' {
  return system === 'metric' ? 'imperial' : 'metric';
}

/** Does a unit belong to the metric side or the imperial/us side? */
export function sideOf(system: UnitSystem): 'metric' | 'imperial' {
  return system === 'metric' ? 'metric' : 'imperial';
}

/**
 * Build the alias -> UnitDef lookup. Aliases are matched case-insensitively;
 * we store them lowercased. Built-in registry plus any extra (custom) units.
 */
export function buildAliasIndex(extra: UnitDef[] = []): Map<string, UnitDef> {
  const index = new Map<string, UnitDef>();
  for (const unit of [...UNITS, ...extra]) {
    for (const alias of unit.aliases) {
      const key = alias.toLowerCase();
      // First definition wins; custom units are appended last and therefore do
      // not silently shadow a built-in alias.
      if (!index.has(key)) index.set(key, unit);
    }
  }
  return index;
}

/** Dimensions that differ between metric and imperial (worth auto-converting). */
export const CONVERTIBLE_DIMENSIONS: DimensionName[] = [
  'length',
  'mass',
  'temperature',
  'volume',
  'area',
  'speed',
  'pressure',
];
