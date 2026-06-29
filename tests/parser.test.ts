import { describe, expect, it } from 'vitest';
import { parseQuantities } from '../src/conversion/parser.js';

const ids = (text: string, mode: 'auto' | 'explicit' = 'auto') =>
  parseQuantities(text, { mode }).map((q) => ({ id: q.unit.id, value: q.value }));

describe('parseQuantities — formats', () => {
  it('matches the same unit across casing and spacing', () => {
    for (const text of ['1M', '1m', '1 Meter', '1 meter', '1meters', '1 metres']) {
      const out = ids(text);
      expect(out, text).toEqual([{ id: 'meter', value: 1 }]);
    }
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
});

describe('parseQuantities — false-positive avoidance', () => {
  it('ignores units inside inline code, fenced code and URLs', () => {
    expect(ids('`10 km`')).toEqual([]);
    expect(ids('```\n10 km\n```')).toEqual([]);
    expect(ids('see https://example.com/10km here')).toEqual([]);
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
