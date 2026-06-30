/**
 * Currency metadata and magnitude (k/M/B/T) parsing.
 *
 * Exchange rates are *dynamic* (see rates.ts); this file only holds the static
 * facts about each currency — its code, sign, and spoken names — plus the
 * helpers for reading amounts like `1.5B`, `1 billion`, or `1 bil`.
 */
export const CURRENCY_DIMENSION = 'currency';

/** USD is the engine's base currency: every rate is expressed as USD per unit. */
export const BASE_CURRENCY = 'USD';

export interface CurrencyMeta {
  code: string;
  /** Currency sign, if it has a well-known one (used for `$5` style display). */
  sign?: string;
  /** Spoken names / plurals that should also match in text. */
  names?: string[];
}

/**
 * Curated set of widely-used currencies. We only recognise these by code/sign/
 * name (not every ISO code) so bare three-letter words can't false-match.
 */
// Names are chosen to avoid clashing with physical units ("pound" is mass) and
// common English words ("won", "real", "rand"); those currencies still match by
// code or sign.
export const CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', sign: '$', names: ['dollar', 'dollars', 'usd'] },
  { code: 'EUR', sign: '€', names: ['euro', 'euros'] },
  { code: 'GBP', sign: '£', names: ['gbp', 'quid', 'sterling'] },
  { code: 'JPY', sign: '¥', names: ['yen', 'jpy'] },
  { code: 'ILS', sign: '₪', names: ['shekel', 'shekels', 'nis', 'ils'] },
  { code: 'INR', sign: '₹', names: ['rupee', 'rupees', 'inr'] },
  { code: 'KRW', sign: '₩', names: ['krw'] },
  { code: 'RUB', sign: '₽', names: ['ruble', 'rubles', 'rouble', 'roubles', 'rub'] },
  { code: 'CNY', names: ['yuan', 'renminbi', 'rmb', 'cny'] },
  { code: 'CAD', names: ['cad'] },
  { code: 'AUD', names: ['aud'] },
  { code: 'CHF', names: ['franc', 'francs', 'chf'] },
  { code: 'NZD', names: ['nzd'] },
  { code: 'HKD', names: ['hkd'] },
  { code: 'SGD', names: ['sgd'] },
  { code: 'SEK', names: ['sek'] },
  { code: 'NOK', names: ['nok'] },
  { code: 'DKK', names: ['dkk'] },
  { code: 'PLN', names: ['zloty', 'pln'] },
  { code: 'TRY', sign: '₺', names: ['try'] },
  { code: 'MXN', names: ['mxn', 'peso', 'pesos'] },
  { code: 'BRL', names: ['brl'] },
  { code: 'ZAR', names: ['zar'] },
  { code: 'AED', names: ['dirham', 'dirhams', 'aed'] },
  { code: 'SAR', names: ['riyal', 'riyals', 'sar'] },
  { code: 'THB', sign: '฿', names: ['baht', 'thb'] },
];

/** Single-character currency signs we parse as a prefix/suffix (`$5`, `5$`). */
export const CURRENCY_SIGNS = ['$', '€', '£', '¥', '₪', '₹', '₩', '₽', '₺', '฿'];

/** Sign → default currency code (ambiguous signs pick the most common). */
export const SIGN_TO_CODE: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₪': 'ILS',
  '₹': 'INR',
  '₩': 'KRW',
  '₽': 'RUB',
  '₺': 'TRY',
  '฿': 'THB',
};

/** Magnitude suffix/word → multiplier. Only applied in currency context. */
export const MAGNITUDES: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  mm: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  bil: 1e9,
  billion: 1e9,
  t: 1e12,
  tril: 1e12,
  trillion: 1e12,
};

/** Magnitude tokens, longest first, for building a regex alternation. */
export const MAGNITUDE_TOKENS = Object.keys(MAGNITUDES).sort((a, b) => b.length - a.length);

/**
 * Parse a possibly-magnitude'd number string, e.g. `1 billion`, `1B`, `1.5m`,
 * `2.5`, `1,000`. Returns null if it isn't a number.
 */
export function parseMagnitudeNumber(input: string): number | null {
  const text = input.trim().toLowerCase();
  const m = text.match(
    new RegExp(`^([-+]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|[-+]?\\.\\d+)\\s*(${MAGNITUDE_TOKENS.join('|')})?$`),
  );
  if (!m) return null;
  const value = parseFloat(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const mult = m[2] ? MAGNITUDES[m[2]] ?? 1 : 1;
  return value * mult;
}
