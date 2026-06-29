import { describe, expect, it } from 'vitest';
import { convertAuto } from '../src/conversion/converter.js';
import { CustomUnitError, defineCustomUnit } from '../src/conversion/custom.js';
import { parseQuantities } from '../src/conversion/parser.js';

describe('defineCustomUnit', () => {
  it('resolves a custom unit relative to an existing one', () => {
    const smoot = defineCustomUnit({
      guildId: 'g1',
      name: 'smoot',
      symbol: 'smt',
      factor: 1.7018,
      per: 'm',
    });
    expect(smoot.dimension).toBe('length');
    expect(smoot.system).toBe('metric');
    expect(smoot.toBase).toBeCloseTo(1.7018, 9);
    expect(smoot.custom).toBe(true);
    expect(smoot.guildId).toBe('g1');
  });

  it('makes the custom unit parseable and convertible', () => {
    const smoot = defineCustomUnit({
      guildId: 'g1',
      name: 'smoot',
      symbol: 'smt',
      factor: 1.7018,
      per: 'm',
    });
    const parsed = parseQuantities('2 smoot', { customUnits: [smoot] });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.value).toBe(2);
    expect(parsed[0]!.unit.id).toBe(smoot.id);

    // 2 smoot = 3.4036 m -> auto-converts to the imperial side.
    const result = convertAuto(2, smoot, 2)!;
    expect(result.to.system).not.toBe('metric');
  });

  it('rejects invalid definitions', () => {
    expect(() =>
      defineCustomUnit({ guildId: 'g', name: 'x', symbol: 'x', factor: 0, per: 'm' }),
    ).toThrow(CustomUnitError);
    expect(() =>
      defineCustomUnit({ guildId: 'g', name: 'x', symbol: 'x', factor: 1, per: 'nonsense' }),
    ).toThrow(CustomUnitError);
    expect(() =>
      defineCustomUnit({ guildId: 'g', name: 'x', symbol: 'x', factor: 1, per: 'celsius' }),
    ).toThrow(CustomUnitError);
  });
});
