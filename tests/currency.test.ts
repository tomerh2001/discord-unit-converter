import { beforeAll, describe, expect, it } from 'vitest';
import {
  convertExpression,
  defineCustomUnit,
  getCurrencyUnits,
  parseMagnitudeNumber,
  setRates,
} from '../src/conversion/index.js';
import { parseQuantities } from '../src/conversion/parser.js';

beforeAll(() => {
  // Deterministic fixed rates (units per USD): 1 USD = 0.5 EUR, 4 ILS, 100 JPY.
  setRates({ USD: 1, EUR: 0.5, GBP: 0.8, ILS: 4, JPY: 100 }, 1000);
});

const currencyUnits = () => getCurrencyUnits();

describe('parseMagnitudeNumber', () => {
  it('parses magnitudes and plain numbers', () => {
    expect(parseMagnitudeNumber('1 billion')).toBe(1e9);
    expect(parseMagnitudeNumber('1B')).toBe(1e9);
    expect(parseMagnitudeNumber('1.5m')).toBe(1.5e6);
    expect(parseMagnitudeNumber('2 thousand')).toBe(2000);
    expect(parseMagnitudeNumber('1,000')).toBe(1000);
    expect(parseMagnitudeNumber('2.5')).toBe(2.5);
    expect(parseMagnitudeNumber('nope')).toBeNull();
  });
});

describe('currency parsing (explicit mode)', () => {
  const ids = (t: string) =>
    parseQuantities(t, { mode: 'explicit', currencyUnits: currencyUnits() }).map((q) => ({
      id: q.unit.id,
      value: q.value,
    }));

  it('parses many money formats', () => {
    expect(ids('$5')).toEqual([{ id: 'currency:USD', value: 5 }]);
    expect(ids('5$')).toEqual([{ id: 'currency:USD', value: 5 }]);
    expect(ids('5 USD')).toEqual([{ id: 'currency:USD', value: 5 }]);
    expect(ids('1 billion USD')).toEqual([{ id: 'currency:USD', value: 1e9 }]);
    expect(ids('1B USD')).toEqual([{ id: 'currency:USD', value: 1e9 }]);
    expect(ids('1 bil usd')).toEqual([{ id: 'currency:USD', value: 1e9 }]);
    expect(ids('1B$')).toEqual([{ id: 'currency:USD', value: 1e9 }]);
    expect(ids('$1.5B')).toEqual([{ id: 'currency:USD', value: 1.5e9 }]);
    expect(ids('€10')).toEqual([{ id: 'currency:EUR', value: 10 }]);
    expect(ids('5 dollars')).toEqual([{ id: 'currency:USD', value: 5 }]);
  });

  it('only fires in explicit mode (never passive)', () => {
    expect(parseQuantities('$5', { mode: 'auto', currencyUnits: currencyUnits() })).toEqual([]);
  });

  it('does not break "1M" = meter', () => {
    const r = parseQuantities('1M', { mode: 'explicit', currencyUnits: currencyUnits() });
    expect(r).toHaveLength(1);
    expect(r[0]!.unit.id).toBe('meter');
  });
});

describe('currency conversion', () => {
  it('converts to the base currency (USD)', () => {
    // 1 USD = 0.5 EUR  ⇒  1 EUR = 2 USD  ⇒  €10 = $20.
    expect(convertExpression('€10', { currencyUnits: currencyUnits(), baseCurrency: 'USD' }).lines).toEqual([
      '€10.00 = **$20.00**',
    ]);
  });

  it('handles an explicit target', () => {
    expect(convertExpression('$20 to EUR', { currencyUnits: currencyUnits(), baseCurrency: 'USD' }).lines).toEqual([
      '$20.00 = **€10.00**',
    ]);
  });

  it('respects a non-USD base currency', () => {
    // base ILS (4 per USD): $5 → ₪20.
    expect(convertExpression('$5', { currencyUnits: currencyUnits(), baseCurrency: 'ILS' }).lines).toEqual([
      '$5.00 = **₪20.00**',
    ]);
  });

  it('parses big magnitudes through /convert', () => {
    // 1.5B USD already USD → no conversion (same as base); to EUR instead.
    expect(convertExpression('1.5B USD to EUR', { currencyUnits: currencyUnits(), baseCurrency: 'USD' }).lines).toEqual([
      '$1,500,000,000.00 = **€750,000,000.00**',
    ]);
  });
});

describe('custom currency (Mesos)', () => {
  it('defines and converts 1 billion Mesos = 2.5 USD', () => {
    const usd = currencyUnits().find((u) => u.id === 'currency:USD')!;
    const mesos = defineCustomUnit({
      guildId: 'g',
      name: 'mesos',
      symbol: 'Mz',
      rateAmount: 1e9,
      equalsValue: 2.5,
      equalsUnit: usd,
    });
    expect(mesos.dimension).toBe('currency');
    expect(mesos.toBase).toBeCloseTo(2.5e-9, 18);

    const cu = [...currencyUnits(), mesos];
    expect(convertExpression('1 billion mesos', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual([
      '1,000,000,000.00 Mz = **$2.50**',
    ]);
  });
});
