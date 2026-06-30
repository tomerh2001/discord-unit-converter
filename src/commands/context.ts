/**
 * Assembles the conversion context for a guild: physical custom units, the full
 * currency set (built-in fiat + the guild's custom currencies), and the
 * precision / base-currency settings. Shared by /convert and the right-click
 * command so they behave identically.
 */
import { loadConfig } from '../config.js';
import { getCurrencyUnits, type UnitDef } from '../conversion/index.js';
import { getCustomUnits, getGuildConfig } from '../storage/customUnits.js';

export interface GuildUnitContext {
  customUnits: UnitDef[];
  currencyUnits: UnitDef[];
  precision: number;
  baseCurrency: string;
}

export function guildUnitContext(guildId: string | null): GuildUnitContext {
  const all = guildId ? getCustomUnits(guildId) : [];
  const customUnits = all.filter((u) => u.dimension !== 'currency');
  const customCurrencies = all.filter((u) => u.dimension === 'currency');
  const currencyUnits = [...getCurrencyUnits(), ...customCurrencies];

  if (guildId) {
    const cfg = getGuildConfig(guildId);
    return { customUnits, currencyUnits, precision: cfg.precision, baseCurrency: cfg.baseCurrency };
  }
  return {
    customUnits,
    currencyUnits,
    precision: loadConfig().defaultPrecision,
    baseCurrency: 'USD',
  };
}
