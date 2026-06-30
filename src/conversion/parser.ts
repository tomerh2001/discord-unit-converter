/**
 * Text -> quantities. Pulls every `<number><unit>` it can find out of free-form
 * message text, while doing its best to avoid firing inside code, links, or
 * normal prose.
 */
import { CURRENCY_SIGNS, MAGNITUDES, MAGNITUDE_TOKENS } from './currencies.js';
import type { ConversionMode, ParsedQuantity, UnitDef } from './types.js';
import { AMBIGUOUS_ALIASES, buildAliasIndex } from './units.js';

/** Numeric literal: optional sign, optional thousands grouping, optional decimal. */
const NUMBER = String.raw`[-+]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a region with same-length spaces so later regexes ignore it while
 * every surviving character keeps its original index.
 */
function blankRanges(text: string, pattern: RegExp): string {
  return text.replace(pattern, (m) => ' '.repeat(m.length));
}

/** Hide code blocks, inline code, URLs and Discord `<...>` tokens. */
function maskNoise(text: string): string {
  let out = text;
  out = blankRanges(out, /```[\s\S]*?```/g); // fenced code
  out = blankRanges(out, /`[^`]*`/g); // inline code
  out = blankRanges(out, /https?:\/\/\S+/gi); // urls
  out = blankRanges(out, /<[^>\n]{1,100}>/g); // mentions, emoji, timestamps
  return out;
}

/**
 * Map smart/curly quotes and primes to their straight forms, so the parser only
 * has to reason about `'` and `"`. Length-preserving (each is one code unit),
 * so character indices stay aligned with the original text.
 */
function normalizeQuotes(text: string): string {
  return text.replace(/[‘’′]/g, "'").replace(/[“”″]/g, '"');
}

/**
 * Feet-and-inches compounds: 5'11", 5' 11", 5 ft 11 in, 5feet11inches.
 *
 * Two style-consistent branches — symbolic (`5'11"`) or worded (`5 ft 11 in`) —
 * but never mixed (`5' 11 in the morning` must NOT parse as 71"). Inches are
 * bounded to 1–2 digits so a stray later number can't be swallowed
 * (`5ft 100 in total`), and gaps use `[ \t]` so the match can't cross lines.
 */
