/**
 * Persistence for per-server custom units and per-server configuration.
 * Custom units are stored already resolved (factor folded into `to_base`) so
 * loading them back is a straight row -> UnitDef mapping.
 */
import type { DimensionName, UnitDef, UnitSystem } from '../conversion/index.js';
import { loadConfig } from '../config.js';
import { getDb } from './db.js';

interface CustomUnitRow {
  guild_id: string;
  name: string;
  symbol: string;
  dimension: string;
  system: string;
  to_base: number;
  offset: number;
  aliases: string;
  created_by: string | null;
}

/** Parse the stored aliases JSON, tolerating corruption rather than throwing. */
function parseAliases(raw: string, fallbackName: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const strings = parsed.filter((a): a is string => typeof a === 'string' && a.length > 0);
      if (strings.length > 0) return strings;
    }
  } catch {
    // fall through to the fallback below
  }
  return [fallbackName];
}

function rowToUnit(row: CustomUnitRow): UnitDef {
  return {
    id: `custom:${row.guild_id}:${row.name}`,
    dimension: row.dimension as DimensionName,
    system: row.system as UnitSystem,
    symbol: row.symbol,
    aliases: parseAliases(row.aliases, row.name),
    toBase: row.to_base,
    offset: row.offset,
    custom: true,
    guildId: row.guild_id,
  };
}

/** All custom units defined in a guild, ready to merge into the registry. */
export function getCustomUnits(guildId: string): UnitDef[] {
  const rows = getDb()
    .prepare('SELECT * FROM custom_units WHERE guild_id = ?')
    .all(guildId) as CustomUnitRow[];
  return rows.map(rowToUnit);
}

/** How many custom units a guild currently has. */
export function countCustomUnits(guildId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM custom_units WHERE guild_id = ?')
    .get(guildId) as { n: number };
  return row.n;
}

/** Persist (insert or replace) a resolved custom unit. */
export function saveCustomUnit(unit: UnitDef, createdBy?: string): void {
  const guildId = unit.guildId;
  if (!guildId) throw new Error('Custom units must have a guildId.');
  const name = unit.aliases[0] ?? unit.symbol.toLowerCase();
  getDb()
    .prepare(
      `INSERT INTO custom_units (guild_id, name, symbol, dimension, system, to_base, offset, aliases, created_by)
       VALUES (@guild_id, @name, @symbol, @dimension, @system, @to_base, @offset, @aliases, @created_by)
       ON CONFLICT(guild_id, name) DO UPDATE SET
         symbol=@symbol, dimension=@dimension, system=@system,
         to_base=@to_base, offset=@offset, aliases=@aliases, created_by=@created_by`,
    )
    .run({
      guild_id: guildId,
      name,
      symbol: unit.symbol,
      dimension: unit.dimension,
      system: unit.system,
      to_base: unit.toBase,
      offset: unit.offset ?? 0,
      aliases: JSON.stringify(unit.aliases),
      created_by: createdBy ?? null,
    });
}

/** Remove a custom unit by name. Returns true if a row was deleted. */
export function removeCustomUnit(guildId: string, name: string): boolean {
  const info = getDb()
    .prepare('DELETE FROM custom_units WHERE guild_id = ? AND name = ?')
    .run(guildId, name.trim().toLowerCase());
  return info.changes > 0;
}

export interface GuildConfig {
  autoDetect: boolean;
  precision: number;
}

/** Read a guild's config, falling back to environment defaults. */
export function getGuildConfig(guildId: string): GuildConfig {
  const { autoDetectDefault, defaultPrecision } = loadConfig();
  const row = getDb()
    .prepare('SELECT auto_detect, precision FROM guild_config WHERE guild_id = ?')
    .get(guildId) as { auto_detect: number; precision: number } | undefined;
  if (!row) {
    return { autoDetect: autoDetectDefault, precision: defaultPrecision };
  }
  return { autoDetect: row.auto_detect === 1, precision: row.precision };
}

function upsertConfig(guildId: string, patch: Partial<GuildConfig>): void {
  const current = getGuildConfig(guildId);
  const next = { ...current, ...patch };
  getDb()
    .prepare(
      `INSERT INTO guild_config (guild_id, auto_detect, precision)
       VALUES (?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET auto_detect=excluded.auto_detect, precision=excluded.precision`,
    )
    .run(guildId, next.autoDetect ? 1 : 0, next.precision);
}

export function setAutoDetect(guildId: string, enabled: boolean): void {
  upsertConfig(guildId, { autoDetect: enabled });
}

export function setPrecision(guildId: string, precision: number): void {
  upsertConfig(guildId, { precision });
}
