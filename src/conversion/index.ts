/**
 * Public surface of the conversion engine. Both the passive message scanner and
 * the `/convert` command go through these functions, so their behaviour stays
 * identical.
 */
import { convertAuto, convertTo, formatQuantity } from './converter.js';
import { parseQuantities } from './parser.js';
import { resolveUnitStrict } from './resolve.js';
import type { Annotation, ConversionMode, UnitDef } from './types.js';

export * from './types.js';
export { UNITS, CONVERTIBLE_DIMENSIONS } from './units.js';
export { convert, convertTo, convertAuto, formatQuantity } from './converter.js';
export { parseQuantities } from './parser.js';
export { defineCustomUnit, CustomUnitError } from './custom.js';
export type { CustomUnitInput } from './custom.js';

/** Hard cap on conversions per message, to bound output size. */
const MAX_ANNOTATIONS = 25;

export interface AnalyzeOptions {
  customUnits?: UnitDef[];
  mode?: ConversionMode;
  precision?: number;
}

/**
 * Find every quantity in `text` and convert it to its automatic counterpart.
 * Quantities with no sensible counterpart (or already on the target side) are
 * dropped.
 */
export function analyze(text: string, opts: AnalyzeOptions = {}): Annotation[] {
  const precision = opts.precision ?? 2;
  const quantities = parseQuantities(text, {
    customUnits: opts.customUnits,
    mode: opts.mode ?? 'auto',
  });

  const annotations: Annotation[] = [];
  for (const q of quantities) {
    if (annotations.length >= MAX_ANNOTATIONS) break;
    const result = convertAuto(q.value, q.unit, precision);
    if (!result) continue;
    annotations.push({ ...result, start: q.start, end: q.end, raw: q.raw });
  }
  return annotations;
}

/**
 * Rebuild `text` with each converted quantity followed by its bolded
 * conversion, e.g. `It's 10 km (**6.21 mi**) away`.
 */
export function renderReply(text: string, annotations: Annotation[]): string {
  let out = '';
  let cursor = 0;
  for (const a of annotations) {
    if (a.start < cursor) continue; // defensive: skip overlaps
    out += text.slice(cursor, a.end);
    out += ` (**${a.display}**)`;
    cursor = a.end;
  }
  out += text.slice(cursor);
  return out;
}

/** Look up a unit by any of its aliases (case-insensitive). */
export function resolveUnit(name: string, customUnits: UnitDef[] = []): UnitDef | undefined {
  return resolveUnitStrict(name, customUnits);
}

// `in` is both a conversion keyword AND the inch alias, so we split on the
// RIGHT-most keyword: `72 in to cm` → ["72 in", "cm"], not ["72", "in to cm"].
// Space lookarounds (not \s+ ... \s+) so adjacent keywords don't eat the shared
// space and hide each other.
const SPLIT_KEYWORD = /(?<=\s)(?:to|into|in|as|->|=>)(?=\s)/gi;

export interface ExpressionResult {
  lines: string[];
  error?: string;
}

/**
 * Evaluate a free-form `/convert` expression. Supports an explicit target
 * (`10 km to miles`) or implicit auto-conversion of every quantity found
 * (`72f and 10kg`). Returns formatted `source = **target**` lines.
 */
export function convertExpression(
  expression: string,
  opts: { customUnits?: UnitDef[]; precision?: number } = {},
): ExpressionResult {
  const precision = opts.precision ?? 2;
  const customUnits = opts.customUnits ?? [];
  const expr = expression.trim();
  if (!expr) return { lines: [], error: 'Nothing to convert.' };

  // Take the last keyword occurrence as the split point.
  let lastSplit: RegExpMatchArray | null = null;
  for (const m of expr.matchAll(SPLIT_KEYWORD)) lastSplit = m;

  if (lastSplit) {
    const left = expr.slice(0, lastSplit.index!);
    const targetName = expr.slice(lastSplit.index! + lastSplit[0].length).trim();
    const target = resolveUnit(targetName, customUnits);
    const quantities = parseQuantities(left, { customUnits, mode: 'explicit' });

    if (target && quantities.length > 0) {
      const lines = quantities.map((q) => {
        if (q.unit.dimension !== target.dimension) {
          return `❌ ${formatQuantity(q.value, q.unit, precision)} → ${target.symbol}: incompatible (${q.unit.dimension} vs ${target.dimension}).`;
        }
        const result = convertTo(q.value, q.unit, target, precision);
        return `${formatQuantity(q.value, q.unit, precision)} = **${result.display}**`;
      });
      return { lines };
    }

    // The user clearly named a target but we don't know it — say so rather than
    // silently auto-converting to a different unit.
    if (!target && targetName && quantities.length > 0) {
      return { lines: [], error: `Unknown unit "${targetName}".` };
    }
    // Otherwise the split was probably spurious; fall through to auto-detect.
  }

  // Implicit: auto-convert every quantity we can find.
  const annotations = analyze(expr, { customUnits, mode: 'explicit', precision });
  if (annotations.length === 0) {
    return {
      lines: [],
      error: `Couldn't find any convertible units in "${expr}".`,
    };
  }
  return {
    lines: annotations.map(
      (a) => `${formatQuantity(a.value, a.from, precision)} = **${a.display}**`,
    ),
  };
}
