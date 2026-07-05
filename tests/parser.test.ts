import { describe, expect, it } from 'vitest';
import { parseQuantities } from '../src/conversion/parser.js';

const ids = (text: string, mode: 'auto' | 'explicit' = 'auto') =>
  parseQuantities(text, { mode }).map((q) => ({ id: q.unit.id, value: q.value }));

describe('parseQuantities — formats', () => {
  it('matches meter by full name and spaced abbreviation (auto mode)', () => {
    for (const text of ['1 m', '1 Meter', '1 meter', '1meters', '1 metres']) {
      expect(ids(text), text).toEqual([{ id: 'meter', value: 1 }]);
    }
  });

  it('treats bare "Nm"/"Nt" as magnitudes only in trading/magnitude context', () => {
    // magnitude/trading context ("5b", "sold", "wts") → 500m is 500 million, not metres
    expect(ids('sold a clean et for 500m instead of 5b')).toEqual([]);
    expect(ids('wts pet 500m')).toEqual([]);
    // no such context → 500m is metres, 5t is tonnes
    expect(ids('the 500m sprint was fast')).toEqual([{ id: 'meter', value: 500 }]);
    expect(ids('5t')).toEqual([{ id: 'tonne', value: 5 }]);
  });

  it('still converts "1M"/"500m" in explicit mode (/convert)', () => {
    expect(ids('1M', 'explicit')).toEqual([{ id: 'meter', value: 1 }]);
    expect(ids('500m', 'explicit')).toEqual([{ id: 'meter', value: 500 }]);
  });

  it('parses decimals, signs and thousands separators', () => {
    expect(ids('2.5 kg')).toEqual([{ id: 'kilogram', value: 2.5 }]);
    expect(ids('-40c')).toEqual([{ id: 'celsius', value: -40 }]);
    expect(ids('5,000 km')).toEqual([{ id: 'kilometer', value: 5000 }]);
  });

  it('finds multiple quantities in one message', () => {
    expect(ids('It is 10 km to the shop and 30°C outside')).toEqual([
      { id: 'kilometer', value: 10 },
      { id: 'celsius', value: 30 },
    ]);
  });

  it('handles feet-and-inches compounds as a single quantity', () => {
    expect(ids(`5'11"`)).toEqual([{ id: 'inch', value: 71 }]);
    expect(ids('5 ft 11 in')).toEqual([{ id: 'inch', value: 71 }]);
    expect(ids(`6'`)).toEqual([{ id: 'foot', value: 6 }]);
    expect(ids(`6"`)).toEqual([{ id: 'inch', value: 6 }]);
  });

  it('matches mobile smart-quotes for height (5’11”)', () => {
    expect(ids('she is 5’11” tall')).toEqual([{ id: 'inch', value: 71 }]);
    expect(ids('it is 6’ wide')).toEqual([{ id: 'foot', value: 6 }]);
  });

  it('keeps the sign on negative compounds', () => {
    expect(ids(`-5'11"`)).toEqual([{ id: 'inch', value: -71 }]);
  });
});

describe('parseQuantities — robustness against bridging / malformed input', () => {
  it('does not bridge feet-inches across prose or unrelated numbers', () => {
    // mixed apostrophe + worded "in" is not a real compound
    expect(ids(`5' 11 in the morning`)).toEqual([{ id: 'foot', value: 5 }]);
    // inches are bounded to 1–2 digits, so a stray 100 is not swallowed
    expect(ids('5ft 100 in total')).toEqual([{ id: 'foot', value: 5 }]);
  });

  it('does not emit a bogus value from malformed thousands grouping', () => {
    expect(ids('12,34 m of cable')).toEqual([]);
    expect(ids('1,234 m')).toEqual([{ id: 'meter', value: 1234 }]);
  });
});

describe('parseQuantities — false-positive avoidance', () => {
  it('ignores units inside inline code, fenced code and URLs', () => {
    expect(ids('`10 km`')).toEqual([]);
    expect(ids('```\n10 km\n```')).toEqual([]);
    expect(ids('see https://example.com/10km here')).toEqual([]);
  });

  it('ignores units inside scheme-less URLs and identifiers', () => {
    expect(ids('docs.google.com/document/d/1L_tlQ5Pt4M4/preview?tab=t.0')).toEqual([]);
    expect(ids('see google.com/a/5kg/b here')).toEqual([]);
    expect(ids('id 1L_tlQ5')).toEqual([]);
    expect(ids('order 5kg2 widgets')).toEqual([]);
  });

  it('still converts real quantities next to punctuation', () => {
    expect(ids('1L of water')).toEqual([{ id: 'liter', value: 1 }]);
    expect(ids('5 kg please')).toEqual([{ id: 'kilogram', value: 5 }]);
  });

  it('does not treat bare "in" in prose as inches (auto mode)', () => {
    expect(ids('I will be back in 5')).toEqual([]);
    expect(ids('I have 5 in my pocket')).toEqual([]);
  });

  it('does accept attached or spelled-out inches', () => {
    expect(ids('5in')).toEqual([{ id: 'inch', value: 5 }]);
    expect(ids('5 inches')).toEqual([{ id: 'inch', value: 5 }]);
  });

  it('accepts bare "in" in explicit mode', () => {
    expect(ids('5 in', 'explicit')).toEqual([{ id: 'inch', value: 5 }]);
  });

  it('ignores numbers without a known unit', () => {
    expect(ids('I have 5 dollars and 3 apples')).toEqual([]);
  });
});
