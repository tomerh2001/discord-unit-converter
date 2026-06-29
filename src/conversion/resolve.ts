/** Shared unit lookup, factored out so both index.ts and custom.ts can use it. */
import type { UnitDef } from './types.js';
import { buildAliasIndex } from './units.js';

/** Look up a unit by any alias (case-insensitive). Undefined if unknown. */
export function resolveUnitStrict(name: string, customUnits: UnitDef[] = []): UnitDef | undefined {
  return buildAliasIndex(customUnits).get(name.trim().toLowerCase());
}
