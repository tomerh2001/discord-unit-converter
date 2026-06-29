/**
 * Environment configuration. Loaded once at startup and validated so the bot
 * fails fast with a clear message instead of a cryptic Discord error.
 */
import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface Config {
  token: string;
  clientId: string;
  guildId: string | undefined;
  dataDir: string;
  defaultPrecision: number;
  autoDetectDefault: boolean;
}

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  cached = {
    token: required('DISCORD_TOKEN'),
    clientId: required('CLIENT_ID'),
    guildId: process.env.GUILD_ID?.trim() || undefined,
    dataDir: process.env.DATA_DIR?.trim() || './data',
    defaultPrecision: optionalInt('DEFAULT_PRECISION', 2),
    autoDetectDefault: (process.env.AUTO_DETECT_DEFAULT ?? 'true').toLowerCase() !== 'false',
  };
  return cached;
}
