import { describe, expect, it } from 'vitest';
import {
  convert,
  convertAuto,
  convertTo,
  formatQuantity,
} from '../src/conversion/converter.js';
import { resolveUnitStrict } from '../src/conversion/resolve.js';
import { UNIT_BY_ID } from '../src/conversion/units.js';
import type { UnitDef } from '../src/conversion/types.js';

function u(name: string): UnitDef {
  const unit = UNIT_BY_ID.get(name) ?? resolveUnitStrict(name);
  if (!unit) throw new Error(`test unit not found: ${name}`);
  return unit;
}

describe('convert (exact factors)', () => {
  it('length', () => {
    expect(convert(1, u('mile'), u('km'))).toBeCloseTo(1.609344, 9);
    expect(convert(1, u('inch'), u('cm'))).toBeCloseTo(2.54, 9);
    expect(convert(1, u('foot'), u('m'))).toBeCloseTo(0.3048, 9);
    expect(convert(1, u('yard'), u('m'))).toBeCloseTo(0.9144, 9);
    expect(convert(100, u('km'), u('mile'))).toBeCloseTo(62.137119, 5);
  });

  it('mass', () => {
    expect(convert(1, u('kg'), u('lb'))).toBeCloseTo(2.2046226, 6);
    expect(convert(1, u('lb'), u('g'))).toBeCloseTo(453.59237, 6);
    expect(convert(1, u('oz'), u('g'))).toBeCloseTo(28.349523, 5);
    expect(convert(1, u('stone'), u('kg'))).toBeCloseTo(6.35029318, 6);
  });

  it('temperature (affine)', () => {
    expect(convert(0, u('celsius'), u('fahrenheit'))).toBeCloseTo(32, 9);
    expect(convert(100, u('celsius'), u('fahrenheit'))).toBeCloseTo(212, 9);
    expect(convert(32, u('fahrenheit'), u('celsius'))).toBeCloseTo(0, 9);
    expect(convert(98.6, u('fahrenheit'), u('celsius'))).toBeCloseTo(37, 6);
    expect(convert(0, u('celsius'), u('kelvin'))).toBeCloseTo(273.15, 9);
    expect(convert(300, u('kelvin'), u('celsius'))).toBeCloseTo(26.85, 9);
  });

  it('volume (US customary)', () => {
    expect(convert(1, u('gallon'), u('l'))).toBeCloseTo(3.785411784, 9);
    expect(convert(1, u('l'), u('gallon'))).toBeCloseTo(0.264172, 6);
    expect(convert(1, u('cup'), u('ml'))).toBeCloseTo(236.5882365, 6);
  });

  it('area & speed & pressure', () => {
    expect(convert(1, u('acre'), u('sqmeter'))).toBeCloseTo(4046.8564224, 6);
    expect(convert(100, u('kilometerperhour'), u('milesperhour'))).toBeCloseTo(62.137119, 5);
    expect(convert(1, u('bar'), u('psi'))).toBeCloseTo(14.503774, 5);
  });

  it('throws on mismatched dimensions', () => {
    expect(() => convert(1, u('meter'), u('kg'))).toThrow();
  });
});

describe('convertAuto (counterpart selection)', () => {
  it('metric length picks a sensible imperial unit by magnitude', () => {
    expect(convertAuto(10, u('km'), 2)!.to.id).toBe('mile');
    expect(convertAuto(30, u('cm'), 2)!.to.id).toBe('inch');
  });

  it('imperial length converts back to metric', () => {
    expect(convertAuto(5, u('mile'), 2)!.to.id).toBe('kilometer');
  });

  it('temperature uses fixed counterparts', () => {
    expect(convertAuto(20, u('celsius'), 2)!.to.id).toBe('fahrenheit');
    expect(convertAuto(72, u('fahrenheit'), 2)!.to.id).toBe('celsius');
  });

  it('mass avoids stone as an auto target', () => {
    expect(convertAuto(70, u('kg'), 2)!.to.id).toBe('pound');
  });
});

describe('formatQuantity', () => {
  it('degree symbols attach without a space', () => {
    expect(formatQuantity(86, u('fahrenheit'), 2)).toBe('86°F');
  });
  it('regular symbols get a space and trimmed zeros', () => {
    expect(formatQuantity(6.21, u('mile'), 2)).toBe('6.21 mi');
    expect(formatQuantity(2.2, u('pound'), 2)).toBe('2.2 lb');
  });
  it('large numbers get thousands separators and honour precision', () => {
    expect(convertTo(1, u('acre'), u('sqmeter'), 2).display).toBe('4,046.86 m²');
    expect(convertTo(1, u('acre'), u('sqmeter'), 0).display).toBe('4,047 m²');
  });
});
