/**
 * Runtime-defined (per-server) units, including custom currencies.
 *
 * A custom unit is declared as a rate: "<rateAmount> <name> = <equalsValue>
 * <equalsUnit>". e.g. "1 billion Mesos = 2.5 USD", or "1 smoot = 1.7018 m". It
 * inherits the dimension and measurement side of the unit it's defined against,
 * so it converts just like a built-in (currencies to the base currency, physical
 * units to their metric/imperial counterpart).
 */
import type { UnitDef } from './types.js';

export interface CustomUnitInput {
  guildId: string;
  /** Display name, e.g. `mesos`. Becomes the canonical alias. */
  name: string;
  /** Short symbol shown in output, e.g. `Mz`. */
  symbol: string;
  /** How many of the new unit the rate is expressed for (default 1). */
  rateAmount?: number;
  /** The value of `equalsUnit` that `rateAmount` of the new unit is worth. */
  equalsValue: number;
  /** The existing unit the new one is defined against (already resolved). */
  equalsUnit: UnitDef;
  /** Extra aliases. */
  aliases?: string[];
}

export class CustomUnitError extends Error {}

const MAX_LEN = 32;
// Wide enough for tiny currency rates (1 Meso = 2.5e-9 USD) and large ones.
const MIN_TOBASE = 1e-18;
const MAX_TOBASE = 1e18;
// Reject markdown / mention / emoji-colon / control characters.
const INVALID_CHARS = /[`*_~|@<>:\\\r\n\t]/;

/**
 * Validate a token that will become a parseable alias. Rejecting 1-char and
 * purely-numeric tokens stops a custom unit from matching half of normal chat.
 */
function validateToken(token: string, label: string): void {
  if (token.length < 2) throw new CustomUnitError(`The ${label} must be at least 2 characters.`);
  if (token.length > MAX_LEN) throw new CustomUnitError(`The ${label} must be at most ${MAX_LEN} characters.`);
  if (/^[-+]?\d+(?:\.\d+)?$/.test(token)) throw new CustomUnitError(`The ${label} cannot be a number.`);
  if (INVALID_CHARS.test(token)) throw new CustomUnitError(`The ${label} contains invalid characters.`);
}

/** Validate and resolve a custom-unit declaration into a concrete UnitDef. */
export function defineCustomUnit(input: CustomUnitInput): UnitDef {
  const name = input.name.trim().toLowerCase();
  const symbol = input.symbol.trim();

  validateToken(name, 'unit name');
  validateToken(symbol.toLowerCase(), 'symbol');

  const rateAmount = input.rateAmount ?? 1;
  if (!Number.isFinite(rateAmount) || rateAmount <= 0) {
    throw new CustomUnitError('The rate amount must be a positive number.');
  }
  if (!Number.isFinite(input.equalsValue) || input.equalsValue === 0) {
    throw new CustomUnitError('The value it equals must be a non-zero number.');
  }

  const base = input.equalsUnit;
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

  // toBase of the new unit = how much of the dimension's base unit ONE of it is.
  const toBase = (input.equalsValue * base.toBase) / rateAmount;
  if (!Number.isFinite(toBase) || toBase === 0) {
    throw new CustomUnitError('That rate produces an unusable value.');
  }
  if (Math.abs(toBase) < MIN_TOBASE || Math.abs(toBase) > MAX_TOBASE) {
    throw new CustomUnitError('That rate is out of the supported range.');
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
