import { describe, expect, it } from 'vitest';
import { convertAuto } from '../src/conversion/converter.js';
import { CustomUnitError, defineCustomUnit } from '../src/conversion/custom.js';
import { parseQuantities } from '../src/conversion/parser.js';
import { UNIT_BY_ID } from '../src/conversion/units.js';

const meter = UNIT_BY_ID.get('meter')!;
const celsius = UNIT_BY_ID.get('celsius')!;

describe('defineCustomUnit', () => {
  it('resolves a custom unit relative to an existing one', () => {
    const smoot = defineCustomUnit({
      guildId: 'g1',
      name: 'smoot',
      symbol: 'smt',
      equalsValue: 1.7018,
      equalsUnit: meter,
    });
    expect(smoot.dimension).toBe('length');
    expect(smoot.system).toBe('metric');
    expect(smoot.toBase).toBeCloseTo(1.7018, 9);
    expect(smoot.custom).toBe(true);
    expect(smoot.guildId).toBe('g1');
  });

  it('honours rateAmount (100 fingers = 1 m → 1 finger = 1 cm)', () => {
    const finger = defineCustomUnit({
      guildId: 'g1',
      name: 'finger',
      symbol: 'fg',
      rateAmount: 100,
      equalsValue: 1,
      equalsUnit: meter,
    });
    expect(finger.toBase).toBeCloseTo(0.01, 9);
  });

  it('makes the custom unit parseable and convertible', () => {
    const smoot = defineCustomUnit({
      guildId: 'g1',
      name: 'smoot',
      symbol: 'smt',
      equalsValue: 1.7018,
      equalsUnit: meter,
    });
    const parsed = parseQuantities('2 smoot', { customUnits: [smoot] });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.value).toBe(2);
    expect(parsed[0]!.unit.id).toBe(smoot.id);

    const result = convertAuto(2, smoot, 2)!;
    expect(result.to.system).not.toBe('metric');
  });

  it('rejects invalid definitions', () => {
    const bad = [
      { guildId: 'g', name: 'foo', symbol: 'fo', equalsValue: 0, equalsUnit: meter }, // zero value
      { guildId: 'g', name: 'x', symbol: 'fo', equalsValue: 1, equalsUnit: meter }, // 1-char name
      { guildId: 'g', name: 'foo', symbol: '@e', equalsValue: 1, equalsUnit: meter }, // bad chars
      { guildId: 'g', name: 'foo', symbol: 'fo', equalsValue: 1, equalsUnit: celsius }, // temperature
      { guildId: 'g', name: 'foo', symbol: 'fo', rateAmount: 0, equalsValue: 1, equalsUnit: meter }, // bad rate
    ];
    for (const input of bad) {
      expect(() => defineCustomUnit(input)).toThrow(CustomUnitError);
    }
  });
});
