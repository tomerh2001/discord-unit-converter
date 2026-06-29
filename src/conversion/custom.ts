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

/** Validate and resolve a custom-unit declaration into a concrete UnitDef. */
export function defineCustomUnit(input: CustomUnitInput, existingCustom: UnitDef[] = []): UnitDef {
  const name = input.name.trim().toLowerCase();
  const symbol = input.symbol.trim();

  if (!name) throw new CustomUnitError('A unit name is required.');
  if (!symbol) throw new CustomUnitError('A unit symbol is required.');
  if (!Number.isFinite(input.factor) || input.factor === 0) {
    throw new CustomUnitError('The factor must be a non-zero number.');
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
    if (cleaned) aliasSet.add(cleaned);
  }

  return {
    id: `custom:${input.guildId}:${name}`,
    dimension: base.dimension,
    system: base.system,
    symbol,
    aliases: [...aliasSet],
    // Factor to the dimension's base unit = factor * (base unit -> dimension base).
    toBase: input.factor * base.toBase,
    offset: 0,
    custom: true,
    guildId: input.guildId,
  };
}
