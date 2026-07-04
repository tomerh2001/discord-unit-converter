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

  it('formats big magnitudes compactly (454.55B, not full digits)', () => {
    expect(convertExpression('1.5B USD to EUR', { currencyUnits: currencyUnits(), baseCurrency: 'USD' }).lines).toEqual([
      '$1.5B = **€750M**',
    ]);
  });

  it('"pound" is GBP only when the target is a currency', () => {
    const cu = currencyUnits();
    // GBP 0.8 per USD ⇒ 1 GBP = 1.25 USD.
    expect(convertExpression('5 pounds to usd', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual([
      '£5.00 = **$6.25**',
    ]);
    // ...but with a mass target it stays weight.
    expect(convertExpression('5 pounds to kg', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual([
      '5 lb = **2.27 kg**',
    ]);
    // £ is always currency.
    expect(convertExpression('£5', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual(['£5.00 = **$6.25**']);
  });
});

describe('custom currency (Mesos)', () => {
  const mesos = () => {
    const usd = currencyUnits().find((u) => u.id === 'currency:USD')!;
    return defineCustomUnit({
      guildId: 'g',
      name: 'mesos',
      symbol: 'Mz',
      rateAmount: 1e9,
      equalsValue: 2.5,
      equalsUnit: usd,
    });
  };

  it('defines and converts 1 billion Mesos = 2.5 USD (compact output)', () => {
    const m = mesos();
    expect(m.dimension).toBe('currency');
    expect(m.toBase).toBeCloseTo(2.5e-9, 18);

    const cu = [...currencyUnits(), m];
    expect(convertExpression('1 billion mesos', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual([
      '1B Mz = **$2.50**',
    ]);
  });

  it('keeps significant figures for tiny amounts (not $0.00)', () => {
    const cu = [...currencyUnits(), mesos()];
    expect(convertExpression('10 mesos', { currencyUnits: cu, baseCurrency: 'USD' }).lines).toEqual([
      '10.00 Mz = **$0.000000025**',
    ]);
  });
});
