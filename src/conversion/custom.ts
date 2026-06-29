/**
 * Runtime-defined (per-server) units. A custom unit is declared relative to an
 * existing unit — "1 <name> = <factor> <base>" — and inherits that base's
 * dimension and measurement side, so it auto-converts to the opposite system
 * just like a built-in.
 */
import type { UnitDef } from './types.js';
import { resolveUnitStrict } from './resolve.js';

export interface CustomUnitInput {
  guildId: string;
  /** Display name, e.g. `smoot`. Becomes the canonical alias. */
  name: string;
  /** Short symbol shown in output, e.g. `smt`. */
  symbol: string;
  /** How many of `per` make one of this unit (1 name = factor * per). */
  factor: number;
  /** An existing unit alias the definition is relative to, e.g. `m`. */
  per: string;
  /** Extra comma-or-space separated aliases. */
  aliases?: string[];
}

export class CustomUnitError extends Error {}

const MAX_LEN = 32;
const MIN_FACTOR = 1e-9;
const MAX_FACTOR = 1e12;
// Reject markdown / mention / emoji-colon / control characters: these aliases
// are interpolated into bot replies and compiled into the parser's regex.
const INVALID_CHARS = /[`*_~|@<>:\\\r\n\t]/;

/**
 * Validate a token that will become a parseable alias. Rejecting 1-char and
 * purely-numeric tokens is what stops a custom unit from matching half of
 * normal chat (`5x`, `10`).
 */
function validateToken(token: string, label: string): void {
  if (token.length < 2) throw new CustomUnitError(`The ${label} must be at least 2 characters.`);
  if (token.length > MAX_LEN) throw new CustomUnitError(`The ${label} must be at most ${MAX_LEN} characters.`);
  if (/^[-+]?\d+(?:\.\d+)?$/.test(token)) throw new CustomUnitError(`The ${label} cannot be a number.`);
  if (INVALID_CHARS.test(token)) throw new CustomUnitError(`The ${label} contains invalid characters.`);
}

/** Validate and resolve a custom-unit declaration into a concrete UnitDef. */
export function defineCustomUnit(input: CustomUnitInput, existingCustom: UnitDef[] = []): UnitDef {
  const name = input.name.trim().toLowerCase();
  const symbol = input.symbol.trim();

  validateToken(name, 'unit name');
  validateToken(symbol.toLowerCase(), 'symbol');

  if (!Number.isFinite(input.factor) || input.factor === 0) {
    throw new CustomUnitError('The factor must be a non-zero number.');
  }
  if (Math.abs(input.factor) < MIN_FACTOR || Math.abs(input.factor) > MAX_FACTOR) {
    throw new CustomUnitError(`The factor must be between ${MIN_FACTOR} and ${MAX_FACTOR}.`);
  }

  const base = resolveUnitStrict(input.per, existingCustom);
  if (!base) {
    throw new CustomUnitError(`Unknown base unit "${input.per}". Use something like \`m\`, \`kg\`, or \`l\`.`);
  }
  if (base.dimension === 'temperature') {
    throw new CustomUnitError('Custom temperature units are not supported (affine scales only).');
  }

  const aliasSet = new Set<string>([name, symbol.toLowerCase()]);
  for (const a of input.aliases ?? []) {
    const cleaned = a.trim().toLowerCase();
    if (!cleaned) continue;
    validateToken(cleaned, 'alias');
    aliasSet.add(cleaned);
  }

  // Factor to the dimension's base unit = factor * (base unit -> dimension base).
  const toBase = input.factor * base.toBase;
  if (!Number.isFinite(toBase) || toBase === 0) {
    throw new CustomUnitError('That factor overflows to an unusable value.');
  }

  return {
    id: `custom:${input.guildId}:${name}`,
    dimension: base.dimension,
    system: base.system,
    symbol,
    aliases: [...aliasSet],
    toBase,
    offset: 0,
    custom: true,
    guildId: input.guildId,
  };
}