const FEET_INCHES =
  /(?<![\p{L}\p{N}.])(?:([-+]?\d+(?:\.\d+)?)[ \t]*'[ \t]*(\d{1,2}(?:\.\d+)?)[ \t]*(?:"|'')|([-+]?\d+(?:\.\d+)?)[ \t]*(?:ft|feet|foot)[ \t]*(\d{1,2}(?:\.\d+)?)[ \t]*(?:in|inch|inches))(?![\p{L}])/giu;

let cachedBuiltinAlt: string | null = null;

function aliasAlternation(index: Map<string, UnitDef>, usingExtras: boolean): string {
  if (!usingExtras && cachedBuiltinAlt) return cachedBuiltinAlt;
  const alt = [...index.keys()]
    .sort((a, b) => b.length - a.length) // longest first: `meters` before `m`
    .map(escapeRegex)
    .join('|');
  if (!usingExtras) cachedBuiltinAlt = alt;
  return alt;
}

export interface ParseOptions {
  /** Extra (custom) units to recognise in addition to the built-ins. */
  customUnits?: UnitDef[];
  /**
   * Currency units (built-in fiat + custom currencies). Only parsed in
   * `explicit` mode, so the passive scanner never reacts to money.
   */
  currencyUnits?: UnitDef[];
  /**
   * `auto` (passive message scanning) applies the ambiguous-alias guard;
   * `explicit` (the /convert command) accepts everything.
   */
  mode?: ConversionMode;
}

/**
 * Currency pass: matches money in many shapes — `$5`, `5$`, `$1.5B`, `5 USD`,
 * `1B USD`, `1 billion Mesos`, `5 dollars` — applying magnitude multipliers
 * (k/M/B/T, "million", "bil", …). Pushes matches and returns `work` with the
 * consumed spans blanked. Only the built-in `NUMBER` is reused; currency
 * indicators (sign or code/name) are required, so plain `1M` never matches.
 */
function parseCurrencies(
  work: string,
  text: string,
  currencyUnits: UnitDef[],
  results: ParsedQuantity[],
): string {
  const aliasToUnit = new Map<string, UnitDef>();
  const codeNames: string[] = [];
  for (const unit of currencyUnits) {
    for (const alias of unit.aliases) {
      const key = alias.toLowerCase();
      if (!aliasToUnit.has(key)) aliasToUnit.set(key, unit);
      if (/^[\p{L}][\p{L} ]*$/u.test(alias)) codeNames.push(key);
    }
  }
  const signChars = CURRENCY_SIGNS.filter((s) => aliasToUnit.has(s.toLowerCase()));
  const magAlt = MAGNITUDE_TOKENS.join('|');
  const magOf = (token: string | undefined): number =>
    token ? (MAGNITUDES[token.toLowerCase()] ?? 1) : 1;

  const consume = (m: RegExpMatchArray, value: number, unit: UnitDef | undefined): void => {
    if (!unit || !Number.isFinite(value)) return;
    const start = m.index!;
    const end = start + m[0].length;
    results.push({ start, end, raw: text.slice(start, end), value, unit });
    work = work.slice(0, start) + ' '.repeat(end - start) + work.slice(end);
  };

  if (signChars.length > 0) {
    const cls = signChars.map((s) => (s === '$' ? '\\$' : s)).join('');
    const prefix = new RegExp(
      `(?<![\\p{L}\\p{N}])([${cls}])\\s?(${NUMBER})\\s?(${magAlt})?(?![\\p{L}\\p{N}])`,
      'giu',
    );
    for (const m of [...work.matchAll(prefix)]) {
      consume(m, parseFloat(m[2]!.replace(/,/g, '')) * magOf(m[3]), aliasToUnit.get(m[1]!.toLowerCase()));
    }
    const suffix = new RegExp(
      `(?<![\\p{L}\\p{N}])(${NUMBER})\\s?(${magAlt})?\\s?([${cls}])(?![\\p{L}\\p{N}])`,
      'giu',
    );
    for (const m of [...work.matchAll(suffix)]) {
      consume(m, parseFloat(m[1]!.replace(/,/g, '')) * magOf(m[2]), aliasToUnit.get(m[3]!.toLowerCase()));
    }
  }

  if (codeNames.length > 0) {
    const codeAlt = [...new Set(codeNames)]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|');
    const code = new RegExp(
      `(?<![\\p{L}\\p{N}.])(${NUMBER})\\s?(${magAlt})?\\s?(${codeAlt})(?![\\p{L}])`,
      'giu',
    );
    for (const m of [...work.matchAll(code)]) {
      consume(m, parseFloat(m[1]!.replace(/,/g, '')) * magOf(m[2]), aliasToUnit.get(m[3]!.toLowerCase()));
    }
  }

  return work;
}

/**
 * Parse every quantity in `text`. Results are ordered by position and never
 * overlap. Feet/inches compounds are resolved before the generic pass so
 * `5'11"` becomes a single 71-inch quantity rather than two fragments.
 */
export function parseQuantities(text: string, opts: ParseOptions = {}): ParsedQuantity[] {
  const mode: ConversionMode = opts.mode ?? 'auto';
  const customUnits = opts.customUnits ?? [];
  const index = buildAliasIndex(customUnits);
  const inch = index.get('inch');

  let work = normalizeQuotes(maskNoise(text));
  const results: ParsedQuantity[] = [];

  // ── Pass 0: currencies (explicit mode only) ──────────────────────────
  if (mode === 'explicit' && opts.currencyUnits && opts.currencyUnits.length > 0) {
    work = parseCurrencies(work, text, opts.currencyUnits, results);
  }

  // ── Pass 1: feet + inches compounds ──────────────────────────────────
  if (inch) {
    for (const m of work.matchAll(FEET_INCHES)) {
      const start = m.index!;
      const end = start + m[0].length;
      const feetStr = m[1] ?? m[3]!;
      const inches = parseFloat(m[2] ?? m[4]!);
      const feet = parseFloat(feetStr);
      // The sign belongs to the whole height, so negate inches too (-5'11" = -71").
      const sign = feet < 0 ? -1 : 1;
      const totalInches = sign * (Math.abs(feet) * 12 + inches);
      results.push({
        start,
        end,
        raw: text.slice(start, end),
        value: totalInches,
        unit: inch,
      });
      // Blank the consumed span so the generic pass skips it.
      work = work.slice(0, start) + ' '.repeat(end - start) + work.slice(end);
    }
  }

  // ── Pass 2: generic <number><unit> ───────────────────────────────────
  const alt = aliasAlternation(index, customUnits.length > 0);
  const generic = new RegExp(
    // The comma in the lookbehind stops a malformed group like `12,34` from
    // re-matching its trailing fragment (`34`) as a fresh number.
    `(?<![\\p{L}\\p{N}.,])(${NUMBER})(\\s*)(${alt})(?![\\p{L}])`,
    'giu',
  );

  for (const m of work.matchAll(generic)) {
    const numStr = m[1]!;
    const gap = m[2]!;
    const aliasText = m[3]!;
    const aliasKey = aliasText.toLowerCase();
    const unit = index.get(aliasKey);
    if (!unit) continue;

    // Ambiguous bare tokens (`in`, `c`, `f`) only count when attached to the
    // number, and only in auto mode — keeps normal prose from converting.
    if (mode === 'auto' && AMBIGUOUS_ALIASES.has(aliasKey) && gap.length > 0) {
      continue;
    }

    const value = parseFloat(numStr.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;

    const start = m.index!;
    const end = start + m[0].length;
    results.push({ start, end, raw: text.slice(start, end), value, unit });
  }

  results.sort((a, b) => a.start - b.start);
  return results;
}
